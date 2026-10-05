-- =============================================================================
-- Online payments (Square): hosted payment links, payments and refunds.
--
-- Square is the source of truth. The app creates one hosted payment link per booking awaiting
-- payment. Payments are recorded through public.record_payment (idempotent per Square payment),
-- fed by verified webhooks and by polling the link's order (return page + pg_cron reconcile),
-- so a missed webhook never loses a payment. Refunds (cancellations, late payments, staff) are
-- queued as jobs and executed by the worker, which records them through public.record_refund.
-- =============================================================================

create type public.link_status as enum ('open', 'paid', 'cancelled');
create type public.refund_status as enum ('pending', 'completed', 'failed', 'rejected');

-- Running totals, kept by private.sync_payment_totals (payment_status is derived from them)
alter table public.bookings
  add column amount_paid_cents     integer not null default 0 check (amount_paid_cents >= 0),
  add column amount_refunded_cents integer not null default 0 check (amount_refunded_cents >= 0);

create table public.payment_links (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings (id) on delete cascade,
  provider          text not null default 'square',
  provider_link_id  text not null unique,
  provider_order_id text not null unique,
  url               text not null,
  amount_cents      integer not null check (amount_cents > 0),
  currency          char(3) not null default 'USD',
  status            public.link_status not null default 'open',
  paid_at           timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- A booking never has two payable links at once (a double click reuses the first one)
create unique index payment_links_one_open_idx on public.payment_links (booking_id) where status = 'open';

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings (id),
  provider            text not null default 'square',
  provider_payment_id text not null unique,
  provider_order_id   text,
  amount_cents        integer not null check (amount_cents > 0),
  currency            char(3) not null default 'USD',
  card_brand          text,
  card_last4          text,
  receipt_url         text,
  paid_at             timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index payments_booking_idx on public.payments (booking_id);

create table public.refunds (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings (id),
  payment_id         uuid not null references public.payments (id),
  provider_refund_id text not null unique,
  amount_cents       integer not null check (amount_cents > 0),
  status             public.refund_status not null default 'pending',
  reason             text,
  requested_by       uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index refunds_booking_idx on public.refunds (booking_id);

create trigger payment_links_set_updated_at before update on public.payment_links
  for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();
create trigger refunds_set_updated_at before update on public.refunds
  for each row execute function private.set_updated_at();

create trigger payment_links_audit after insert or update or delete on public.payment_links
  for each row execute function private.audit_row();
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function private.audit_row();
create trigger refunds_audit after insert or update or delete on public.refunds
  for each row execute function private.audit_row();

alter table public.payment_links enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;

-- Clients see their totals on the booking; the payment records are for staff
create policy "payment_links: staff read" on public.payment_links for select to authenticated using ((select private.is_staff()));
create policy "payments: staff read" on public.payments for select to authenticated using ((select private.is_staff()));
create policy "refunds: staff read" on public.refunds for select to authenticated using ((select private.is_staff()));

revoke all on public.payment_links, public.payments, public.refunds from anon;
revoke insert, update, delete on public.payment_links, public.payments, public.refunds from authenticated;
grant select on public.payment_links, public.payments, public.refunds to authenticated;

-- =============================================================================
-- Helpers
-- =============================================================================

-- Recomputes paid/refunded totals and payment_status from the records
create function private.sync_payment_totals(p_booking_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.bookings b
     set amount_paid_cents = t.paid,
         amount_refunded_cents = t.refunded,
         payment_status = case
           when t.paid = 0 then b.payment_status
           when t.refunded >= t.paid then 'refunded'
           when t.refunded > 0 and b.status in ('cancelled', 'expired') then 'refunded'
           when t.paid - t.refunded >= b.total_cents then 'paid'
           else 'partially_paid'
         end::public.payment_status
    from (
      select
        coalesce((select sum(p.amount_cents) from public.payments p where p.booking_id = p_booking_id), 0)::int as paid,
        coalesce((select sum(r.amount_cents) from public.refunds r
                  where r.booking_id = p_booking_id and r.status in ('pending', 'completed')), 0)::int as refunded
    ) t
   where b.id = p_booking_id;
$$;

-- Refunds queued for the worker but not yet sent to Square
create function private.queued_refund_cents(p_booking_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum((j.payload ->> 'amount_cents')::int), 0)::int
  from public.jobs j
  where j.type = 'payment.refund' and j.status in ('queued', 'running', 'failed')
    and j.payload ->> 'booking_id' = p_booking_id::text;
$$;

-- Paid online and still refundable (recorded and queued refunds deducted)
create function private.refundable_cents(p_booking public.bookings)
returns integer
language sql
stable
set search_path = ''
as $$
  select greatest(p_booking.amount_paid_cents - p_booking.amount_refunded_cents - private.queued_refund_cents(p_booking.id), 0);
$$;

-- What the client gets back under the policy in force when they booked (null = nothing)
create function private.policy_refund_cents(p_booking public.bookings)
returns integer
language sql
stable
set search_path = ''
as $$
  select nullif(floor(
    private.refundable_cents(p_booking)
    * case
        when p_booking.start_at - now() >= make_interval(hours => coalesce((p_booking.policy ->> 'cancel_cutoff_hours')::int, 0))
          then coalesce((p_booking.policy ->> 'cancellation_refund_percent')::int, 100)
        else coalesce((p_booking.policy ->> 'late_cancellation_refund_percent')::int, 0)
      end / 100.0
  )::int, 0);
$$;

-- =============================================================================
-- Cancellations now refund what was actually paid
-- =============================================================================

-- Client (within policy) or staff (always) cancels. Returns the refund owed in cents, if any.
-- Staff choose the refund through app.refund_mode (see staff_cancel_booking); clients get the policy.
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_actor   uuid := private.current_profile_id();
  v_staff   boolean := private.is_staff();
  v_mode    text;
  v_refund  integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or (v_booking.client_id <> v_actor and not v_staff) then raise exception 'not_found'; end if;
  if v_booking.status not in ('held', 'pending_payment', 'confirmed') then raise exception 'not_cancellable'; end if;

  if v_booking.status = 'confirmed' and not v_staff
     and v_booking.start_at - now() < make_interval(hours => (v_booking.policy ->> 'cancel_cutoff_hours')::int) then
    raise exception 'outside_policy';
  end if;

  v_mode := case when v_staff then coalesce(nullif(current_setting('app.refund_mode', true), ''), 'policy') else 'policy' end;
  v_refund := case v_mode
    when 'full' then nullif(private.refundable_cents(v_booking), 0)
    when 'none' then null
    else private.policy_refund_cents(v_booking)
  end;

  perform private.begin_trusted_rpc();
  update public.bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = v_actor,
         cancellation_reason = left(nullif(trim(p_reason), ''), 500), refund_due_cents = v_refund, hold_expires_at = null
   where id = p_booking_id;

  return v_refund;
end;
$$;

-- When the business cancels, the terms promise a full refund; staff may choose the policy amount or none
drop function public.staff_cancel_booking(uuid, text, boolean);
create function public.staff_cancel_booking(
  p_booking_id uuid,
  p_reason     text default null,
  p_notify     boolean default true,
  p_refund     text default 'full'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  if p_refund not in ('full', 'policy', 'none') then raise exception 'invalid_refund'; end if;
  perform set_config('app.notify_client', case when p_notify then 'on' else 'off' end, true);
  perform set_config('app.refund_mode', p_refund, true);
  return public.cancel_booking(p_booking_id, p_reason);
end;
$$;

grant execute on function public.staff_cancel_booking(uuid, text, boolean, text) to authenticated;

-- Account deletion also refunds paid future bookings under the policy
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and deleted_at is null for update;
  if not found then raise exception 'not_found'; end if;

  perform private.begin_trusted_rpc();

  update public.bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = v_profile.id,
         cancellation_reason = 'Account deleted by the client', hold_expires_at = null,
         refund_due_cents = private.policy_refund_cents(bookings)
   where client_id = v_profile.id and status in ('held', 'pending_payment', 'confirmed') and start_at > now();

  update public.profiles
     set full_name = null, email = null, phone_e164 = null, avatar_url = null, reminders_opt_in = false,
         user_id = null, anonymized_at = now(), deleted_at = now()
   where id = v_profile.id;
end;
$$;

-- Square payment links do not expire on their own: keep the slot while the client pays
create or replace function public.submit_booking(p_booking_id uuid, p_notes text default null, p_intake jsonb default null)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking  public.bookings;
  v_settings public.business_settings;
  v_form     public.intake_forms;
begin
  select b.* into v_booking from public.bookings b
  join public.profiles p on p.id = b.client_id
  where b.id = p_booking_id and p.user_id = auth.uid()
  for update of b;
  if not found then raise exception 'not_found'; end if;
  if v_booking.status <> 'held' then raise exception 'not_held'; end if;
  if v_booking.hold_expires_at < now() then raise exception 'hold_expired'; end if;

  select f.* into v_form
  from public.booking_items i
  join public.treatments t on t.id = i.treatment_id
  join public.intake_forms f on f.id = t.intake_form_id
  where i.booking_id = p_booking_id and i.kind = 'treatment';

  if found then
    if p_intake is null or jsonb_typeof(p_intake) <> 'object' then raise exception 'intake_required'; end if;
    insert into public.intake_responses (booking_id, form_id, form_version, answers)
    values (p_booking_id, v_form.id, v_form.version, p_intake)
    on conflict (booking_id) do update set answers = excluded.answers, submitted_at = now();
  end if;

  select * into v_settings from public.business_settings where id = 1;
  perform private.begin_trusted_rpc();

  if v_settings.payments_enabled and v_booking.amount_due_cents > 0 then
    -- 30 minutes to pay; when it runs out the link is deleted and the slot released
    update public.bookings
       set status = 'pending_payment', payment_status = 'pending',
           client_notes = nullif(trim(p_notes), ''), hold_expires_at = now() + interval '30 minutes'
     where id = p_booking_id;
    return 'pending_payment'::public.booking_status;
  end if;

  update public.bookings
     set status = 'confirmed', confirmed_at = now(), hold_expires_at = null,
         client_notes = nullif(trim(p_notes), '')
   where id = p_booking_id;
  return 'confirmed'::public.booking_status;
end;
$$;

-- =============================================================================
-- Worker / webhook API (service role only)
-- =============================================================================

-- Records one Square payment for the order of one of our links. Idempotent per payment.
-- Returns: unknown_order (not ours, e.g. an in-store sale), duplicate, confirmed, reinstated
-- (paid just after the hold ran out and the time was still free), recorded, or refunded
-- (the booking can no longer be honored: a full refund is queued).
create function public.record_payment(
  p_provider_order_id   text,
  p_provider_payment_id text,
  p_amount_cents        integer,
  p_card_brand          text default null,
  p_card_last4          text default null,
  p_receipt_url         text default null,
  p_paid_at             timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link       public.payment_links;
  v_booking    public.bookings;
  v_payment_id uuid;
  v_outcome    text;
begin
  select * into v_link from public.payment_links where provider_order_id = p_provider_order_id;
  if not found then return 'unknown_order'; end if;

  select * into v_booking from public.bookings where id = v_link.booking_id for update;

  insert into public.payments (booking_id, provider, provider_payment_id, provider_order_id, amount_cents, card_brand, card_last4, receipt_url, paid_at)
  values (v_booking.id, v_link.provider, p_provider_payment_id, p_provider_order_id, p_amount_cents, p_card_brand, p_card_last4, p_receipt_url, coalesce(p_paid_at, now()))
  on conflict (provider_payment_id) do nothing
  returning id into v_payment_id;
  if v_payment_id is null then return 'duplicate'; end if;

  perform private.begin_trusted_rpc();
  update public.payment_links set status = 'paid', paid_at = coalesce(p_paid_at, now()) where id = v_link.id;

  if v_booking.status = 'pending_payment' then
    update public.bookings set status = 'confirmed', confirmed_at = now(), hold_expires_at = null where id = v_booking.id;
    v_outcome := 'confirmed';
  elsif v_booking.status = 'expired' and v_booking.start_at > now() then
    begin
      perform private.expire_overlapping_holds(v_booking.specialist_id, v_booking.blocked_range);
      update public.bookings set status = 'confirmed', confirmed_at = now(), hold_expires_at = null where id = v_booking.id;
      v_outcome := 'reinstated';
    exception when exclusion_violation then
      v_outcome := 'refunded';
    end;
  elsif v_booking.status in ('confirmed', 'completed', 'no_show') then
    v_outcome := 'recorded';
  else
    v_outcome := 'refunded';
  end if;

  perform private.sync_payment_totals(v_booking.id);

  if v_outcome = 'refunded' then
    perform private.enqueue_job(
      'payment.refund',
      jsonb_build_object('booking_id', v_booking.id, 'payment_id', v_payment_id, 'amount_cents', p_amount_cents,
                         'reason', 'Paid after the booking was released'),
      'payment.refund:late:' || p_provider_payment_id);
  end if;

  return v_outcome;
end;
$$;

-- Records (or updates the status of) a Square refund of one of our payments. Status never moves
-- back from a final state, so out-of-order webhooks are harmless. Returns false if the payment is not ours.
create function public.record_refund(
  p_provider_payment_id text,
  p_provider_refund_id  text,
  p_amount_cents        integer,
  p_status              public.refund_status,
  p_reason              text default null,
  p_requested_by        uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where provider_payment_id = p_provider_payment_id;
  if not found then return false; end if;

  perform 1 from public.bookings where id = v_payment.booking_id for update;
  perform private.begin_trusted_rpc();

  insert into public.refunds as r (booking_id, payment_id, provider_refund_id, amount_cents, status, reason, requested_by)
  values (v_payment.booking_id, v_payment.id, p_provider_refund_id, p_amount_cents, p_status, left(p_reason, 500), p_requested_by)
  on conflict (provider_refund_id) do update
    set status = case when r.status in ('completed', 'failed', 'rejected') then r.status else excluded.status end,
        reason = coalesce(r.reason, excluded.reason),
        requested_by = coalesce(r.requested_by, excluded.requested_by);

  perform private.sync_payment_totals(v_payment.booking_id);
  return true;
end;
$$;

revoke execute on function
  public.record_payment(text, text, integer, text, text, text, timestamptz),
  public.record_refund(text, text, integer, public.refund_status, text, uuid)
  from public, anon, authenticated;
grant execute on function
  public.record_payment(text, text, integer, text, text, text, timestamptz),
  public.record_refund(text, text, integer, public.refund_status, text, uuid)
  to service_role;

-- =============================================================================
-- Staff: manual refund (admins only). Queued for the worker, which talks to Square.
-- =============================================================================
create function public.staff_request_refund(p_booking_id uuid, p_amount_cents integer, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'invalid_amount'; end if;
  -- Refunds already queued but not yet sent to Square count against what is left
  if p_amount_cents > private.refundable_cents(v_booking) then raise exception 'refund_exceeds_paid'; end if;

  perform private.enqueue_job(
    'payment.refund',
    jsonb_build_object('booking_id', p_booking_id, 'amount_cents', p_amount_cents,
                       'reason', coalesce(left(nullif(trim(p_reason), ''), 500), 'Refund by staff'),
                       'requested_by', private.current_profile_id()));
end;
$$;

grant execute on function public.staff_request_refund(uuid, integer, text) to authenticated;

-- =============================================================================
-- Outbox: refunds on cancellation, and closing the payment link when a booking stops waiting
-- =============================================================================
create function private.enqueue_payment_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Paid, expired, cancelled or confirmed by staff: reconcile the link (record a payment that
  -- slipped in, otherwise delete it so it can no longer be paid)
  if old.status = 'pending_payment' and new.status <> 'pending_payment' then
    perform private.enqueue_job('payments.reconcile', jsonb_build_object('booking_id', new.id),
                                'payments.reconcile:' || new.id || ':' || new.status);
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' and coalesce(new.refund_due_cents, 0) > 0 then
    perform private.enqueue_job('payment.refund',
      jsonb_build_object('booking_id', new.id, 'amount_cents', new.refund_due_cents, 'reason', 'Booking cancelled'),
      'payment.refund:cancel:' || new.id);
  end if;

  return new;
end;
$$;

create trigger bookings_enqueue_payment_jobs
  after update of status on public.bookings
  for each row execute function private.enqueue_payment_jobs();

-- A booking paid just after its hold expired is reinstated: it gets the confirmation like any other
create or replace function private.enqueue_booking_jobs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.business_settings;
  v_event    text;
  v_by       text;
  v_offset   integer;
  v_version  text;
  v_notify   boolean := coalesce(current_setting('app.notify_client', true), '') <> 'off';
begin
  if tg_op = 'UPDATE' and new.status = 'confirmed' and old.status in ('held', 'pending_payment', 'expired') then
    v_event := 'confirmed';
  elsif tg_op = 'INSERT' and new.status = 'confirmed' then
    v_event := 'confirmed';
  elsif tg_op = 'UPDATE' and new.status = 'confirmed' and old.status = 'confirmed'
        and (new.start_at, new.end_at, new.specialist_id) is distinct from (old.start_at, old.end_at, old.specialist_id) then
    v_event := 'rescheduled';
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status in ('confirmed', 'pending_payment') then
    v_event := 'cancelled';
  else
    return new;
  end if;

  v_by := case when new.cancelled_by is not null and new.cancelled_by <> new.client_id then 'business' else 'client' end;
  v_version := new.id || ':' || v_event || ':' || extract(epoch from new.start_at)::bigint || ':' || new.reschedule_count
               || ':' || coalesce(new.specialist_id::text, '');

  if v_notify then
    perform private.enqueue_job('email.booking', jsonb_build_object('booking_id', new.id, 'event', v_event, 'by', v_by), 'email.booking:' || v_version);
  end if;
  perform private.enqueue_job('email.admin_booking', jsonb_build_object('booking_id', new.id, 'event', v_event, 'by', v_by), 'email.admin_booking:' || v_version);
  perform private.enqueue_job('calendar.sync', jsonb_build_object('booking_id', new.id), 'calendar.sync:' || v_version);

  if v_event in ('confirmed', 'rescheduled') then
    select * into v_settings from public.business_settings where id = 1;
    foreach v_offset in array v_settings.reminder_offsets_min loop
      if new.start_at - make_interval(mins => v_offset) > now() then
        perform private.enqueue_job(
          'email.reminder',
          jsonb_build_object('booking_id', new.id, 'start_at', new.start_at, 'offset_min', v_offset),
          'email.reminder:' || new.id || ':' || extract(epoch from new.start_at)::bigint || ':' || v_offset,
          new.start_at - make_interval(mins => v_offset)
        );
      end if;
    end loop;
    if v_settings.review_url is not null then
      perform private.enqueue_job(
        'email.review_request',
        jsonb_build_object('booking_id', new.id, 'start_at', new.start_at),
        'email.review_request:' || new.id,
        new.end_at + make_interval(hours => v_settings.review_request_delay_hours)
      );
    end if;
  end if;

  return new;
end;
$$;

-- pg_cron: every 2 minutes, while links are open, poll Square for payments a webhook may have missed
select cron.schedule('bloom-payments-reconcile', '*/2 * * * *', $$
  select private.enqueue_job('payments.reconcile', '{}'::jsonb, 'payments.reconcile:' || to_char(now(), 'YYYYMMDDHH24MI'))
  where exists (select 1 from public.payment_links where status = 'open' and created_at < now() - interval '1 minute')
$$);
