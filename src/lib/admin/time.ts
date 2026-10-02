import { addDays, fromLocal, isoWeekday, localDate, parseDate } from '@/lib/availability/timezone';

/** Midnight of a local calendar date, as an instant */
export function startOfLocalDay(date: string, timeZone: string) {
  return fromLocal({ ...parseDate(date), hour: 0, minute: 0 }, timeZone) ?? Date.parse(`${date}T00:00:00Z`);
}

/** [start, end) of `days` local days starting at `date` */
export function localRange(date: string, days: number, timeZone: string) {
  return { from: new Date(startOfLocalDay(date, timeZone)), to: new Date(startOfLocalDay(addDays(date, days), timeZone)), fromDate: date, toDate: addDays(date, days) };
}

export function todayRange(timeZone: string, now = Date.now()) {
  return localRange(localDate(now, timeZone), 1, timeZone);
}

/** Monday-based week containing `date` */
export function weekRange(date: string, timeZone: string) {
  return localRange(addDays(date, 1 - isoWeekday(date)), 7, timeZone);
}

export function monthRange(date: string, timeZone: string) {
  const { year, month } = parseDate(date);
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const days = Math.round((Date.parse(next) - Date.parse(first)) / 86_400_000);
  return localRange(first, days, timeZone);
}
