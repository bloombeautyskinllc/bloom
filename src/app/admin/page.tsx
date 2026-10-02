import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import BookingQuickActions from '@/components/admin/BookingQuickActions';
import { PageHeader, Panel, Stat, StatusBadge, buttonClass } from '@/components/admin/ui';
import { routes } from '@/data/site';
import { monthRange, todayRange, weekRange } from '@/lib/admin/time';
import { localDate, toLocal } from '@/lib/availability/timezone';
import { requireStaff } from '@/lib/auth/session';
import { formatDateShort, formatMoney, formatTime } from '@/lib/booking/format';
import { firstName } from '@/lib/format/name';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Dashboard' };

type Metrics = {
  appointments: number;
  cancelled: number;
  no_show: number;
  revenue_estimated_cents: number;
  revenue_collected_cents: number;
  new_clients: number;
  top_treatments: { name: string; count: number }[];
};

export default async function AdminDashboard() {
  const { profile } = await requireStaff(routes.admin);
  const [t, settings] = await Promise.all([getTranslations('bo'), getPublicSettings()]);
  const tz = settings.timezone;
  const supabase = await createClient();

  const today = todayRange(tz);
  const week = weekRange(today.fromDate, tz);
  const month = monthRange(today.fromDate, tz);

  const metric = async (r: { from: Date; to: Date }) => {
    const { data } = await supabase.rpc('admin_dashboard', { p_from: r.from.toISOString(), p_to: r.to.toISOString() });
    return data as unknown as Metrics;
  };
  const [dayM, weekM, monthM, { data: schedule }, { data: toClose }] = await Promise.all([
    metric(today),
    metric(week),
    metric(month),
    supabase
      .from('booking_search')
      .select('id, code, status, start_at, end_at, client_name, service, options, total_cents, category_color')
      .gte('start_at', today.from.toISOString())
      .lt('start_at', today.to.toISOString())
      .in('status', ['confirmed', 'pending_payment', 'completed', 'no_show'])
      .order('start_at'),
    supabase
      .from('booking_search')
      .select('id, code, start_at, client_name, service')
      .eq('status', 'confirmed')
      .lt('end_at', new Date().toISOString())
      .order('start_at', { ascending: false })
      .limit(15),
  ]);

  const hour = toLocal(Date.now(), tz).hour;
  const daypart = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  const cards = (m: Metrics) => [
    { label: t('dashboard.appointments'), value: m.appointments },
    { label: t('dashboard.estimated'), value: formatMoney(m.revenue_estimated_cents) },
    { label: t('dashboard.collected'), value: formatMoney(m.revenue_collected_cents) },
    { label: t('dashboard.cancelled'), value: m.cancelled },
    { label: t('dashboard.noShows'), value: m.no_show, warn: m.no_show > 0 },
    { label: t('dashboard.newClients'), value: m.new_clients },
  ];

  return (
    <>
      <PageHeader
        title={t('dashboard.title', { daypart: t(`dashboard.${daypart}`), name: firstName(profile.full_name) })}
        intro={formatDateShort(Date.now(), tz)}
        actions={
          <Link href="/admin/bookings/new" className={buttonClass.primary}>
            {t('nav.newBooking')}
          </Link>
        }
      />

      {[
        { title: t('dashboard.today'), m: dayM },
        { title: t('dashboard.week'), m: weekM },
      ].map(({ title, m }) => (
        <section key={title} className="mb-6">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {cards(m).map((c) => (
              <Stat key={c.label} label={c.label} value={c.value} tone={c.warn ? 'warn' : 'default'} />
            ))}
          </div>
        </section>
      ))}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title={t('dashboard.todaySchedule')} actions={<Link href="/admin/calendar" className={buttonClass.ghost}>{t('nav.calendar')} →</Link>}>
          {!schedule?.length ? (
            <p className="text-sm text-muted">{t('dashboard.nothingToday')}</p>
          ) : (
            <ul className="divide-y divide-stone">
              {schedule.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-4 py-3 transition hover:bg-sand/60">
                    <span className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: b.category_color ?? '#725F4C' }} aria-hidden />
                    <span className="w-20 shrink-0 text-sm font-medium text-ink">{formatTime(b.start_at!, tz)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-ink">{b.client_name ?? '—'}</span>
                      <span className="block truncate text-xs text-muted">
                        {b.service}
                        {b.options ? ` · ${b.options}` : ''}
                      </span>
                    </span>
                    <StatusBadge status={b.status!} label={t(`status.${b.status}`)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title={t('dashboard.needsClosure')}>
            {!toClose?.length ? (
              <p className="text-sm text-muted">{t('dashboard.allClosed')}</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted">{t('dashboard.needsClosureBody')}</p>
                <ul className="divide-y divide-stone">
                  {toClose.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <Link href={`/admin/bookings/${b.id}`} className="min-w-0 text-sm">
                        <span className="block truncate text-ink">{b.client_name}</span>
                        <span className="block truncate text-xs text-muted">
                          {localDate(Date.parse(b.start_at!), tz) === today.fromDate ? formatTime(b.start_at!, tz) : `${formatDateShort(b.start_at!, tz)} · ${formatTime(b.start_at!, tz)}`} · {b.service}
                        </span>
                      </Link>
                      <BookingQuickActions bookingId={b.id!} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title={t('dashboard.topTreatments')}>
            {monthM.top_treatments.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ol className="flex flex-col gap-2 text-sm">
                {monthM.top_treatments.map((x, i) => (
                  <li key={x.name} className="flex items-center gap-3">
                    <span className="w-5 text-muted">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{x.name}</span>
                    <span className="font-medium tabular-nums text-ink">{x.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
