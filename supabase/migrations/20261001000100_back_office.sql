-- =============================================================================
-- Phase 5: back office
--
-- * Internal booking notes and a basic CRM (client notes, tags, documents)
-- * Private storage bucket for signed consent forms and client documents
-- * Staff RPCs: create custom bookings, change status, cancel/reschedule with an
--   optional rules override (reason required, audited) and optional client notification
-- * Dashboard metrics and hourly flagging of past appointments pending closure
--
-- Permissions: staff (and admins) run the day-to-day (bookings, calendar, clients);
-- only admins change the catalog, team, settings and roles or read the audit log.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal notes on bookings (never visible to clients)
-- -----------------------------------------------------------------------------
create table public.booking_notes (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  author_id  uuid references public.profiles (id),
  body       text not null check (char_length(body) between 1 and 4000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_notes_booking_idx on public.booking_notes (booking_id, created_at);

-- -----------------------------------------------------------------------------
-- CRM
-- -----------------------------------------------------------------------------
create table public.client_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid references public.profiles (id),
  body       text not null check (char_length(body) between 1 and 4000),
  pinned     boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

create table public.client_tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 1 and 40),
  color      text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

create table public.client_tag_links (
  client_id  uuid not null references public.profiles (id) on delete cascade,
  tag_id     uuid not null references public.client_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, tag_id)
);

