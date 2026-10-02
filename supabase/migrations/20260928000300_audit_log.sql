-- =============================================================================
-- Audit log: append-only record of every change and application event
--
-- * Row changes: private.audit_row() trigger on every business table.
-- * Application events (logins, emails, payment links, syncs): public.log_app_event(),
--   callable only with the service role (server code).
-- * Nobody can UPDATE, DELETE or TRUNCATE it; admins can read it.
-- =============================================================================

create table public.audit_log (
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  actor_user_id    uuid,
  actor_profile_id uuid,
  actor_type       public.actor_type not null,
  actor_role       text,
  action           text not null,
  entity_type      text not null,
  entity_id        text,
  before           jsonb,
  after            jsonb,
  diff             jsonb,
  ip               inet,
  user_agent       text,
  correlation_id   text,
  metadata         jsonb not null default '{}'::jsonb
);

comment on table public.audit_log is 'Append-only activity log. Written by triggers and log_app_event(); never updated or deleted.';

create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_profile_id, occurred_at desc);
create index audit_log_action_idx on public.audit_log (action, occurred_at desc);
create index audit_log_correlation_idx on public.audit_log (correlation_id) where correlation_id is not null;

-- -----------------------------------------------------------------------------
-- Append-only enforcement
-- -----------------------------------------------------------------------------
create function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only (% rejected)', tg_op using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function private.reject_audit_mutation();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.reject_audit_mutation();

revoke all on public.audit_log from anon, authenticated, service_role;
grant select on public.audit_log to authenticated, service_role;

alter table public.audit_log enable row level security;

create policy "audit_log: admins read"
  on public.audit_log for select
  to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Actor resolution
-- -----------------------------------------------------------------------------
create function private.resolve_actor(
  p_user_id uuid,
  out actor_user_id uuid,
  out actor_profile_id uuid,
  out actor_type public.actor_type,
  out actor_role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  actor_user_id := p_user_id;
  if p_user_id is null then
    actor_type := 'system';
    actor_role := coalesce(auth.jwt() ->> 'role', current_user);
    return;
  end if;

  select p.id, p.role into actor_profile_id, v_role
  from public.profiles p
  where p.user_id = p_user_id;

  actor_role := coalesce(v_role::text, 'client');
  actor_type := (case v_role when 'admin' then 'admin' when 'staff' then 'staff' else 'user' end)::public.actor_type;
end;
$$;

-- -----------------------------------------------------------------------------
-- Generic row trigger. Optional TG_ARGV: column names to redact (sensitive data):
--   execute function private.audit_row('answers', 'notes')
-- -----------------------------------------------------------------------------
create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  record;
  v_before jsonb;
  v_after  jsonb;
  v_diff   jsonb;
  v_col    text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_before := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_after := to_jsonb(new); end if;

  if tg_argv is not null then
    foreach v_col in array tg_argv loop
      if v_before ? v_col then v_before := jsonb_set(v_before, array[v_col], '"[redacted]"'); end if;
      if v_after ? v_col then v_after := jsonb_set(v_after, array[v_col], '"[redacted]"'); end if;
    end loop;
  end if;

  if tg_op = 'UPDATE' then
    v_diff := private.jsonb_diff(v_before, v_after) - 'updated_at';
    if v_diff = '{}'::jsonb then
      return new; -- nothing but updated_at changed
    end if;
  end if;

  select * into v_actor from private.resolve_actor(auth.uid());

  insert into public.audit_log (
    actor_user_id, actor_profile_id, actor_type, actor_role,
    action, entity_type, entity_id,
    before, after, diff,
    ip, user_agent, correlation_id
  ) values (
    v_actor.actor_user_id, v_actor.actor_profile_id, v_actor.actor_type, v_actor.actor_role,
    tg_table_name || '.' || lower(tg_op), tg_table_name, coalesce(v_after ->> 'id', v_before ->> 'id'),
    v_before, v_after, v_diff,
    private.request_ip(), private.request_user_agent(), private.request_correlation_id()
  );

  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- Application events (server only). The actor is passed explicitly because the
-- server calls this with the service role key.
-- -----------------------------------------------------------------------------
create function public.log_app_event(
  p_action         text,
  p_entity_type    text,
  p_entity_id      text default null,
  p_metadata       jsonb default '{}'::jsonb,
  p_actor_user_id  uuid default null,
  p_ip             text default null,
  p_user_agent     text default null,
  p_correlation_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_id    bigint;
begin
  select * into v_actor from private.resolve_actor(coalesce(p_actor_user_id, auth.uid()));

  insert into public.audit_log (
    actor_user_id, actor_profile_id, actor_type, actor_role,
    action, entity_type, entity_id, metadata,
    ip, user_agent, correlation_id
  ) values (
    v_actor.actor_user_id, v_actor.actor_profile_id, v_actor.actor_type, v_actor.actor_role,
    p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb),
    coalesce(private.safe_inet(p_ip), private.request_ip()),
    left(coalesce(p_user_agent, private.request_user_agent()), 500),
    coalesce(p_correlation_id, private.request_correlation_id())
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.log_app_event(text, text, text, jsonb, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.log_app_event(text, text, text, jsonb, uuid, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- Audit the tables created so far
-- -----------------------------------------------------------------------------
create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function private.audit_row();
