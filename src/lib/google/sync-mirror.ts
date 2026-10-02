import { fromLocal, parseDate } from '@/lib/availability/timezone';
import { BOOKING_ID_PROPERTY } from './booking-event';
import type { GoogleEvent } from './calendar';

export type MirrorAction = { kind: 'upsert'; googleEventId: string; start: string; end: string } | { kind: 'remove'; googleEventId: string } | { kind: 'ignore' };

/**
 * Two-way sync rule for the business calendar: events created by hand in Google (a day off, a
 * personal appointment) block availability; our own booking events and "free" events do not.
 */
export function mirrorAction(event: GoogleEvent, timeZone: string): MirrorAction {
  if (event.extendedProperties?.private?.[BOOKING_ID_PROPERTY]) return { kind: 'ignore' };
  if (event.status === 'cancelled' || event.transparency === 'transparent') return { kind: 'remove', googleEventId: event.id };

  const start = toInstant(event.start, timeZone);
  const end = toInstant(event.end, timeZone);
  if (!start || !end || end <= start) return { kind: 'ignore' };
  return { kind: 'upsert', googleEventId: event.id, start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

// Timed events carry an instant; all-day events a local date (end date exclusive), taken in the business time zone
function toInstant(time: GoogleEvent['start'], timeZone: string): number | null {
  if (!time) return null;
  if (time.dateTime) return Date.parse(time.dateTime);
  if (time.date) return fromLocal({ ...parseDate(time.date), hour: 0, minute: 0 }, timeZone);
  return null;
}
