-- =============================================================================
-- Bookings: availability blocks, bookings with a frozen price snapshot, and the
-- transactional RPCs that create, confirm, cancel and reschedule them.
--
-- Double booking is impossible at the database level: an EXCLUDE constraint on
-- (specialist, blocked range incl. buffers) covers holds, pending payments and
-- confirmed bookings. The RPCs recompute prices and validate every rule server-side.
-- Error messages are stable keys (e.g. 'slot_taken') that the app translates.
-- =============================================================================

create extension if not exists pg_cron;

create type public.booking_status as enum ('held', 'pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show', 'expired');
create type public.booking_source as enum ('online', 'admin');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'partially_paid', 'refunded', 'failed');
create type public.block_source as enum ('manual', 'google', 'holiday');

-- -----------------------------------------------------------------------------
-- Availability blocks: holidays, time off, manual blocks, mirrored Google busy time
-- -----------------------------------------------------------------------------
create table public.availability_blocks (
  id              uuid primary key default gen_random_uuid(),
  specialist_id   uuid references public.specialists (id) on delete cascade, -- null = whole business
  range           tstzrange not null check (not isempty(range) and lower(range) is not null and upper(range) is not null),
  source          public.block_source not null default 'manual',
  reason          text,
  google_event_id text,
  created_by      uuid references public.profiles (id),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index availability_blocks_range_idx on public.availability_blocks using gist (range) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- Bookings
-- -----------------------------------------------------------------------------
create function private.new_booking_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- 8 chars from an unambiguous alphabet (no 0/O, 1/I/L): ~1e12 combinations
  select 'BLM-' || string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + (get_byte(b, i) % 31), 1), '')
  from (select extensions.gen_random_bytes(8) as b) r, generate_series(0, 7) i;
$$;

create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique default private.new_booking_code(),
  client_id           uuid not null references public.profiles (id),
  specialist_id       uuid not null references public.specialists (id),
  status              public.booking_status not null default 'held',
  source              public.booking_source not null default 'online',
  start_at            timestamptz not null,
  end_at              timestamptz not null,
  buffer_before_min   integer not null default 0 check (buffer_before_min >= 0),
  buffer_after_min    integer not null default 0 check (buffer_after_min >= 0),
  -- [start - buffer_before, end + buffer_after), maintained by trigger (timestamptz arithmetic is not immutable)
  blocked_range       tstzrange not null,
  hold_expires_at     timestamptz,
  idempotency_key     text unique,
  currency            char(3) not null default 'USD',
  subtotal_cents      integer not null check (subtotal_cents >= 0),
  discount_cents      integer not null default 0 check (discount_cents >= 0),
  adjustment_cents    integer not null default 0,
  total_cents         integer not null check (total_cents >= 0),
  amount_due_cents    integer not null default 0 check (amount_due_cents >= 0), -- charged online at booking
  payment_status      public.payment_status not null default 'unpaid',
  client_notes        text check (client_notes is null or char_length(client_notes) <= 1000),
  -- Policy in force when booked (terms: the version in effect at booking applies)
  policy              jsonb not null default '{}'::jsonb,
  reschedule_count    integer not null default 0 check (reschedule_count >= 0),
  confirmed_at        timestamptz,
  cancelled_at        timestamptz,
  cancelled_by        uuid references public.profiles (id),
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  refund_due_cents    integer check (refund_due_cents is null or refund_due_cents >= 0),
  rules_overridden    boolean not null default false,
  override_reason     text,
  created_by          uuid references public.profiles (id),
  closure_flagged_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_at > start_at)
);

create function private.set_booking_blocked_range()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.blocked_range := tstzrange(
    new.start_at - make_interval(mins => new.buffer_before_min),
    new.end_at + make_interval(mins => new.buffer_after_min),
    '[)'
  );
  return new;
end;
$$;

create trigger bookings_set_blocked_range
  before insert or update of start_at, end_at, buffer_before_min, buffer_after_min on public.bookings
  for each row execute function private.set_booking_blocked_range();

-- The guarantee: one specialist can never have two active bookings/holds that overlap
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (specialist_id with =, blocked_range with &&)
  where (status in ('held', 'pending_payment', 'confirmed'));

