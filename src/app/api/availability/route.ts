import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { availableSlots, type SpecialistAvailability, type WeeklyHours } from '@/lib/availability/slots';
import { addDays } from '@/lib/availability/timezone';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Either a treatment (+ options) for a new booking, or an existing booking to reschedule
const querySchema = z.union([
  z.object({
    treatment: z.uuid(),
    options: z.string().optional().transform((v) => (v ? v.split(',') : [])).pipe(z.array(z.uuid()).max(30)),
    from: dateSchema,
    to: dateSchema,
  }),
  z.object({ booking: z.uuid(), from: dateSchema, to: dateSchema }),
]);

const MAX_RANGE_DAYS = 42;

/**
 * Bookable slots per local date. The database re-validates every rule when the slot is held,
 * so this is a fast, friendly view of availability, never the authority.
 */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const query = parsed.data;
  if (query.to < query.from || addDays(query.from, MAX_RANGE_DAYS) < query.to) {
    return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const settings = await getPublicSettings();

  // What is being booked: duration, buffers and which specialists can do it
  let durationMin: number;
  let bufferBeforeMin: number;
  let bufferAfterMin: number;
  let specialistIds: string[];
  let ownRange: { start: number; end: number } | null = null;

  if ('booking' in query) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('start_at, end_at, buffer_before_min, buffer_after_min, specialist_id')
      .eq('id', query.booking)
      .maybeSingle();
    if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    durationMin = (Date.parse(booking.end_at) - Date.parse(booking.start_at)) / 60_000;
    bufferBeforeMin = booking.buffer_before_min;
    bufferAfterMin = booking.buffer_after_min;
    specialistIds = [booking.specialist_id];
    // The booking being moved must not block its own new time
    ownRange = {
      start: Date.parse(booking.start_at) - bufferBeforeMin * 60_000,
      end: Date.parse(booking.end_at) + bufferAfterMin * 60_000,
    };
  } else {
    const [{ data: treatment }, { data: options }, { data: links }] = await Promise.all([
      supabase.from('treatments').select('duration_minutes, buffer_before_min, buffer_after_min, is_bookable').eq('id', query.treatment).maybeSingle(),
      supabase.from('treatment_options').select('id, extra_duration_minutes').eq('treatment_id', query.treatment).in('id', query.options.length ? query.options : ['00000000-0000-0000-0000-000000000000']),
      supabase.from('specialist_treatments').select('specialist_id').eq('treatment_id', query.treatment),
    ]);
    if (!treatment?.is_bookable || treatment.duration_minutes === null) return NextResponse.json({ error: 'not_bookable' }, { status: 404 });
    durationMin = treatment.duration_minutes + (options ?? []).reduce((sum, o) => sum + (o.extra_duration_minutes ?? 0), 0);
    bufferBeforeMin = treatment.buffer_before_min;
    bufferAfterMin = treatment.buffer_after_min;
    specialistIds = (links ?? []).map((l) => l.specialist_id);
  }

  const [{ data: specialists }, { data: hours }, { data: busy, error: busyError }] = await Promise.all([
    supabase.from('specialists').select('id').in('id', specialistIds.length ? specialistIds : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('working_hours').select('specialist_id, iso_weekday, start_time, end_time'),
    // A day of margin on each side covers buffers and time zone edges
    supabase.rpc('get_busy_ranges', {
      p_from: new Date(Date.parse(`${addDays(query.from, -1)}T00:00:00Z`)).toISOString(),
      p_to: new Date(Date.parse(`${addDays(query.to, 2)}T00:00:00Z`)).toISOString(),
    }),
  ]);
  if (busyError) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const toWeekly = (rows: typeof hours): WeeklyHours[] =>
    (rows ?? []).map((h) => ({ isoWeekday: h.iso_weekday, start: h.start_time, end: h.end_time }));
  const businessHours = toWeekly((hours ?? []).filter((h) => h.specialist_id === null));

  const availability: SpecialistAvailability[] = (specialists ?? []).map((s) => {
    const own = (hours ?? []).filter((h) => h.specialist_id === s.id);
    return {
      id: s.id,
      hours: own.length > 0 ? toWeekly(own) : businessHours,
      busy: (busy ?? [])
        .filter((b) => b.specialist_id === null || b.specialist_id === s.id)
        .map((b) => ({ start: Date.parse(b.start_at), end: Date.parse(b.end_at) }))
        .filter((b) => !(ownRange && b.start === ownRange.start && b.end === ownRange.end)),
    };
  });

  const days = availableSlots(
    availability,
    {
      timeZone: settings.timezone,
      now: Date.now(),
      durationMin,
      bufferBeforeMin,
      bufferAfterMin,
      slotIntervalMin: settings.slot_interval_min,
      minNoticeMin: settings.min_notice_min,
      maxWindowDays: settings.max_window_days,
    },
    query.from,
    query.to,
  );

  return NextResponse.json(
    {
      timeZone: settings.timezone,
      durationMin,
      days: days.map((d) => ({ date: d.date, slots: d.slots.map((s) => new Date(s).toISOString()) })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
