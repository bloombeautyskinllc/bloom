-- =============================================================================
-- Link profiles when an email is confirmed after sign-up
--
-- handle_new_auth_user only links an existing (e.g. admin-created) profile when the
-- email is already verified at insert time. Some flows confirm the email a moment
-- later (admin-created logins, email confirmation). Without this trigger such a user
-- gets a second, email-less profile and loses their history and welcome email.
-- =============================================================================

create function private.handle_auth_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email    text := lower(new.email);
  v_current  public.profiles;
  v_existing public.profiles;
begin
  if old.email_confirmed_at is not null or new.email_confirmed_at is null or v_email is null then
    return new;
  end if;

  select * into v_current from public.profiles where user_id = new.id;
  if not found or v_current.email is not null then
    return new; -- nothing to fix
  end if;

  select * into v_existing from public.profiles
   where email = v_email and user_id is null and deleted_at is null and anonymized_at is null;

  if found then
    -- Never drop a profile that already has history; staff can merge those by hand
    if exists (select 1 from public.bookings where client_id = v_current.id) then
      return new;
    end if;
    delete from public.profiles where id = v_current.id;
    update public.profiles
       set user_id = new.id,
           full_name = coalesce(full_name, v_current.full_name),
           avatar_url = coalesce(avatar_url, v_current.avatar_url)
     where id = v_existing.id;
  elsif not exists (
    select 1 from public.profiles where email = v_email and deleted_at is null and anonymized_at is null
  ) then
    update public.profiles set email = v_email where id = v_current.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function private.handle_auth_email_confirmed();
