'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { routes } from '@/data/site';
import { startPayment } from '@/lib/booking/actions';

const CHECKS = 10;
const EVERY_MS = 3000;

/** Re-checks the payment a few times (the page reconciles with Square on each refresh), then offers to pay again. */
export default function PaymentPending({ bookingId }: { bookingId: string }) {
  const t = useTranslations('payment');
  const tb = useTranslations('booking');
  const router = useRouter();
  const [checks, setChecks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const waiting = checks < CHECKS;

  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => {
      setChecks((c) => c + 1);
      router.refresh();
    }, EVERY_MS);
    return () => clearTimeout(id);
  }, [checks, waiting, router]);

  const payAgain = () =>
    startTransition(async () => {
      const result = await startPayment({ bookingId });
      if (result.ok) window.location.assign(result.data.url);
      else setError(tb(`errors.${result.error}`));
    });

  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <p className="text-[15px] leading-relaxed text-ink">{waiting ? t('pending.checking') : t('pending.notYet')}</p>
      {error && <p className="rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">{error}</p>}
      {!waiting && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={payAgain} disabled={pending} className="btn-dark disabled:opacity-60">
            {pending ? t('redirecting') : t('payNow')}
          </button>
          <Link href={routes.dashboard} className="rounded-full border border-taupe px-5 py-3 text-sm font-medium text-ink">
            {t('toDashboard')}
          </Link>
        </div>
      )}
    </div>
  );
}
