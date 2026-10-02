-- =============================================================================
-- Phase 4: booking notifications, Google Calendar sync and the scheduled worker
--
-- * Triggers on bookings enqueue jobs (outbox) for every relevant change, so every
--   path (client RPCs, admin tools, cron) notifies and syncs the same way.
-- * Google OAuth refresh tokens live in Supabase Vault; only the service role can
--   read them, through SECURITY DEFINER functions.
-- * pg_cron calls the app's job worker every minute through pg_net.
-- =============================================================================

create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- Settings used by notifications
-- -----------------------------------------------------------------------------
alter table public.business_settings
  -- Google review link for the post-visit email; no review emails while it is empty
  add column review_url text,
  add column review_request_delay_hours integer not null default 3 check (review_request_delay_hours between 0 and 168);

-- -----------------------------------------------------------------------------
-- Google OAuth credentials (tokens in Vault)
-- -----------------------------------------------------------------------------
create table private.google_credentials (
  id              uuid primary key default gen_random_uuid(),
  owner_kind      text not null check (owner_kind in ('business', 'client')),
  profile_id      uuid references public.profiles (id) on delete cascade, -- the client, or the admin who connected the business calendar
  google_email    text,
  scopes          text[] not null default '{}',
  vault_secret_id uuid not null,
  calendar_id     text not null default 'primary',
  connected_at    timestamptz not null default now(),
  revoked_at      timestamptz,
  last_error      text,
  last_used_at    timestamptz
);

-- One active business calendar, one active calendar per client
create unique index google_credentials_business_key on private.google_credentials (owner_kind) where owner_kind = 'business' and revoked_at is null;
create unique index google_credentials_client_key on private.google_credentials (profile_id) where owner_kind = 'client' and revoked_at is null;

revoke all on private.google_credentials from public, anon, authenticated;