create index bookings_client_idx on public.bookings (client_id, start_at desc);
create index bookings_start_idx on public.bookings (start_at);
create index bookings_expiring_idx on public.bookings (hold_expires_at) where status in ('held', 'pending_payment');

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Frozen snapshot of what was booked (future catalog/price changes never alter it)
-- -----------------------------------------------------------------------------
create table public.booking_items (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings (id) on delete cascade,
  kind             text not null check (kind in ('treatment', 'option', 'custom')),
  treatment_id     uuid references public.treatments (id),
  option_id        uuid references public.treatment_options (id),
  name             text not null,
  description      text,
  includes         text[] not null default '{}',
  group_label      text,
  price_type       public.price_type not null default 'fixed',
  unit_price_cents integer not null check (unit_price_cents >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

create index booking_items_booking_idx on public.booking_items (booking_id, sort_order);

-- Intake / consent answers (sensitive: redacted in the audit log)
create table public.intake_responses (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null unique references public.bookings (id) on delete cascade,
  form_id      uuid not null references public.intake_forms (id),
  form_version integer not null,
  answers      jsonb not null check (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Notifications can now point at bookings
alter table public.notifications
  add constraint notifications_booking_fk foreign key (booking_id) references public.bookings (id);

-- -----------------------------------------------------------------------------
-- Audit, updated_at, RLS
-- -----------------------------------------------------------------------------
create trigger availability_blocks_set_updated_at before update on public.availability_blocks
  for each row execute function private.set_updated_at();

create trigger availability_blocks_audit after insert or update or delete on public.availability_blocks
  for each row execute function private.audit_row();
create trigger bookings_audit after insert or update or delete on public.bookings
  for each row execute function private.audit_row();
create trigger booking_items_audit after insert or update or delete on public.booking_items
  for each row execute function private.audit_row();
create trigger intake_responses_audit after insert or update or delete on public.intake_responses
  for each row execute function private.audit_row('answers');

alter table public.availability_blocks enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.intake_responses enable row level security;

create policy "availability_blocks: staff read"
  on public.availability_blocks for select to authenticated
  using ((select private.is_staff()));
create policy "availability_blocks: admins write"
  on public.availability_blocks for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "bookings: own or staff"
  on public.bookings for select to authenticated
  using (client_id = (select private.current_profile_id()) or (select private.is_staff()));

create policy "booking_items: own or staff"
  on public.booking_items for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id and (b.client_id = (select private.current_profile_id()) or (select private.is_staff()))
  ));

create policy "intake_responses: own or staff"
  on public.intake_responses for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id and (b.client_id = (select private.current_profile_id()) or (select private.is_staff()))
  ));

-- Every write goes through the RPCs below
revoke all on public.availability_blocks, public.bookings, public.booking_items, public.intake_responses from anon;
revoke insert, update, delete on public.bookings, public.booking_items, public.intake_responses from authenticated;
grant select on public.bookings, public.booking_items, public.intake_responses to authenticated;

-- =============================================================================
-- Availability helpers
-- =============================================================================

