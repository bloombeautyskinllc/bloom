-- =============================================================================
-- Foundation: extensions, private schema, shared enums and helpers
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- `private` is never exposed through the Data API (only `public` is). It holds
-- helper functions used by RLS policies and triggers, and internal tables.
create schema if not exists private;
revoke all on schema private from public;
-- RLS policies run with the caller's privileges, so API roles need USAGE to
-- evaluate private.is_admin() & co. EXECUTE is granted per function below.
grant usage on schema private to anon, authenticated, service_role;

-- Functions are executable by PUBLIC by default: turn that off for both schemas
-- and grant explicitly, function by function.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Shared enums
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('client', 'staff', 'admin');
create type public.price_type as enum ('fixed', 'from');
create type public.actor_type as enum ('user', 'staff', 'admin', 'system');

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Request context (PostgREST exposes the HTTP request headers as a GUC).
-- Server-side calls forward the end user's IP / user agent in x-client-ip /
-- x-client-user-agent, because the connecting client is then our own server.
-- These headers are best-effort audit context, not an authentication signal.
-- -----------------------------------------------------------------------------
create function private.request_header(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(nullif(current_setting('request.headers', true), ''), 'null')::json ->> p_name;
$$;

create function private.safe_inet(p_value text)
returns inet
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(trim(p_value), '')::inet;
exception when others then
  return null;
end;
$$;

create function private.request_ip()
returns inet
language sql
stable
set search_path = ''
as $$
  select coalesce(
    private.safe_inet(private.request_header('x-client-ip')),
    private.safe_inet(split_part(private.request_header('x-forwarded-for'), ',', 1))
  );
$$;

create function private.request_user_agent()
returns text
language sql
stable
set search_path = ''
as $$
  select left(coalesce(private.request_header('x-client-user-agent'), private.request_header('user-agent')), 500);
$$;

create function private.request_correlation_id()
returns text
language sql
stable
set search_path = ''
as $$
  select left(private.request_header('x-correlation-id'), 100);
$$;

-- Shallow diff of two row images: {"column": {"from": old, "to": new}}
create function private.jsonb_diff(p_old jsonb, p_new jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(n.key, jsonb_build_object('from', p_old -> n.key, 'to', n.value)),
    '{}'::jsonb
  )
  from jsonb_each(coalesce(p_new, '{}'::jsonb)) as n
  where (p_old -> n.key) is distinct from n.value;
$$;
