-- =============================================================================
-- Catalog (categories, treatments, options, intake forms), team, business hours
-- and business settings.
--
-- Read access: anyone reads active catalog rows; staff read everything.
-- Write access: admins only. Every table is audited.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------
create table public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  short_name  text,
  description text,
  color       text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Intake / consent forms (questions are validated by a Zod schema in the app)
-- -----------------------------------------------------------------------------
create table public.intake_forms (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null,
  name               text not null,
  version            integer not null default 1 check (version > 0),
  questions          jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  requires_signature boolean not null default false,
  is_active          boolean not null default true,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (slug, version)
);

-- -----------------------------------------------------------------------------
-- Treatments
-- -----------------------------------------------------------------------------
create table public.treatments (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null references public.service_categories (id),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name              text not null,
  description       text,
  includes          text[] not null default '{}',
  menu_group        text,
  price_cents       integer not null check (price_cents >= 0),
  price_type        public.price_type not null default 'fixed',
  currency          char(3) not null default 'USD',
  duration_minutes  integer check (duration_minutes is null or duration_minutes between 5 and 600),
  buffer_before_min integer not null default 0 check (buffer_before_min between 0 and 240),
  buffer_after_min  integer not null default 0 check (buffer_after_min between 0 and 240),
  deposit_cents     integer check (deposit_cents is null or deposit_cents >= 0),
  min_options       integer not null default 0 check (min_options >= 0),
  max_options       integer check (max_options is null or max_options >= 1),
  intake_form_id    uuid references public.intake_forms (id),
  is_best_seller    boolean not null default false,
  is_active         boolean not null default true,
  -- Seeded with estimated values that the owner has not confirmed yet
  needs_review      boolean not null default false,
  sort_order        integer not null default 0,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  is_bookable       boolean generated always as (
                      is_active and deleted_at is null and duration_minutes is not null
                    ) stored,
  check (max_options is null or max_options >= min_options)
);

create index treatments_category_idx on public.treatments (category_id, sort_order);