-- Busy time for the slot engine: active bookings/holds (with buffers) and blocks. No client data.
create function public.get_busy_ranges(p_from timestamptz, p_to timestamptz)
returns table (specialist_id uuid, start_at timestamptz, end_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.specialist_id, lower(b.blocked_range), upper(b.blocked_range)
  from public.bookings b
  where b.status in ('held', 'pending_payment', 'confirmed')
    and not (b.status in ('held', 'pending_payment') and b.hold_expires_at < now())
    and b.blocked_range && tstzrange(p_from, p_to)
    and p_to - p_from <= interval '100 days'
  union all
  -- specialist_id null = applies to every specialist
  select a.specialist_id, lower(a.range), upper(a.range)
  from public.availability_blocks a
  where a.deleted_at is null
    and a.range && tstzrange(p_from, p_to)
    and p_to - p_from <= interval '100 days';
$$;

grant execute on function public.get_busy_ranges(timestamptz, timestamptz) to authenticated;

-- Global rules that do not depend on the specialist
create function private.assert_booking_window(p_start timestamptz, p_settings public.business_settings)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_start < now() + make_interval(mins => p_settings.min_notice_min) then
    raise exception 'too_soon';
  end if;
  if (p_start at time zone p_settings.timezone)::date > (now() at time zone p_settings.timezone)::date + p_settings.max_window_days then
    raise exception 'too_far';
  end if;
  -- Slots are aligned to the configured interval (minutes past the hour in local time)
  if (extract(minute from (p_start at time zone p_settings.timezone))::int % p_settings.slot_interval_min) <> 0
     or extract(second from p_start) <> 0 then
    raise exception 'invalid_time';
  end if;
end;
$$;

-- Can this specialist take [start, end) with these buffers? (hours + blocks; overlap is left to the constraint)
create function private.specialist_fits(
  p_specialist uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_buffer_before integer,
  p_buffer_after integer,
  p_timezone text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  with local as (
    select (p_start at time zone p_timezone) as s, (p_end at time zone p_timezone) as e
  ),
  hours as (
    -- The specialist's own schedule when they have one, otherwise the business default
    select w.* from public.working_hours w
    where w.specialist_id = p_specialist
    union all
    select w.* from public.working_hours w
    where w.specialist_id is null
      and not exists (select 1 from public.working_hours x where x.specialist_id = p_specialist)
  )
  select
    -- The service itself fits inside one working window of that local day (buffers may spill outside)
    exists (
      select 1 from hours h, local l
      where h.iso_weekday = extract(isodow from l.s)
        and l.s::date = (l.e - interval '1 microsecond')::date
        and h.start_time <= l.s::time
        and (l.e::time = time '00:00' or h.end_time >= l.e::time)
    )
    and not exists (
      select 1 from public.availability_blocks a
      where a.deleted_at is null
        and (a.specialist_id is null or a.specialist_id = p_specialist)
        and a.range && tstzrange(p_start - make_interval(mins => p_buffer_before), p_end + make_interval(mins => p_buffer_after), '[)')
    );
$$;

-- Frees expired holds that sit on a range, inside the caller's transaction
create function private.expire_overlapping_holds(p_specialist uuid, p_range tstzrange)
returns void
language sql
set search_path = ''
as $$
  update public.bookings
     set status = 'expired'
   where specialist_id = p_specialist
     and status in ('held', 'pending_payment')
     and hold_expires_at < now()
     and blocked_range && p_range;
$$;

create function private.policy_snapshot(p_settings public.business_settings)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'cancel_cutoff_hours', p_settings.cancel_cutoff_hours,
    'reschedule_cutoff_hours', p_settings.reschedule_cutoff_hours,
    'max_reschedules', p_settings.max_reschedules,
    'cancellation_refund_percent', p_settings.cancellation_refund_percent,
    'late_cancellation_refund_percent', p_settings.late_cancellation_refund_percent,
    'terms_version', p_settings.terms_version
  );
$$;

-- =============================================================================
-- RPCs
-- =============================================================================

-- Step "date & time": hold a slot for hold_minutes while the client confirms.
create function public.hold_slot(
  p_treatment_id    uuid,
  p_option_ids      uuid[],
  p_start_at        timestamptz,
  p_specialist_id   uuid default null,
  p_idempotency_key text default null
)
returns table (booking_id uuid, code text, hold_expires_at timestamptz, start_at timestamptz, end_at timestamptz, total_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_profile    public.profiles;
  v_settings   public.business_settings;
  v_treatment  public.treatments;
  v_option_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(p_option_ids) x), '{}');
  v_opt_count  integer;
  v_opt_price  integer;
  v_opt_min    integer;
  v_opt_nulls  integer;
  v_duration   integer;
  v_total      integer;
  v_end        timestamptz;
  v_specialist uuid;
  v_id         uuid;
