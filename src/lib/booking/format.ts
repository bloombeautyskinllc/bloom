// Display helpers shared by server and client. Every formatter pins the locale and the business time
// zone so server-rendered and hydrated output are identical.

export const BUSINESS_TIME_ZONE = 'America/New_York';

export function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** "$120" or "from $120" for starting prices */
export function formatPrice(cents: number, priceType: 'fixed' | 'from') {
  return priceType === 'from' ? `from ${formatMoney(cents)}` : formatMoney(cents);
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const timeFmt = new Map<string, Intl.DateTimeFormat>();
function fmt(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = timeZone + JSON.stringify(options);
  let f = timeFmt.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, ...options });
    timeFmt.set(key, f);
  }
  return f;
}

/** "11:00 AM" */
export function formatTime(instant: number | string | Date, timeZone = BUSINESS_TIME_ZONE) {
  return fmt(timeZone, { hour: 'numeric', minute: '2-digit' }).format(new Date(instant));
}

/** "Tuesday, October 6, 2026" */
export function formatDateLong(instant: number | string | Date, timeZone = BUSINESS_TIME_ZONE) {
  return fmt(timeZone, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(instant));
}

/** "Tue, Oct 6" */
export function formatDateShort(instant: number | string | Date, timeZone = BUSINESS_TIME_ZONE) {
  return fmt(timeZone, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(instant));
}

/** A calendar date ('YYYY-MM-DD') shown as "Tuesday, October 6" without time zone shifts */
export function formatCalendarDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return fmt('UTC', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d)));
}