create function public.store_google_credential(
  p_owner_kind    text,
  p_profile_id    uuid,
  p_google_email  text,
  p_scopes        text[],
  p_refresh_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old    private.google_credentials;
  v_secret uuid;
  v_id     uuid;
begin
  -- Replace any active credential for the same owner
  for v_old in
    select * from private.google_credentials
    where revoked_at is null and owner_kind = p_owner_kind and (p_owner_kind = 'business' or profile_id = p_profile_id)
  loop
    update private.google_credentials set revoked_at = now() where id = v_old.id;
    delete from vault.secrets where id = v_old.vault_secret_id;
  end loop;

  v_secret := vault.create_secret(p_refresh_token, 'google_refresh_' || gen_random_uuid(), 'Google OAuth refresh token (' || p_owner_kind || ')');
  insert into private.google_credentials (owner_kind, profile_id, google_email, scopes, vault_secret_id)
  values (p_owner_kind, p_profile_id, lower(p_google_email), coalesce(p_scopes, '{}'), v_secret)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.get_google_credential(p_owner_kind text, p_profile_id uuid default null)
returns table (credential_id uuid, refresh_token text, calendar_id text, google_email text)
language sql
security definer
set search_path = ''
as $$
  select c.id, s.decrypted_secret, c.calendar_id, c.google_email
  from private.google_credentials c
  join vault.decrypted_secrets s on s.id = c.vault_secret_id
  where c.revoked_at is null
    and c.owner_kind = p_owner_kind
    and (p_owner_kind = 'business' or c.profile_id = p_profile_id);
$$;

create function public.revoke_google_credential(p_owner_kind text, p_profile_id uuid default null, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v private.google_credentials;
begin
  for v in
    select * from private.google_credentials
    where revoked_at is null and owner_kind = p_owner_kind and (p_owner_kind = 'business' or profile_id = p_profile_id)
  loop
    update private.google_credentials set revoked_at = now(), last_error = p_error where id = v.id;
    delete from vault.secrets where id = v.vault_secret_id;
  end loop;
end;
$$;

create function public.mark_google_credential(p_credential_id uuid, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.google_credentials set last_used_at = now(), last_error = p_error where id = p_credential_id;
$$;

revoke execute on function
  public.store_google_credential(text, uuid, text, text[], text),
  public.get_google_credential(text, uuid),
  public.revoke_google_credential(text, uuid, text),
  public.mark_google_credential(uuid, text)
  from public, anon, authenticated;
grant execute on function
  public.store_google_credential(text, uuid, text, text[], text),
  public.get_google_credential(text, uuid),
  public.revoke_google_credential(text, uuid, text),
  public.mark_google_credential(uuid, text)
  to service_role;

-- What the signed-in user may know: is their calendar (or, for staff, the business calendar) connected?
create function public.google_calendar_status()
returns table (owner_kind text, google_email text, connected_at timestamptz, last_error text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.owner_kind, c.google_email, c.connected_at, c.last_error
  from private.google_credentials c
  where c.revoked_at is null
    and ((c.owner_kind = 'client' and c.profile_id = private.current_profile_id())
      or (c.owner_kind = 'business' and private.is_staff()));
$$;

grant execute on function public.google_calendar_status() to authenticated;

-- -----------------------------------------------------------------------------
-- Google events linked to bookings, and push-notification channels
-- -----------------------------------------------------------------------------
create table public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings (id) on delete cascade,
  kind            text not null check (kind in ('business', 'client')),
  credential_id   uuid,
  calendar_id     text not null,
  google_event_id text,
  sync_status     text not null default 'pending' check (sync_status in ('pending', 'synced', 'deleted', 'error')),
  last_synced_at  timestamptz,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (booking_id, kind)
);

create table public.google_watch_channels (
  id            uuid primary key default gen_random_uuid(),
  credential_id uuid not null,
  calendar_id   text not null,
  channel_id    text not null unique,
  resource_id   text,
  token         text not null,
  expires_at    timestamptz,
  sync_token    text,
  stopped_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Incremental sync state even without a push channel (localhost, or before the first watch)
create table public.google_sync_state (
  credential_id uuid primary key,
  sync_token    text,
  last_pull_at  timestamptz,
  updated_at    timestamptz not null default now()
);

create trigger calendar_events_set_updated_at before update on public.calendar_events for each row execute function private.set_updated_at();
create trigger google_watch_channels_set_updated_at before update on public.google_watch_channels for each row execute function private.set_updated_at();
create trigger calendar_events_audit after insert or update or delete on public.calendar_events for each row execute function private.audit_row();

alter table public.calendar_events enable row level security;
alter table public.google_watch_channels enable row level security;
alter table public.google_sync_state enable row level security;

create policy "calendar_events: staff read" on public.calendar_events for select to authenticated using ((select private.is_staff()));
revoke all on public.calendar_events, public.google_watch_channels, public.google_sync_state from anon, authenticated;
grant select on public.calendar_events to authenticated;

-- Plain unique constraint (NULLs are distinct) so the sync can upsert on it
alter table public.availability_blocks add constraint availability_blocks_google_event_id_key unique (google_event_id);

-- -----------------------------------------------------------------------------
-- Outbox: enqueue notifications and syncs on booking changes
-- -----------------------------------------------------------------------------
create function private.enqueue_booking_jobs()
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
begin
  -- Which business event is this?
  if tg_op = 'UPDATE' and new.status = 'confirmed' and old.status in ('held', 'pending_payment') then
    v_event := 'confirmed';
  elsif tg_op = 'INSERT' and new.status = 'confirmed' then
    v_event := 'confirmed'; -- created already confirmed (admin bookings)
  elsif tg_op = 'UPDATE' and new.status = 'confirmed' and old.status = 'confirmed'
        and (new.start_at, new.end_at) is distinct from (old.start_at, old.end_at) then
    v_event := 'rescheduled';
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status in ('confirmed', 'pending_payment') then
    v_event := 'cancelled';
  else
    return new;
  end if;

  v_by := case when new.cancelled_by is not null and new.cancelled_by <> new.client_id then 'business' else 'client' end;
  -- One version per state of the booking, so every change notifies exactly once
  v_version := new.id || ':' || v_event || ':' || extract(epoch from new.start_at)::bigint || ':' || new.reschedule_count;

  perform private.enqueue_job('email.booking', jsonb_build_object('booking_id', new.id, 'event', v_event, 'by', v_by), 'email.booking:' || v_version);
  perform private.enqueue_job('email.admin_booking', jsonb_build_object('booking_id', new.id, 'event', v_event, 'by', v_by), 'email.admin_booking:' || v_version);
  perform private.enqueue_job('calendar.sync', jsonb_build_object('booking_id', new.id), 'calendar.sync:' || v_version);

  if v_event in ('confirmed', 'rescheduled') then
    select * into v_settings from public.business_settings where id = 1;
    -- Reminders carry the start time: a reschedule makes old ones obsolete (the handler checks)
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

create trigger bookings_enqueue_jobs
  after insert or update of status, start_at, end_at on public.bookings
  for each row execute function private.enqueue_booking_jobs();

-- -----------------------------------------------------------------------------
-- Worker trigger: pg_cron -> pg_net -> POST {app_url}/api/jobs/run
-- The URL and secret live in Vault (set per environment with configure_job_worker).
-- -----------------------------------------------------------------------------
create function public.configure_job_worker(p_app_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_value text;
begin
  foreach v_name in array array['bloom_app_url', 'bloom_jobs_secret'] loop
    v_value := case v_name when 'bloom_app_url' then rtrim(p_app_url, '/') else p_secret end;
    if exists (select 1 from vault.secrets where name = v_name) then
      perform vault.update_secret((select id from vault.secrets where name = v_name), v_value);
    else
      perform vault.create_secret(v_value, v_name);
    end if;
  end loop;
end;
$$;

revoke execute on function public.configure_job_worker(text, text) from public, anon, authenticated;
grant execute on function public.configure_job_worker(text, text) to service_role;

create function private.call_job_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text := (select decrypted_secret from vault.decrypted_secrets where name = 'bloom_app_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'bloom_jobs_secret');
begin
  if v_url is null or v_secret is null then
    return; -- not configured in this environment
  end if;
  -- Only call when there is something due (saves a request per minute otherwise)
  if not exists (select 1 from public.jobs where status in ('queued', 'failed') and next_run_at <= now()) then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/api/jobs/run',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

-- Periodic jobs: pull Google changes (fallback when push notifications are unavailable) and renew channels
create function private.enqueue_periodic_jobs(p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.enqueue_job(
    p_kind,
    '{}'::jsonb,
    p_kind || ':' || to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI')
  )
  where exists (select 1 from private.google_credentials where owner_kind = 'business' and revoked_at is null);
$$;

select cron.schedule('bloom-job-worker', '* * * * *', 'select private.call_job_worker()');
select cron.schedule('bloom-calendar-pull', '*/15 * * * *', $$select private.enqueue_periodic_jobs('calendar.pull')$$);
select cron.schedule('bloom-calendar-renew', '17 */6 * * *', $$select private.enqueue_periodic_jobs('calendar.renew_watch')$$);
