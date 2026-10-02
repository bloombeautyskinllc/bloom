'use client';

import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { useTranslations } from 'next-intl';
import { addDays, isoWeekday, parseDate } from '@/lib/availability/timezone';
import { formatCalendarDate } from '@/lib/booking/format';
import { cn } from '@/lib/utils';

type Props = {
  month: string; // 'YYYY-MM'
  selected: string | null; // 'YYYY-MM-DD'
  availableCounts: Map<string, number>;
  canGoBack: boolean;
  canGoForward: boolean;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(month: string) {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  return { first, last };
}

// US-style month grid (weeks start on Sunday). Only dates with availability are enabled.
export default function MonthCalendar({ month, selected, availableCounts, canGoBack, canGoForward, onMonthChange, onSelect }: Props) {
  const t = useTranslations('booking.datetime');
  const { first, last } = monthBounds(month);
  const leading = isoWeekday(first) % 7; // Sunday -> 0
  const days: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);

  const { year, month: m } = parseDate(first);
  const title = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, m - 1, 1)));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl text-ink" aria-live="polite">
          {title}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            disabled={!canGoBack}
            aria-label={t('previousMonth')}
            className="grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-sand disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <HiChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            disabled={!canGoForward}
            aria-label={t('nextMonth')}
            className="grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-sand disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <HiChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center" role="grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-bronze" role="columnheader">
            {w}
          </div>
        ))}
        {days.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} />;
          const count = availableCounts.get(date) ?? 0;
          const isSelected = date === selected;
          const day = Number(date.slice(8));
          return (
            <button
              key={date}
              type="button"
              disabled={count === 0}
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${formatCalendarDate(date)}${count > 0 ? `, ${count} ${t('available')}` : ''}`}
              className={cn(
                'relative mx-auto grid aspect-square w-full max-w-[48px] place-items-center rounded-full text-[15px] transition',
                count === 0 && 'cursor-default text-muted/35',
                count > 0 && !isSelected && 'font-medium text-ink hover:bg-sand',
                isSelected && 'bg-cocoa font-semibold text-cream',
              )}
            >
              {day}
              {count > 0 && !isSelected && <span aria-hidden className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

