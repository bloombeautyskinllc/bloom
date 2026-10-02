-- Booking outbox triggers and Google credential isolation (pgTAP)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('20000000-0000-0000-0000-00000000000a', 'olga@example.com', now(), '{"full_name":"Olga O"}', 'authenticated', 'authenticated');
update public.profiles set onboarded_at = now(), phone_e164 = '+12125550111' where email = 'olga@example.com';
update public.business_settings set reminder_offsets_min = '{1440,120}', review_url = 'https://g.page/r/example/review' where id = 1;

-- A booking 10 days out, created as held
create temp table t (name text primary key, id uuid);
with ins as (
  insert into public.bookings (client_id, specialist_id, status, start_at, end_at, subtotal_cents, total_cents, hold_expires_at, policy)
  select p.id, s.id, 'held',
         date_trunc('hour', now()) + interval '10 days', date_trunc('hour', now()) + interval '10 days 1 hour',
         18000, 18000, now() + interval '10 minutes', '{"cancel_cutoff_hours":24,"reschedule_cutoff_hours":24,"max_reschedules":2}'
  from public.profiles p, public.specialists s where p.email = 'olga@example.com'
  returning id
)
insert into t select 'b', id from ins;

create function pg_temp.jobs(p_type text) returns int language sql as $$
  select count(*)::int from public.jobs where type = p_type and payload ->> 'booking_id' = (select id::text from t where name = 'b')
$$;

select is(pg_temp.jobs('email.booking'), 0, 'a hold does not notify anyone');

-- Confirm
update public.bookings set status = 'confirmed', confirmed_at = now() where id = (select id from t where name = 'b');
select is(pg_temp.jobs('email.booking'), 1, 'confirming queues the client email');
select is(pg_temp.jobs('email.admin_booking'), 1, 'and the admin email');
select is(pg_temp.jobs('calendar.sync'), 1, 'and the calendar sync');
select is(pg_temp.jobs('email.reminder'), 2, 'and one reminder per configured offset (24h, 2h)');
select ok(
  (select bool_and(j.next_run_at < b.start_at) from public.jobs j, public.bookings b
    where j.type = 'email.reminder' and b.id = (select id from t where name = 'b') and j.payload ->> 'booking_id' = b.id::text),
  'reminders are scheduled before the appointment'
);
select is(pg_temp.jobs('email.review_request'), 1, 'a review request is scheduled when a review link is configured');

-- A no-op update does not notify again
update public.bookings set client_notes = 'x' where id = (select id from t where name = 'b');
select is(pg_temp.jobs('email.booking'), 1, 'unrelated updates do not notify');

-- Reschedule
update public.bookings
   set start_at = start_at + interval '1 day', end_at = end_at + interval '1 day', reschedule_count = reschedule_count + 1
 where id = (select id from t where name = 'b');
select is(pg_temp.jobs('email.booking'), 2, 'rescheduling notifies the client again');
select is(pg_temp.jobs('email.reminder'), 4, 'and schedules reminders for the new time');

-- Cancel (by the client)
update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = client_id where id = (select id from t where name = 'b');
select is(pg_temp.jobs('calendar.sync'), 3, 'cancelling removes the calendar event through a sync');
select is(
  (select payload ->> 'by' from public.jobs where type = 'email.booking' and payload ->> 'event' = 'cancelled'
     and payload ->> 'booking_id' = (select id::text from t where name = 'b')),
  'client', 'the email knows who cancelled'
);

-- Google refresh tokens: service role only
select public.store_google_credential('business', null, 'Owner@Example.com', '{calendar.events}', 'refresh-token-123');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select * from public.get_google_credential('business') $$, '42501', null, 'clients cannot read Google tokens');
reset role;
select is((select refresh_token from public.get_google_credential('business')), 'refresh-token-123', 'the server reads the token back from Vault');

select * from finish();
rollback;
