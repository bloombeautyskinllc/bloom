-- Payments: pending payment, recording Square payments (idempotent), late payments, refunds (pgTAP)
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Isolation: existing data must not occupy the slots these tests use (rolled back at the end)
update public.bookings set status = 'cancelled' where status in ('held', 'pending_payment', 'confirmed');
update public.business_settings set payments_enabled = true, cancellation_refund_percent = 80 where id = 1;
update public.treatments set deposit_cents = null where slug = 'hydrodermabrasion';

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('60000000-0000-0000-0000-00000000000a', 'pia@example.com', now(), '{"full_name":"Pia Pay"}', 'authenticated', 'authenticated'),
  ('60000000-0000-0000-0000-00000000000b', 'quinn@example.com', now(), '{"full_name":"Quinn Q"}', 'authenticated', 'authenticated'),
  ('60000000-0000-0000-0000-0000000000ad', 'ada@example.com', now(), '{"full_name":"Ada Admin"}', 'authenticated', 'authenticated');
update public.profiles set onboarded_at = now(), phone_e164 = '+12125550160', terms_accepted_at = now()
 where email in ('pia@example.com', 'quinn@example.com', 'ada@example.com');
update public.profiles set role = 'admin' where email = 'ada@example.com';

create temp table t (name text primary key, ts timestamptz, id uuid);
insert into t (name, ts) values
  ('at11', ((date_trunc('week', now() at time zone 'America/New_York')::date + 9) + time '11:00') at time zone 'America/New_York'),
  ('at15', ((date_trunc('week', now() at time zone 'America/New_York')::date + 9) + time '15:00') at time zone 'America/New_York'),
  ('at17', ((date_trunc('week', now() at time zone 'America/New_York')::date + 9) + time '17:00') at time zone 'America/New_York');
