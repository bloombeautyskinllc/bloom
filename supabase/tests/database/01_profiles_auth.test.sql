-- Profiles, roles, onboarding and audit log: RLS and integrity tests (pgTAP)
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- -----------------------------------------------------------------------------
-- Fixtures (as postgres)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', now(), '{"full_name":"Alice A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com',   now(), '{"name":"Bob B"}',        'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com', now(), '{}',                      'authenticated', 'authenticated');

select is(
  (select count(*)::int from public.profiles where user_id in (
    '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000ad')),
  3, 'sign-up trigger creates one profile per auth user'
);
select is((select full_name from public.profiles where email = 'alice@example.com'), 'Alice A', 'profile name comes from Google full_name');
select is((select full_name from public.profiles where email = 'bob@example.com'), 'Bob B', 'profile name falls back to Google name');

update public.profiles set role = 'admin' where email = 'admin@example.com'; -- as system (allowlist path)
select is((select role::text from public.profiles where email = 'admin@example.com'), 'admin', 'system can grant admin (email allowlist)');

-- Walk-in client created by the business, then signs in with the same verified email
insert into public.profiles (email, full_name) values ('carol@example.com', 'Carol Walk-in');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
values ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', now(), '{"full_name":"Carol G"}', 'authenticated', 'authenticated');
select is((select count(*)::int from public.profiles where email = 'carol@example.com'), 1, 'verified sign-in links the existing profile instead of duplicating it');
select is((select full_name from public.profiles where email = 'carol@example.com'), 'Carol Walk-in', 'linking keeps the name the business entered');

-- Same, but the email is confirmed only after the auth user is created
insert into public.profiles (email, full_name) values ('dan@example.com', 'Dan Walk-in');
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values ('00000000-0000-0000-0000-00000000000d', 'dan@example.com', '{"full_name":"Dan G"}', 'authenticated', 'authenticated');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000d';
select is((select count(*)::int from public.profiles where user_id = '00000000-0000-0000-0000-00000000000d'), 1, 'confirming the email later still leaves exactly one profile');
select is((select full_name from public.profiles where user_id = '00000000-0000-0000-0000-00000000000d'), 'Dan Walk-in', 'and it is the existing profile, now linked');

-- -----------------------------------------------------------------------------
-- As Alice (client)
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'client sees only their own profile');
select is((select email from public.profiles), 'alice@example.com', 'the visible profile is their own');

update public.profiles set full_name = 'Hacked' where email = 'bob@example.com';
select is((select count(*)::int from public.profiles where full_name = 'Hacked'), 0, 'client cannot update another client');

select throws_ok(
  $$ update public.profiles set role = 'admin' where user_id = auth.uid() $$,
  '42501', null, 'client cannot promote themselves'
);
select throws_ok(
  $$ update public.profiles set onboarded_at = now() where user_id = auth.uid() $$,
  '42501', null, 'client cannot write system columns directly'
);
select throws_ok(
  $$ update public.profiles set email = 'x@example.com' where user_id = auth.uid() $$,
  '42501', null, 'client cannot change the email that comes from Google'
);
select lives_ok(
  $$ update public.profiles set full_name = 'Alice Updated', reminders_opt_in = true where user_id = auth.uid() $$,
  'client can edit their own name and preferences'
);

select throws_ok(
  $$ select public.complete_onboarding('Alice', '+12125550123', false) $$,
  '22023', null, 'onboarding requires accepting the terms'
);
select throws_ok(
  $$ select public.complete_onboarding('Alice', '2125550123', true) $$,
  '22023', null, 'onboarding requires an E.164 phone'
);
select is(public.complete_onboarding('Alice A', '+12125550123', true, true), true, 'first onboarding returns true');
select is(public.complete_onboarding('Alice A', '+12125550124', true, true), false, 'repeated onboarding returns false');

select is((select count(*)::int from public.audit_log), 0, 'client cannot read the audit log');
select throws_ok(
  $$ insert into public.treatments (category_id, slug, name, price_cents) select id, 'x', 'X', 1 from public.service_categories limit 1 $$,
  '42501', null, 'client cannot write the catalog'
);
select throws_ok(
  $$ select public.log_app_event('fake', 'x') $$,
  '42501', null, 'client cannot write application audit events'
);

reset role;

-- -----------------------------------------------------------------------------
-- Effects checked as postgres
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.jobs where type = 'email.welcome'
     and payload ->> 'profile_id' = (select id::text from public.profiles where email = 'alice@example.com')),
  1, 'welcome email is enqueued exactly once'
);

-- -----------------------------------------------------------------------------
-- As admin
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';

select ok((select count(*) from public.audit_log where action = 'profiles.update') > 0, 'admin reads the audit log, including profile changes');
select throws_ok(
  $$ delete from public.audit_log $$,
  '42501', null, 'even admins cannot delete audit entries'
);

reset role;
select throws_ok(
  $$ update public.audit_log set action = 'tampered' $$,
  '42501', null, 'audit log rejects updates even for postgres'
);

select * from finish();
rollback;
