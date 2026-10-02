import type { GoogleEventInput } from './calendar';

export type BookingForCalendar = {
  id: string;
  code: string;
  startAt: string;
  endAt: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  isStartingPrice: boolean;
  treatmentName: string;
  optionNames: string[];
  clientNotes: string | null;
  client: { name: string | null; email: string | null; phone: string | null };
};

/** Private marker on every event we create, so the two-way sync never mirrors our own events as blocks */
export const BOOKING_ID_PROPERTY = 'bloomBookingId';

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;

/** Business (and specialist) calendar: everything staff need at a glance */
export function businessEvent(b: BookingForCalendar, opts: { adminUrl: string; timeZone: string }): GoogleEventInput {
  const service = b.optionNames.length ? `${b.treatmentName} (${b.optionNames.join(', ')})` : b.treatmentName;
  const lines = [
    `Client: ${b.client.name ?? 'Unknown'}`,
    b.client.phone && `Phone: ${b.client.phone}`,
    b.client.email && `Email: ${b.client.email}`,
    `Treatment: ${service}`,
    `Price: ${b.isStartingPrice ? 'from ' : ''}${money(b.totalCents)}`,
    `Payment: ${b.paymentStatus.replace('_', ' ')}`,
    b.clientNotes && `Notes: ${b.clientNotes}`,
    `Booking: ${b.code}`,
    `Back office: ${opts.adminUrl}`,
  ].filter(Boolean);

  return {
    summary: `${b.client.name ?? 'Client'} · ${b.treatmentName}`,
    description: lines.join('\n'),
    start: { dateTime: b.startAt, timeZone: opts.timeZone },
    end: { dateTime: b.endAt, timeZone: opts.timeZone },
    transparency: 'opaque',
    extendedProperties: { private: { [BOOKING_ID_PROPERTY]: b.id } },
  };
}

/** Client's own calendar: their appointment only, no internal data */
export function clientEvent(b: BookingForCalendar, opts: { manageUrl: string; location: string; timeZone: string }): GoogleEventInput {
  const service = b.optionNames.length ? `${b.treatmentName}: ${b.optionNames.join(', ')}` : b.treatmentName;
  return {
    summary: `BLOOM Beauty Skin · ${b.treatmentName}`,
    description: `${service}\nBooking ${b.code}\nManage your appointment: ${opts.manageUrl}`,
    location: opts.location,
    start: { dateTime: b.startAt, timeZone: opts.timeZone },
    end: { dateTime: b.endAt, timeZone: opts.timeZone },
    reminders: { useDefault: true },
    extendedProperties: { private: { [BOOKING_ID_PROPERTY]: b.id } },
  };
}
