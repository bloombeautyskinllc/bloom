import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import AuditTimeline from '@/components/admin/AuditTimeline';
import BookingActions from '@/components/admin/BookingActions';
import ConsentPanel from '@/components/admin/ConsentPanel';
import NoteForm from '@/components/admin/NoteForm';
import PaymentsPanel from '@/components/admin/PaymentsPanel';
import { PageHeader, Panel, StatusBadge, buttonClass } from '@/components/admin/ui';
import { requireStaff } from '@/lib/auth/session';
import { formatDateLong, formatDuration, formatMoney, formatTime } from '@/lib/booking/format';
import { answersSchema, conditionChoices, emptyEstheticianRecord, estheticianSchema, labelOf, pressureChoices } from '@/lib/consent/form';
import { formatPhone } from '@/lib/format/phone';
import { getPublicSettings } from '@/lib/settings';
import { payableNow, refreshPendingRefunds } from '@/lib/payments/links';
import { activeSquare } from '@/lib/payments/square';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Booking' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-stone py-2.5 text-sm last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireStaff(`/admin/bookings/${id}`);
  // Settle refunds still marked pending (normally done by the Square webhook)
  if (z.uuid().safeParse(id).success) {
    await refreshPendingRefunds({ bookingId: id }).catch((e) => console.error('[payments] refund refresh failed', e));
  }
  const [t, settings] = await Promise.all([getTranslations('bo'), getPublicSettings()]);
  const tz = settings.timezone;
  const supabase = await createClient();

  const { data: b } = await supabase.from('booking_search').select('*').eq('id', id).maybeSingle();
  if (!b) notFound();

  const [{ data: notes }, { data: events }, { data: emails }, { data: money }, { data: payments }, { data: refunds }, { data: openLink }, square, { data: consent }] = await Promise.all([
    supabase.from('booking_notes').select('id, body, created_at, author:profiles!author_id(full_name)').eq('booking_id', id).is('deleted_at', null).order('created_at'),
    supabase.from('calendar_events').select('kind, sync_status, last_error, last_synced_at').eq('booking_id', id),
    supabase.from('notifications').select('template, recipient, status, created_at').eq('booking_id', id).order('created_at'),
    supabase.from('bookings').select('status, hold_expires_at, total_cents, amount_due_cents, amount_paid_cents, amount_refunded_cents').eq('id', id).single(),
    supabase.from('payments').select('id, amount_cents, card_brand, card_last4, receipt_url, paid_at').eq('booking_id', id).order('paid_at'),
    supabase.from('refunds').select('id, amount_cents, status, reason, created_at').eq('booking_id', id).order('created_at'),
    supabase.from('payment_links').select('url, amount_cents, kind').eq('booking_id', id).eq('status', 'open').maybeSingle(),
    activeSquare(),
    supabase.from('consent_forms').select('answers, signed_name, signed_at, esthetician, esthetician_signature, esthetician_signed_at').eq('booking_id', id).maybeSingle(),
  ]);
  const answers = consent ? answersSchema.parse(consent.answers) : null;
  const when = (iso: string) => `${formatDateLong(iso, tz)} · ${formatTime(iso, tz)}`;
  // First visit to the esthetician part: the appointment and the signed-in staff member
  const newRecord = () => {
    const empty = emptyEstheticianRecord();
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(b.start_at!));
    const name = profile.full_name ?? '';
    return { ...empty, estheticianName: name, record: { ...empty.record, date, treatment: [b.service, b.options].filter(Boolean).join(' · '), esthetician: name } };
  };
  const paidCents = money?.amount_paid_cents ?? 0;
  const refundedCents = money?.amount_refunded_cents ?? 0;

  const minutes = (Date.parse(b.end_at!) - Date.parse(b.start_at!)) / 60_000;

  return (
    <>
      <PageHeader
        title={t('booking.title', { code: b.code ?? '' })}
        intro={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={b.status!} label={t(`status.${b.status}`)} /> {t(`payment.${b.payment_status}`)}
          </span>
        }
        actions={
          <Link href="/admin/bookings" className={buttonClass.ghost}>
            ← {t('nav.bookings')}
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel title={t('booking.actions')}>
            <BookingActions
              bookingId={b.id!}
              status={b.status!}
              startAt={b.start_at!}
              started={Date.parse(b.start_at!) <= Date.now()}
              timeZone={tz}
              refundableCents={paidCents - refundedCents}
            />
          </Panel>

          <Panel>
            <dl>
              <Row label={t('booking.client')}>
                <Link href={`/admin/clients/${b.client_id}`} className="font-medium underline decoration-taupe underline-offset-4">
                  {b.client_name ?? '—'}
                </Link>
                <span className="block text-muted">{[formatPhone(b.client_phone), b.client_email].filter(Boolean).join(' · ')}</span>
              </Row>
              <Row label={t('booking.service')}>
                {b.service}
                {b.options && <span className="block text-muted">{b.options}</span>}
              </Row>
              <Row label={t('booking.when')}>
                {formatDateLong(b.start_at!, tz)} · {formatTime(b.start_at!, tz)} – {formatTime(b.end_at!, tz)}
              </Row>
              <Row label={t('booking.duration')}>{formatDuration(minutes)}</Row>
              {(settings && b.specialist_name) && <Row label={t('booking.specialist')}>{b.specialist_name}</Row>}
              <Row label={t('booking.price')}>
                <span className="tabular-nums">
                  {t('booking.subtotal')}: {formatMoney(b.subtotal_cents ?? 0)}
                  {(b.adjustment_cents ?? 0) !== 0 && <> · {t('booking.adjustment')}: {formatMoney(b.adjustment_cents ?? 0)}</>}
                  {(b.discount_cents ?? 0) > 0 && <> · {t('booking.discount')}: −{formatMoney(b.discount_cents ?? 0)}</>}
                </span>
                <span className="block font-medium tabular-nums">
                  {t('booking.total')}: {formatMoney(b.total_cents ?? 0)}
                </span>
              </Row>
              <Row label={t('booking.source')}>
                {b.source === 'admin' ? t('booking.sourceAdmin') : t('booking.sourceOnline')} · {t('booking.reschedules', { count: b.reschedule_count ?? 0 })}
              </Row>
              {b.rules_overridden && <Row label="⚠">{t('booking.overriddenNote', { reason: b.override_reason ?? '' })}</Row>}
              {b.client_notes && <Row label={t('booking.clientNotes')}>{b.client_notes}</Row>}
              {b.cancellation_reason && <Row label={t('booking.cancelReason')}>{b.cancellation_reason}</Row>}
            </dl>
          </Panel>

          <Panel title={t('consent.title')}>
            <ConsentPanel
              bookingId={b.id!}
              signed={consent ? { signedName: consent.signed_name, signedAtLabel: when(consent.signed_at) } : null}
              highlights={
                answers && {
                  conditions: answers.health.conditions
                    .filter((c) => c !== 'none')
                    .map((c) => (c === 'other' && answers.health.conditionsOther ? answers.health.conditionsOther : labelOf(conditionChoices, c))),
                  medication: answers.health.medication === 'yes' ? answers.health.medicationDetails || t('common.yes') : null,
                  allergies: answers.health.allergies || null,
                  avoid: answers.preferences.avoid || null,
                  pressure: answers.preferences.pressure ? labelOf(pressureChoices, answers.preferences.pressure) : null,
                  photos: answers.consent.photos,
                }
              }
              record={consent?.esthetician ? estheticianSchema.parse(consent.esthetician) : newRecord()}
              estheticianSignature={consent?.esthetician_signature ?? null}
              estheticianSignedLabel={consent?.esthetician_signed_at ? when(consent.esthetician_signed_at) : null}
            />
          </Panel>

          <Panel title={t('booking.internalNotes')}>
            {!notes?.length ? (
              <p className="mb-3 text-sm text-muted">{t('booking.noNotes')}</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-sand px-4 py-3 text-sm">
                    <p className="whitespace-pre-line text-ink">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      {(n.author as { full_name: string | null } | null)?.full_name ?? '—'} · {formatDateLong(n.created_at, tz)} {formatTime(n.created_at, tz)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <NoteForm kind="booking" targetId={b.id!} placeholder={t('booking.notePlaceholder')} label={t('booking.addNote')} />
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title={t('payments.title')}>
            <PaymentsPanel
              bookingId={b.id!}
              timeZone={tz}
              amountDueCents={money?.amount_due_cents ?? 0}
              paidCents={paidCents}
              refundedCents={refundedCents}
              payments={(payments ?? []).map((p) => ({ id: p.id, amountCents: p.amount_cents, cardBrand: p.card_brand, cardLast4: p.card_last4, receiptUrl: p.receipt_url, paidAt: p.paid_at }))}
              refunds={(refunds ?? []).map((r) => ({ id: r.id, amountCents: r.amount_cents, status: r.status, reason: r.reason, createdAt: r.created_at }))}
              openLink={openLink ? { url: openLink.url, amountCents: openLink.amount_cents, kind: openLink.kind } : null}
              suggestedCents={money && square ? (payableNow(money)?.amountCents ?? null) : null}
              canRefund={profile.role === 'admin'}
            />
          </Panel>
          <Panel title={t('booking.notifications')}>
            {!emails?.length ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {emails.map((e, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2">
                    <span className="text-ink">{e.template}</span>
                    <span className="text-muted">
                      {e.status} · {formatTime(e.created_at, tz)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t('booking.calendarSync')}>
            {!events?.length ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {events.map((e) => (
                  <li key={e.kind}>
                    <span className="text-ink">{e.kind}</span> · <span className={e.sync_status === 'error' ? 'text-red-800' : 'text-muted'}>{e.sync_status}</span>
                    {e.last_error && <span className="block text-xs text-red-800">{e.last_error.slice(0, 160)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {profile.role === 'admin' && (
            <Panel title={t('booking.timeline')}>
              <AuditTimeline entityType="bookings" entityId={b.id!} timeZone={tz} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