begin
  select * into v_profile from public.profiles p where p.user_id = auth.uid() and p.deleted_at is null;
  if not found then raise exception 'not_authenticated'; end if;
  if v_profile.onboarded_at is null then raise exception 'onboarding_required'; end if;

  -- Retrying the same request returns the same hold
  if p_idempotency_key is not null then
    return query
      select b.id, b.code, b.hold_expires_at, b.start_at, b.end_at, b.total_cents
      from public.bookings b
      where b.idempotency_key = p_idempotency_key and b.client_id = v_profile.id
        and b.status in ('held', 'pending_payment', 'confirmed');
    if found then return; end if;
  end if;

  select * into v_settings from public.business_settings where id = 1;
  select * into v_treatment from public.treatments t where t.id = p_treatment_id and t.is_bookable;
  if not found then raise exception 'not_bookable'; end if;

  select count(*), coalesce(sum(o.price_cents), 0), coalesce(sum(o.extra_duration_minutes), 0),
         count(*) filter (where o.extra_duration_minutes is null)
    into v_opt_count, v_opt_price, v_opt_min, v_opt_nulls
  from public.treatment_options o
  where o.id = any (v_option_ids) and o.treatment_id = v_treatment.id and o.is_active and o.deleted_at is null;

  if v_opt_count <> cardinality(v_option_ids)
     or v_opt_nulls > 0
     or v_opt_count < v_treatment.min_options
     or (v_treatment.max_options is not null and v_opt_count > v_treatment.max_options) then
    raise exception 'invalid_options';
  end if;

  -- Price and duration are always computed here, never taken from the client
  v_duration := v_treatment.duration_minutes + v_opt_min;
  v_total := v_treatment.price_cents + v_opt_price;
  v_end := p_start_at + make_interval(mins => v_duration);

  perform private.assert_booking_window(p_start_at, v_settings);
  perform private.begin_trusted_rpc();

  -- One active hold per client: picking a new time releases the previous one
  update public.bookings b set status = 'expired'
   where b.client_id = v_profile.id and b.status = 'held';

  for v_specialist in
    select s.id from public.specialists s
    join public.specialist_treatments st on st.specialist_id = s.id and st.treatment_id = v_treatment.id
    where s.is_active and s.deleted_at is null and (p_specialist_id is null or s.id = p_specialist_id)
    order by s.sort_order, s.created_at
  loop
    continue when not private.specialist_fits(
      v_specialist, p_start_at, v_end, v_treatment.buffer_before_min, v_treatment.buffer_after_min, v_settings.timezone);

    perform private.expire_overlapping_holds(
      v_specialist,
      tstzrange(p_start_at - make_interval(mins => v_treatment.buffer_before_min), v_end + make_interval(mins => v_treatment.buffer_after_min), '[)'));

    begin
      insert into public.bookings (
        client_id, specialist_id, status, source, start_at, end_at, buffer_before_min, buffer_after_min,
        hold_expires_at, idempotency_key, subtotal_cents, total_cents, amount_due_cents, policy, created_by
      ) values (
        v_profile.id, v_specialist, 'held', 'online', p_start_at, v_end, v_treatment.buffer_before_min, v_treatment.buffer_after_min,
        now() + make_interval(mins => v_settings.hold_minutes), p_idempotency_key, v_total, v_total,
        coalesce(least(v_treatment.deposit_cents, v_total), v_total), private.policy_snapshot(v_settings), v_profile.id
      )
      returning id into v_id;
      exit;
    exception when exclusion_violation then
      v_id := null; -- taken: try the next specialist
    end;
  end loop;

  if v_id is null then raise exception 'slot_taken'; end if;

  insert into public.booking_items (booking_id, kind, treatment_id, name, description, includes, price_type, unit_price_cents, duration_minutes, sort_order)
  values (v_id, 'treatment', v_treatment.id, v_treatment.name, v_treatment.description, v_treatment.includes,
          v_treatment.price_type, v_treatment.price_cents, v_treatment.duration_minutes, 0);

  insert into public.booking_items (booking_id, kind, treatment_id, option_id, name, description, group_label, price_type, unit_price_cents, duration_minutes, sort_order)
  select v_id, 'option', v_treatment.id, o.id, o.name, o.description, o.group_label, o.price_type, o.price_cents, o.extra_duration_minutes, 1 + o.sort_order
  from public.treatment_options o
  where o.id = any (v_option_ids);

  return query
    select b.id, b.code, b.hold_expires_at, b.start_at, b.end_at, b.total_cents
    from public.bookings b where b.id = v_id;
end;
$$;

-- Step "confirm": notes + intake, then confirmed (or pending payment when online payments are on)
create function public.submit_booking(p_booking_id uuid, p_notes text default null, p_intake jsonb default null)
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
    -- Stripe Checkout sessions last at least 30 minutes: keep the slot for that long
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

