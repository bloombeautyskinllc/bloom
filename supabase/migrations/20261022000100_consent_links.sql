-- =============================================================================
-- Consent form links: staff send a link to a client so they can sign the intake & consent
-- form for a booking without signing in (bookings made in the back office, by phone or walk-in).
--
-- * One link per booking. The token is a random 192-bit URL-safe string; anyone holding it can
--   see the booking basics (name, contact, treatment, time) and sign that booking's form once.
-- * The link is deleted when the form is signed, and stops working after 30 days (asking for
--   the link again then issues a new one).
-- * The link never shows earlier forms: health answers are not prefilled from a link.
-- =============================================================================

create table public.consent_links (
  booking_id  uuid primary key references public.bookings (id) on delete cascade,
  token       text not null unique check (token ~ '^[A-Za-z0-9_-]{32}$'),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.consent_links enable row level security;

create policy "consent_links: staff"
  on public.consent_links for select to authenticated
  using ((select private.is_staff()));

-- Every write goes through the RPCs below
revoke all on public.consent_links from anon;
revoke insert, update, delete on public.consent_links from authenticated;
grant select on public.consent_links to authenticated;

-- -----------------------------------------------------------------------------
-- Staff: the booking's link, created (or renewed when expired) on demand
-- -----------------------------------------------------------------------------
create function public.staff_consent_link(p_booking_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_status public.booking_status;
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;

  select b.status into v_status from public.bookings b where b.id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_status not in ('pending_payment', 'confirmed', 'completed') then raise exception 'not_signable'; end if;
  if exists (select 1 from public.consent_forms c where c.booking_id = p_booking_id) then raise exception 'already_signed'; end if;

  return query
  insert into public.consent_links as l (booking_id, token, created_by, expires_at)
  values (
    p_booking_id,
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
    private.current_profile_id(),
    now() + interval '30 days'
  )
  on conflict (booking_id) do update
    set token = case when l.expires_at > now() then l.token else excluded.token end,
        created_by = case when l.expires_at > now() then l.created_by else excluded.created_by end,
        created_at = case when l.expires_at > now() then l.created_at else now() end,
        expires_at = case when l.expires_at > now() then l.expires_at else excluded.expires_at end
  returning l.token, l.expires_at;
end;
$$;

grant execute on function public.staff_consent_link(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Public: what the consent page shows for a link (no rows = invalid, expired or used)
-- -----------------------------------------------------------------------------
create function public.consent_link_booking(p_token text)
returns table (
  booking_code text,
  start_at     timestamptz,
  treatment    text,
  full_name    text,
  email        text,
  phone_e164   text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.code, b.start_at,
         (select i.name from public.booking_items i
           where i.booking_id = b.id and i.kind <> 'option'
           order by i.sort_order limit 1),
         p.full_name, p.email, p.phone_e164
  from public.consent_links l
  join public.bookings b on b.id = l.booking_id
  join public.profiles p on p.id = b.client_id
  where l.token = p_token
    and l.expires_at > now()
    and b.status in ('pending_payment', 'confirmed', 'completed')
    and not exists (select 1 from public.consent_forms c where c.booking_id = b.id);
$$;

grant execute on function public.consent_link_booking(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Public: sign the form through a link. Answers are validated by the app (Zod), as in
-- save_booking_consent; the link is used up.
-- -----------------------------------------------------------------------------
create function public.submit_consent_link(
  p_token       text,
  p_version     integer,
  p_answers     jsonb,
  p_signed_name text,
  p_signature   text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link    public.consent_links;
  v_booking public.bookings;
begin
  select l.* into v_link from public.consent_links l where l.token = p_token for update;
  if not found or v_link.expires_at <= now() then raise exception 'invalid_link'; end if;

  select b.* into v_booking from public.bookings b where b.id = v_link.booking_id for update;
  if v_booking.status not in ('pending_payment', 'confirmed', 'completed') then raise exception 'invalid_link'; end if;
  if exists (select 1 from public.consent_forms c where c.booking_id = v_booking.id) then raise exception 'already_signed'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or p_signature is null or nullif(trim(p_signed_name), '') is null then
    raise exception 'consent_required';
  end if;

  insert into public.consent_forms (booking_id, client_id, form_version, answers, signed_name, client_signature)
  values (v_booking.id, v_booking.client_id, p_version, p_answers, trim(p_signed_name), p_signature);

  delete from public.consent_links where booking_id = v_booking.id;
end;
$$;

grant execute on function public.submit_consent_link(text, integer, jsonb, text, text) to anon, authenticated;
