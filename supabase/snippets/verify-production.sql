-- BLOOM: production health check. Read-only: paste into Supabase > SQL Editor and run.
-- ok = true: fine · false: needs attention · null: informational
with
expected_tables(name) as (values
  ('public.profiles'), ('public.audit_log'), ('public.service_categories'), ('public.intake_forms'),
  ('public.treatments'), ('public.treatment_options'), ('public.specialists'), ('public.specialist_treatments'),
  ('public.working_hours'), ('public.business_settings'), ('public.jobs'), ('public.notifications'),
  ('public.webhook_events'), ('public.availability_blocks'), ('public.bookings'), ('public.booking_items'),
  ('public.intake_responses'), ('public.calendar_events'), ('public.google_watch_channels'),
  ('public.google_sync_state'), ('public.booking_notes'), ('public.client_notes'), ('public.client_tags'),
  ('public.client_tag_links'), ('public.client_documents'), ('private.google_credentials')
),
expected_functions(name) as (values
  -- one per migration, ending with the latest (back office)
  ('private.set_updated_at'), ('private.handle_new_auth_user'), ('private.audit_row'), ('public.get_public_settings'),
  ('public.claim_jobs'), ('public.submit_booking'), ('public.hold_slot'), ('private.handle_auth_email_confirmed'),
  ('public.configure_job_worker'), ('private.call_job_worker'), ('public.store_google_credential'),
  ('public.staff_set_booking_status'), ('public.admin_create_booking'), ('public.admin_dashboard'),
  ('public.admin_set_working_hours'), ('public.flag_bookings_pending_closure')
),
expected_triggers(tbl, name) as (values
  ('auth.users', 'on_auth_user_created'), ('auth.users', 'on_auth_user_email_confirmed'),
  ('public.bookings', 'bookings_enqueue_jobs'), ('public.bookings', 'bookings_set_blocked_range'),
  ('public.profiles', 'profiles_guard'), ('public.audit_log', 'audit_log_no_update_delete')
),
expected_cron(name) as (values
  ('bloom-job-worker'), ('bloom-expire-holds'), ('bloom-calendar-pull'), ('bloom-calendar-renew'), ('bloom-flag-closure')
),
checks as (
  -- 1. Extensions
  select 1 as ord, 'extensions' as section, e.name as "check",
         x.extname is not null as ok, coalesce('v' || x.extversion, 'not installed') as detail
  from (values ('pg_cron'), ('pg_net'), ('btree_gist'), ('supabase_vault')) e(name)
  left join pg_extension x on x.extname = e.name

  -- 2. Migrations: tables, functions, triggers
  union all
  select 2, 'tables', t.name, to_regclass(t.name) is not null,
         case when to_regclass(t.name) is null then 'missing: apply migrations' else 'ok' end
  from expected_tables t

  union all
  select 3, 'rls', t.name, c.relrowsecurity,
         case when c.relrowsecurity then 'enabled' else 'RLS DISABLED' end
  from expected_tables t join pg_class c on c.oid = to_regclass(t.name)
  where t.name like 'public.%'

  union all
  select 4, 'functions', f.name,
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname || '.' || p.proname = f.name),
         ''
  from expected_functions f

  union all
  select 5, 'triggers', tr.tbl || ' → ' || tr.name,
         exists (select 1 from pg_trigger g where g.tgrelid = to_regclass(tr.tbl) and g.tgname = tr.name and g.tgenabled <> 'D'),
         ''
  from expected_triggers tr

  -- 3. Scheduled jobs (pg_cron) and their last run
  union all
  select 6, 'cron', ec.name, coalesce(j.active, false),
         case when j.jobid is null then 'not scheduled'
              else j.schedule || coalesce(' · last: ' || r.status || ' ' || to_char(r.start_time, 'YYYY-MM-DD HH24:MI'), ' · never ran')
                   || coalesce(' · ' || nullif(left(r.return_message, 80), ''), '') end
  from expected_cron ec
  left join cron.job j on j.jobname = ec.name
  left join lateral (select d.status, d.start_time, d.return_message from cron.job_run_details d
                     where d.jobid = j.jobid order by d.start_time desc limit 1) r on true

  -- 4. Job worker config in Vault (npm run jobs:configure -- <site url>)
  union all
  select 7, 'vault', 'bloom_app_url', s.decrypted_secret ~ '^https://',
         coalesce(s.decrypted_secret, 'not set: run npm run jobs:configure -- https://<domain>')
  from (select 1) one left join vault.decrypted_secrets s on s.name = 'bloom_app_url'

  union all
  select 7, 'vault', 'bloom_jobs_secret', length(s.decrypted_secret) >= 32,
         coalesce('set (' || length(s.decrypted_secret) || ' chars, must equal JOBS_SECRET in Vercel)', 'not set')
  from (select 1) one left join vault.decrypted_secrets s on s.name = 'bloom_jobs_secret'

  -- 5. Worker HTTP calls in the last 6 hours (pg_net keeps responses ~6 h). 200 = OK, 401 = JOBS_SECRET mismatch
  union all
  select 8, 'worker calls (6h)', coalesce('HTTP ' || status_code, 'no response'),
         status_code = 200,
         count(*) || ' calls · last ' || to_char(max(created), 'YYYY-MM-DD HH24:MI')
           || coalesce(' · ' || left(max(coalesce(error_msg, '')), 80), '')
  from net._http_response
  group by status_code

  -- 6. Job queue
  union all
  select 9, 'jobs', s.status::text, case when s.status in ('dead', 'failed') then count(j.id) = 0 end,
         count(j.id) || ' jobs'
         || coalesce(' · overdue since ' || to_char(min(j.next_run_at) filter (where j.next_run_at < now() - interval '5 minutes' and s.status in ('queued', 'failed')), 'YYYY-MM-DD HH24:MI'), '')
  from unnest(enum_range(null::public.job_status)) s(status)
  left join public.jobs j on j.status = s.status
  group by s.status

  union all
  select 9, 'jobs', 'last errors', null, string_agg(distinct j.type || ': ' || left(j.last_error, 100), ' | ')
  from public.jobs j where j.last_error is not null and j.updated_at > now() - interval '7 days'

  -- 7. Notifications in the last 7 days
  union all
  select 10, 'notifications (7d)', n.status::text, case when n.status in ('bounced', 'complained', 'failed') then false end,
         count(*) || ''
  from public.notifications n where n.created_at > now() - interval '7 days'
  group by n.status

  -- 8. Data
  union all
  select 11, 'data', 'business_settings', count(*) > 0, count(*) || ' rows' from public.business_settings
  union all
  select 11, 'data', 'treatments (active)', count(*) > 0, count(*) || ' rows' from public.treatments where is_active
  union all
  select 11, 'data', 'specialists (active)', count(*) > 0, count(*) || ' rows' from public.specialists where is_active
  union all
  select 11, 'data', 'working_hours', count(*) > 0, count(*) || ' rows' from public.working_hours
  union all
  select 11, 'data', 'admins', count(*) > 0,
         coalesce(string_agg(p.email, ', '), 'none yet: sign in with an email listed in ADMIN_EMAILS')
  from public.profiles p where p.role = 'admin' and p.deleted_at is null

  -- 9. Google Calendar (business account connected from the admin panel)
  union all
  select 12, 'google', 'business calendar connected', count(*) > 0,
         coalesce(string_agg(c.google_email, ', '), 'not connected yet (optional)')
  from private.google_credentials c where c.owner_kind = 'business' and c.revoked_at is null
)
select section, "check", ok, detail
from checks
order by ord, ok nulls last, "check";
