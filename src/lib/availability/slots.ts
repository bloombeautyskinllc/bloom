import { addDays, fromLocal, isoWeekday, localDate, parseDate } from './timezone';

export type Interval = { start: number; end: number };

/** Weekly opening hours as local wall-clock times ('HH:MM' or 'HH:MM:SS'; '24:00' = midnight). */
export type WeeklyHours = { isoWeekday: number; start: string; end: string };

export type SpecialistAvailability = {
  id: string;
  hours: WeeklyHours[];
  /** Occupied time for this specialist: other bookings' blocked ranges (with their buffers) and time off. */
  busy: Interval[];
};

export type SlotRules = {
  timeZone: string;
  now: number;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  slotIntervalMin: number;
  minNoticeMin: number;
  maxWindowDays: number;
};

export type DaySlots = { date: string; slots: number[] };

const MINUTE = 60_000;

function minutesOf(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Bookable start instants per local date, for one specialist. Mirrors the database rules in
 * private.assert_booking_window / specialist_fits (the database is the final authority):
 *  - starts on the slot grid (minutes past the hour divisible by slotIntervalMin, local time)
 *  - the service fits inside a working window of that day (buffers may spill outside)
 *  - [start - bufferBefore, end + bufferAfter) does not overlap busy time
 *  - start >= now + minimum notice, and the date is within the booking window
 */
export function specialistSlots(specialist: SpecialistAvailability, rules: SlotRules, fromDate: string, toDate: string): DaySlots[] {
  const today = localDate(rules.now, rules.timeZone);
  const lastDate = addDays(today, rules.maxWindowDays);
  const earliest = rules.now + rules.minNoticeMin * MINUTE;
  const days: DaySlots[] = [];

  for (let date = fromDate < today ? today : fromDate; date <= toDate && date <= lastDate; date = addDays(date, 1)) {
    const { year, month, day } = parseDate(date);
    const weekday = isoWeekday(date);
    const slots = new Set<number>();

    for (const window of specialist.hours.filter((h) => h.isoWeekday === weekday)) {
      const openMin = minutesOf(window.start);
      const closeMin = minutesOf(window.end);
      const close = closeMin >= 24 * 60 ? fromLocal({ ...parseDate(addDays(date, 1)), hour: 0, minute: 0 }, rules.timeZone) : fromLocal({ year, month, day, hour: Math.floor(closeMin / 60), minute: closeMin % 60 }, rules.timeZone);
      if (close === null) continue;

      const first = Math.ceil(openMin / rules.slotIntervalMin) * rules.slotIntervalMin;
      for (let m = first; m < closeMin; m += rules.slotIntervalMin) {
        const start = fromLocal({ year, month, day, hour: Math.floor(m / 60), minute: m % 60 }, rules.timeZone);
        if (start === null || start < earliest) continue; // skipped by DST, or too soon

        const end = start + rules.durationMin * MINUTE;
        if (end > close) break;

        const blocked = { start: start - rules.bufferBeforeMin * MINUTE, end: end + rules.bufferAfterMin * MINUTE };
        if (specialist.busy.some((b) => overlaps(blocked, b))) continue;
        slots.add(start);
      }
    }

    if (slots.size > 0) days.push({ date, slots: [...slots].sort((a, b) => a - b) });
  }
  return days;
}

/** "Any available specialist": the union of every specialist's slots. */
export function availableSlots(specialists: SpecialistAvailability[], rules: SlotRules, fromDate: string, toDate: string): DaySlots[] {
  const byDate = new Map<string, Set<number>>();
  for (const specialist of specialists) {
    for (const { date, slots } of specialistSlots(specialist, rules, fromDate, toDate)) {
      const set = byDate.get(date) ?? new Set<number>();
      slots.forEach((s) => set.add(s));
      byDate.set(date, set);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, set]) => ({ date, slots: [...set].sort((a, b) => a - b) }));
}
