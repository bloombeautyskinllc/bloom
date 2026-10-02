'use client';

import { useTranslations } from 'next-intl';
import { fromLocal, parseDate } from '@/lib/availability/timezone';
import { inputClass } from './ui';

// Business-time-zone date + time picker (the staff member's computer may be in another zone)
const TIMES = Array.from({ length: (22 - 7) * 4 + 1 }, (_, i) => {
  const minutes = 7 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export function toInstant(date: string, time: string, timeZone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  const instant = fromLocal({ ...parseDate(date), hour, minute }, timeZone);
  return instant === null ? null : new Date(instant).toISOString();
}

export function timeLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

type Props = { date: string; time: string; onChange: (v: { date: string; time: string }) => void; idPrefix: string };

export default function LocalDateTimeInput({ date, time, onChange, idPrefix }: Props) {
  const t = useTranslations('bo.newBooking');
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label htmlFor={`${idPrefix}-date`} className="mb-1.5 block text-sm font-medium text-ink">
          {t('date')}
        </label>
        <input id={`${idPrefix}-date`} type="date" value={date} onChange={(e) => onChange({ date: e.target.value, time })} className={inputClass} required />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-time`} className="mb-1.5 block text-sm font-medium text-ink">
          {t('time')}
        </label>
        <select id={`${idPrefix}-time`} value={time} onChange={(e) => onChange({ date, time: e.target.value })} className={inputClass} required>
          {TIMES.map((x) => (
            <option key={x} value={x}>
              {timeLabel(x)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
