-- Deposit at booking (percentage or fixed per treatment) and paying the balance afterwards (pgTAP)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

update public.bookings set status = 'cancelled' where status in ('held', 'pending_payment', 'confirmed');
update public.business_settings set payments_enabled = true, deposit_percent = 40 where id = 1;
update public.treatments set deposit_cents = null where slug = 'hydrodermabrasion';

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('70000000-0000-0000-0000-00000000000a', 'dora@example.com', now(), '{"full_name":"Dora Deposit"}', 'authenticated', 'authenticated');
update public.profiles set onboarded_at = now(), phone_e164 = '+12125550170', terms_accepted_at = now() where email = 'dora@example.com';

create temp table t (name text primary key, ts timestamptz, id uuid);
insert into t (name, ts) values
  ('at11', ((date_trunc('week', now() at time zone 'America/New_York')::date + 10) + time '11:00') at time zone 'America/New_York'),
  ('at15', ((date_trunc('week', now() at time zone 'America/New_York')::date + 10) + time '15:00') at time zone 'America/New_York');
insert into t (name, id) select 'facial', id from public.treatments where slug = 'hydrodermabrasion';
grant all on t to authenticated;
create function pg_temp.ts(p text) returns timestamptz language sql as $$ select ts from t where name = p $$;
create function pg_temp.tid(p text) returns uuid language sql as $$ select id from t where name = p $$;
grant execute on function pg_temp.ts(text), pg_temp.tid(text) to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '70000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);

-- 40% of $180
set local role authenticated;
insert into t (name, id) select 'pct', booking_id from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at11'));
reset role;
select is((select amount_due_cents from public.bookings where id = pg_temp.tid('pct')), 7200, 'the deposit is 40% of the price by default');

-- A fixed deposit on the treatment wins over the percentage
update public.treatments set deposit_cents = 5000 where slug = 'hydrodermabrasion';
set local role authenticated;
select public.submit_booking(pg_temp.tid('pct'));
insert into t (name, id) select 'fixed', booking_id from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at15'));
reset role;
select is((select amount_due_cents from public.bookings where id = pg_temp.tid('fixed')), 5000, 'a fixed treatment deposit overrides the percentage');
select is((public.get_public_settings() ->> 'deposit_percent')::int, 40, 'visitors can see the deposit percentage');

-- Deposit, then the balance through a second link
insert into public.payment_links (booking_id, provider_link_id, provider_order_id, url, amount_cents)
values (pg_temp.tid('pct'), 'link_dep', 'ord_dep', 'https://square.link/u/dep', 7200);
set local role service_role;
select is(public.record_payment('ord_dep', 'pay_dep', 7200), 'confirmed', 'the deposit confirms the booking');
reset role;
select is((select payment_status::text from public.bookings where id = pg_temp.tid('pct')), 'partially_paid', 'a deposit leaves the booking partially paid');

insert into public.payment_links (booking_id, kind, provider_link_id, provider_order_id, url, amount_cents)
values (pg_temp.tid('pct'), 'balance', 'link_bal', 'ord_bal', 'https://square.link/u/bal', 10800);
set local role service_role;
select is(public.record_payment('ord_bal', 'pay_bal', 10800), 'recorded', 'the balance is recorded on the confirmed booking');
reset role;
select is((select amount_paid_cents from public.bookings where id = pg_temp.tid('pct')), 18000, 'deposit and balance add up');
select is((select payment_status::text from public.bookings where id = pg_temp.tid('pct')), 'paid', 'the booking is fully paid');

select * from finish();
rollback;
