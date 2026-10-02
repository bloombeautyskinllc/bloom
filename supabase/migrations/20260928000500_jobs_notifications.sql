-- =============================================================================
-- Outbox (jobs), notification log and webhook idempotency
--
-- Side effects (emails, Google Calendar sync) never run inside the user's
-- request: RPCs enqueue a job and the worker (/api/jobs/run) processes it with
-- retries and exponential backoff.
-- =============================================================================

create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'dead');
create type public.notification_channel as enum ('email', 'sms', 'whatsapp');
create type public.notification_status as enum ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed');

-- -----------------------------------------------------------------------------
-- Jobs
-- -----------------------------------------------------------------------------
create table public.jobs (
  id             uuid primary key default gen_random_uuid(),
  type           text not null,
  payload        jsonb not null default '{}'::jsonb,
  status         public.job_status not null default 'queued',
  attempts       integer not null default 0,
  max_attempts   integer not null default 8 check (max_attempts > 0),
  next_run_at    timestamptz not null default now(),
  locked_at      timestamptz,
  locked_by      text,
  last_error     text,
  dedupe_key     text unique,
  correlation_id text,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index jobs_due_idx on public.jobs (next_run_at) where status in ('queued', 'failed');

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function private.set_updated_at();

create function private.enqueue_job(
  p_type       text,
  p_payload    jsonb,
  p_dedupe_key text default null,
  p_run_at     timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.jobs (type, payload, dedupe_key, next_run_at, correlation_id)
  values (p_type, coalesce(p_payload, '{}'::jsonb), p_dedupe_key, p_run_at, private.request_correlation_id())
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Worker API (service role only)
create function public.claim_jobs(p_worker text, p_limit integer default 10)
returns setof public.jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Recover jobs whose worker died mid-run
  update public.jobs
     set status = 'failed', locked_at = null, locked_by = null, last_error = coalesce(last_error, 'worker timeout')
   where status = 'running' and locked_at < now() - interval '10 minutes';

  return query
  update public.jobs j
     set status = 'running', attempts = j.attempts + 1, locked_at = now(), locked_by = p_worker
   where j.id in (
     select id from public.jobs
      where status in ('queued', 'failed') and next_run_at <= now()
      order by next_run_at
      limit greatest(1, least(p_limit, 50))
      for update skip locked
   )
  returning j.*;
end;
$$;

create function public.complete_job(p_job_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.jobs
     set status = 'succeeded', completed_at = now(), locked_at = null, locked_by = null, last_error = null
   where id = p_job_id;
$$;

-- Backoff: 1, 2, 4, 8 ... minutes, capped at 6 hours; 'dead' after max_attempts
create function public.fail_job(p_job_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.jobs
     set status = case when attempts >= max_attempts then 'dead'::public.job_status else 'failed'::public.job_status end,
         last_error = left(p_error, 2000),
         locked_at = null,
         locked_by = null,
         next_run_at = now() + least(interval '6 hours', interval '1 minute' * power(2, greatest(attempts - 1, 0)))
   where id = p_job_id;
$$;

revoke execute on function public.claim_jobs(text, integer), public.complete_job(uuid), public.fail_job(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_jobs(text, integer), public.complete_job(uuid), public.fail_job(uuid, text)
  to service_role;

-- -----------------------------------------------------------------------------
-- Notifications: every message sent (email now; SMS/WhatsApp later)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  channel             public.notification_channel not null default 'email',
  template            text not null,
  recipient           text not null,
  profile_id          uuid references public.profiles (id),
  booking_id          uuid, -- FK added with the bookings table (phase 3)
  job_id              uuid references public.jobs (id),
  status              public.notification_status not null default 'queued',
  provider            text,
  provider_message_id text unique,
  error               text,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  bounced_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Webhook idempotency (Stripe, Resend, Google push)
-- -----------------------------------------------------------------------------
create table public.webhook_events (
  provider     text not null,
  event_id     text not null,
  event_type   text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  primary key (provider, event_id)
);

-- -----------------------------------------------------------------------------
-- Audit + RLS
-- -----------------------------------------------------------------------------
create trigger jobs_audit
  after insert or update or delete on public.jobs
  for each row execute function private.audit_row();
create trigger notifications_audit
  after insert or update or delete on public.notifications
  for each row execute function private.audit_row();

alter table public.jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.webhook_events enable row level security;

create policy "jobs: admins read"
  on public.jobs for select to authenticated
  using ((select private.is_admin()));

create policy "notifications: staff read all, clients read own"
  on public.notifications for select to authenticated
  using ((select private.is_staff()) or profile_id = (select private.current_profile_id()));

revoke all on public.jobs, public.notifications, public.webhook_events from anon, authenticated;
grant select on public.jobs, public.notifications to authenticated;

-- =============================================================================
-- Auth RPCs
-- =============================================================================

-- Mandatory first-sign-in step. Returns true only the first time (welcome email).
create function public.complete_onboarding(
  p_full_name      text,
  p_phone_e164     text,
  p_accept_terms   boolean,
  p_reminders      boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_terms   text;
  v_first   boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if coalesce(p_accept_terms, false) is false then
    raise exception 'terms must be accepted' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_full_name, ''))) not between 2 and 120 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;

  select * into v_profile from public.profiles
   where user_id = auth.uid() and deleted_at is null
   for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  select terms_version into v_terms from public.business_settings where id = 1;
  v_first := v_profile.onboarded_at is null;

  perform private.begin_trusted_rpc();
  update public.profiles
     set full_name = trim(p_full_name),
         phone_e164 = p_phone_e164,
         reminders_opt_in = coalesce(p_reminders, false),
         terms_accepted_at = now(),
         terms_version = coalesce(v_terms, 'unversioned'),
         onboarded_at = coalesce(onboarded_at, now())
   where id = v_profile.id;

  if v_first and v_profile.email is not null then
    perform private.enqueue_job(
      'email.welcome',
      jsonb_build_object('profile_id', v_profile.id),
      'email.welcome:' || v_profile.id
    );
  end if;

  return v_first;
end;
$$;

grant execute on function public.complete_onboarding(text, text, boolean, boolean) to authenticated;

-- Role management from the back office (admins only). Keeps at least one admin.
create function public.admin_set_role(p_profile_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'only admins can change roles' using errcode = '42501';
  end if;
  if p_role <> 'admin'
     and exists (select 1 from public.profiles where id = p_profile_id and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin' and deleted_at is null) <= 1 then
    raise exception 'cannot remove the last admin' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_profile_id;
end;
$$;

grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;
