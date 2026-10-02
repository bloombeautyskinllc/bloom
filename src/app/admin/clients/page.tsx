import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader, buttonClass, inputClass } from '@/components/admin/ui';
import { requireStaff } from '@/lib/auth/session';
import { formatDateShort, formatMoney } from '@/lib/booking/format';
import { formatPhone } from '@/lib/format/phone';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaff('/admin/clients');
  const [t, settings, sp] = await Promise.all([getTranslations('bo'), getPublicSettings(), searchParams]);
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? '').replace(/[^\p{L}\p{N}@.+\-_ ]/gu, '').trim().slice(0, 80);

  let query = (await createClient())
    .from('client_overview')
    .select('*', { count: 'exact' })
    .eq('role', 'client')
    .is('anonymized_at', null);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone_e164.ilike.%${q.replace(/\D/g, '') || q}%`);
  const { data: clients, count } = await query.order('full_name', { nullsFirst: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return (
    <>
      <PageHeader title={t('clients.title')} intro={t('clients.count', { count: count ?? 0 })} />
      <form className="mb-5 flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder={t('clients.searchPlaceholder')} aria-label={t('common.search')} className={`${inputClass} max-w-md`} />
        <button type="submit" className={buttonClass.primary}>
          {t('common.search')}
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-stone bg-cream">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-stone text-xs uppercase tracking-[0.1em] text-bronze">
            <tr>
              {(['client', 'contact', 'visits', 'lastVisit', 'nextVisit', 'spend', 'tags'] as const).map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-semibold">
                  {t(`clients.columns.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {clients?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  {t('common.noResults')}
                </td>
              </tr>
            )}
            {clients?.map((c) => (
              <tr key={c.id} className="transition hover:bg-sand/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/clients/${c.id}`} className="font-medium text-ink hover:underline">
                    {c.full_name ?? '—'}
                  </Link>
                  {!c.has_login && <span className="block text-[11px] text-bronze">{t('clients.noLogin')}</span>}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatPhone(c.phone_e164)}
                  <span className="block text-xs">{c.email}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {c.visits}
                  {(c.no_shows ?? 0) > 0 && <span className="ml-1 text-xs text-red-800">({c.no_shows} ✕)</span>}
                </td>
                <td className="px-4 py-3 text-muted">{c.last_visit_at ? formatDateShort(c.last_visit_at, settings.timezone) : '—'}</td>
                <td className="px-4 py-3 text-muted">{c.next_visit_at ? formatDateShort(c.next_visit_at, settings.timezone) : '—'}</td>
                <td className="px-4 py-3 tabular-nums">{formatMoney(c.lifetime_cents ?? 0)}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {c.tags?.map((tag) => (
                      <span key={tag} className="rounded-full bg-sand px-2 py-0.5 text-[11px] text-bronze">
                        {tag}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(count ?? 0) > PAGE_SIZE && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={`/admin/clients?q=${encodeURIComponent(q)}&page=${page - 1}`} className={buttonClass.secondary}>← {t('calendar.previous')}</Link> : <span />}
          <span className="text-muted">
            {page} / {Math.ceil((count ?? 0) / PAGE_SIZE)}
          </span>
          {page * PAGE_SIZE < (count ?? 0) ? <Link href={`/admin/clients?q=${encodeURIComponent(q)}&page=${page + 1}`} className={buttonClass.secondary}>{t('calendar.next')} →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
