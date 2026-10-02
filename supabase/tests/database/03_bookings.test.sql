-- Bookings: double-booking prevention, server-side pricing, policy and RLS (pgTAP)
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Isolation: existing data (e.g. demo bookings) must not occupy the slots these tests use.
-- Everything below runs in this transaction and is rolled back at the end.
update public.bookings set status = 'cancelled' where status in ('held', 'pending_payment', 'confirmed');

-- -----------------------------------------------------------------------------
-- Fixtures (as postgres)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('10000000-0000-0000-0000-00000000000a', 'ana@example.com', now(), '{"full_name":"Ana A"}', 'authenticated', 'authenticated'),
  ('10000000-0000-0000-0000-00000000000b', 'bea@example.com', now(), '{"full_name":"Bea B"}', 'authenticated', 'authenticated');
update public.profiles set onboarded_at = now(), phone_e164 = '+12125550100', terms_accepted_at = now()
 where email in ('ana@example.com', 'bea@example.com');

-- Next week's Tuesday, 11:00 in New York (always inside the 60-day window and past the 2h notice)
create temp table t (name text primary key, ts timestamptz, id uuid);
insert into t (name, ts) values
  ('day', ((date_trunc('week', now() at time zone 'America/New_York')::date + 8) + time '00:00') at time zone 'America/New_York');
insert into t (name, ts) select 'at11', ts + interval '11 hours' from t where name = 'day';
insert into t (name, ts) select 'at1145', ts + interval '11 hours 45 minutes' from t where name = 'day';
insert into t (name, ts) select 'at1215', ts + interval '12 hours 15 minutes' from t where name = 'day';
insert into t (name, ts) select 'at15', ts + interval '15 hours' from t where name = 'day';
insert into t (name, ts) select 'at21', ts + interval '21 hours' from t where name = 'day';
insert into t (name, id) select 'facial', id from public.treatments where slug = 'hydrodermabrasion';
insert into t (name, id) select 'laser', id from public.treatments where slug = 'diode-laser-session';
grant all on t to authenticated;

create function pg_temp.ts(p text) returns timestamptz language sql as $$ select ts from t where name = p $$;
create function pg_temp.tid(p text) returns uuid language sql as $$ select id from t where name = p $$;
grant execute on function pg_temp.ts(text), pg_temp.tid(text) to authenticated;