-- -----------------------------------------------------------------------------
-- Treatment options / add-ons (e.g. laser areas)
-- -----------------------------------------------------------------------------
create table public.treatment_options (
  id                     uuid primary key default gen_random_uuid(),
  treatment_id           uuid not null references public.treatments (id),
  slug                   text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  group_label            text,
  name                   text not null,
  description            text,
  price_cents            integer not null check (price_cents >= 0),
  price_type             public.price_type not null default 'fixed',
  extra_duration_minutes integer check (extra_duration_minutes is null or extra_duration_minutes between 0 and 600),
  is_active              boolean not null default true,
  needs_review           boolean not null default false,
  sort_order             integer not null default 0,
  deleted_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index treatment_options_treatment_idx on public.treatment_options (treatment_id, sort_order);

-- -----------------------------------------------------------------------------
-- Team
-- -----------------------------------------------------------------------------
create table public.specialists (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid unique references public.profiles (id),
  display_name       text not null,
  bio                text,
  color              text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  google_calendar_id text,
  is_active          boolean not null default true,
  needs_review       boolean not null default false,
  sort_order         integer not null default 0,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.specialist_treatments (
  specialist_id uuid not null references public.specialists (id) on delete cascade,
  treatment_id  uuid not null references public.treatments (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (specialist_id, treatment_id)
);

-- Weekly hours as local times in the business time zone (DST handled when expanding to dates)
create table public.working_hours (
  id            uuid primary key default gen_random_uuid(),
  specialist_id uuid references public.specialists (id) on delete cascade, -- null = business default
  iso_weekday   smallint not null check (iso_weekday between 1 and 7),
  start_time    time not null,
  end_time      time not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_time > start_time)
);

create index working_hours_specialist_idx on public.working_hours (specialist_id, iso_weekday);

-- -----------------------------------------------------------------------------
-- Business settings (single row, id = 1)
-- -----------------------------------------------------------------------------
create table public.business_settings (
  id                      smallint primary key default 1 check (id = 1),
  business_name           text not null,
  timezone                text not null default 'America/New_York',
  address_line1           text,
  address_line2           text,
  phone_e164              text,
  whatsapp_e164           text,
  public_email            text,
  slot_interval_min       integer not null default 15 check (slot_interval_min between 5 and 120),
  min_notice_min          integer not null default 120 check (min_notice_min >= 0),
  max_window_days         integer not null default 60 check (max_window_days between 1 and 365),
  hold_minutes            integer not null default 10 check (hold_minutes between 5 and 60),
  cancel_cutoff_hours     integer not null default 24 check (cancel_cutoff_hours >= 0),
  reschedule_cutoff_hours integer not null default 24 check (reschedule_cutoff_hours >= 0),
  max_reschedules         integer not null default 2 check (max_reschedules >= 0),
  reminder_offsets_min    integer[] not null default '{1440,120}',
  admin_alert_emails      text[] not null default '{}',
  payments_enabled        boolean not null default false,
  terms_version           text not null default '2026-09-28',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- updated_at + audit triggers
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['service_categories', 'intake_forms', 'treatments', 'treatment_options',
                           'specialists', 'working_hours', 'business_settings'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
                   t || '_set_updated_at', t);
  end loop;

  foreach t in array array['service_categories', 'intake_forms', 'treatments', 'treatment_options',
                           'specialists', 'specialist_treatments', 'working_hours', 'business_settings'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
                   t || '_audit', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.service_categories    enable row level security;
alter table public.intake_forms          enable row level security;
alter table public.treatments            enable row level security;
alter table public.treatment_options     enable row level security;
alter table public.specialists           enable row level security;
alter table public.specialist_treatments enable row level security;
alter table public.working_hours         enable row level security;
alter table public.business_settings     enable row level security;

-- Public catalog: active rows only; staff see everything
create policy "service_categories: public reads active"
  on public.service_categories for select to anon, authenticated
  using ((is_active and deleted_at is null) or (select private.is_staff()));

create policy "treatments: public reads active"
  on public.treatments for select to anon, authenticated
  using ((is_active and deleted_at is null) or (select private.is_staff()));

create policy "treatment_options: public reads active"
  on public.treatment_options for select to anon, authenticated
  using ((is_active and deleted_at is null) or (select private.is_staff()));

create policy "intake_forms: signed-in users read active"
  on public.intake_forms for select to authenticated
  using ((is_active and deleted_at is null) or (select private.is_staff()));

create policy "specialists: public reads active"
  on public.specialists for select to anon, authenticated
  using ((is_active and deleted_at is null) or (select private.is_staff()));

create policy "specialist_treatments: public reads"
  on public.specialist_treatments for select to anon, authenticated
  using (true);

create policy "working_hours: public reads"
  on public.working_hours for select to anon, authenticated
  using (true);

-- Settings include alert recipients: staff only. Public booking rules are served by an RPC (phase 3).
create policy "business_settings: staff read"
  on public.business_settings for select to authenticated
  using ((select private.is_staff()));

-- Admin writes on every catalog/team/settings table
do $$
declare
  t text;
begin
  foreach t in array array['service_categories', 'intake_forms', 'treatments', 'treatment_options',
                           'specialists', 'specialist_treatments', 'working_hours'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))',
                   t || ': admins insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
                   t || ': admins update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))',
                   t || ': admins delete', t);
  end loop;
end;
$$;

create policy "business_settings: admins update"
  on public.business_settings for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.service_categories, public.intake_forms, public.treatments, public.treatment_options,
              public.specialists, public.specialist_treatments, public.working_hours, public.business_settings
  from anon;
grant select on public.service_categories, public.treatments, public.treatment_options,
                public.specialists, public.specialist_treatments, public.working_hours
  to anon;

-- -----------------------------------------------------------------------------
-- Catalog rows that still need owner input (shown in the back office)
-- -----------------------------------------------------------------------------
create view public.catalog_pending_fields
with (security_invoker = true)
as
  select 'treatment'::text as kind, t.id, t.slug, t.name,
         array_remove(array[
           case when t.duration_minutes is null then 'duration' end,
           case when cardinality(t.includes) = 0 then 'includes' end,
           case when t.needs_review then 'estimated values' end
         ], null) as missing
  from public.treatments t
  where t.deleted_at is null
    and (t.duration_minutes is null or cardinality(t.includes) = 0 or t.needs_review)
  union all
  select 'option', o.id, o.slug, o.name,
         array_remove(array[
           case when o.extra_duration_minutes is null then 'duration' end,
           case when o.needs_review then 'estimated values' end
         ], null)
  from public.treatment_options o
  where o.deleted_at is null
    and (o.extra_duration_minutes is null or o.needs_review);

revoke all on public.catalog_pending_fields from anon;
