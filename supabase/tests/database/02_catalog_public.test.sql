-- Public catalog access (pgTAP)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*)::int from public.service_categories), 4, 'anonymous visitors read the 4 categories');
select ok((select count(*) from public.treatments) > 0, 'anonymous visitors read active treatments');
select throws_ok($$ select * from public.business_settings $$, '42501', null, 'anonymous visitors cannot read settings');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anonymous visitors cannot read profiles');

reset role;
update public.treatments set is_active = false where slug = 'back-facial';

set local role anon;
select is((select count(*)::int from public.treatments where slug = 'back-facial'), 0, 'inactive treatments are hidden from the public');
select throws_ok(
  $$ update public.treatments set price_cents = 1 $$,
  '42501', null, 'anonymous visitors cannot change prices'
);

reset role;
select * from finish();
rollback;
