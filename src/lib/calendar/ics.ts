// iCalendar (RFC 5545) event files and Google Calendar "add event" links for bookings

export type CalendarEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  /** Increment on every change so calendar apps replace the previous version */
  sequence?: number;
  status?: 'CONFIRMED' | 'CANCELLED';
  organizerEmail?: string;
  url?: string;
};

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

// TEXT values escape backslash, semicolon, comma and newlines
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines longer than 75 octets are folded with CRLF + space
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const n = new TextEncoder().encode(char).length;
    if (size + n > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(event: CalendarEvent, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BLOOM Beauty Skin//Booking//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${event.status === 'CANCELLED' ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(event.start)}`,
    `DTEND:${utcStamp(event.end)}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `STATUS:${event.status ?? 'CONFIRMED'}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    ...(event.url ? [`URL:${event.url}`] : []),
    ...(event.organizerEmail ? [`ORGANIZER;CN=BLOOM Beauty Skin:mailto:${event.organizerEmail}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Link that opens Google Calendar's "new event" screen prefilled (no permission needed) */
export function googleCalendarUrl(event: Pick<CalendarEvent, 'title' | 'description' | 'location' | 'start' | 'end'>) {
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, details: event.description, location: event.location });
  // `dates` keeps a literal "/": Google can drop the end time when it arrives encoded as %2F,
  // falling back to its default one-hour length
  const dates = `${utcStamp(event.start)}/${utcStamp(event.end)}`;
  return `https://calendar.google.com/calendar/render?${params.toString()}&dates=${dates}`;
}
