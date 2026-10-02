'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import Modal from '@/components/ui/Modal';
import { rescheduleBookingAsStaff } from '@/lib/admin/actions';
import { addDays, fromLocal, isoWeekday, localDate, parseDate, toLocal } from '@/lib/availability/timezone';
import { formatDateLong, formatTime } from '@/lib/booking/format';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Notice, buttonClass, inputClass } from './ui';

export type CalendarView = 'day' | 'week' | 'month';

export type CalendarBooking = {
  id: string;
  code: string;
  status: 'confirmed' | 'pending_payment' | 'completed' | 'no_show';
  start_at: string;
  end_at: string;
  client_name: string | null;
  service: string | null;
  options: string | null;
  specialist_id: string | null;
  category_color: string | null;
  total_cents: number | null;
};

export type CalendarBlock = { id: string; specialistId: string | null; source: string; reason: string | null; start: string; end: string };

type Props = {
  view: CalendarView;
  date: string;
  rangeDates: { from: string; to: string };
  timeZone: string;
  bookings: CalendarBooking[];
  specialists: { id: string; display_name: string; color: string | null }[];
  businessHours: { isoWeekday: number; start: string; end: string }[];
  blocks: CalendarBlock[];
};

const PX_PER_MIN = 1.1;
const SNAP_MIN = 15;
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const localMinutes = (iso: string, tz: string) => {
  const l = toLocal(Date.parse(iso), tz);
  return l.hour * 60 + l.minute;
};

type Column = { key: string; date: string; specialistId: string | null; label: string; sublabel?: string };
type PendingMove = { booking: CalendarBooking; startAt: string; specialistId: string | null };

