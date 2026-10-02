import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import AuditTimeline from '@/components/admin/AuditTimeline';
import { ClientEditor, Documents, PinButton, TagEditor } from '@/components/admin/ClientPanels';
import NoteForm from '@/components/admin/NoteForm';
import { PageHeader, Panel, Stat, StatusBadge, buttonClass } from '@/components/admin/ui';
import { requireStaff } from '@/lib/auth/session';
import { formatDateShort, formatMoney, formatTime } from '@/lib/booking/format';
import { formatPhone } from '@/lib/format/phone';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Client' };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile: me } = await requireStaff(`/admin/clients/${id}`);
  const [t, settings] = await Promise.all([getTranslations('bo'), getPublicSettings()]);
  const tz = settings.timezone;
  const supabase = await createClient();

  const { data: c } = await supabase.from('client_overview').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();

  const [{ data: bookings }, { data: notes }, { data: docs }, { data: allTags }] = await Promise.all([
    supabase.from('booking_search').select('id, code, status, start_at, service, options, total_cents').eq('client_id', id).order('start_at', { ascending: false }).limit(100),
    supabase.from('client_notes').select('id, body, pinned, created_at, author:profiles!author_id(full_name)').eq('client_id', id).is('deleted_at', null).order('pinned', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('client_documents').select('id, title, kind, created_at').eq('client_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('client_tags').select('name').order('name'),
  ]);

  const date = (iso: string) => formatDateShort(iso, tz);

  return (
    <>
      <PageHeader
        title={c.full_name ?? '—'}
        intro={t('client.since', { date: date(c.created_at!) })}
        actions={
          <>
            <Link href="/admin/clients" className={buttonClass.ghost}>
              ← {t('nav.clients')}
            </Link>
            {!c.anonymized_at && (
              <Link href={`/admin/bookings/new?client=${c.id}`} className={buttonClass.primary}>
                {t('client.book')}
              </Link>
            )}
          </>
        }
      />
      {c.anonymized_at && (
        <div className="mb-4">
          <p className="rounded-xl bg-stone px-4 py-3 text-sm text-muted">{t('client.anonymized')}</p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('client.visits')} value={c.visits ?? 0} />
        <Stat label={t('client.noShows')} value={c.no_shows ?? 0} tone={(c.no_shows ?? 0) > 0 ? 'warn' : 'default'} />
        <Stat label={t('client.lifetime')} value={formatMoney(c.lifetime_cents ?? 0)} />
        <Stat label={t('clients.columns.nextVisit')} value={c.next_visit_at ? date(c.next_visit_at) : '—'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4">
          <Panel title={t('client.contact')}>
            <dl className="mb-4 flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-muted">{t('client.phone')}</dt>
                <dd className="text-ink">{formatPhone(c.phone_e164) ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">{t('client.email')}</dt>
                <dd className="break-all text-ink">{c.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted">{t('client.account')}</dt>
                <dd className="text-ink">{c.has_login ? t('client.hasLogin') : t('client.noLogin')}</dd>
              </div>
              <div>
                <dt className="text-muted">{t('client.reminders')}</dt>
                <dd className="text-ink">{c.reminders_opt_in ? t('common.yes') : t('common.no')}</dd>
              </div>
            </dl>
            {!c.anonymized_at && <ClientEditor client={{ id: c.id!, fullName: c.full_name ?? '', email: c.email, phone: c.phone_e164, hasLogin: Boolean(c.has_login) }} />}
          </Panel>

          <Panel title={t('client.tags')}>
            <TagEditor clientId={c.id!} tags={c.tags ?? []} allTags={(allTags ?? []).map((x) => x.name)} />
          </Panel>

          <Panel title={t('client.notes')}>
            {notes && notes.length > 0 && (
              <ul className="mb-4 flex flex-col gap-3">
                {notes.map((n) => (
                  <li key={n.id} className={`rounded-xl px-4 py-3 text-sm ${n.pinned ? 'border border-bronze/40 bg-latte/30' : 'bg-sand'}`}>
                    <p className="whitespace-pre-line text-ink">{n.body}</p>
                    <p className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span>
                        {(n.author as { full_name: string | null } | null)?.full_name ?? '—'} · {date(n.created_at)}
                      </span>
                      <PinButton noteId={n.id} clientId={c.id!} pinned={n.pinned} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <NoteForm kind="client" targetId={c.id!} placeholder={t('client.notePlaceholder')} label={t('booking.addNote')} />
          </Panel>

          <Panel title={t('client.documents')}>
            <Documents clientId={c.id!} documents={(docs ?? []).map((d) => ({ id: d.id, title: d.title, kind: d.kind, dateLabel: date(d.created_at) }))} />
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title={t('client.history')}>
            {!bookings?.length ? (
              <p className="text-sm text-muted">{t('client.noHistory')}</p>
            ) : (
              <ul className="divide-y divide-stone">
                {bookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-3 py-2.5 text-sm transition hover:bg-sand/60">
                      <span className="w-28 shrink-0 text-muted">
                        {date(b.start_at!)}
                        <span className="block text-xs">{formatTime(b.start_at!, tz)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink">{b.service}</span>
                        {b.options && <span className="block truncate text-xs text-muted">{b.options}</span>}
                      </span>
                      <span className="tabular-nums text-ink">{formatMoney(b.total_cents ?? 0)}</span>
                      <StatusBadge status={b.status!} label={t(`status.${b.status}`)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {me.role === 'admin' && (
            <Panel title={t('booking.timeline')}>
              <AuditTimeline entityType="profiles" entityId={c.id!} timeZone={tz} limit={40} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
