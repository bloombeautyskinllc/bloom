import { after } from 'next/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import AccountSection from '@/components/account/AccountSection';
import Card from '@/components/account/Card';
import PaymentPending from '@/components/booking/PaymentPending';
import { routes } from '@/data/site';
import { requireOnboardedProfile } from '@/lib/auth/session';
import { formatMoney } from '@/lib/booking/format';
import { processJobs } from '@/lib/jobs/runner';
import { reconcileLinks } from '@/lib/payments/links';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('payment');
  return { title: t('metaTitle'), robots: { index: false } };
}

// Square sends the client here after checkout. The webhook may not have arrived yet, so the
// booking's link is checked with Square right away (idempotent) before showing the outcome.
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<{ booking?: string; for?: string }> }) {
  const { booking: raw, for: purpose } = await searchParams;
  const forBalance = purpose === 'balance';
  const bookingId = z.uuid().safeParse(raw);
  await requireOnboardedProfile(bookingId.success ? `${routes.booking}/return?booking=${bookingId.data}${forBalance ? '&for=balance' : ''}` : routes.dashboard);
  if (!bookingId.success) redirect(routes.dashboard);

  const supabase = await createClient();
  const load = async () =>
    (await supabase.from('bookings').select('id, code, status, amount_paid_cents, amount_refunded_cents').eq('id', bookingId.data).maybeSingle()).data;

  let b = await load(); // RLS: the client's own booking only
  if (!b) redirect(routes.dashboard);
  // Still waiting: the deposit while the booking is pending, or an unpaid balance link
  let waiting = b.status === 'pending_payment';
  try {
    const result = await reconcileLinks({ bookingId: b.id });
    // The payment confirmed the booking and queued its emails and calendar sync: send them now, not at the next cron tick
    if (result.paid > 0) after(() => processJobs({ limit: 10 }).catch((e) => console.error('[jobs] inline run failed', e)));
    b = (await load()) ?? b;
    const settled = b.status === 'confirmed' || b.status === 'completed';
    waiting = b.status === 'pending_payment' || (forBalance && settled && result.checked > result.paid);
  } catch (e) {
    console.error('[payments] return page reconcile failed', e);
  }
  if (!waiting && (b.status === 'confirmed' || b.status === 'completed')) {
    redirect(`${routes.dashboard}?${forBalance ? 'paid' : 'booked'}=${encodeURIComponent(b.code)}`);
  }

  const t = await getTranslations('payment');
  const refunded = b.amount_refunded_cents > 0;

  return (
    <AccountSection label={t('label')} lead={t('lead')} accent={t(`accent.${waiting ? 'pending' : 'released'}`)}>
      <Card>
        {waiting ? (
          <PaymentPending bookingId={b.id} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] leading-relaxed text-ink">
              {b.amount_paid_cents > 0
                ? refunded
                  ? t('released.refunded', { amount: formatMoney(b.amount_refunded_cents), code: b.code })
                  : t('released.refunding', { code: b.code })
                : t('released.unpaid')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={routes.booking} className="btn-dark">
                {t('bookAgain')}
              </Link>
              <Link href={routes.dashboard} className="rounded-full border border-taupe px-5 py-3 text-sm font-medium text-ink">
                {t('toDashboard')}
              </Link>
            </div>
          </div>
        )}
      </Card>
    </AccountSection>
  );
}
