import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { describeDiff } from '@/components/admin/AuditTimeline';
import { PageHeader, buttonClass, inputClass } from '@/components/admin/ui';
import { ENTITY_TYPES, auditFiltersSchema, queryAudit } from '@/lib/admin/audit-query';
import { requireAdmin } from '@/lib/auth/session';
import { formatDateShort, formatTime } from '@/lib/booking/format';
import { getPublicSettings } from '@/lib/settings';

export const metadata = { title: 'Activity log' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

function entityHref(type: string, id: string | null) {
  if (!id) return null;
  if (type === 'bookings' || type === 'booking') return `/admin/bookings/${id}`;
  if (type === 'profiles') return `/admin/clients/${id}`;
  return null;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin('/admin/activity');
  const raw = await searchParams;
  const filters = auditFiltersSchema.parse(raw);
  const [t, settings] = await Promise.all([getTranslations('bo'), getPublicSettings()]);
  const tz = settings.timezone;
  const page = filters.page ?? 1;
  const { data: rows, count, names, error } = await queryAudit(filters, tz, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  if (error) throw new Error(error.message);

  const params = new URLSearchParams(Object.entries(raw).filter(([k, v]) => v && k !== 'page') as [string, string][]);
  const pageHref = (p: number) => `/admin/activity?${new URLSearchParams({ ...Object.fromEntries(params), page: String(p) }).toString()}`;

  return (
    <>
      <PageHeader
        title={t('activity.title')}
        intro={t('activity.intro')}
        actions={
          <a href={`/api/admin/audit.csv?${params.toString()}`} className={buttonClass.secondary}>
            {t('common.exportCsv')}
          </a>
        }
      />

      <form className="mb-5 grid gap-3 rounded-2xl border border-stone bg-cream p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <input name="actor" type="email" defaultValue={filters.actor} placeholder={`${t('activity.actor')} (email)`} aria-label={t('activity.actor')} className={inputClass} />
        <select name="actorType" defaultValue={filters.actorType ?? ''} aria-label={t('activity.actor')} className={inputClass}>
          <option value="">{t('activity.actor')}: {t('common.all')}</option>
          {(['admin', 'staff', 'user', 'system'] as const).map((x) => (
            <option key={x} value={x}>
              {x === 'system' ? t('activity.system') : x === 'user' ? t('nav.role.client') : t(`nav.role.${x}`)}
            </option>
          ))}
        </select>
        <input name="action" defaultValue={filters.action} placeholder={t('activity.searchAction')} aria-label={t('activity.action')} className={inputClass} />
        <select name="entity" defaultValue={filters.entity ?? ''} aria-label={t('activity.entityType')} className={inputClass}>
          <option value="">{t('activity.entityType')}: {t('common.all')}</option>
          {ENTITY_TYPES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <input name="from" type="date" defaultValue={filters.from} aria-label={t('bookings.dateFrom')} className={inputClass} />
        <input name="to" type="date" defaultValue={filters.to} aria-label={t('bookings.dateTo')} className={inputClass} />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className={buttonClass.primary}>
            {t('common.filter')}
          </button>
          <Link href="/admin/activity" className={buttonClass.ghost}>
            {t('common.clear')}
          </Link>
          <span className="ml-auto self-center text-sm text-muted">{count ?? 0}</span>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stone bg-cream">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-stone text-xs uppercase tracking-[0.1em] text-bronze">
            <tr>
              {(['when', 'actor', 'action', 'entity', 'details', 'ip'] as const).map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-semibold">
                  {t(`activity.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone align-top">
            {rows?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {t('activity.noEntries')}
                </td>
              </tr>
            )}
            {rows?.map((r) => {
              const href = entityHref(r.entity_type, r.entity_id);
              const changes = describeDiff(r.diff);
              const meta = r.metadata && typeof r.metadata === 'object' && Object.keys(r.metadata).length ? JSON.stringify(r.metadata) : null;
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {formatDateShort(r.occurred_at, tz)}
                    <span className="block text-xs">{formatTime(r.occurred_at, tz)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block text-ink">{r.actor_profile_id ? names.get(r.actor_profile_id) : t('activity.system')}</span>
                    <span className="text-xs text-muted">{r.actor_role}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink">{r.action}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className="block text-muted">{r.entity_type}</span>
                    {href ? (
                      <Link href={href} className="font-mono text-ink underline decoration-taupe">
                        {r.entity_id?.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="font-mono text-muted">{r.entity_id?.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="max-w-[420px] px-4 py-2.5">
                    {changes.length > 0 || meta ? (
                      <details>
                        <summary className="cursor-pointer text-xs text-bronze">{changes.length > 0 ? `${changes.length} field(s)` : 'metadata'}</summary>
                        <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[11px] text-muted">
                          {changes.map((c) => (
                            <li key={c} className="break-all">
                              {c}
                            </li>
                          ))}
                          {meta && <li className="break-all">{meta.slice(0, 400)}</li>}
                        </ul>
                      </details>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted">{r.ip ? String(r.ip) : '—'}</td>
                </tr>
              );
            })}
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
