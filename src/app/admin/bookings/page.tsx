import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader, StatusBadge, buttonClass, inputClass } from '@/components/admin/ui';
import { BOOKING_STATUSES, PAYMENT_STATUSES, bookingFiltersSchema, queryBookings } from '@/lib/admin/bookings-query';
import { startOfLocalDay } from '@/lib/admin/time';
import { addDays } from '@/lib/availability/timezone';
import { requireStaff } from '@/lib/auth/session';
import { formatDateShort, formatMoney, formatTime } from '@/lib/booking/format';
import { formatPhone } from '@/lib/format/phone';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Bookings' };

const PAGE_SIZE = 50;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStaff('/admin/bookings');
  const raw = await searchParams;
  const filters = bookingFiltersSchema.parse(raw);
  const [t, settings] = await Promise.all([getTranslations('bo'), getPublicSettings()]);
  const tz = settings.timezone;
  const page = filters.page ?? 1;

  const range = {
    from: filters.from ? new Date(startOfLocalDay(filters.from, tz)) : undefined,
    to: filters.to ? new Date(startOfLocalDay(addDays(filters.to, 1), tz)) : undefined,
  };

  const supabase = await createClient();
  const [{ data: rows, count, error }, { data: treatments }, { data: specialists }] = await Promise.all([
    queryBookings(filters, range, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    supabase.from('treatments').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('specialists').select('id, display_name').is('deleted_at', null).order('sort_order'),
  ]);
  if (error) throw new Error(error.message);

  const params = new URLSearchParams(Object.entries(raw).filter(([k, v]) => v && k !== 'page') as [string, string][]);
  const pageHref = (p: number) => `/admin/bookings?${new URLSearchParams({ ...Object.fromEntries(params), page: String(p) }).toString()}`;

  return (
    <>
      <PageHeader
        title={t('bookings.title')}
        intro={t('bookings.count', { count: count ?? 0 })}
        actions={
          <>
            <a href={`/api/admin/bookings.csv?${params.toString()}`} className={buttonClass.secondary}>
              {t('common.exportCsv')}
            </a>
            <Link href="/admin/bookings/new" className={buttonClass.primary}>
              {t('nav.newBooking')}
            </Link>
          </>
        }
      />

      {/* Plain GET form: filters live in the URL (shareable, back button works) */}
      <form className="mb-5 grid gap-3 rounded-2xl border border-stone bg-cream p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8" role="search">
        <input name="q" defaultValue={filters.q} placeholder={t('bookings.searchPlaceholder')} aria-label={t('common.search')} className={`${inputClass} sm:col-span-2`} />
        <label className="sr-only" htmlFor="f-from">{t('bookings.dateFrom')}</label>
        <input id="f-from" type="date" name="from" defaultValue={filters.from} className={inputClass} />
        <label className="sr-only" htmlFor="f-to">{t('bookings.dateTo')}</label>
        <input id="f-to" type="date" name="to" defaultValue={filters.to} className={inputClass} />
        <select name="status" defaultValue={filters.status ?? ''} aria-label={t('bookings.status')} className={inputClass}>
          <option value="">{t('bookings.status')}: {t('common.all')}</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select name="payment" defaultValue={filters.payment ?? ''} aria-label={t('bookings.payment')} className={inputClass}>
          <option value="">{t('bookings.payment')}: {t('common.all')}</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`payment.${s}`)}
            </option>
          ))}
        </select>
        <select name="treatment" defaultValue={filters.treatment ?? ''} aria-label={t('bookings.treatment')} className={inputClass}>
          <option value="">{t('bookings.treatment')}: {t('common.all')}</option>
          {treatments?.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        {(specialists?.length ?? 0) > 1 && (
          <select name="specialist" defaultValue={filters.specialist ?? ''} aria-label={t('bookings.specialist')} className={inputClass}>
            <option value="">{t('bookings.specialist')}: {t('common.all')}</option>
            {specialists?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-8">
          <button type="submit" className={buttonClass.primary}>
            {t('common.filter')}
          </button>
          <Link href="/admin/bookings" className={buttonClass.ghost}>
            {t('common.clear')}
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stone bg-cream">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-stone text-xs uppercase tracking-[0.1em] text-bronze">
            <tr>
              {(['when', 'client', 'service', 'total', 'status', 'payment', 'ref'] as const).map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-semibold">
                  {t(`bookings.columns.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {rows?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  {t('common.noResults')}
                </td>
              </tr>
            )}
            {rows?.map((b) => (
              <tr key={b.id} className="transition hover:bg-sand/60">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/admin/bookings/${b.id}`} className="font-medium text-ink hover:underline">
                    {formatDateShort(b.start_at!, tz)}
                  </Link>
                  <span className="block text-xs text-muted">{formatTime(b.start_at!, tz)}</span>
                </td>
                <td className="px-4 py-3">
                  {b.client_id ? (
                    <Link href={`/admin/clients/${b.client_id}`} className="text-ink hover:underline">
                      {b.client_name ?? '—'}
                    </Link>
                  ) : (
                    '—'
                  )}
                  <span className="block text-xs text-muted">{formatPhone(b.client_phone) ?? b.client_email}</span>
                </td>
                <td className="max-w-[280px] px-4 py-3">
                  <span className="block truncate text-ink">{b.service}</span>
                  {b.options && <span className="block truncate text-xs text-muted">{b.options}</span>}
                  {(b.rules_overridden || b.source === 'admin') && (
                    <span className="mt-0.5 block text-[11px] text-bronze">
                      {[b.source === 'admin' && t('bookings.admin'), b.rules_overridden && t('bookings.overridden')].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink">{formatMoney(b.total_cents ?? 0)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.status!} label={t(`status.${b.status}`)} />
                </td>
                <td className="px-4 py-3 text-muted">{t(`payment.${b.payment_status}`)}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{b.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(count ?? 0) > PAGE_SIZE && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={pageHref(page - 1)} className={buttonClass.secondary}>← {t('calendar.previous')}</Link> : <span />}
          <span className="text-muted">
            {page} / {Math.ceil((count ?? 0) / PAGE_SIZE)}
          </span>
          {page * PAGE_SIZE < (count ?? 0) ? <Link href={pageHref(page + 1)} className={buttonClass.secondary}>{t('calendar.next')} →</Link> : <span />}
        </nav>
      )}
    </>
  );
}

export const dynamic = 'force-dynamic';
