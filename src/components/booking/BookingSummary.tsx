'use client';

import { useTranslations } from 'next-intl';
import { formatDateLong, formatDuration, formatMoney, formatTime } from '@/lib/booking/format';
import type { CatalogTreatment, Quote } from '@/lib/booking/types';

type Props = {
  treatment: CatalogTreatment | null;
  selectedOptions: CatalogTreatment['options'];
  quote: Quote | null;
  slot: string | null;
  timeZone: string;
};

/** Always-visible summary: sticky sidebar on desktop, compact bar at the bottom on phones */
export default function BookingSummary({ treatment, selectedOptions, quote, slot, timeZone }: Props) {
  const t = useTranslations('booking.summary');

  const details = treatment && quote && (
    <>
      <p className="font-serif text-xl text-ink">{treatment.name}</p>
      {selectedOptions.length > 0 && <p className="mt-1 text-sm text-muted">{selectedOptions.map((o) => o.name).join(', ')}</p>}
      <dl className="mt-4 flex flex-col gap-2 border-t border-stone pt-4 text-sm">
        {slot && (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t('date')}</dt>
              <dd className="text-right text-ink">{formatDateLong(slot, timeZone)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t('time')}</dt>
              <dd className="text-ink">{formatTime(slot, timeZone)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t('duration')}</dt>
          <dd className="text-ink">{formatDuration(quote.durationMinutes)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-stone pt-3">
          <dt className="font-medium text-ink">{t('total')}</dt>
          <dd className="font-serif text-2xl text-ink">
            {quote.priceType === 'from' && <span className="mr-1 font-sans text-xs text-muted">from</span>}
            {formatMoney(quote.totalCents)}
          </dd>
        </div>
      </dl>
      {quote.priceType === 'from' && <p className="mt-3 text-xs leading-relaxed text-muted">{t('estimate')}</p>}
    </>
  );

  return (
    <>
      <aside aria-label={t('title')} className="hidden lg:sticky lg:top-32 lg:block lg:self-start">
        <div className="rounded-[22px] border border-stone bg-cream/90 p-6 shadow-soft">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{t('title')}</p>
          <div className="mt-4">{details ?? <p className="text-sm text-muted">{t('empty')}</p>}</div>
        </div>
      </aside>

      {treatment && quote && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone bg-cream/95 px-5 py-3 shadow-[0_-12px_30px_rgba(35,27,21,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-site items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{treatment.name}</p>
              <p className="text-xs text-muted">
                {slot ? `${formatDateLong(slot, timeZone).replace(/, \d{4}$/, '')} · ${formatTime(slot, timeZone)} · ` : ''}
                {formatDuration(quote.durationMinutes)}
              </p>
            </div>
            <p className="shrink-0 font-serif text-xl text-ink">
              {quote.priceType === 'from' && <span className="mr-1 font-sans text-[10px] text-muted">from</span>}
              {formatMoney(quote.totalCents)}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
