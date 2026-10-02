import { describe, expect, it } from 'vitest';
import { availableSlots, specialistSlots, type SlotRules, type SpecialistAvailability, type WeeklyHours } from './slots';
import { addDays, fromLocal, isoWeekday, offsetMinutes, toLocal } from './timezone';

const TZ = 'America/New_York';
const at = (iso: string) => Date.parse(iso);
/** Local "HH:MM" of each slot, for readable assertions */
const times = (slots: number[]) =>
  slots.map((s) => {
    const l = toLocal(s, TZ);
    return `${String(l.hour).padStart(2, '0')}:${String(l.minute).padStart(2, '0')}`;
  });

const monToSat: WeeklyHours[] = [1, 2, 3, 4, 5, 6].map((d) => ({ isoWeekday: d, start: '10:00', end: '20:00' }));

const rules = (over: Partial<SlotRules> = {}): SlotRules => ({
  timeZone: TZ,
  now: at('2026-10-05T12:00:00Z'), // Monday 08:00 in New York
  durationMin: 60,
  bufferBeforeMin: 0,
  bufferAfterMin: 15,
  slotIntervalMin: 15,
  minNoticeMin: 120,
  maxWindowDays: 60,
  ...over,
});

const specialist = (over: Partial<SpecialistAvailability> = {}): SpecialistAvailability => ({ id: 's1', hours: monToSat, busy: [], ...over });

describe('timezone helpers', () => {
  it('knows New York offsets in summer and winter', () => {
    expect(offsetMinutes(at('2026-07-01T12:00:00Z'), TZ)).toBe(-240);
    expect(offsetMinutes(at('2026-12-01T12:00:00Z'), TZ)).toBe(-300);
  });

  it('converts local wall-clock time to UTC across DST', () => {
    expect(fromLocal({ year: 2026, month: 10, day: 31, hour: 10, minute: 0 }, TZ)).toBe(at('2026-10-31T14:00:00Z'));
    expect(fromLocal({ year: 2026, month: 11, day: 1, hour: 10, minute: 0 }, TZ)).toBe(at('2026-11-01T15:00:00Z'));
  });

  it('returns null for times skipped when clocks spring forward (2026-03-08 02:00 -> 03:00)', () => {
    expect(fromLocal({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, TZ)).toBeNull();
    expect(fromLocal({ year: 2026, month: 3, day: 8, hour: 3, minute: 0 }, TZ)).toBe(at('2026-03-08T07:00:00Z'));
  });

  it('resolves repeated times when clocks fall back (2026-11-01) to the first occurrence', () => {
    expect(fromLocal({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, TZ)).toBe(at('2026-11-01T05:30:00Z'));
  });

  it('does calendar math on dates', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isoWeekday('2026-10-05')).toBe(1);
    expect(isoWeekday('2026-10-11')).toBe(7);
  });
});