create table public.client_documents (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles (id) on delete cascade,
  booking_id   uuid references public.bookings (id) on delete set null,
  kind         text not null default 'consent' check (kind in ('consent', 'intake', 'photo', 'other')),
  title        text not null check (char_length(title) between 1 and 200),
  storage_path text not null unique, -- '<client_id>/<uuid>-<file name>' in bucket client-documents
  mime_type    text,
  size_bytes   integer check (size_bytes is null or size_bytes >= 0),
  signed_at    timestamptz,
  uploaded_by  uuid references public.profiles (id),
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index client_documents_client_idx on public.client_documents (client_id, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['booking_notes', 'client_notes'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_set_updated_at', t);
  end loop;
  foreach t in array array['booking_notes', 'client_notes', 'client_tags', 'client_tag_links', 'client_documents'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

alter table public.booking_notes enable row level security;
alter table public.client_notes enable row level security;
alter table public.client_tags enable row level security;
alter table public.client_tag_links enable row level security;
alter table public.client_documents enable row level security;

-- Staff read and write the CRM; authors keep their name on what they wrote
create policy "booking_notes: staff read" on public.booking_notes for select to authenticated using ((select private.is_staff()));
create policy "booking_notes: staff write" on public.booking_notes for insert to authenticated
  with check ((select private.is_staff()) and author_id = (select private.current_profile_id()));
create policy "booking_notes: author or admin edits" on public.booking_notes for update to authenticated
  using ((select private.is_admin()) or author_id = (select private.current_profile_id()))
  with check ((select private.is_admin()) or author_id = (select private.current_profile_id()));

create policy "client_notes: staff read" on public.client_notes for select to authenticated using ((select private.is_staff()));
create policy "client_notes: staff write" on public.client_notes for insert to authenticated
  with check ((select private.is_staff()) and author_id = (select private.current_profile_id()));
create policy "client_notes: author or admin edits" on public.client_notes for update to authenticated
  using ((select private.is_admin()) or author_id = (select private.current_profile_id()))
  with check ((select private.is_admin()) or author_id = (select private.current_profile_id()));

create policy "client_tags: staff all" on public.client_tags for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "client_tag_links: staff all" on public.client_tag_links for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- Clients may see (not change) their own documents; staff manage them
create policy "client_documents: own or staff read" on public.client_documents for select to authenticated
  using (client_id = (select private.current_profile_id()) or (select private.is_staff()));
create policy "client_documents: staff write" on public.client_documents for insert to authenticated
  with check ((select private.is_staff()) and uploaded_by = (select private.current_profile_id()));
create policy "client_documents: staff update" on public.client_documents for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

revoke all on public.booking_notes, public.client_notes, public.client_tags, public.client_tag_links, public.client_documents from anon;

-- -----------------------------------------------------------------------------
-- Private bucket for consent forms and client documents
-- Path convention: '<client profile id>/<file>' so policies can scope by folder.
-- Files are served only through short-lived signed URLs.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-documents', 'client-documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "client-documents: staff read" on storage.objects for select to authenticated
  using (bucket_id = 'client-documents' and (select private.is_staff()));
create policy "client-documents: clients read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'client-documents' and (storage.foldername(name))[1] = (select private.current_profile_id())::text);
create policy "client-documents: staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-documents' and (select private.is_staff()));
create policy "client-documents: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents' and (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Calendar colors per category (editable in the catalog)
-- -----------------------------------------------------------------------------
update public.service_categories set color = v.color
from (values ('facials', '#8C7462'), ('brows-lips', '#B5836B'), ('diode-laser', '#5E4F41'), ('intimate-care', '#A08C7A')) as v(slug, color)
where service_categories.slug = v.slug and service_categories.color is null;

-- -----------------------------------------------------------------------------
-- Staff can choose not to notify the client about a change (e.g. agreed by phone).
-- The RPC sets a transaction-local flag that the outbox trigger honors.
-- -----------------------------------------------------------------------------
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
  if tg_op = 'UPDATE' and new.status = 'confirmed' and old.status in ('held', 'pending_payment') then
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

drop trigger bookings_enqueue_jobs on public.bookings;
create trigger bookings_enqueue_jobs
  after insert or update of status, start_at, end_at, specialist_id on public.bookings
  for each row execute function private.enqueue_booking_jobs();

-- =============================================================================
-- Staff RPCs
-- =============================================================================

create function private.require_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return private.current_profile_id();
end;
$$;

-- Mark attended / no-show / confirm (pay in store), with corrections allowed
create function public.staff_set_booking_status(p_booking_id uuid, p_status public.booking_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  perform private.require_staff();
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;

  if not (
    (p_status = 'confirmed' and v_booking.status in ('pending_payment', 'completed', 'no_show'))
    or (p_status in ('completed', 'no_show') and v_booking.status in ('confirmed', 'completed', 'no_show'))
  ) then
    raise exception 'invalid_transition';
  end if;
  if p_status in ('completed', 'no_show') and v_booking.start_at > now() then
    raise exception 'not_started';
  end if;

  update public.bookings
     set status = p_status,
         confirmed_at = case when p_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
         hold_expires_at = null,
         closure_flagged_at = case when p_status in ('completed', 'no_show') then null else closure_flagged_at end
   where id = p_booking_id;
end;
$$;

-- Cancel on behalf of the business, optionally without emailing the client
create function public.staff_cancel_booking(p_booking_id uuid, p_reason text default null, p_notify boolean default true)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  perform set_config('app.notify_client', case when p_notify then 'on' else 'off' end, true);
  return public.cancel_booking(p_booking_id, p_reason);
end;
$$;

-- Move a booking (drag and drop, or the reschedule dialog). Staff are not bound by the client
-- policy; with p_override they may also ignore hours, notice and blocks (reason required).
-- Overlaps are never allowed: the exclusion constraint still applies.
create function public.staff_reschedule_booking(
  p_booking_id    uuid,
  p_new_start     timestamptz,
  p_specialist_id uuid default null,
  p_override      boolean default false,
  p_reason        text default null,
  p_notify        boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking    public.bookings;
  v_settings   public.business_settings;
  v_specialist uuid;
  v_new_end    timestamptz;
begin
  perform private.require_staff();
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_booking.status not in ('confirmed', 'pending_payment') then raise exception 'not_reschedulable'; end if;
  if p_override and char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'override_reason_required'; end if;

  select * into v_settings from public.business_settings where id = 1;
  v_specialist := coalesce(p_specialist_id, v_booking.specialist_id);
  v_new_end := p_new_start + (v_booking.end_at - v_booking.start_at);

  if not p_override then
    if p_new_start < now() then raise exception 'too_soon'; end if;
    if not private.specialist_fits(v_specialist, p_new_start, v_new_end, v_booking.buffer_before_min, v_booking.buffer_after_min, v_settings.timezone) then
      raise exception 'outside_availability';
    end if;
  end if;

  perform private.expire_overlapping_holds(
    v_specialist,
    tstzrange(p_new_start - make_interval(mins => v_booking.buffer_before_min), v_new_end + make_interval(mins => v_booking.buffer_after_min), '[)'));
  perform set_config('app.notify_client', case when p_notify then 'on' else 'off' end, true);

  begin
    update public.bookings
       set start_at = p_new_start,
           end_at = v_new_end,
           specialist_id = v_specialist,
           rules_overridden = rules_overridden or p_override,
           override_reason = case when p_override then left(trim(p_reason), 500) else override_reason end
     where id = p_booking_id;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;
end;
$$;

-- Admin custom booking: existing or new client, catalog treatment (+ options) or a fully custom
-- service, manual price and discount, optional rules override. Created confirmed.
create function public.admin_create_booking(
  p_start_at          timestamptz,
  p_client_id         uuid default null,
  p_new_client        jsonb default null,  -- {"full_name","email","phone_e164"}
  p_treatment_id      uuid default null,
  p_option_ids        uuid[] default '{}',
  p_custom            jsonb default null,  -- {"name","duration_minutes","price_cents"}
  p_specialist_id     uuid default null,
  p_price_cents       integer default null, -- manual total before discount; null = catalog price
  p_discount_cents    integer default 0,
  p_override_rules    boolean default false,
  p_override_reason   text default null,
  p_notes             text default null,
  p_notify            boolean default true,
  p_idempotency_key   text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor      uuid := private.require_staff();
  v_settings   public.business_settings;
  v_client     uuid := p_client_id;
  v_email      text;
  v_treatment  public.treatments;
  v_option_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(p_option_ids) x), '{}');
  v_opt_count  integer := 0;
  v_opt_price  integer := 0;
  v_opt_min    integer := 0;
  v_name       text;
  v_duration   integer;
  v_subtotal   integer;
  v_total      integer;
  v_before     integer := 0;
  v_after      integer := 0;
  v_end        timestamptz;
  v_specialist uuid;
  v_fits       boolean := false; -- some specialist is free by the rules, but the slot overlaps
  v_id         uuid;
begin
  if p_idempotency_key is not null then
    select id into v_id from public.bookings where idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  if p_override_rules and char_length(trim(coalesce(p_override_reason, ''))) < 3 then raise exception 'override_reason_required'; end if;
  if coalesce(p_discount_cents, 0) < 0 or coalesce(p_price_cents, 0) < 0 then raise exception 'invalid_price'; end if;

  select * into v_settings from public.business_settings where id = 1;
  perform private.begin_trusted_rpc();

  -- Client: existing, matched by email, or created
  if v_client is null then
    if p_new_client is null or char_length(trim(coalesce(p_new_client ->> 'full_name', ''))) < 2 then
      raise exception 'client_required';
    end if;
    v_email := nullif(lower(trim(p_new_client ->> 'email')), '');
    if v_email is not null then
      select id into v_client from public.profiles where email = v_email and deleted_at is null and anonymized_at is null;
    end if;
    if v_client is null then
      insert into public.profiles (email, full_name, phone_e164)
      values (v_email, trim(p_new_client ->> 'full_name'), nullif(trim(p_new_client ->> 'phone_e164'), ''))
      returning id into v_client;
    end if;
  elsif not exists (select 1 from public.profiles where id = v_client and deleted_at is null) then
    raise exception 'client_required';
  end if;

  -- What is booked
  if p_custom is not null then
    v_name := left(trim(coalesce(p_custom ->> 'name', '')), 120);
    v_duration := (p_custom ->> 'duration_minutes')::int;
    v_subtotal := coalesce((p_custom ->> 'price_cents')::int, 0);
    if char_length(v_name) < 2 or v_duration is null or v_duration not between 5 and 600 or v_subtotal < 0 then
      raise exception 'invalid_custom_service';
    end if;
  else
    select * into v_treatment from public.treatments where id = p_treatment_id and deleted_at is null and duration_minutes is not null;
    if not found then raise exception 'not_bookable'; end if;
    select count(*), coalesce(sum(o.price_cents), 0), coalesce(sum(o.extra_duration_minutes), 0)
      into v_opt_count, v_opt_price, v_opt_min
    from public.treatment_options o
    where o.id = any (v_option_ids) and o.treatment_id = v_treatment.id and o.deleted_at is null;
    if v_opt_count <> cardinality(v_option_ids) or v_opt_count < v_treatment.min_options then raise exception 'invalid_options'; end if;
    v_duration := v_treatment.duration_minutes + v_opt_min;
    v_subtotal := v_treatment.price_cents + v_opt_price;
    v_before := v_treatment.buffer_before_min;
    v_after := v_treatment.buffer_after_min;
  end if;

  v_total := greatest(coalesce(p_price_cents, v_subtotal) - coalesce(p_discount_cents, 0), 0);
  v_end := p_start_at + make_interval(mins => v_duration);

  if not p_override_rules and p_start_at < now() then raise exception 'too_soon'; end if;

  perform set_config('app.notify_client', case when p_notify then 'on' else 'off' end, true);

  for v_specialist in
    select s.id from public.specialists s
    where s.is_active and s.deleted_at is null
      and (p_specialist_id is null or s.id = p_specialist_id)
      and (p_custom is not null or exists (select 1 from public.specialist_treatments st where st.specialist_id = s.id and st.treatment_id = v_treatment.id))
    order by s.sort_order, s.created_at
  loop
    continue when not p_override_rules and not private.specialist_fits(v_specialist, p_start_at, v_end, v_before, v_after, v_settings.timezone);
    v_fits := true;
    perform private.expire_overlapping_holds(v_specialist, tstzrange(p_start_at - make_interval(mins => v_before), v_end + make_interval(mins => v_after), '[)'));
    begin
      insert into public.bookings (
        client_id, specialist_id, status, source, start_at, end_at, buffer_before_min, buffer_after_min,
        idempotency_key, subtotal_cents, discount_cents, adjustment_cents, total_cents, amount_due_cents,
        client_notes, policy, confirmed_at, rules_overridden, override_reason, created_by
      ) values (
        v_client, v_specialist, 'confirmed', 'admin', p_start_at, v_end, v_before, v_after,
        p_idempotency_key, v_subtotal, coalesce(p_discount_cents, 0), coalesce(p_price_cents, v_subtotal) - v_subtotal, v_total, v_total,
        nullif(trim(p_notes), ''), private.policy_snapshot(v_settings), now(), p_override_rules,
        case when p_override_rules then left(trim(p_override_reason), 500) end, v_actor
      )
      returning id into v_id;
      exit;
    exception when exclusion_violation then
      v_id := null;
    end;
  end loop;

  if v_id is null then
    raise exception '%', case when p_override_rules or v_fits then 'slot_taken' else 'outside_availability' end;
  end if;

  if p_custom is not null then
    insert into public.booking_items (booking_id, kind, name, price_type, unit_price_cents, duration_minutes, sort_order)
    values (v_id, 'custom', v_name, 'fixed', v_subtotal, v_duration, 0);
  else
    insert into public.booking_items (booking_id, kind, treatment_id, name, description, includes, price_type, unit_price_cents, duration_minutes, sort_order)
    values (v_id, 'treatment', v_treatment.id, v_treatment.name, v_treatment.description, v_treatment.includes, v_treatment.price_type, v_treatment.price_cents, v_treatment.duration_minutes, 0);
    insert into public.booking_items (booking_id, kind, treatment_id, option_id, name, description, group_label, price_type, unit_price_cents, duration_minutes, sort_order)
    select v_id, 'option', v_treatment.id, o.id, o.name, o.description, o.group_label, o.price_type, o.price_cents, coalesce(o.extra_duration_minutes, 0), 1 + o.sort_order
    from public.treatment_options o where o.id = any (v_option_ids);
  end if;

  return v_id;
end;
$$;

-- Dashboard metrics for bookings starting in [p_from, p_to)
create function public.admin_dashboard(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_staff();
  with b as (
    select * from public.bookings where start_at >= p_from and start_at < p_to
  )
  select jsonb_build_object(
    'appointments', (select count(*) from b where status in ('confirmed', 'completed', 'no_show', 'pending_payment')),
    'completed', (select count(*) from b where status = 'completed'),
    'cancelled', (select count(*) from b where status = 'cancelled'),
    'no_show', (select count(*) from b where status = 'no_show'),
    'pending_payment', (select count(*) from b where status = 'pending_payment'),
    'revenue_estimated_cents', (select coalesce(sum(total_cents), 0) from b where status in ('confirmed', 'completed')),
    'revenue_collected_cents', (select coalesce(sum(total_cents), 0) from b where payment_status = 'paid' and status in ('confirmed', 'completed')),
    'new_clients', (select count(*) from public.profiles where role = 'client' and created_at >= p_from and created_at < p_to and anonymized_at is null),
    'top_treatments', coalesce((
      select jsonb_agg(t order by t.count desc) from (
        select i.name, count(*) as count
        from b join public.booking_items i on i.booking_id = b.id and i.kind in ('treatment', 'custom')
        where b.status in ('confirmed', 'completed', 'no_show')
        group by i.name order by count(*) desc limit 5
      ) t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Client overview for the CRM list (RLS of the underlying tables applies: staff see everyone)
create view public.client_overview
with (security_invoker = true)
as
  select
    p.id, p.full_name, p.email, p.phone_e164, p.role, p.created_at, p.user_id is not null as has_login,
    p.anonymized_at, p.reminders_opt_in,
    (select count(*) from public.bookings b where b.client_id = p.id and b.status in ('confirmed', 'completed')) as visits,
    (select count(*) from public.bookings b where b.client_id = p.id and b.status = 'no_show') as no_shows,
    (select coalesce(sum(b.total_cents), 0) from public.bookings b where b.client_id = p.id and b.status = 'completed') as lifetime_cents,
    (select max(b.start_at) from public.bookings b where b.client_id = p.id and b.status in ('completed', 'confirmed') and b.start_at < now()) as last_visit_at,
    (select min(b.start_at) from public.bookings b where b.client_id = p.id and b.status = 'confirmed' and b.start_at >= now()) as next_visit_at,
    coalesce((select array_agg(t.name order by t.name) from public.client_tag_links l join public.client_tags t on t.id = l.tag_id where l.client_id = p.id), '{}') as tags
  from public.profiles p
  where p.deleted_at is null;

revoke all on public.client_overview from anon;

grant execute on function
  public.staff_set_booking_status(uuid, public.booking_status),
  public.staff_cancel_booking(uuid, text, boolean),
  public.staff_reschedule_booking(uuid, timestamptz, uuid, boolean, text, boolean),
  public.admin_create_booking(timestamptz, uuid, jsonb, uuid, uuid[], jsonb, uuid, integer, integer, boolean, text, text, boolean, text),
  public.admin_dashboard(timestamptz, timestamptz)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Hourly: flag past appointments nobody has closed (completed / no-show) yet
-- -----------------------------------------------------------------------------
create function public.flag_bookings_pending_closure()
returns integer
language sql
security definer
set search_path = ''
as $$
  with flagged as (
    update public.bookings set closure_flagged_at = now()
     where status = 'confirmed' and end_at < now() and closure_flagged_at is null
    returning 1
  )
  select count(*)::int from flagged;
$$;
revoke execute on function public.flag_bookings_pending_closure() from public, anon, authenticated;

select cron.schedule('bloom-flag-closure', '5 * * * *', 'select public.flag_bookings_pending_closure()');

-- -----------------------------------------------------------------------------
-- One row per booking with client, specialist and service, for the back office
-- (search, filters, calendar, CSV). RLS of the underlying tables applies.
-- -----------------------------------------------------------------------------
create view public.booking_search
with (security_invoker = true)
as
  select
    b.id, b.code, b.status, b.payment_status, b.source, b.start_at, b.end_at,
    b.subtotal_cents, b.discount_cents, b.adjustment_cents, b.total_cents,
    b.client_id, p.full_name as client_name, p.email as client_email, p.phone_e164 as client_phone,
    b.specialist_id, s.display_name as specialist_name, s.color as specialist_color,
    (select string_agg(i.name, ', ' order by i.sort_order) from public.booking_items i where i.booking_id = b.id and i.kind <> 'option') as service,
    (select string_agg(i.name, ', ' order by i.sort_order) from public.booking_items i where i.booking_id = b.id and i.kind = 'option') as options,
    coalesce((select array_agg(distinct i.treatment_id) from public.booking_items i where i.booking_id = b.id and i.treatment_id is not null), '{}') as treatment_ids,
    (select c.slug from public.booking_items i join public.treatments tr on tr.id = i.treatment_id join public.service_categories c on c.id = tr.category_id
      where i.booking_id = b.id and i.kind = 'treatment' limit 1) as category_slug,
    (select c.color from public.booking_items i join public.treatments tr on tr.id = i.treatment_id join public.service_categories c on c.id = tr.category_id
      where i.booking_id = b.id and i.kind = 'treatment' limit 1) as category_color,
    b.client_notes, b.cancellation_reason, b.rules_overridden, b.override_reason, b.reschedule_count,
    b.closure_flagged_at, b.created_at
  from public.bookings b
  join public.profiles p on p.id = b.client_id
  left join public.specialists s on s.id = b.specialist_id
  where b.status not in ('held', 'expired');

revoke all on public.booking_search from anon;

-- -----------------------------------------------------------------------------
-- Replace a weekly schedule atomically (business default when p_specialist_id is null)
-- p_hours: [{"iso_weekday":1,"start":"10:00","end":"20:00"}, ...]
-- -----------------------------------------------------------------------------
create function public.admin_set_working_hours(p_specialist_id uuid, p_hours jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_hours) <> 'array' then raise exception 'invalid_hours'; end if;

  delete from public.working_hours where specialist_id is not distinct from p_specialist_id;
  insert into public.working_hours (specialist_id, iso_weekday, start_time, end_time)
  select p_specialist_id, (h ->> 'iso_weekday')::smallint, (h ->> 'start')::time, (h ->> 'end')::time
  from jsonb_array_elements(p_hours) h;
end;
$$;

grant execute on function public.admin_set_working_hours(uuid, jsonb) to authenticated;
