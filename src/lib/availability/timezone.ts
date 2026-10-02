// Wall-clock <-> UTC conversions for an IANA time zone using Intl only (works in Node and browsers).
// All instants are epoch milliseconds; local dates are 'YYYY-MM-DD' strings.

export type LocalDateTime = { year: number; month: number; day: number; hour: number; minute: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Local wall-clock fields of an instant in `timeZone`. */
export function toLocal(instant: number, timeZone: string): LocalDateTime & { second: number } {
  const fields: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value);
  }
  return { year: fields.year, month: fields.month, day: fields.day, hour: fields.hour, minute: fields.minute, second: fields.second };
}

/** Minutes to add to UTC to get local time at that instant (New York: -240 in summer, -300 in winter). */
export function offsetMinutes(instant: number, timeZone: string) {
  const l = toLocal(instant, timeZone);
  const asUtc = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second);
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60_000);
}

/**
 * The instant at which the wall clock in `timeZone` shows `local`.
 * Returns null for times skipped by a DST jump (e.g. 02:30 on the spring-forward day).
 * Times repeated when clocks fall back resolve to the first occurrence.
 */
export function fromLocal(local: LocalDateTime, timeZone: string): number | null {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  let instant = naive - offsetMinutes(naive, timeZone) * 60_000;
  const corrected = naive - offsetMinutes(instant, timeZone) * 60_000;
  if (corrected !== instant) {
    instant = Math.min(instant, corrected);
  }
  const check = toLocal(instant, timeZone);
  const same =
    check.year === local.year && check.month === local.month && check.day === local.day && check.hour === local.hour && check.minute === local.minute;
  return same ? instant : null;
}

export function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export function formatDate({ year, month, day }: { year: number; month: number; day: number }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(date: string, days: number) {
  const { year, month, day } = parseDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}

/** ISO weekday of a calendar date: 1 = Monday ... 7 = Sunday */
export function isoWeekday(date: string) {
  const { year, month, day } = parseDate(date);
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}

/** Local calendar date of an instant. */
export function localDate(instant: number, timeZone: string) {
  return formatDate(toLocal(instant, timeZone));
}
