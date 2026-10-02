'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { addDays, localDate, toLocal } from '@/lib/availability/timezone';
import { formatCalendarDate, formatTime } from '@/lib/booking/format';
import { cn } from '@/lib/utils';
import MonthCalendar, { monthBounds, shiftMonth } from './MonthCalendar';

export type AvailabilitySource = { treatmentId: string; optionIds: string[] } | { bookingId: string };

type AvailabilityResponse = { timeZone: string; durationMin: number; days: { date: string; slots: string[] }[] };

type Props = {
  source: AvailabilitySource;
  timeZone: string;
  maxWindowDays: number;
  selected: string | null;
  pending?: boolean;
  onSelect: (slotIso: string) => void;
};

function sourceParams(source: AvailabilitySource) {
  const p = new URLSearchParams();
  if ('bookingId' in source) p.set('booking', source.bookingId);
  else {
    p.set('treatment', source.treatmentId);
    if (source.optionIds.length) p.set('options', [...source.optionIds].sort().join(','));
  }
  return p;
}

async function fetchAvailability(source: AvailabilitySource, from: string, to: string): Promise<AvailabilityResponse> {
  const p = sourceParams(source);
  p.set('from', from);
  p.set('to', to);
  const res = await fetch(`/api/availability?${p.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`availability ${res.status}`);
  return res.json();
}

/** Month calendar + slot list. Used by the booking flow and by "Reschedule" in the dashboard. */
export default function DateTimePicker({ source, timeZone, maxWindowDays, selected, pending = false, onSelect }: Props) {
  const t = useTranslations('booking.datetime');
  const today = localDate(Date.now(), timeZone);
  const lastDay = addDays(today, maxWindowDays);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState<string | null>(null);

  const { first, last } = monthBounds(month);
  const from = first < today ? today : first;
  const to = last > lastDay ? lastDay : last;

  const query = useQuery({
    queryKey: ['availability', sourceParams(source).toString(), from, to],
    queryFn: () => fetchAvailability(source, from, to),
    enabled: from <= to,
  });

  const counts = useMemo(() => new Map((query.data?.days ?? []).map((d) => [d.date, d.slots.length])), [query.data]);

  // Land on the first available day of the month
  useEffect(() => {
    if (!query.data) return;
    if (day && counts.has(day)) return;
    setDay(query.data.days[0]?.date ?? null);
  }, [query.data, counts, day]);

  const slots = query.data?.days.find((d) => d.date === day)?.slots ?? [];
  const groups = [
    { key: 'morning', items: slots.filter((s) => toLocal(Date.parse(s), timeZone).hour < 12) },
    { key: 'afternoon', items: slots.filter((s) => toLocal(Date.parse(s), timeZone).hour >= 12 && toLocal(Date.parse(s), timeZone).hour < 17) },
    { key: 'evening', items: slots.filter((s) => toLocal(Date.parse(s), timeZone).hour >= 17) },
  ] as const;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-10">
      <MonthCalendar
        month={month}
        selected={day}
        availableCounts={counts}
        canGoBack={month > today.slice(0, 7)}
        canGoForward={shiftMonth(month, 1) <= lastDay.slice(0, 7)}
        onMonthChange={(m) => {
          setMonth(m);
          setDay(null);
        }}
        onSelect={setDay}
      />

      <div aria-live="polite" aria-busy={query.isFetching}>
        {query.isPending && from <= to ? (
          <p className="text-sm text-muted">{t('loading')}</p>
        ) : query.isError ? (
          <div className="text-sm text-muted">
            <p>{t('unavailable')}</p>
            <button type="button" onClick={() => query.refetch()} className="mt-2 text-ink underline decoration-taupe underline-offset-4">
              {t('retry')}
            </button>
          </div>
        ) : !day ? (
          <p className="text-sm text-muted">{t('noSlotsMonth')}</p>
        ) : (
          <>
            <p className="font-serif text-xl text-ink">{formatCalendarDate(day)}</p>
            {slots.length === 0 && <p className="mt-3 text-sm text-muted">{t('noSlots')}</p>}
            <div className="mt-4 flex flex-col gap-5">
              {groups
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.key}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{t(g.key)}</p>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                      {g.items.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          disabled={pending}
                          onClick={() => onSelect(slot)}
                          aria-pressed={slot === selected}
                          className={cn(
                            'whitespace-nowrap rounded-xl border px-1 py-2.5 text-[13px] font-medium transition disabled:opacity-60 sm:text-sm',
                            slot === selected ? 'border-cocoa bg-cocoa text-cream' : 'border-taupe bg-white text-ink hover:border-bronze',
                          )}
                        >
                          {formatTime(slot, timeZone)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
        <p className="mt-6 text-xs text-muted">{t('timezone')}</p>
      </div>
    </div>
  );
}
