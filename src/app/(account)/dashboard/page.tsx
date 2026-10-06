import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import AccountSection from '@/components/account/AccountSection';
import Card from '@/components/account/Card';
import BookingCard, { type DashboardBooking } from '@/components/dashboard/BookingCard';
import ProfileCard from '@/components/dashboard/ProfileCard';
import { routes } from '@/data/site';
import { requireOnboardedProfile } from '@/lib/auth/session';
import { bookingCalendarEvent } from '@/lib/booking/calendar-event';
import { googleCalendarUrl } from '@/lib/calendar/ics';
import { env } from '@/lib/env';
import { firstName as getFirstName } from '@/lib/format/name';
import { activeSquare } from '@/lib/payments/square';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard');
  return { title: t('metaTitle'), robots: { index: false } };
}

type Policy = { cancel_cutoff_hours?: number; reschedule_cutoff_hours?: number; max_reschedules?: number; cancellation_refund_percent?: number };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ booked?: string; paid?: string }> }) {
  const { profile } = await requireOnboardedProfile(routes.dashboard);
  const [t, settings, { booked, paid }] = await Promise.all([getTranslations('dashboard'), getPublicSettings(), searchParams]);

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('bookings')
    .select('id, code, status, payment_status, start_at, end_at, total_cents, amount_due_cents, amount_paid_cents, amount_refunded_cents, hold_expires_at, reschedule_count, policy, items:booking_items(kind, name, price_type, duration_minutes, sort_order), consent:consent_forms(booking_id)')
    .eq('client_id', profile.id)
    .not('status', 'in', '("held","expired")')
    .order('start_at', { ascending: true });
  if (error) throw new Error(`bookings load failed: ${error.message}`);

  const now = Date.now();
  const onlinePayments = settings.payments_enabled && (await activeSquare()) !== null;
  const bookings = (rows ?? []).map((b) => {
    const policy = (b.policy ?? {}) as Policy;
    const items = [...b.items].sort((a, z) => a.sort_order - z.sort_order);
    const hoursLeft = (Date.parse(b.start_at) - now) / 3_600_000;
    const booking: DashboardBooking = {
      id: b.id,
      code: b.code,
      status: b.status,
      paymentStatus: b.payment_status,
      startAt: b.start_at,
      endAt: b.end_at,
      totalCents: b.total_cents,
      amountDueCents: b.amount_due_cents,
      amountPaidCents: b.amount_paid_cents,
      amountRefundedCents: b.amount_refunded_cents,
      payBy: b.status === 'pending_payment' ? b.hold_expires_at : null,
      balanceCents: Math.max(b.total_cents - (b.amount_paid_cents - b.amount_refunded_cents), 0),
      // The balance is paid once the treatment has started (or later from the history)
      canPayBalance:
        onlinePayments && (b.status === 'confirmed' || b.status === 'completed') && Date.parse(b.start_at) <= now && b.total_cents > b.amount_paid_cents - b.amount_refunded_cents,
      isStartingPrice: items.some((i) => i.price_type === 'from'),
      treatmentName: items.find((i) => i.kind === 'treatment')?.name ?? 'Appointment',
      optionNames: items.filter((i) => i.kind === 'option').map((i) => i.name),
      durationMin: (Date.parse(b.end_at) - Date.parse(b.start_at)) / 60_000,
      canChange: hoursLeft >= Math.max(policy.cancel_cutoff_hours ?? 0, 0),
      reschedulesLeft: hoursLeft >= (policy.reschedule_cutoff_hours ?? 0) ? Math.max((policy.max_reschedules ?? 0) - b.reschedule_count, 0) : 0,
      refundPercent: policy.cancellation_refund_percent ?? null,
      googleCalendarUrl: googleCalendarUrl(bookingCalendarEvent(b, env.NEXT_PUBLIC_SITE_URL)),
      hasConsent: Boolean(b.consent),
    };
    return booking;
  });

  const isUpcoming = (b: DashboardBooking) => (b.status === 'confirmed' || b.status === 'pending_payment') && Date.parse(b.endAt) >= now;
  const upcoming = bookings.filter(isUpcoming);
  const history = bookings.filter((b) => !isUpcoming(b)).reverse();
  const justBooked = booked ? upcoming.find((b) => b.code === booked) : undefined;
  const justPaid = paid ? bookings.find((b) => b.code === paid) : undefined;

  return (
    <AccountSection label={t('label')} lead={t('greetingLead')} accent={`${getFirstName(profile.full_name)}.`} wide>
      {justPaid && (
        <p role="status" className="mb-6 rounded-2xl border border-cocoa/20 bg-cream px-5 py-4 text-[15px] text-ink shadow-soft">
          {t('paidThanks', { code: justPaid.code })}
        </p>
      )}
      {justBooked && (
        <p role="status" className="mb-6 rounded-2xl border border-cocoa/20 bg-cream px-5 py-4 text-[15px] text-ink shadow-soft">
          {justBooked.status === 'pending_payment' ? t('bookedPendingPayment', { code: justBooked.code }) : t('booked', { code: justBooked.code })}
          {justBooked.hasConsent && (
            <>
              {' '}
              <a href={`/api/bookings/${justBooked.id}/consent`} className="font-medium underline decoration-taupe underline-offset-4">
                {t('downloadConsentLink')}
              </a>
            </>
          )}
        </p>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="upcoming-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="upcoming-title" className="font-serif text-[28px] leading-tight text-ink sm:text-[32px]">
                {t('upcoming')}
              </h2>
              <Link href={routes.booking} className="btn-dark py-2.5">
                {t('book')}
              </Link>
            </div>
            <div className="mt-5 flex flex-col gap-4">
              {upcoming.length === 0 ? (
                <Card>
                  <p className="text-muted">{t('noUpcoming')}</p>
                </Card>
              ) : (
                upcoming.map((b) => <BookingCard key={b.id} booking={b} timeZone={settings.timezone} maxWindowDays={settings.max_window_days} upcoming />)
              )}
            </div>
          </section>

          <section aria-labelledby="history-title">
            <h2 id="history-title" className="font-serif text-[28px] leading-tight text-ink sm:text-[32px]">
              {t('history')}
            </h2>
            <div className="mt-5 flex flex-col gap-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted">{t('noHistory')}</p>
              ) : (
                history.map((b) => <BookingCard key={b.id} booking={b} timeZone={settings.timezone} maxWindowDays={settings.max_window_days} upcoming={false} />)
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-32 lg:self-start">
          <ProfileCard fullName={profile.full_name ?? ''} email={profile.email} phoneE164={profile.phone_e164} reminders={profile.reminders_opt_in} />
        </div>
      </div>
    </AccountSection>
  );
}
