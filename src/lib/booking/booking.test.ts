import { describe, expect, it } from 'vitest';
import { buildIcs, googleCalendarUrl } from '../calendar/ics';
import { formatDuration, formatMoney, formatPrice, formatTime } from './format';
import { quote } from './pricing';
import type { CatalogTreatment } from './types';

const laser: CatalogTreatment = {
  id: 't',
  slug: 'diode-laser-session',
  categorySlug: 'diode-laser',
  name: 'Diode Laser Hair Removal Session',
  description: null,
  includes: [],
  menuGroup: null,
  priceCents: 0,
  priceType: 'from',
  depositCents: null,
  depositPercent: null,
  durationMinutes: 10,
  isBestSeller: false,
  minOptions: 1,
  maxOptions: null,
  intake: null,
  options: [
    { id: 'lip', slug: 'laser-upper-lip', groupLabel: 'Face', name: 'Upper Lip', description: null, priceCents: 4000, priceType: 'from', extraMinutes: 5 },
    { id: 'arm', slug: 'laser-underarms', groupLabel: 'Body', name: 'Underarms', description: null, priceCents: 5500, priceType: 'from', extraMinutes: 10 },
  ],
};

describe('quote', () => {
  it('adds up selected options', () => {
    expect(quote(laser, ['lip', 'arm'])).toEqual({ totalCents: 9500, durationMinutes: 25, priceType: 'from', optionsValid: true });
  });
  it('flags a missing required option', () => {
    expect(quote(laser, []).optionsValid).toBe(false);
  });
  it('ignores ids from other treatments', () => {
    expect(quote(laser, ['nope']).totalCents).toBe(0);
  });
});

describe('format', () => {
  it('formats money without useless decimals', () => {
    expect(formatMoney(18000)).toBe('$180');
    expect(formatMoney(125000)).toBe('$1,250');
    expect(formatMoney(4050)).toBe('$40.50');
    expect(formatPrice(12000, 'from')).toBe('from $120');
  });
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(150)).toBe('2 h 30 min');
  });
  it('shows times in New York', () => {
    expect(formatTime(Date.parse('2026-10-06T15:00:00Z'))).toMatch(/^11:00\sAM$/);
  });
});

describe('ics', () => {
  const event = {
    uid: 'booking-1@bloombeautyskinllc.com',
    title: 'BLOOM · Hydrodermabrasion, Vitamin C',
    description: 'Booking BLM-ABC\nSee you soon; bring sunscreen',
    location: '305 E 204th St, Suite 2A, Bronx, NY 10467',
    start: new Date('2026-10-06T15:00:00Z'),
    end: new Date('2026-10-06T16:00:00Z'),
  };

  it('builds a valid VEVENT with escaped text and CRLF line endings', () => {
    const ics = buildIcs(event, new Date('2026-09-29T12:00:00Z'));
    expect(ics).toContain('DTSTART:20261006T150000Z\r\n');
    expect(ics).toContain('DTEND:20261006T160000Z\r\n');
    expect(ics).toContain('SUMMARY:BLOOM · Hydrodermabrasion\\, Vitamin C');
    expect(ics).toContain('DESCRIPTION:Booking BLM-ABC\\nSee you soon\\; bring sunscreen');
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('builds a Google Calendar template link', () => {
    const raw = googleCalendarUrl(event);
    expect(raw).toContain('&dates=20261006T150000Z/20261006T160000Z');
    const url = new URL(raw);
    expect(url.searchParams.get('dates')).toBe('20261006T150000Z/20261006T160000Z');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
  });
});