create function pg_temp.as_user(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
$$;

-- -----------------------------------------------------------------------------
-- Ana holds Tuesday 11:00 (60 min + 15 min cleanup)
-- -----------------------------------------------------------------------------
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
set local role authenticated;

insert into t (name, id)
select 'ana1', booking_id from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at11'), null, 'key-ana-1');

select is((select status::text from public.bookings where id = pg_temp.tid('ana1')), 'held', 'a hold is created');
select is((select total_cents from public.bookings where id = pg_temp.tid('ana1')), 18000, 'price comes from the catalog ($180)');
select is((select end_at - start_at from public.bookings where id = pg_temp.tid('ana1')), interval '60 minutes', 'duration comes from the catalog');
select is((select name from public.booking_items where booking_id = pg_temp.tid('ana1')), 'Hydrodermabrasion Treatment', 'the treatment is snapshotted on the booking');
select is(
  (select booking_id from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at11'), null, 'key-ana-1')),
  pg_temp.tid('ana1'),
  'retrying with the same idempotency key returns the same booking'
);
select throws_ok($$ insert into public.bookings (client_id, specialist_id, start_at, end_at, subtotal_cents, total_cents)
  select client_id, specialist_id, start_at, end_at, 0, 0 from public.bookings limit 1 $$, '42501', null, 'clients cannot insert bookings directly');
select throws_ok($$ update public.bookings set total_cents = 1 $$, '42501', null, 'clients cannot change prices');

-- -----------------------------------------------------------------------------
-- Bea tries the same and overlapping times
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
set local role authenticated;

select throws_ok($$ select * from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at11')) $$, 'P0001', 'slot_taken', 'the same slot cannot be booked twice');
select throws_ok($$ select * from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at1145')) $$, 'P0001', 'slot_taken', 'overlapping slots are rejected');
select lives_ok($$ insert into t (name, id) select 'bea1', booking_id from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at1215')) $$,
  'the slot right after the cleanup buffer is free');
select is((select count(*)::int from public.bookings), 1, 'a client only sees their own bookings');
select is((select count(*)::int from public.get_busy_ranges(pg_temp.ts('day'), pg_temp.ts('day') + interval '1 day')), 2,
  'busy ranges expose occupied time without client data');

select throws_ok($$ select * from public.hold_slot(pg_temp.tid('facial'), '{}', now() + interval '30 minutes') $$, 'P0001', 'too_soon', 'minimum notice is enforced');
select throws_ok($$ select * from public.hold_slot(pg_temp.tid('facial'), '{}', now() + interval '90 days') $$, 'P0001', 'too_far', 'the booking window is enforced');
select throws_ok($$ select * from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at21')) $$, 'P0001', 'slot_taken', 'times outside working hours are rejected');
select throws_ok($$ select * from public.hold_slot(pg_temp.tid('laser'), '{}', pg_temp.ts('at15')) $$, 'P0001', 'invalid_options', 'laser needs at least one area');

select lives_ok($$ insert into t (name, id) select 'bea_laser', booking_id from public.hold_slot(
  pg_temp.tid('laser'),
  array(select id from public.treatment_options where slug in ('laser-upper-lip', 'laser-underarms')),
  pg_temp.ts('at15')) $$, 'laser with two areas can be held');
select is((select total_cents from public.bookings where id = pg_temp.tid('bea_laser')), 9500, 'areas add up ($40 + $55)');
select is((select end_at - start_at from public.bookings where id = pg_temp.tid('bea_laser')), interval '25 minutes', 'durations add up (10 + 5 + 10 min)');
select is((select status::text from public.bookings where id = pg_temp.tid('bea1')), 'expired', 'holding a new time releases the client''s previous hold');

-- -----------------------------------------------------------------------------
-- Ana confirms, reschedules and cancels
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
set local role authenticated;

select is(public.submit_booking(pg_temp.tid('ana1'), '  First visit  '), 'confirmed'::public.booking_status, 'without online payments the booking is confirmed');
select is((select client_notes from public.bookings where id = pg_temp.tid('ana1')), 'First visit', 'notes are trimmed and stored');
select lives_ok($$ select * from public.reschedule_booking(pg_temp.tid('ana1'), pg_temp.ts('at11') + interval '1 day') $$, 'a confirmed booking can be rescheduled');
select is((select reschedule_count from public.bookings where id = pg_temp.tid('ana1')), 1, 'reschedules are counted');

reset role;
update public.bookings set reschedule_count = 2 where id = pg_temp.tid('ana1');
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok($$ select * from public.reschedule_booking(pg_temp.tid('ana1'), pg_temp.ts('at11')) $$, 'P0001', 'max_reschedules', 'the reschedule limit is enforced');

select lives_ok($$ select public.cancel_booking(pg_temp.tid('ana1'), 'Travelling') $$, 'cancelling with notice is allowed');

-- A confirmed booking 3 hours away is inside the 24h cancellation cutoff
reset role;
with ins as (
  insert into public.bookings (client_id, specialist_id, status, start_at, end_at, subtotal_cents, total_cents, policy)
  select p.id, s.id, 'confirmed', date_trunc('hour', now()) + interval '3 hours', date_trunc('hour', now()) + interval '4 hours', 100, 100,
         '{"cancel_cutoff_hours": 24, "reschedule_cutoff_hours": 24, "max_reschedules": 2}'
  from public.profiles p, public.specialists s where p.email = 'ana@example.com'
  returning id
)
insert into t (name, id) select 'late', id from ins;

select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
set local role authenticated;
select throws_ok($$ select public.cancel_booking(pg_temp.tid('late')) $$, 'P0001', 'outside_policy', 'late cancellations are blocked online');

-- -----------------------------------------------------------------------------
-- The constraint itself, and expired holds
-- -----------------------------------------------------------------------------
reset role;
select throws_ok($$
  insert into public.bookings (client_id, specialist_id, status, start_at, end_at, subtotal_cents, total_cents)
  select p.id, s.id, 'confirmed', pg_temp.ts('at11') + interval '2 days', pg_temp.ts('at11') + interval '2 days 1 hour', 1, 1
  from public.profiles p, public.specialists s where p.email in ('ana@example.com', 'bea@example.com')
$$, '23P01', null, 'the database rejects overlapping bookings even for direct inserts');

update public.bookings set hold_expires_at = now() - interval '1 minute' where id = pg_temp.tid('bea_laser');
select pg_temp.as_user('10000000-0000-0000-0000-00000000000a');
set local role authenticated;
select lives_ok($$ select * from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at15')) $$, 'an expired hold no longer blocks its slot');

-- -----------------------------------------------------------------------------
-- Account deletion keeps history but removes personal data
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.as_user('10000000-0000-0000-0000-00000000000b');
set local role authenticated;
select lives_ok($$ select public.delete_my_account() $$, 'a client can delete their account');
reset role;
select ok(
  (select email is null and full_name is null and phone_e164 is null and anonymized_at is not null and user_id is null
     from public.profiles where id = (select client_id from public.bookings where id = pg_temp.tid('bea_laser'))),
  'the profile is anonymized'
);
select is(
  (select count(*)::int from public.bookings b join public.profiles p on p.id = b.client_id
    where p.anonymized_at is not null and b.status in ('held', 'pending_payment', 'confirmed')),
  0, 'their future bookings are released'
);
select ok((select count(*) from public.audit_log where action = 'bookings.insert') >= 3, 'every booking is in the audit log');

select * from finish();
rollback;