-- Client (within policy) or staff (always) cancels. Returns the refund owed in cents, if any.
create function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_actor   uuid := private.current_profile_id();
  v_staff   boolean := private.is_staff();
  v_percent integer;
  v_refund  integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or (v_booking.client_id <> v_actor and not v_staff) then raise exception 'not_found'; end if;
  if v_booking.status not in ('held', 'pending_payment', 'confirmed') then raise exception 'not_cancellable'; end if;

  if v_booking.status = 'confirmed' and not v_staff
     and v_booking.start_at - now() < make_interval(hours => (v_booking.policy ->> 'cancel_cutoff_hours')::int) then
    raise exception 'outside_policy';
  end if;

  v_percent := case
    when v_booking.start_at - now() >= make_interval(hours => coalesce((v_booking.policy ->> 'cancel_cutoff_hours')::int, 0))
      then coalesce((v_booking.policy ->> 'cancellation_refund_percent')::int, 100)
    else coalesce((v_booking.policy ->> 'late_cancellation_refund_percent')::int, 0)
  end;
  -- Payments arrive in phase 6; until then nothing has been charged
  v_refund := case when v_booking.payment_status in ('paid', 'partially_paid')
    then floor(v_booking.amount_due_cents * v_percent / 100.0)::int end;

  perform private.begin_trusted_rpc();
  update public.bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = v_actor,
         cancellation_reason = left(nullif(trim(p_reason), ''), 500), refund_due_cents = v_refund, hold_expires_at = null
   where id = p_booking_id;

  return v_refund;
end;
$$;

-- Move a confirmed booking: the old slot is released and the new one taken in the same transaction
create function public.reschedule_booking(p_booking_id uuid, p_new_start timestamptz)
returns table (start_at timestamptz, end_at timestamptz, reschedule_count integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_booking  public.bookings;
  v_settings public.business_settings;
  v_staff    boolean := private.is_staff();
  v_new_end  timestamptz;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or (v_booking.client_id <> private.current_profile_id() and not v_staff) then raise exception 'not_found'; end if;
  if v_booking.status <> 'confirmed' then raise exception 'not_reschedulable'; end if;

  if not v_staff then
    if v_booking.start_at - now() < make_interval(hours => (v_booking.policy ->> 'reschedule_cutoff_hours')::int) then
      raise exception 'outside_policy';
    end if;
    if v_booking.reschedule_count >= (v_booking.policy ->> 'max_reschedules')::int then
      raise exception 'max_reschedules';
    end if;
  end if;

  select * into v_settings from public.business_settings where id = 1;
  v_new_end := p_new_start + (v_booking.end_at - v_booking.start_at);

  perform private.assert_booking_window(p_new_start, v_settings);
  if not private.specialist_fits(v_booking.specialist_id, p_new_start, v_new_end,
                                 v_booking.buffer_before_min, v_booking.buffer_after_min, v_settings.timezone) then
    raise exception 'slot_taken';
  end if;

  perform private.expire_overlapping_holds(
    v_booking.specialist_id,
    tstzrange(p_new_start - make_interval(mins => v_booking.buffer_before_min), v_new_end + make_interval(mins => v_booking.buffer_after_min), '[)'));

  perform private.begin_trusted_rpc();
  begin
    update public.bookings b
       set start_at = p_new_start, end_at = v_new_end, reschedule_count = b.reschedule_count + 1
     where b.id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  return query select b.start_at, b.end_at, b.reschedule_count from public.bookings b where b.id = p_booking_id;
end;
$$;

-- Account deletion: anonymize the profile, cancel future bookings, keep history and audit log.
-- The server then deletes the auth user with the service role.
create function public.delete_my_account()
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
         cancellation_reason = 'Account deleted by the client', hold_expires_at = null
   where client_id = v_profile.id and status in ('held', 'pending_payment', 'confirmed') and start_at > now();

  update public.profiles
     set full_name = null, email = null, phone_e164 = null, avatar_url = null, reminders_opt_in = false,
         user_id = null, anonymized_at = now(), deleted_at = now()
   where id = v_profile.id;
end;
$$;

-- pg_cron: release unpaid/unconfirmed holds every minute
create function public.expire_stale_holds()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.bookings set status = 'expired'
     where status in ('held', 'pending_payment') and hold_expires_at < now()
    returning 1
  )
  select count(*)::int from expired;
$$;

grant execute on function
  public.hold_slot(uuid, uuid[], timestamptz, uuid, text),
  public.submit_booking(uuid, text, jsonb),
  public.cancel_booking(uuid, text),
  public.reschedule_booking(uuid, timestamptz),
  public.delete_my_account()
  to authenticated;
revoke execute on function public.expire_stale_holds() from public, anon, authenticated;

select cron.schedule('bloom-expire-holds', '* * * * *', 'select public.expire_stale_holds()');

-- Realtime for the admin calendar (phase 5): changes are still filtered by RLS
alter publication supabase_realtime add table public.bookings;
