-- =============================================================================
-- Client intake and consent form, signed online for every booking.
--
-- * The client fills sections 01–05 (client information, skin history, health history,
--   treatment preferences, consent) and draws a signature during the booking flow. The next
--   booking prefills everything from their latest form, so only today's answers, the consent
--   statements and a new signature are needed.
-- * Staff complete the esthetician part in the back office: skin analysis with face maps,
--   treatment record and the esthetician signature.
-- * The PDF is rendered on demand from this row (src/lib/consent/pdf.tsx), so it always
--   includes the esthetician part. The wording is versioned (form_version) in
--   src/lib/consent/form.ts and never changes for a signed form.
-- * Online bookings cannot be submitted without a signed form (submit_booking).
-- =============================================================================

create table public.consent_forms (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             uuid not null unique references public.bookings (id) on delete cascade,
  client_id              uuid not null references public.profiles (id) on delete cascade,
  form_version           integer not null check (form_version > 0),
  answers                jsonb not null check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 50000),
  signed_name            text not null check (char_length(signed_name) between 2 and 120),
  -- Drawn signatures as PNG data URLs (a few KB each)
  client_signature       text not null check (client_signature ~ '^data:image/png;base64,[A-Za-z0-9+/]+=*$' and octet_length(client_signature) <= 300000),
  signed_at              timestamptz not null default now(),
  -- Esthetician part: skin analysis (with face map drawings), treatment record
  esthetician            jsonb check (esthetician is null or (jsonb_typeof(esthetician) = 'object' and octet_length(esthetician::text) <= 900000)),
  esthetician_signature  text check (esthetician_signature is null or (esthetician_signature ~ '^data:image/png;base64,[A-Za-z0-9+/]+=*$' and octet_length(esthetician_signature) <= 300000)),
  esthetician_signed_at  timestamptz,
  esthetician_profile_id uuid references public.profiles (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Prefill reads the client's latest form; the back office lists them per client
create index consent_forms_client_idx on public.consent_forms (client_id, signed_at desc);

create trigger consent_forms_set_updated_at before update on public.consent_forms
  for each row execute function private.set_updated_at();
-- Health data and signatures never reach the audit log
create trigger consent_forms_audit after insert or update or delete on public.consent_forms
  for each row execute function private.audit_row('answers', 'client_signature', 'esthetician', 'esthetician_signature');

alter table public.consent_forms enable row level security;

create policy "consent_forms: own or staff"
  on public.consent_forms for select to authenticated
  using (client_id = (select private.current_profile_id()) or (select private.is_staff()));

-- Every write goes through the RPCs below
revoke all on public.consent_forms from anon;
revoke insert, update, delete on public.consent_forms from authenticated;
grant select on public.consent_forms to authenticated;

-- -----------------------------------------------------------------------------
-- Client: sign the form for a held booking (called right before submit_booking).
-- Answers are validated by the app (Zod); the database checks ownership, state and sizes.
-- -----------------------------------------------------------------------------
create function public.save_booking_consent(
  p_booking_id  uuid,
  p_version     integer,
  p_answers     jsonb,
  p_signed_name text,
  p_signature   text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_id      uuid;
begin
  select b.* into v_booking from public.bookings b
  join public.profiles p on p.id = b.client_id
  where b.id = p_booking_id and p.user_id = auth.uid()
  for update of b;
  if not found then raise exception 'not_found'; end if;
  if v_booking.status <> 'held' then raise exception 'not_held'; end if;
  if v_booking.hold_expires_at < now() then raise exception 'hold_expired'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or p_signature is null or nullif(trim(p_signed_name), '') is null then
    raise exception 'consent_required';
  end if;

  -- A retried confirmation replaces the form signed moments ago for the same hold
  insert into public.consent_forms (booking_id, client_id, form_version, answers, signed_name, client_signature)
  values (p_booking_id, v_booking.client_id, p_version, p_answers, trim(p_signed_name), p_signature)
  on conflict (booking_id) do update
    set form_version = excluded.form_version, answers = excluded.answers, signed_name = excluded.signed_name,
        client_signature = excluded.client_signature, signed_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.save_booking_consent(uuid, integer, jsonb, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Staff: esthetician part of the form. A null signature keeps the current one.
-- -----------------------------------------------------------------------------
create function public.staff_save_consent_record(
  p_booking_id  uuid,
  p_record      jsonb,
  p_signature   text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_record is null or jsonb_typeof(p_record) <> 'object' then raise exception 'invalid_record'; end if;

  update public.consent_forms
     set esthetician = p_record,
         esthetician_signature  = coalesce(p_signature, esthetician_signature),
         esthetician_signed_at  = case when p_signature is not null then now() else esthetician_signed_at end,
         esthetician_profile_id = case when p_signature is not null then private.current_profile_id() else esthetician_profile_id end
   where booking_id = p_booking_id;
  if not found then raise exception 'not_found'; end if;
end;
$$;

grant execute on function public.staff_save_consent_record(uuid, jsonb, text) to authenticated;

-- -----------------------------------------------------------------------------
-- submit_booking (from 20261005000300_pay_in_full.sql) now requires the signed form
-- -----------------------------------------------------------------------------
create or replace function public.submit_booking(
  p_booking_id uuid,
  p_notes      text default null,
  p_intake     jsonb default null,
  p_pay_full   boolean default false
)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking  public.bookings;
  v_settings public.business_settings;
  v_form     public.intake_forms;
  v_due      integer;
begin
  select b.* into v_booking from public.bookings b
  join public.profiles p on p.id = b.client_id
  where b.id = p_booking_id and p.user_id = auth.uid()
  for update of b;
  if not found then raise exception 'not_found'; end if;
  if v_booking.status <> 'held' then raise exception 'not_held'; end if;
  if v_booking.hold_expires_at < now() then raise exception 'hold_expired'; end if;

  if not exists (select 1 from public.consent_forms c where c.booking_id = p_booking_id) then
    raise exception 'consent_required';
  end if;

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

  -- The client may pay the full price instead of the deposit
  v_due := case when p_pay_full then v_booking.total_cents else v_booking.amount_due_cents end;

  if v_settings.payments_enabled and v_due > 0 then
    -- 30 minutes to pay; when it runs out the link is deleted and the slot released
    update public.bookings
       set status = 'pending_payment', payment_status = 'pending', amount_due_cents = v_due,
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