insert into t (name, id) select 'facial', id from public.treatments where slug = 'hydrodermabrasion';
grant all on t to authenticated;
create function pg_temp.ts(p text) returns timestamptz language sql as $$ select ts from t where name = p $$;
create function pg_temp.tid(p text) returns uuid language sql as $$ select id from t where name = p $$;
grant execute on function pg_temp.ts(text), pg_temp.tid(text) to authenticated;
create function pg_temp.as_user(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.link(p_booking text, p_order text) returns void language sql as $$
  insert into public.payment_links (booking_id, provider_link_id, provider_order_id, url, amount_cents)
  select id, 'link_' || p_order, p_order, 'https://square.link/u/' || p_order, 18000 from t where name = p_booking;
$$;

-- -----------------------------------------------------------------------------
-- With online payments on, confirming waits for the payment
-- -----------------------------------------------------------------------------
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
set local role authenticated;
insert into t (name, id) select 'pia1', booking_id from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at11'));
select is(public.submit_booking(pg_temp.tid('pia1')), 'pending_payment'::public.booking_status, 'submitting waits for payment');
select is((select payment_status::text from public.bookings where id = pg_temp.tid('pia1')), 'pending', 'payment is pending');
select ok((select hold_expires_at > now() + interval '25 minutes' from public.bookings where id = pg_temp.tid('pia1')), 'the slot is kept for the checkout');
select throws_ok($$ select public.record_payment('ord_1', 'pay_1', 18000) $$, '42501', null, 'clients cannot record payments');
select is((select count(*)::int from public.payments), 0, 'clients cannot read payment records');

-- -----------------------------------------------------------------------------
-- Square reports the payment (webhook or reconcile), possibly more than once
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.link('pia1', 'ord_1');
set local role service_role;
select is(public.record_payment('ord_1', 'pay_1', 18000, 'VISA', '1111'), 'confirmed', 'a payment confirms the booking');
select is(public.record_payment('ord_1', 'pay_1', 18000, 'VISA', '1111'), 'duplicate', 'the same payment is recorded once');
select is(public.record_payment('ord_in_store', 'pay_x', 5000), 'unknown_order', 'payments that are not ours are ignored');
reset role;
select is((select status::text from public.bookings where id = pg_temp.tid('pia1')), 'confirmed', 'the booking is confirmed');
select is((select amount_paid_cents from public.bookings where id = pg_temp.tid('pia1')), 18000, 'the paid amount is recorded once');
select is((select payment_status::text from public.bookings where id = pg_temp.tid('pia1')), 'paid', 'payment status is paid');
select is((select status::text from public.payment_links where provider_order_id = 'ord_1'), 'paid', 'the link is marked paid');
select ok(exists (select 1 from public.jobs where type = 'email.booking' and payload ->> 'booking_id' = pg_temp.tid('pia1')::text),
  'the confirmation email is queued');

-- -----------------------------------------------------------------------------
-- Cancelling with notice refunds the policy percentage of what was paid
-- -----------------------------------------------------------------------------
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
set local role authenticated;
select is(public.cancel_booking(pg_temp.tid('pia1'), 'Plans changed'), 14400, 'the client gets 80% back');
reset role;
select is((select (payload ->> 'amount_cents')::int from public.jobs where dedupe_key = 'payment.refund:cancel:' || pg_temp.tid('pia1')), 14400,
  'the refund is queued for the worker');

set local role service_role;
select ok(public.record_refund('pay_1', 'ref_1', 14400, 'pending', 'Booking cancelled'), 'the worker records the refund');
select ok(public.record_refund('pay_1', 'ref_1', 14400, 'completed'), 'the webhook completes it');
select ok(public.record_refund('pay_1', 'ref_1', 14400, 'pending'), 'a late, out-of-order webhook is accepted');
reset role;
select is((select status::text from public.refunds where provider_refund_id = 'ref_1'), 'completed', 'a final refund status never goes back');
select is((select amount_refunded_cents from public.bookings where id = pg_temp.tid('pia1')), 14400, 'the refunded amount is tracked');
select is((select payment_status::text from public.bookings where id = pg_temp.tid('pia1')), 'refunded', 'a cancelled booking with a refund shows as refunded');

-- -----------------------------------------------------------------------------
-- Late payments: reinstated if the time is still free, refunded otherwise
-- -----------------------------------------------------------------------------
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
set local role authenticated;
insert into t (name, id) select 'quinn15', booking_id from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at15'));
select public.submit_booking(pg_temp.tid('quinn15'));
insert into t (name, id) select 'quinn17', booking_id from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at17'));
select public.submit_booking(pg_temp.tid('quinn17'));
reset role;
select pg_temp.link('quinn15', 'ord_2');
select pg_temp.link('quinn17', 'ord_3');
update public.bookings set hold_expires_at = now() - interval '1 minute' where id in (pg_temp.tid('quinn15'), pg_temp.tid('quinn17'));
select public.expire_stale_holds();

-- Someone else takes 17:00 after Quinn's hold expired
select pg_temp.as_user('60000000-0000-0000-0000-00000000000a');
set local role authenticated;
insert into t (name, id) select 'pia17', booking_id from public.hold_slot(pg_temp.tid('facial'), '{}', pg_temp.ts('at17'));
reset role;

set local role service_role;
select is(public.record_payment('ord_2', 'pay_2', 18000), 'reinstated', 'a late payment keeps the booking when the time is free');
select is(public.record_payment('ord_3', 'pay_3', 18000), 'refunded', 'a late payment for a taken time is refunded');
reset role;
select is((select status::text from public.bookings where id = pg_temp.tid('quinn15')), 'confirmed', 'the reinstated booking is confirmed');
select is((select status::text from public.bookings where id = pg_temp.tid('quinn17')), 'expired', 'the released booking stays released');
select is((select (payload ->> 'amount_cents')::int from public.jobs where dedupe_key = 'payment.refund:late:pay_3'), 18000, 'a full refund is queued');

-- -----------------------------------------------------------------------------
-- Staff refunds and cancellations
-- -----------------------------------------------------------------------------
select pg_temp.as_user('60000000-0000-0000-0000-00000000000b');
set local role authenticated;
select throws_ok($$ select public.staff_request_refund(pg_temp.tid('quinn15'), 100) $$, '42501', null, 'clients cannot refund');

reset role;
select pg_temp.as_user('60000000-0000-0000-0000-0000000000ad');
set local role authenticated;
select throws_ok($$ select public.staff_request_refund(pg_temp.tid('quinn15'), 18001) $$, 'P0001', 'refund_exceeds_paid', 'refunds cannot exceed what was paid');
select lives_ok($$ select public.staff_request_refund(pg_temp.tid('quinn15'), 5000, 'Goodwill') $$, 'admins can refund part of a payment');
select throws_ok($$ select public.staff_request_refund(pg_temp.tid('quinn15'), 13001) $$, 'P0001', 'refund_exceeds_paid', 'queued refunds count against what is left');
select is(public.staff_cancel_booking(pg_temp.tid('quinn15'), 'Specialist unwell', false), 13000,
  'when the business cancels, everything left is refunded by default');

select * from finish();
rollback;
