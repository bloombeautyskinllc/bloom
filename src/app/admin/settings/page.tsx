import { getTranslations } from 'next-intl/server';
import GoogleCalendarCard from '@/components/account/GoogleCalendarCard';
import SettingsForm from '@/components/admin/SettingsForm';
import { PageHeader, Panel, Stat } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Settings' };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  await requireAdmin('/admin/settings');
  const [t, { calendar }] = await Promise.all([getTranslations('bo'), searchParams]);
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: s }, { data: calendars }, jobs, syncErrors, emailsFailed, { data: recent }] = await Promise.all([
    supabase.from('business_settings').select('*').eq('id', 1).single(),
    supabase.rpc('google_calendar_status'),
    supabase.from('jobs').select('status'),
    supabase.from('calendar_events').select('id', { count: 'exact', head: true }).eq('sync_status', 'error'),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).in('status', ['failed', 'bounced', 'complained']).gte('created_at', weekAgo),
    supabase.from('jobs').select('type, status, attempts, last_error').in('status', ['failed', 'dead']).order('updated_at', { ascending: false }).limit(5),
  ]);
  if (!s) throw new Error('business_settings row missing');

  const count = (status: string) => (jobs.data ?? []).filter((j) => j.status === status).length;
  const business = calendars?.find((c) => c.owner_kind === 'business');

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <SettingsForm
          initial={{
            businessName: s.business_name,
            legalName: s.legal_name,
            addressLine1: s.address_line1 ?? '',
            addressLine2: s.address_line2 ?? '',
            phone: s.phone_e164 ?? '',
            whatsapp: s.whatsapp_e164 ?? '',
            publicEmail: s.public_email ?? '',
            privacyEmail: s.privacy_email,
            slotIntervalMin: s.slot_interval_min,
            minNoticeMin: s.min_notice_min,
            maxWindowDays: s.max_window_days,
            holdMinutes: s.hold_minutes,
            cancelCutoffHours: s.cancel_cutoff_hours,
            rescheduleCutoffHours: s.reschedule_cutoff_hours,
            maxReschedules: s.max_reschedules,
            refundPercent: s.cancellation_refund_percent,
            lateRefundPercent: s.late_cancellation_refund_percent,
            minorsAllowed: s.minors_allowed_with_guardian,
            reminderHours: s.reminder_offsets_min.map((m) => String(m / 60)).join(', '),
            alertEmails: s.admin_alert_emails.join(', '),
            reviewUrl: s.review_url ?? '',
            reviewDelayHours: s.review_request_delay_hours,
            paymentsEnabled: s.payments_enabled,
            depositPercent: s.deposit_percent,
          }}
        />

        <div className="flex flex-col gap-4 xl:sticky xl:top-8 xl:self-start">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{t('settings.integrations')}</h2>
          <GoogleCalendarCard kind="business" connection={business ? { googleEmail: business.google_email, lastError: business.last_error } : null} status={calendar} />
          <Panel title={t('health.title')}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t('health.jobsPending')} value={count('queued')} />
              <Stat label={t('health.jobsFailed')} value={count('failed')} tone={count('failed') ? 'warn' : 'default'} />
              <Stat label={t('health.jobsDead')} value={count('dead')} tone={count('dead') ? 'warn' : 'default'} />
              <Stat label={t('health.syncErrors')} value={syncErrors.count ?? 0} tone={syncErrors.count ? 'warn' : 'default'} />
              <Stat label={t('health.emailsFailed')} value={emailsFailed.count ?? 0} tone={emailsFailed.count ? 'warn' : 'default'} />
            </div>
            {recent && recent.length > 0 ? (
              <ul className="mt-4 divide-y divide-stone text-sm">
                {recent.map((j, i) => (
                  <li key={i} className="py-2">
                    <span className="text-ink">{j.type}</span> <span className="text-muted">· {j.status} · {j.attempts}×</span>
                    {j.last_error && <p className="mt-0.5 break-words text-xs text-muted">{j.last_error.slice(0, 180)}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">{t('health.allGood')}</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
