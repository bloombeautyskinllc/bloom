import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import CalendarBoard, { type CalendarBlock, type CalendarBooking, type CalendarView } from '@/components/admin/CalendarBoard';
import { PageHeader } from '@/components/admin/ui';
import { localRange, monthRange, weekRange } from '@/lib/admin/time';
import { addDays, isoWeekday, localDate } from '@/lib/availability/timezone';
import { requireStaff } from '@/lib/auth/session';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  view: z.enum(['day', 'week', 'month']).catch('week'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('/admin/calendar');
  const [t, settings, raw] = await Promise.all([getTranslations('bo.calendar'), getPublicSettings(), searchParams]);
  const tz = settings.timezone;
  const { view } = paramsSchema.parse(raw);
  const date = paramsSchema.parse(raw).date ?? localDate(Date.now(), tz);

  // Month view shows whole weeks (Sunday..Saturday) around the month
  let range;
  if (view === 'day') range = localRange(date, 1, tz);
  else if (view === 'week') range = weekRange(date, tz);
  else {
    const m = monthRange(date, tz);
    const first = addDays(m.fromDate, -(isoWeekday(m.fromDate) % 7));
    const days = Math.ceil((Date.parse(m.toDate) - Date.parse(first)) / 86_400_000 / 7) * 7;
    range = localRange(first, days, tz);
  }

  const supabase = await createClient();
  const [{ data: bookings }, { data: specialists }, { data: hours }, { data: blocks }] = await Promise.all([
    supabase
      .from('booking_search')
      .select('id, code, status, start_at, end_at, client_name, service, options, specialist_id, category_color, total_cents')
      .gte('start_at', range.from.toISOString())
      .lt('start_at', range.to.toISOString())
      .in('status', ['confirmed', 'pending_payment', 'completed', 'no_show'])
      .order('start_at'),
    supabase.from('specialists').select('id, display_name, color').eq('is_active', true).is('deleted_at', null).order('sort_order'),
    supabase.from('working_hours').select('specialist_id, iso_weekday, start_time, end_time'),
    supabase.from('availability_blocks').select('id, specialist_id, range, source, reason').is('deleted_at', null).overlaps('range', `[${range.from.toISOString()},${range.to.toISOString()})`),
  ]);

  const parseRange = (r: unknown) => {
    const m = /^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(String(r));
    return m ? { start: new Date(m[1]).toISOString(), end: new Date(m[2]).toISOString() } : null;
  };

  return (
    <>
      <PageHeader title={t('title')} intro={t('legend')} />
      <CalendarBoard
        view={view as CalendarView}
        date={date}
        rangeDates={{ from: range.fromDate, to: range.toDate }}
        timeZone={tz}
        bookings={(bookings ?? []) as CalendarBooking[]}
        specialists={specialists ?? []}
        businessHours={(hours ?? []).filter((h) => h.specialist_id === null).map((h) => ({ isoWeekday: h.iso_weekday, start: h.start_time, end: h.end_time }))}
        blocks={(blocks ?? []).flatMap((b): CalendarBlock[] => {
          const r = parseRange(b.range);
          return r ? [{ id: b.id, specialistId: b.specialist_id, source: b.source, reason: b.reason, ...r }] : [];
        })}
      />
    </>
  );
}