describe('specialistSlots', () => {
  it('fills the working day on the slot grid; the service ends by closing, the buffer may spill over', () => {
    const [day] = specialistSlots(specialist(), rules(), '2026-10-06', '2026-10-06');
    const t = times(day.slots);
    expect(t[0]).toBe('10:00');
    expect(t.at(-1)).toBe('19:00'); // 19:00 + 60 min = 20:00 closing; cleanup buffer runs after hours
    expect(t).toHaveLength(37); // 10:00 .. 19:00 every 15 min
  });

  it('is closed on days without hours (Sunday)', () => {
    expect(specialistSlots(specialist(), rules(), '2026-10-11', '2026-10-11')).toEqual([]);
  });

  it('respects the minimum notice on the same day', () => {
    // now = Monday 10:30 local (14:30Z); 2h notice -> first slot 12:30
    const [day] = specialistSlots(specialist(), rules({ now: at('2026-10-05T14:30:00Z') }), '2026-10-05', '2026-10-05');
    expect(times(day.slots)[0]).toBe('12:30');
  });

  it('keeps each booking clear of other bookings, counting both buffers', () => {
    // Existing booking 12:00-13:00 local with a 15 min cleanup -> busy 12:00-13:15 (16:00Z-17:15Z)
    const busy = [{ start: at('2026-10-06T16:00:00Z'), end: at('2026-10-06T17:15:00Z') }];
    const t = times(specialistSlots(specialist({ busy }), rules(), '2026-10-06', '2026-10-06')[0].slots);
    expect(t).toContain('10:45'); // 10:45-11:45 + 15 cleanup = 12:00, touches but does not overlap
    expect(t).not.toContain('11:00'); // its cleanup would run into 12:00
    expect(t).not.toContain('12:00');
    expect(t).not.toContain('13:00');
    expect(t).toContain('13:15');
  });

  it('applies the buffer before the service', () => {
    const busy = [{ start: at('2026-10-06T16:00:00Z'), end: at('2026-10-06T17:15:00Z') }];
    const t = times(specialistSlots(specialist({ busy }), rules({ bufferBeforeMin: 15 }), '2026-10-06', '2026-10-06')[0].slots);
    expect(t).not.toContain('13:15'); // needs 13:00-13:15 for prep
    expect(t).toContain('13:30');
  });

  it('removes a fully blocked day (time off, holiday)', () => {
    const busy = [{ start: at('2026-10-06T04:00:00Z'), end: at('2026-10-07T04:00:00Z') }];
    const days = specialistSlots(specialist({ busy }), rules(), '2026-10-06', '2026-10-07');
    expect(days.map((d) => d.date)).toEqual(['2026-10-07']);
  });

  it('stops at the booking window', () => {
    const days = specialistSlots(specialist(), rules({ maxWindowDays: 3 }), '2026-10-05', '2026-10-31');
    expect(days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
  });

  it('never offers the past', () => {
    const days = specialistSlots(specialist(), rules(), '2026-09-01', '2026-10-05');
    expect(days.map((d) => d.date)).toEqual(['2026-10-05']);
  });

  it('aligns to the grid when a window opens off-grid', () => {
    const hours = [{ isoWeekday: 2, start: '10:10', end: '12:00' }];
    const [day] = specialistSlots(specialist({ hours }), rules(), '2026-10-06', '2026-10-06');
    expect(times(day.slots)[0]).toBe('10:15');
  });

  it('uses the right UTC instants on both sides of the fall-back change', () => {
    const [sat] = specialistSlots(specialist(), rules(), '2026-10-31', '2026-10-31');
    expect(sat.slots[0]).toBe(at('2026-10-31T14:00:00Z')); // EDT, UTC-4
    const [mon] = specialistSlots(specialist(), rules(), '2026-11-02', '2026-11-02');
    expect(mon.slots[0]).toBe(at('2026-11-02T15:00:00Z')); // EST, UTC-5
  });

  it('skips non-existent times and keeps real durations on the spring-forward night', () => {
    const hours = [{ isoWeekday: 7, start: '01:00', end: '04:00' }];
    const r = rules({ now: at('2026-03-01T12:00:00Z'), durationMin: 30, bufferAfterMin: 0 });
    const [day] = specialistSlots(specialist({ hours }), r, '2026-03-08', '2026-03-08');
    const t = times(day.slots);
    expect(t.some((x) => x.startsWith('02:'))).toBe(false); // 02:00-02:59 does not exist that night
    expect(t).toEqual(['01:00', '01:15', '01:30', '01:45', '03:00', '03:15', '03:30']);
    // 01:45 + 30 real minutes = 03:15 local: fits before 04:00
    expect(day.slots[3] + 30 * 60_000).toBe(at('2026-03-08T07:15:00Z'));
  });

  it('handles a 24:00 closing time', () => {
    const hours = [{ isoWeekday: 2, start: '22:00', end: '24:00' }];
    const [day] = specialistSlots(specialist({ hours }), rules({ bufferAfterMin: 0 }), '2026-10-06', '2026-10-06');
    expect(times(day.slots).at(-1)).toBe('23:00');
  });
});

describe('availableSlots', () => {
  it('merges specialists: a time is available if anyone can take it', () => {
    const busyAllDay = [{ start: at('2026-10-06T04:00:00Z'), end: at('2026-10-07T04:00:00Z') }];
    const days = availableSlots(
      [specialist({ id: 'a', busy: busyAllDay }), specialist({ id: 'b', hours: [{ isoWeekday: 2, start: '15:00', end: '17:00' }] })],
      rules(),
      '2026-10-06',
      '2026-10-06',
    );
    expect(times(days[0].slots)).toEqual(['15:00', '15:15', '15:30', '15:45', '16:00']);
  });
});
