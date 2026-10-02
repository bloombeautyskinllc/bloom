-- =============================================================================
-- Profiles, roles and role helpers
--
-- A profile is a person known to the business. It may exist without a login
-- (walk-in client created by an admin) and outlives its auth user (account
-- deletion anonymizes the profile but keeps booking history), so profiles.id is
-- its own key and user_id links to auth.users when there is a login.
-- =============================================================================

create table public.profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid unique references auth.users (id) on delete set null,
  email             text check (email is null or email = lower(email)),
  full_name         text check (full_name is null or char_length(full_name) between 1 and 120),
  avatar_url        text,
  phone_e164        text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  role              public.user_role not null default 'client',
  onboarded_at      timestamptz,
  terms_accepted_at timestamptz,
  terms_version     text,
  reminders_opt_in  boolean not null default false,
  locale            text not null default 'en' check (locale in ('en', 'es')),
  anonymized_at     timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'People known to the business (clients, staff, admins). May exist without a login.';

-- One active profile per email
create unique index profiles_email_active_key
  on public.profiles (email)
  where email is not null and deleted_at is null and anonymized_at is null;
create index profiles_role_idx on public.profiles (role) where role <> 'client';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies can call them without recursion)
-- -----------------------------------------------------------------------------
create function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where p.user_id = auth.uid() and p.deleted_at is null;
$$;

create function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.user_id = auth.uid() and p.deleted_at is null;
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() in ('staff', 'admin'), false);
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'admin', false);
$$;

-- True for trusted server-side callers: service role key, SQL editor, migrations, cron
create function private.is_system()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is null
     and coalesce(auth.jwt() ->> 'role', current_user) not in ('anon', 'authenticated');
$$;

grant execute on function
  private.current_profile_id(), private.current_user_role(), private.is_staff(), private.is_admin(), private.is_system()
  to anon, authenticated, service_role;

-- Our SECURITY DEFINER RPCs validate their own input and then flag the
-- transaction so guard triggers let them write system-managed columns.
-- API users cannot call set_config (pg_catalog is not exposed by the Data API).
create function private.begin_trusted_rpc()
returns void
language sql
set search_path = ''
as $$
  select set_config('app.trusted_rpc', 'on', true);
$$;

create function private.in_trusted_rpc()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.trusted_rpc', true), '') = 'on';
$$;

-- Guard triggers run as the caller, so the caller must be able to ask
grant execute on function private.in_trusted_rpc() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Guard: privileged columns can only change through RPCs, admins or the system
-- -----------------------------------------------------------------------------
create function private.guard_profile_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_system() or private.in_trusted_rpc() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Only staff insert directly (admin-created clients); never with a login or a privileged role
    if new.user_id is not null or new.onboarded_at is not null or new.terms_accepted_at is not null then
      raise exception 'profiles: user_id, onboarding and terms are set by the system' using errcode = '42501';
    end if;
    if new.role <> 'client' and not private.is_admin() then
      raise exception 'profiles: only admins can assign roles' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'profiles: only admins can change roles' using errcode = '42501';
  end if;
  if new.user_id is distinct from old.user_id
     or new.onboarded_at is distinct from old.onboarded_at
     or new.terms_accepted_at is distinct from old.terms_accepted_at
     or new.terms_version is distinct from old.terms_version
     or new.anonymized_at is distinct from old.anonymized_at then
    raise exception 'profiles: these columns are set by the system' using errcode = '42501';
  end if;
  -- A login's email comes from Google; staff can only edit emails of profiles without a login
  if new.email is distinct from old.email and (old.user_id is not null or not private.is_staff()) then
    raise exception 'profiles: email cannot be changed' using errcode = '42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at and not private.is_admin() then
    raise exception 'profiles: only admins can delete profiles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function private.guard_profile_changes();

-- -----------------------------------------------------------------------------
-- Sign-up: create or link the profile for every new auth user
-- -----------------------------------------------------------------------------
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email    text := lower(new.email);
  v_name     text := left(nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), ''), 120);
  v_avatar   text := new.raw_user_meta_data ->> 'avatar_url';
  v_verified boolean := new.email_confirmed_at is not null
                        or coalesce((new.raw_user_meta_data ->> 'email_verified')::boolean, false);
  v_id       uuid;
begin
  -- Link an admin-created profile only when the provider verified the email
  if v_email is not null and v_verified then
    update public.profiles p
       set user_id = new.id,
           full_name = coalesce(p.full_name, v_name),
           avatar_url = coalesce(p.avatar_url, v_avatar)
     where p.email = v_email and p.user_id is null and p.deleted_at is null and p.anonymized_at is null
    returning p.id into v_id;
  end if;

  if v_id is null then
    insert into public.profiles (user_id, email, full_name, avatar_url)
    values (
      new.id,
      -- Keep the email unique among active profiles: an unverified duplicate is stored without it
      case when exists (
        select 1 from public.profiles p
        where p.email = v_email and p.deleted_at is null and p.anonymized_at is null
      ) then null else v_email end,
      v_name,
      v_avatar
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: read own or staff reads all"
  on public.profiles for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

create policy "profiles: update own or staff updates all"
  on public.profiles for update
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()))
  with check (user_id = (select auth.uid()) or (select private.is_staff()));

create policy "profiles: staff create clients"
  on public.profiles for insert
  to authenticated
  with check ((select private.is_staff()));

-- Column privileges as a second fence (the guard trigger is the first)
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert (email, full_name, phone_e164, reminders_opt_in, locale, role) on public.profiles to authenticated;
grant update (email, full_name, phone_e164, reminders_opt_in, locale, role, deleted_at) on public.profiles to authenticated;
