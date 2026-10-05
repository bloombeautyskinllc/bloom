'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { cancelBookingAsStaff, rescheduleBookingAsStaff, setBookingStatus } from '@/lib/admin/actions';
import { localDate, toLocal } from '@/lib/availability/timezone';
import { formatMoney } from '@/lib/booking/format';
import LocalDateTimeInput, { toInstant } from './LocalDateTimeInput';
import { Notice, buttonClass, inputClass } from './ui';

type Props = {
  bookingId: string;
  status: string;
  startAt: string;
  started: boolean;
  timeZone: string;
  /** Paid online and not yet refunded, in cents */
  refundableCents: number;
};

export default function BookingActions({ bookingId, status, startAt, started, timeZone, refundableCents }: Props) {
  const t = useTranslations('bo');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<'cancel' | 'reschedule' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [override, setOverride] = useState(false);
  const [refund, setRefund] = useState<'full' | 'policy' | 'none'>('full');
  const local = toLocal(Date.parse(startAt), timeZone);
  const [when, setWhen] = useState({
    date: localDate(Date.parse(startAt), timeZone),
    time: `${String(local.hour).padStart(2, '0')}:${String(local.minute - (local.minute % 15)).padStart(2, '0')}`,
  });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        setDialog(null);
        setNotice({ tone: 'success', text: success });
        router.refresh();
      } else {
        setNotice({ tone: 'error', text: t(`errors.${result.error ?? 'generic'}`) });
      }
    });

  const active = status === 'confirmed' || status === 'pending_payment';
  const closable = started && ['confirmed', 'completed', 'no_show'].includes(status);

  return (
    <div className="flex flex-col gap-3">
      {notice && !dialog && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <div className="flex flex-wrap gap-2">
        {status === 'pending_payment' && (
          <button type="button" disabled={pending} className={buttonClass.primary} onClick={() => run(() => setBookingStatus({ bookingId, status: 'confirmed' }), t('booking.done.confirmed'))}>
            {t('booking.confirm')}
          </button>
        )}
        {closable && status !== 'completed' && (
          <button type="button" disabled={pending} className={buttonClass.primary} onClick={() => run(() => setBookingStatus({ bookingId, status: 'completed' }), t('booking.done.completed'))}>
            {t('booking.complete')}
          </button>
        )}
        {closable && status !== 'no_show' && (
          <button type="button" disabled={pending} className={buttonClass.secondary} onClick={() => run(() => setBookingStatus({ bookingId, status: 'no_show' }), t('booking.done.no_show'))}>
            {t('booking.noShow')}
          </button>
        )}
        {active && (
          <>
            <button type="button" disabled={pending} className={buttonClass.secondary} onClick={() => { setNotice(null); setDialog('reschedule'); }}>
              {t('booking.reschedule')}
            </button>
            <button type="button" disabled={pending} className={buttonClass.ghost} onClick={() => { setNotice(null); setDialog('cancel'); }}>
              {t('booking.cancel')}
            </button>
          </>
        )}
      </div>

      <Modal open={dialog === 'cancel'} onOpenChange={(o) => !o && setDialog(null)} title={t('booking.cancelTitle')} closeLabel={t('common.close')}>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-medium text-ink">{t('common.reason')}</label>
            <textarea id="cancel-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} h-auto py-2`} />
          </div>
          {refundableCents > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium text-ink">{t('booking.refundOnCancel', { amount: formatMoney(refundableCents) })}</legend>
              {(['full', 'policy', 'none'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm text-ink">
                  <input type="radio" name="refund-mode" checked={refund === mode} onChange={() => setRefund(mode)} className="h-4 w-4 accent-cocoa" />
                  {t(`booking.refundMode.${mode}`)}
                </label>
              ))}
            </fieldset>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-cocoa" />
            {t('common.notifyClient')}
          </label>
          {notice?.tone === 'error' && <Notice tone="error">{notice.text}</Notice>}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass.ghost} onClick={() => setDialog(null)}>{t('common.cancel')}</button>
            <button type="button" disabled={pending} className={buttonClass.danger} onClick={() => run(() => cancelBookingAsStaff({ bookingId, reason: reason || undefined, notify, refund }), t('booking.done.cancelled'))}>
              {t('booking.cancelConfirm')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'reschedule'} onOpenChange={(o) => !o && setDialog(null)} title={t('booking.rescheduleTitle')} closeLabel={t('common.close')}>
        <div className="flex flex-col gap-4">
          <LocalDateTimeInput idPrefix="resched" date={when.date} time={when.time} onChange={setWhen} />
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 h-4 w-4 accent-cocoa" />
            {t('booking.override')}
          </label>
          {override && (
            <>
              <Notice>{t('booking.overrideWarning')}</Notice>
              <div>
                <label htmlFor="override-reason" className="mb-1.5 block text-sm font-medium text-ink">{t('booking.overrideReason')}</label>
                <input id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={inputClass} />
              </div>
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-cocoa" />
            {t('common.notifyClient')}
          </label>
          {notice?.tone === 'error' && <Notice tone="error">{notice.text}</Notice>}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass.ghost} onClick={() => setDialog(null)}>{t('common.cancel')}</button>
            <button
              type="button"
              disabled={pending}
              className={buttonClass.primary}
              onClick={() => {
                const startAtIso = toInstant(when.date, when.time, timeZone);
                if (!startAtIso) return;
                run(() => rescheduleBookingAsStaff({ bookingId, startAt: startAtIso, override, reason: override ? reason : undefined, notify }), t('booking.done.rescheduled'));
              }}
            >
              {t('booking.move')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
