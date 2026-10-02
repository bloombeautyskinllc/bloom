// "2026-09-28" -> "September 28, 2026". Versions that are not ISO dates are shown as they are.
export function formatLegalDate(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, y, m, d] = match;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(+y, +m - 1, +d)));
}
