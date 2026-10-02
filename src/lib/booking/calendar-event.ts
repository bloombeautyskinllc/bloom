import { site } from '@/data/site';
import type { CalendarEvent } from '@/lib/calendar/ics';

type BookingForCalendar = {
  id: string;
  code: string;
  start_at: string;
  end_at: string;
  reschedule_count: number;
  status: string;
  items: { kind: string; name: string }[];
};

/** Calendar event for a client's own booking (.ics download and "Add to Google Calendar") */
export function bookingCalendarEvent(booking: BookingForCalendar, siteUrl: string): CalendarEvent {
  const treatment = booking.items.find((i) => i.kind === 'treatment')?.name ?? 'Appointment';
  const options = booking.items.filter((i) => i.kind === 'option').map((i) => i.name);
  const what = options.length > 0 ? `${treatment}: ${options.join(', ')}` : treatment;

  return {
    uid: `${booking.id}@bloombeautyskinllc.com`,
    title: `BLOOM Beauty Skin · ${treatment}`,
    description: `${what}\nBooking ${booking.code}\nManage your appointment: ${siteUrl}/dashboard`,
    location: `${site.address.line1}, ${site.address.line2}`,
    start: new Date(booking.start_at),
    end: new Date(booking.end_at),
    sequence: booking.reschedule_count,
    status: booking.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
    url: `${siteUrl}/dashboard`,
  };
}
