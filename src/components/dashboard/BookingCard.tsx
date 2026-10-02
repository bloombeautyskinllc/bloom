'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HiOutlineCalendar, HiOutlineDownload } from 'react-icons/hi';
import DateTimePicker from '@/components/booking/DateTimePicker';
import QueryProvider from '@/components/booking/QueryProvider';
import Modal from '@/components/ui/Modal';
import { site } from '@/data/site';
import { cancelBooking, rescheduleBooking } from '@/lib/booking/actions';
import { formatDateLong, formatDuration, formatMoney, formatTime } from '@/lib/booking/format';
import { cn } from '@/lib/utils';

export type DashboardBooking = {
  id: string;
  code: string;
  status: 'held' | 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'expired';
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'failed';
  startAt: string;
  endAt: string;
  totalCents: number;
  isStartingPrice: boolean;
  treatmentName: string;
  optionNames: string[];
  durationMin: number;
  /** Server-computed policy flags (the RPCs enforce the same rules) */
  canChange: boolean;
  reschedulesLeft: number;
  refundPercent: number | null;
  googleCalendarUrl: string;
};

const statusTone: Record<DashboardBooking['status'], string> = {
  held: 'bg-sand text-bronze',
  pending_payment: 'bg-sand text-bronze',
  confirmed: 'bg-cocoa text-cream',
  completed: 'bg-stone text-ink',
  cancelled: 'bg-stone text-muted',
  no_show: 'bg-stone text-muted',
  expired: 'bg-stone text-muted',
};

type Props = { booking: DashboardBooking; timeZone: string; maxWindowDays: number; upcoming: boolean };

