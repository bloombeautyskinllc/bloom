import { describe, expect, it, vi } from 'vitest';
import { BOOKING_ID_PROPERTY, businessEvent, clientEvent, type BookingForCalendar } from './booking-event';
import { CalendarClient, GoogleApiError } from './calendar';
import { mirrorAction } from './sync-mirror';

const TZ = 'America/New_York';

const booking: BookingForCalendar = {
  id: 'b-1',
  code: 'BLM-ABC',
  startAt: '2026-10-06T15:00:00.000Z',
  endAt: '2026-10-06T15:25:00.000Z',
  status: 'confirmed',
  paymentStatus: 'unpaid',
  totalCents: 9500,
  isStartingPrice: true,
  treatmentName: 'Diode Laser Hair Removal Session',
  optionNames: ['Upper Lip', 'Underarms'],
  clientNotes: 'Sensitive skin',
  client: { name: 'Maria Lopez', email: 'maria@example.com', phone: '+1 212 555 0123' },
};

describe('booking events', () => {
  it('gives staff everything in the business calendar', () => {
    const e = businessEvent(booking, { adminUrl: 'https://x/admin?booking=BLM-ABC', timeZone: TZ });
    expect(e.summary).toBe('Maria Lopez · Diode Laser Hair Removal Session');
    expect(e.description).toContain('Phone: +1 212 555 0123');
    expect(e.description).toContain('Treatment: Diode Laser Hair Removal Session (Upper Lip, Underarms)');
    expect(e.description).toContain('Price: from $95');
    expect(e.description).toContain('Payment: unpaid');
    expect(e.description).toContain('Notes: Sensitive skin');
    expect(e.extendedProperties?.private?.[BOOKING_ID_PROPERTY]).toBe('b-1');
  });

  it('keeps internal data out of the client calendar', () => {
    const e = clientEvent(booking, { manageUrl: 'https://x/dashboard', location: '305 E 204th St', timeZone: TZ });
    expect(e.description).not.toContain('Phone');
    expect(e.description).not.toContain('Sensitive skin');
    expect(e.location).toBe('305 E 204th St');
  });
});

describe('two-way sync rules', () => {
  it('blocks time for events created by hand', () => {
    expect(mirrorAction({ id: 'g1', start: { dateTime: '2026-10-06T14:00:00-04:00' }, end: { dateTime: '2026-10-06T16:00:00-04:00' } }, TZ)).toEqual({
      kind: 'upsert',
      googleEventId: 'g1',
      start: '2026-10-06T18:00:00.000Z',
      end: '2026-10-06T20:00:00.000Z',
    });
  });

  it('blocks whole local days for all-day events (end date exclusive)', () => {
    const a = mirrorAction({ id: 'off', start: { date: '2026-11-26' }, end: { date: '2026-11-27' } }, TZ);
    expect(a).toEqual({ kind: 'upsert', googleEventId: 'off', start: '2026-11-26T05:00:00.000Z', end: '2026-11-27T05:00:00.000Z' });
  });

  it('never mirrors our own booking events', () => {
    expect(mirrorAction({ id: 'x', extendedProperties: { private: { [BOOKING_ID_PROPERTY]: 'b-1' } }, start: { dateTime: '2026-10-06T14:00:00Z' }, end: { dateTime: '2026-10-06T15:00:00Z' } }, TZ).kind).toBe('ignore');
  });

  it('frees time when an event is deleted or marked as free', () => {
    expect(mirrorAction({ id: 'g1', status: 'cancelled' }, TZ)).toEqual({ kind: 'remove', googleEventId: 'g1' });
    expect(mirrorAction({ id: 'g2', transparency: 'transparent', start: { dateTime: '2026-10-06T14:00:00Z' }, end: { dateTime: '2026-10-06T15:00:00Z' } }, TZ).kind).toBe('remove');
  });
});

describe('CalendarClient', () => {
  it('treats deleting an already-deleted event as success', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Resource has been deleted' } }), { status: 410 }));
    await expect(new CalendarClient('token', fetchMock as unknown as typeof fetch).deleteEvent('primary', 'e1')).resolves.toBeUndefined();
  });

  it('surfaces other API errors with their status', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Forbidden' } }), { status: 403 }));
    await expect(new CalendarClient('token', fetchMock as unknown as typeof fetch).insertEvent('primary', {})).rejects.toBeInstanceOf(GoogleApiError);
  });

  it('sends a sync token instead of a time window on incremental syncs', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ items: [], nextSyncToken: 'n' }), { status: 200 }));
    await new CalendarClient('token', fetchMock as unknown as typeof fetch).listEvents('primary', { syncToken: 's1', timeMin: 'ignored' });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('syncToken')).toBe('s1');
    expect(url.searchParams.has('timeMin')).toBe(false);
  });
});
