-- Back office: staff RPCs, CRM privacy and notification control (pgTAP)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Isolation: existing data (e.g. demo bookings) must not occupy the slots these tests use.
-- Everything below runs in this transaction and is rolled back at the end.
update public.bookings set status = 'cancelled' where status in ('held', 'pending_payment', 'confirmed');

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('30000000-0000-0000-0000-00000000000c', 'cleo@example.com',  now(), '{"full_name":"Cleo Client"}', 'authenticated', 'authenticated'),
  ('30000000-0000-0000-0000-00000000005f', 'sam@example.com',   now(), '{"full_name":"Sam Staff"}',   'authenticated', 'authenticated');
update public.profiles set onboarded_at = now(), phone_e164 = '+12125550150' where email in ('cleo@example.com', 'sam@example.com');
update public.profiles set role = 'staff' where email = 'sam@example.com';

create temp table t (name text primary key, id uuid, ts timestamptz);
insert into t (name, ts) values
  ('tue11', ((date_trunc('week', now() at time zone 'America/New_York')::date + 8) + time '11:00') at time zone 'America/New_York'),
  ('tue21', ((date_trunc('week', now() at time zone 'America/New_York')::date + 8) + time '21:00') at time zone 'America/New_York');
insert into t (name, id) select 'facial', id from public.treatments where slug = 'hydrodermabrasion';
grant all on t to authenticated;
create function pg_temp.v(p text) returns uuid language sql as $$ select id from t where name = p $$;
create function pg_temp.ts(p text) returns timestamptz language sql as $$ select ts from t where name = p $$;
grant execute on function pg_temp.v(text), pg_temp.ts(text) to authenticated;
create function pg_temp.as_user(p text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
$$;

-- -----------------------------------------------------------------------------
-- Clients cannot use staff tools
-- -----------------------------------------------------------------------------
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
set local role authenticated;
select throws_ok($$ select public.admin_create_booking(pg_temp.ts('tue11'), p_new_client => '{"full_name":"X Y"}', p_treatment_id => pg_temp.v('facial')) $$,
  '42501', null, 'clients cannot create bookings for others');
select throws_ok($$ select public.admin_dashboard(now(), now() + interval '1 day') $$, '42501', null, 'clients cannot read business metrics');
select is((select count(*)::int from public.client_notes), 0, 'clients see no CRM notes');

-- -----------------------------------------------------------------------------
-- Staff: custom booking for a new walk-in client, no email
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('30000000-0000-0000-0000-00000000005f');
set local role authenticated;

insert into t (name, id)
select 'walkin', public.admin_create_booking(
  pg_temp.ts('tue11'),
  p_new_client => '{"full_name":"Wendy Walk-in","email":"Wendy@Example.com","phone_e164":"+12125550177"}',
  p_treatment_id => pg_temp.v('facial'),
  p_price_cents => 15000,
  p_discount_cents => 1000,
  p_notes => 'Referred by Cleo',
  p_notify => false
);
select is((select status::text from public.bookings where id = pg_temp.v('walkin')), 'confirmed', 'admin bookings are created confirmed');
select is((select total_cents from public.bookings where id = pg_temp.v('walkin')), 14000, 'manual price minus discount');
select is((select adjustment_cents from public.bookings where id = pg_temp.v('walkin')), -3000, 'the adjustment against the catalog price is recorded');
select is((select source::text from public.bookings where id = pg_temp.v('walkin')), 'admin', 'the source is admin');
select is((select email from public.profiles where id = (select client_id from public.bookings where id = pg_temp.v('walkin'))), 'wendy@example.com', 'the new client is created with a normalized email');

reset role;
select is((select count(*)::int from public.jobs where type = 'email.booking' and payload ->> 'booking_id' = pg_temp.v('walkin')::text), 0, 'notify=false: no client email');
select is((select count(*)::int from public.jobs where type = 'calendar.sync' and payload ->> 'booking_id' = pg_temp.v('walkin')::text), 1, 'but the calendar is still synced');
select is((select count(*)::int from public.jobs where type = 'email.admin_booking' and payload ->> 'booking_id' = pg_temp.v('walkin')::text), 1, 'and staff are still notified');
select pg_temp.as_user('30000000-0000-0000-0000-00000000005f');
set local role authenticated;

-- Same email again: the existing client is reused, not duplicated
select lives_ok($$ insert into t (name, id) select 'walkin2', public.admin_create_booking(
  pg_temp.ts('tue11') + interval '2 hours', p_new_client => '{"full_name":"Wendy W","email":"wendy@example.com"}', p_custom => '{"name":"Brow touch-up","duration_minutes":30,"price_cents":5000}') $$,
  'a custom service can be booked');
select is((select client_id from public.bookings where id = pg_temp.v('walkin2')), (select client_id from public.bookings where id = pg_temp.v('walkin')), 'an existing client is matched by email');
select is((select kind || ':' || name from public.booking_items where booking_id = pg_temp.v('walkin2')), 'custom:Brow touch-up', 'the custom service is snapshotted');

-- Rules
select throws_ok($$ select public.admin_create_booking(pg_temp.ts('tue21'), p_client_id => (select client_id from public.bookings where id = pg_temp.v('walkin')), p_treatment_id => pg_temp.v('facial')) $$,
  'P0001', 'outside_availability', 'outside working hours is refused without an override');
select throws_ok($$ select public.admin_create_booking(pg_temp.ts('tue21'), p_client_id => (select client_id from public.bookings where id = pg_temp.v('walkin')), p_treatment_id => pg_temp.v('facial'), p_override_rules => true) $$,
  'P0001', 'override_reason_required', 'an override needs a reason');
select lives_ok($$ insert into t (name, id) select 'late', public.admin_create_booking(pg_temp.ts('tue21'), p_client_id => (select client_id from public.bookings where id = pg_temp.v('walkin')),
  p_treatment_id => pg_temp.v('facial'), p_override_rules => true, p_override_reason => 'VIP after-hours visit') $$, 'with a reason, staff can book outside the rules');
select throws_ok($$ select public.staff_reschedule_booking(pg_temp.v('walkin2'), pg_temp.ts('tue11'), p_override => true, p_reason => 'test') $$,
  'P0001', 'slot_taken', 'even an override can never double-book');

-- Status and notes
select throws_ok($$ select public.staff_set_booking_status(pg_temp.v('walkin'), 'completed') $$, 'P0001', 'not_started', 'future bookings cannot be marked attended');
select lives_ok($$ insert into public.booking_notes (booking_id, author_id, body) values (pg_temp.v('walkin'), private.current_profile_id(), 'Prefers morning slots') $$, 'staff add internal notes');

reset role;
select pg_temp.as_user('30000000-0000-0000-0000-00000000000c');
set local role authenticated;
select is((select count(*)::int from public.booking_notes), 0, 'clients never see internal notes');

reset role;
select ok((select count(*) from public.audit_log where action = 'bookings.insert' and (after ->> 'rules_overridden')::boolean) >= 1, 'overrides are in the audit log');

select * from finish();
rollback;