export default function BookingCard({ booking, timeZone, maxWindowDays, upcoming }: Props) {
  const t = useTranslations('dashboard');
  const tb = useTranslations('booking');
  const router = useRouter();
  const [dialog, setDialog] = useState<'cancel' | 'reschedule' | null>(null);
  const [reason, setReason] = useState('');
  const [newSlot, setNewSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const date = formatDateLong(booking.startAt, timeZone);
  const time = formatTime(booking.startAt, timeZone);
  const active = booking.status === 'confirmed' || booking.status === 'pending_payment';

  const close = () => {
    setDialog(null);
    setError(null);
    setNewSlot(null);
    setReason('');
  };

  const doCancel = () =>
    startTransition(async () => {
      const result = await cancelBooking({ bookingId: booking.id, reason: reason || undefined });
      if (!result.ok) return setError(tb(`errors.${result.error}`));
      close();
      setNotice(t('cancelDialog.done'));
      router.refresh();
    });

  const doReschedule = () =>
    newSlot &&
    startTransition(async () => {
      const result = await rescheduleBooking({ bookingId: booking.id, startAt: newSlot });
      if (!result.ok) return setError(tb(`errors.${result.error}`));
      close();
      setNotice(t('rescheduleDialog.done'));
      router.refresh();
    });

  return (
    <article className={cn('rounded-[22px] border border-stone bg-cream/90 p-5 sm:p-6', upcoming && 'shadow-soft')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-bronze">
            {date} · {time}
          </p>
          <h3 className="mt-1.5 font-serif text-2xl leading-tight text-ink">{booking.treatmentName}</h3>
          {booking.optionNames.length > 0 && <p className="mt-1 text-sm text-muted">{booking.optionNames.join(', ')}</p>}
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', statusTone[booking.status])}>{t(`status.${booking.status}`)}</span>
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-1.5">
          <dt className="text-muted">{tb('summary.duration')}:</dt>
          <dd className="text-ink">{formatDuration(booking.durationMin)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">{tb('summary.total')}:</dt>
          <dd className="text-ink">
            {booking.isStartingPrice && 'from '}
            {formatMoney(booking.totalCents)}
          </dd>
        </div>
        {active && (
          <div className="flex gap-1.5">
            <dd className="text-muted">{t(`payment.${booking.paymentStatus}`)}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt className="text-muted">Ref:</dt>
          <dd className="font-mono text-xs leading-5 text-ink">{booking.code}</dd>
        </div>
      </dl>

      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-sand px-4 py-2.5 text-sm text-ink">
          {notice}
        </p>
      )}

      {upcoming && active && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone pt-4">
          {booking.canChange ? (
            <>
              {booking.status === 'confirmed' && booking.reschedulesLeft > 0 && (
                <button type="button" onClick={() => setDialog('reschedule')} className="rounded-full bg-cocoa px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink">
                  {t('actions.reschedule')}
                </button>
              )}
              <button type="button" onClick={() => setDialog('cancel')} className="rounded-full border border-taupe px-4 py-2 text-sm font-medium text-ink transition hover:border-bronze">
                {t('actions.cancel')}
              </button>
            </>
          ) : (
            <p className="w-full text-sm text-muted">
              {t('policyClosed')}{' '}
              <a href={site.whatsappUrl} target="_blank" rel="noreferrer" className="text-ink underline decoration-taupe underline-offset-4">
                {t('actions.contact')}
              </a>
            </p>
          )}
          <a href={booking.googleCalendarUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted transition hover:bg-sand hover:text-ink">
            <HiOutlineCalendar className="h-4 w-4" /> {t('actions.addToGoogle')}
          </a>
          <a href={`/api/bookings/${booking.id}/ics`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted transition hover:bg-sand hover:text-ink">
            <HiOutlineDownload className="h-4 w-4" /> {t('actions.downloadIcs')}
          </a>
          {booking.canChange && booking.status === 'confirmed' && (
            <p className="w-full text-xs text-muted">{t('reschedulesLeft', { count: booking.reschedulesLeft })}</p>
          )}
        </div>
      )}

      <Modal open={dialog === 'cancel'} onOpenChange={(o) => !o && close()} title={t('cancelDialog.title')} description={t('cancelDialog.body', { treatment: booking.treatmentName, date, time })}>
        {booking.refundPercent !== null && booking.paymentStatus === 'paid' && (
          <p className="mb-4 text-sm text-ink">{t('cancelDialog.refund', { percent: booking.refundPercent })}</p>
        )}
        <label htmlFor={`reason-${booking.id}`} className="mb-2 block text-sm font-medium text-ink">
          {t('cancelDialog.reason')}
        </label>
        <textarea
          id={`reason-${booking.id}`}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl border border-taupe bg-white px-4 py-3 text-base text-ink focus:border-bronze focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} className="rounded-full border border-taupe px-5 py-3 text-sm font-medium text-ink">
            {t('cancelDialog.keep')}
          </button>
          <button type="button" onClick={doCancel} disabled={pending} className="rounded-full bg-cocoa px-5 py-3 text-sm font-medium text-cream disabled:opacity-60">
            {pending ? t('cancelDialog.cancelling') : t('cancelDialog.confirm')}
          </button>
        </div>
      </Modal>

      <Modal
        open={dialog === 'reschedule'}
        onOpenChange={(o) => !o && close()}
        title={t('rescheduleDialog.title')}
        description={t('rescheduleDialog.current', { date, time })}
        wide
      >
        {dialog === 'reschedule' && (
          <QueryProvider>
            <DateTimePicker source={{ bookingId: booking.id }} timeZone={timeZone} maxWindowDays={maxWindowDays} selected={newSlot} pending={pending} onSelect={setNewSlot} />
          </QueryProvider>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 border-t border-stone pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">{newSlot ? `${formatDateLong(newSlot, timeZone)} · ${formatTime(newSlot, timeZone)}` : ''}</p>
          <button type="button" onClick={doReschedule} disabled={!newSlot || pending} className="btn-dark justify-center disabled:opacity-50">
            {pending ? t('rescheduleDialog.moving') : t('rescheduleDialog.confirm')}
          </button>
        </div>
      </Modal>
    </article>
  );
}