export default function CalendarBoard({ view, date, rangeDates, timeZone, bookings, specialists, businessHours, blocks }: Props) {
  const t = useTranslations('bo');
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [move, setMove] = useState<PendingMove | null>(null);
  const [notify, setNotify] = useState(true);
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const grabOffset = useRef(0);
  const today = localDate(Date.now(), timeZone);

  // Live updates: any booking change (online booking, another staff member) refreshes the view
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel('admin-calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 400);
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  // Visible hours: business hours with an hour of margin (at least 8:00–20:00)
  const [gridStart, gridEnd] = useMemo(() => {
    const starts = businessHours.map((h) => minutesOf(h.start));
    const ends = businessHours.map((h) => minutesOf(h.end));
    const s = Math.min(8 * 60, ...(starts.length ? starts.map((x) => x - 60) : [8 * 60]));
    const e = Math.max(20 * 60, ...(ends.length ? ends.map((x) => x + 60) : [20 * 60]));
    return [Math.max(0, Math.floor(s / 60) * 60), Math.min(24 * 60, Math.ceil(e / 60) * 60)];
  }, [businessHours]);

  const nav = (delta: number) => {
    if (view === 'day') return addDays(date, delta);
    if (view === 'week') return addDays(date, delta * 7);
    const { year, month } = parseDate(date);
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
  };
  const href = (v: CalendarView, d: string) => `/admin/calendar?view=${v}&date=${d}`;

  const title = (() => {
    const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { ...o, timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
    if (view === 'day') return fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (view === 'week') return `${fmt(rangeDates.from, { month: 'short', day: 'numeric' })} – ${fmt(addDays(rangeDates.to, -1), { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return fmt(date, { month: 'long', year: 'numeric' });
  })();

  const columns: Column[] = useMemo(() => {
    const dayLabel = (d: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
    if (view === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(rangeDates.from, i);
        return { key: d, date: d, specialistId: null, label: dayLabel(d), sublabel: String(Number(d.slice(8))) };
      });
    }
    // Day view: one column per specialist when there are several
    if (specialists.length > 1) return specialists.map((s) => ({ key: s.id, date, specialistId: s.id, label: s.display_name }));
    return [{ key: date, date, specialistId: null, label: dayLabel(date), sublabel: String(Number(date.slice(8))) }];
  }, [view, date, rangeDates.from, specialists]);

  const inColumn = (b: CalendarBooking, c: Column) =>
    localDate(Date.parse(b.start_at), timeZone) === c.date && (c.specialistId === null || b.specialist_id === c.specialistId);

  const onDrop = (e: DragEvent<HTMLDivElement>, column: Column) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/booking-id');
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = gridStart + Math.round((e.clientY - rect.top - grabOffset.current) / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
    const clamped = Math.max(gridStart, Math.min(gridEnd - SNAP_MIN, minutes));
    const instant = fromLocal({ ...parseDate(column.date), hour: Math.floor(clamped / 60), minute: clamped % 60 }, timeZone);
    if (instant === null || instant === Date.parse(booking.start_at)) return;
    setError(null);
    setOverride(false);
    setReason('');
    setNotify(true);
    setMove({ booking, startAt: new Date(instant).toISOString(), specialistId: column.specialistId ?? booking.specialist_id });
  };

  const confirmMove = () =>
    move &&
    start(async () => {
      const result = await rescheduleBookingAsStaff({
        bookingId: move.booking.id,
        startAt: move.startAt,
        specialistId: move.specialistId ?? undefined,
        override,
        reason: override ? reason : undefined,
        notify,
      });
      if (result.ok) {
        setMove(null);
        router.refresh();
      } else {
        setError(t(`errors.${result.error}`));
        if (result.error === 'outside_availability' || result.error === 'too_soon') setOverride(true);
      }
    });

  const moveDuration = move ? Date.parse(move.booking.end_at) - Date.parse(move.booking.start_at) : 0;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={href(view, today)} className={buttonClass.secondary}>
            {t('calendar.today')}
          </Link>
          <Link href={href(view, nav(-1))} aria-label={t('calendar.previous')} className="grid h-9 w-9 place-items-center rounded-full hover:bg-stone/60">
            <HiChevronLeft className="h-5 w-5" />
          </Link>
          <Link href={href(view, nav(1))} aria-label={t('calendar.next')} className="grid h-9 w-9 place-items-center rounded-full hover:bg-stone/60">
            <HiChevronRight className="h-5 w-5" />
          </Link>
          <h2 className="ml-1 font-serif text-2xl text-ink">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('inline-flex items-center gap-1.5 text-xs', live ? 'text-emerald-800' : 'text-muted')}>
            <span className={cn('h-2 w-2 rounded-full', live ? 'bg-emerald-600' : 'bg-taupe')} aria-hidden />
            {t('calendar.live')}
          </span>
          <div className="flex rounded-full border border-taupe bg-white p-0.5" role="tablist">
            {(['day', 'week', 'month'] as const).map((v) => (
              <Link
                key={v}
                href={href(v, date)}
                role="tab"
                aria-selected={v === view}
                className={cn('rounded-full px-3.5 py-1.5 text-sm transition', v === view ? 'bg-cocoa text-cream' : 'text-ink hover:bg-sand')}
              >
                {t(`calendar.${v}`)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {view === 'month' ? (
        <MonthGrid rangeFrom={rangeDates.from} rangeTo={rangeDates.to} month={date.slice(0, 7)} today={today} bookings={bookings} timeZone={timeZone} moreLabel={(n) => t('calendar.more', { count: n })} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone bg-cream">
          <div className="min-w-[760px]">
            {/* Column headers */}
            <div className="grid border-b border-stone" style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(0, 1fr))` }}>
              <div />
              {columns.map((c) => (
                <Link key={c.key} href={href('day', c.date)} className={cn('px-2 py-2.5 text-center text-sm', c.date === today && !c.specialistId && 'text-cocoa')}>
                  <span className="block text-[11px] uppercase tracking-[0.14em] text-bronze">{c.label}</span>
                  {c.sublabel && (
                    <span className={cn('mt-0.5 inline-grid h-8 w-8 place-items-center rounded-full font-medium', c.date === today ? 'bg-cocoa text-cream' : 'text-ink')}>{c.sublabel}</span>
                  )}
                </Link>
              ))}
            </div>

            {/* Time grid */}
            <div className="grid" style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(0, 1fr))` }}>
              <div className="relative" style={{ height: (gridEnd - gridStart) * PX_PER_MIN }}>
                {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => {
                  const h = gridStart / 60 + i;
                  return (
                    <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: i * 60 * PX_PER_MIN }}>
                      {i === 0 ? '' : `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`}
                    </span>
                  );
                })}
              </div>

              {columns.map((c) => {
                const windows = businessHours.filter((h) => h.isoWeekday === isoWeekday(c.date)).map((h) => [minutesOf(h.start), minutesOf(h.end)] as const);
                return (
                  <div
                    key={c.key}
                    className="relative border-l border-stone"
                    style={{ height: (gridEnd - gridStart) * PX_PER_MIN }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, c)}
                  >
                    {/* Closed hours tinted */}
                    <div className="absolute inset-0 bg-stone/40" aria-hidden />
                    {windows.map(([s, e]) => (
                      <div key={s} className="absolute inset-x-0 bg-cream" style={{ top: (Math.max(s, gridStart) - gridStart) * PX_PER_MIN, height: (Math.min(e, gridEnd) - Math.max(s, gridStart)) * PX_PER_MIN }} aria-hidden />
                    ))}
                    {/* Hour lines */}
                    {Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => (
                      <div key={i} className="absolute inset-x-0 border-t border-stone/70" style={{ top: i * 60 * PX_PER_MIN }} aria-hidden />
                    ))}
                    {/* Blocks (time off, Google busy time) */}
                    {blocks
                      .filter((b) => c.specialistId === null || b.specialistId === null || b.specialistId === c.specialistId)
                      .map((b) => {
                        const dayStart = fromLocal({ ...parseDate(c.date), hour: 0, minute: 0 }, timeZone) ?? 0;
                        const s = Math.max(Date.parse(b.start), dayStart + gridStart * 60_000);
                        const e = Math.min(Date.parse(b.end), dayStart + gridEnd * 60_000);
                        if (e <= s) return null;
                        return (
                          <div
                            key={b.id}
                            className="absolute inset-x-1 overflow-hidden rounded-md border border-dashed border-taupe bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(205,194,180,0.45)_6px,rgba(205,194,180,0.45)_12px)] px-1.5 py-0.5 text-[11px] text-muted"
                            style={{ top: ((s - dayStart) / 60_000 - gridStart) * PX_PER_MIN, height: ((e - s) / 60_000) * PX_PER_MIN }}
                            title={b.reason ?? t('calendar.blocked')}
                          >
                            {b.reason ?? t('calendar.blocked')}
                          </div>
                        );
                      })}
                    {/* Now line */}
                    {c.date === today && (
                      <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-700/70" style={{ top: (localMinutes(new Date().toISOString(), timeZone) - gridStart) * PX_PER_MIN }} aria-hidden />
                    )}
                    {/* Appointments */}
                    {bookings.filter((b) => inColumn(b, c)).map((b) => {
                      const top = (localMinutes(b.start_at, timeZone) - gridStart) * PX_PER_MIN;
                      const height = Math.max(((Date.parse(b.end_at) - Date.parse(b.start_at)) / 60_000) * PX_PER_MIN, 22);
                      const movable = (b.status === 'confirmed' || b.status === 'pending_payment') && Date.parse(b.start_at) > Date.now();
                      const color = b.category_color ?? '#725F4C';
                      return (
                        <Link
                          key={b.id}
                          href={`/admin/bookings/${b.id}`}
                          draggable={movable}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/booking-id', b.id);
                            e.dataTransfer.effectAllowed = 'move';
                            grabOffset.current = e.clientY - e.currentTarget.getBoundingClientRect().top;
                          }}
                          className={cn(
                            'absolute inset-x-1 z-10 overflow-hidden rounded-lg px-2 py-1 text-left text-[12px] leading-tight text-white shadow-sm transition hover:z-30 hover:shadow-md',
                            movable && 'cursor-grab active:cursor-grabbing',
                            b.status === 'completed' && 'opacity-60',
                            b.status === 'no_show' && 'ring-2 ring-inset ring-red-700',
                          )}
                          style={{
                            top,
                            height,
                            backgroundColor: color,
                            backgroundImage: b.status === 'pending_payment' ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.18) 0 6px, transparent 6px 12px)' : undefined,
                          }}
                          title={`${formatTime(b.start_at, timeZone)} ${b.client_name ?? ''} · ${b.service ?? ''}${b.options ? ` (${b.options})` : ''}`}
                        >
                          <span className="block font-semibold">
                            {formatTime(b.start_at, timeZone)} {b.client_name}
                          </span>
                          {height > 34 && <span className="block truncate opacity-90">{b.service}</span>}
                          {height > 52 && b.options && <span className="block truncate opacity-80">{b.options}</span>}
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="border-t border-stone px-4 py-2 text-xs text-muted">{t('calendar.dragHint')}</p>
        </div>
      )}

      <Modal open={move !== null} onOpenChange={(o) => !o && setMove(null)} title={t('calendar.moveTitle')} closeLabel={t('common.close')}>
        {move && (
          <div className="flex flex-col gap-4">
            <p className="whitespace-pre-line text-sm text-ink">
              {t('calendar.moveBody', {
                client: move.booking.client_name ?? '',
                service: move.booking.service ?? '',
                from: `${formatDateLong(move.booking.start_at, timeZone)} ${formatTime(move.booking.start_at, timeZone)}`,
                to: `${formatDateLong(move.startAt, timeZone)} ${formatTime(move.startAt, timeZone)} – ${formatTime(Date.parse(move.startAt) + moveDuration, timeZone)}`,
              })}
            </p>
            {error && <Notice tone="error">{error}</Notice>}
            {override && (
              <>
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 h-4 w-4 accent-cocoa" />
                  {t('booking.override')}
                </label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('booking.overrideReason')} aria-label={t('booking.overrideReason')} maxLength={500} className={inputClass} />
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-cocoa" />
              {t('common.notifyClient')}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonClass.ghost} onClick={() => setMove(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" disabled={pending} className={buttonClass.primary} onClick={confirmMove}>
                {t('booking.move')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MonthGrid({
  rangeFrom,
  rangeTo,
  month,
  today,
  bookings,
  timeZone,
  moreLabel,
}: {
  rangeFrom: string;
  rangeTo: string;
  month: string;
  today: string;
  bookings: CalendarBooking[];
  timeZone: string;
  moreLabel: (n: number) => string;
}) {
  const days: string[] = [];
  for (let d = rangeFrom; d < rangeTo; d = addDays(d, 1)) days.push(d);
  const byDay = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    const d = localDate(Date.parse(b.start_at), timeZone);
    byDay.set(d, [...(byDay.get(d) ?? []), b]);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-stone bg-cream">
      <div className="grid grid-cols-7 border-b border-stone text-center text-[11px] uppercase tracking-[0.14em] text-bronze">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          return (
            <div key={d} className={cn('min-h-[112px] border-b border-r border-stone p-1.5', !d.startsWith(month) && 'bg-sand/60')}>
              <Link href={`/admin/calendar?view=day&date=${d}`} className={cn('mb-1 inline-grid h-7 w-7 place-items-center rounded-full text-xs', d === today ? 'bg-cocoa text-cream' : 'text-ink hover:bg-stone')}>
                {Number(d.slice(8))}
              </Link>
              <ul className="flex flex-col gap-0.5">
                {list.slice(0, 3).map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}`} className={cn('flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] text-ink hover:bg-stone/60', b.status === 'completed' && 'opacity-60')}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: b.category_color ?? '#725F4C' }} aria-hidden />
                      <span className="truncate">
                        {formatTime(b.start_at, timeZone)} {b.client_name}
                      </span>
                    </Link>
                  </li>
                ))}
                {list.length > 3 && (
                  <li>
                    <Link href={`/admin/calendar?view=day&date=${d}`} className="px-1 text-[11px] text-bronze hover:underline">
                      {moreLabel(list.length - 3)}
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
