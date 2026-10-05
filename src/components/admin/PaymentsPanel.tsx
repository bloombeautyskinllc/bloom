'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { createPaymentLinkAsStaff, refundBookingAsStaff } from '@/lib/admin/actions';
import { formatDateLong, formatMoney, formatTime } from '@/lib/booking/format';
import { Notice, buttonClass, inputClass } from './ui';

export type PanelPayment = { id: string; amountCents: number; cardBrand: string | null; cardLast4: string | null; receiptUrl: string | null; paidAt: string };
export type PanelLink = { url: string; amountCents: number; kind: string };
export type PanelRefund = { id: string; amountCents: number; status: string; reason: string | null; createdAt: string };

type Props = {
  bookingId: string;
  timeZone: string;
  amountDueCents: number;
  paidCents: number;
  refundedCents: number;
  payments: PanelPayment[];
  refunds: PanelRefund[];
  openLink: PanelLink | null;
  /** What the booking owes online now (deposit or balance); null when it cannot be paid online */
  suggestedCents: number | null;
  canRefund: boolean;
};

export default function PaymentsPanel({ bookingId, timeZone, amountDueCents, paidCents, refundedCents, payments, refunds, openLink, suggestedCents, canRefund }: Props) {
  const t = useTranslations('bo');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkAmount, setLinkAmount] = useState('');
  const [link, setLink] = useState<PanelLink | null>(openLink);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const refundable = paidCents - refundedCents;
  const when = (iso: string) => `${formatDateLong(iso, timeZone)} · ${formatTime(iso, timeZone)}`;

  const submit = () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0 || cents > refundable) return setNotice({ tone: 'error', text: t('errors.invalid_amount') });
    start(async () => {
      const result = await refundBookingAsStaff({ bookingId, amountCents: cents, reason: reason || undefined });
      if (!result.ok) return setNotice({ tone: 'error', text: t(`errors.${result.error}`) });
      setOpen(false);
      setNotice({ tone: 'success', text: t('payments.refundQueued') });
      router.refresh();
    });
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false); // clipboard blocked: the field is selectable
    }
  };

  const createLink = () => {
    const cents = Math.round(Number(linkAmount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return setNotice({ tone: 'error', text: t('errors.invalid_amount') });
    start(async () => {
      const result = await createPaymentLinkAsStaff({ bookingId, amountCents: cents });
      if (!result.ok) return setNotice({ tone: 'error', text: t(`errors.${result.error}`) });
      setLinkOpen(false);
      setLink(result.data);
      await copy(result.data.url);
      setNotice({ tone: 'success', text: t('payments.linkCreated') });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      {notice && !open && !linkOpen && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <dl className="grid grid-cols-3 gap-2">
        {[
          [t('payments.due'), amountDueCents],
          [t('payments.paid'), paidCents],
          [t('payments.refunded'), refundedCents],
        ].map(([label, cents]) => (
          <div key={label} className="rounded-xl bg-sand px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-medium tabular-nums text-ink">{formatMoney(cents as number)}</dd>
          </div>
        ))}
      </dl>

      {payments.length === 0 && refunds.length === 0 && <p className="text-muted">{link ? t('payments.awaiting') : t('payments.none')}</p>}

      {payments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-2">
              <span className="text-ink">
                {formatMoney(p.amountCents)} · {[p.cardBrand?.replace(/_/g, ' ').toLowerCase(), p.cardLast4 && `•••• ${p.cardLast4}`].filter(Boolean).join(' ') || 'Square'}
              </span>
              <span className="text-muted">
                {when(p.paidAt)}
                {p.receiptUrl && (
                  <>
                    {' · '}
                    <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="underline decoration-taupe underline-offset-4">
                      {t('payments.receipt')}
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {refunds.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-stone pt-2">
          {refunds.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2">
              <span className="text-ink">
                −{formatMoney(r.amountCents)} · {t(`payments.refundStatus.${r.status}`)}
                {r.reason && <span className="text-muted"> · {r.reason}</span>}
              </span>
              <span className="text-muted">{when(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {(link || suggestedCents !== null) && (
        <div className="flex flex-col gap-2 border-t border-stone pt-3">
          <p className="text-xs font-medium text-ink">{t('payments.link')}</p>
          {link && (
            <>
              <div className="flex gap-2">
                <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={t('payments.link')} className={`${inputClass} font-mono text-xs`} />
                <button type="button" className={buttonClass.secondary} onClick={() => copy(link.url)}>
                  {copied ? t('payments.copied') : t('payments.copy')}
                </button>
              </div>
              <p className="text-xs text-muted">{t('payments.linkFor', { amount: formatMoney(link.amountCents), kind: link.kind })}</p>
            </>
          )}
          {suggestedCents !== null && (
            <div>
              <button
                type="button"
                className={buttonClass.ghost}
                onClick={() => {
                  setNotice(null);
                  setLinkAmount((suggestedCents / 100).toFixed(2));
                  setLinkOpen(true);
                }}
              >
                {link ? t('payments.newLink') : t('payments.createLink')}
              </button>
            </div>
          )}
        </div>
      )}

      {canRefund && refundable > 0 && (
        <div>
          <button
            type="button"
            className={buttonClass.secondary}
            onClick={() => {
              setNotice(null);
              setAmount((refundable / 100).toFixed(2));
              setOpen(true);
            }}
          >
            {t('payments.refund')}
          </button>
        </div>
      )}

      <Modal open={linkOpen} onOpenChange={setLinkOpen} title={t('payments.linkTitle')} closeLabel={t('common.close')}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('payments.linkIntro')}</p>
          <div>
            <label htmlFor="link-amount" className="mb-1.5 block text-sm font-medium text-ink">{t('payments.amount')}</label>
            <input id="link-amount" type="number" min={0.01} step="0.01" value={linkAmount} onChange={(e) => setLinkAmount(e.target.value)} className={inputClass} />
          </div>
          {notice?.tone === 'error' && <Notice tone="error">{notice.text}</Notice>}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass.ghost} onClick={() => setLinkOpen(false)}>{t('common.cancel')}</button>
            <button type="button" disabled={pending} className={buttonClass.primary} onClick={createLink}>
              {t('payments.createAndCopy')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={open} onOpenChange={setOpen} title={t('payments.refundTitle')} closeLabel={t('common.close')}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('payments.refundIntro', { amount: formatMoney(refundable) })}</p>
          <div>
            <label htmlFor="refund-amount" className="mb-1.5 block text-sm font-medium text-ink">{t('payments.amount')}</label>
            <input id="refund-amount" type="number" min={0.01} max={refundable / 100} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="refund-reason" className="mb-1.5 block text-sm font-medium text-ink">{t('common.reason')}</label>
            <input id="refund-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
          </div>
          {notice?.tone === 'error' && <Notice tone="error">{notice.text}</Notice>}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass.ghost} onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button type="button" disabled={pending} className={buttonClass.danger} onClick={submit}>
              {t('payments.refundConfirm')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
