'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { routes } from '@/data/site';
import type { Hold } from '@/lib/booking/actions';
import { formatMoney } from '@/lib/booking/format';
import type { IntakeQuestion } from '@/lib/booking/types';
import { StepHeading } from './steps';

export type PolicySummary = {
  cancelCutoffHours: number;
  maxReschedules: number;
  refundPercent: number;
  paymentsEnabled: boolean;
  /** Share of the price charged at booking when the treatment has no fixed deposit */
  depositPercent: number;
};

type Props = {
  hold: Hold;
  intake: IntakeQuestion[] | null;
  policy: PolicySummary;
  /** Deposit charged online before the booking is confirmed (0 = no deposit). The client may pay the full price instead. */
  amountDueCents: number;
  pending: boolean;
  error: string | null;
  onExpired: () => void;
  onSubmit: (values: { notes: string; intake?: Record<string, string | boolean>; payFull: boolean }) => void;
};

function useCountdown(until: string) {
  const [left, setLeft] = useState(() => Date.parse(until) - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(Date.parse(until) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  return Math.max(0, left);
}

const fieldClass =
  'w-full rounded-xl border border-taupe bg-white px-4 py-3 text-base text-ink placeholder:text-muted/60 transition focus:border-bronze focus:outline-none focus:ring-2 focus:ring-accent/30';

export default function ConfirmStep({ hold, intake, policy, amountDueCents, pending, error, onExpired, onSubmit }: Props) {
  const t = useTranslations('booking.confirm');
  const left = useCountdown(hold.holdExpiresAt);
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [payFull, setPayFull] = useState(false);
  // With online payments the client chooses: the deposit, or everything now
  const canChoose = policy.paymentsEnabled && amountDueCents < hold.totalCents;
  const chargeCents = payFull ? hold.totalCents : amountDueCents;
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  const expired = left === 0;

  const missing = (intake ?? []).filter((q) => q.required && (answers[q.id] === undefined || answers[q.id] === ''));

  return (
    <div>
      <StepHeading>{t('title')}</StepHeading>

      <p
        role="status"
        className={`mt-4 rounded-xl px-4 py-3 text-sm ${expired ? 'border border-accent/40 bg-sand text-ink' : 'bg-sand/70 text-muted'}`}
      >
        {expired ? (
          <>
            {t('holdExpired')}{' '}
            <button type="button" onClick={onExpired} className="font-medium text-ink underline decoration-taupe underline-offset-4">
              OK
            </button>
          </>
        ) : (
          t('holdNotice', { time: `${minutes}:${String(seconds).padStart(2, '0')}` })
        )}
      </p>

      <form
        className="mt-6 flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (expired || missing.length > 0) return;
          onSubmit({ notes, intake: intake ? answers : undefined, payFull: canChoose && payFull });
        }}
      >
        {intake && intake.length > 0 && (
          <fieldset className="flex flex-col gap-5">
            <legend className="mb-1 font-serif text-xl text-ink">{t('intakeTitle')}</legend>
            {intake.map((q) => (
              <div key={q.id}>
                <label htmlFor={`q-${q.id}`} className="mb-2 block text-sm font-medium text-ink">
                  {q.label} {q.required && <span className="text-xs font-normal text-bronze">({t('required')})</span>}
                </label>
                {q.help && <p className="mb-2 text-xs text-muted">{q.help}</p>}
                {q.type === 'boolean' ? (
                  <div className="flex gap-2" role="radiogroup" id={`q-${q.id}`}>
                    {[true, false].map((v) => (
                      <label key={String(v)} className="flex items-center gap-2 rounded-xl border border-taupe bg-white px-4 py-2.5 text-sm">
                        <input type="radio" name={q.id} checked={answers[q.id] === v} onChange={() => setAnswers((a) => ({ ...a, [q.id]: v }))} className="accent-cocoa" />
                        {v ? t('yes') : t('no')}
                      </label>
                    ))}
                  </div>
                ) : q.type === 'select' ? (
                  <select id={`q-${q.id}`} className={fieldClass} value={String(answers[q.id] ?? '')} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}>
                    <option value="" />
                    {q.options?.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : q.type === 'textarea' ? (
                  <textarea id={`q-${q.id}`} rows={3} maxLength={2000} className={fieldClass} value={String(answers[q.id] ?? '')} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                ) : (
                  <input id={`q-${q.id}`} maxLength={2000} className={fieldClass} value={String(answers[q.id] ?? '')} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                )}
              </div>
            ))}
          </fieldset>
        )}

        <div>
          <label htmlFor="notes" className="mb-2 block text-sm font-medium text-ink">
            {t('notes')}
          </label>
          <textarea
            id="notes"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-describedby="notes-hint"
            className={fieldClass}
          />
          <p id="notes-hint" className="mt-1.5 text-xs text-muted">
            {t('notesHint')}
          </p>
        </div>

        <div className="rounded-2xl border border-stone bg-cream px-5 py-4">
          <p className="text-sm font-medium text-ink">{t('policyTitle')}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {policy.paymentsEnabled
              ? t('policy', { hours: policy.cancelCutoffHours, max: policy.maxReschedules, percent: policy.refundPercent })
              : t('policyNoPayment', { hours: policy.cancelCutoffHours })}{' '}
            <Link href={`${routes.terms}#cancellation`} target="_blank" className="text-ink underline decoration-taupe underline-offset-4">
              {t('readTerms')}
            </Link>
          </p>
        </div>

        {canChoose ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-ink">{t('payChoice')}</legend>
            {[
              { full: false, label: amountDueCents > 0 ? t('payDeposit', { amount: formatMoney(amountDueCents) }) : t('payLater'), hint: t('payDepositHint', { amount: formatMoney(hold.totalCents - amountDueCents) }) },
              { full: true, label: t('payFull', { amount: formatMoney(hold.totalCents) }), hint: t('payFullHint') },
            ].map((o) => (
              <label
                key={String(o.full)}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-5 py-4 transition ${payFull === o.full ? 'border-cocoa bg-cream' : 'border-stone bg-white/60 hover:border-taupe'}`}
              >
                <input type="radio" name="pay" checked={payFull === o.full} onChange={() => setPayFull(o.full)} className="mt-1 accent-cocoa" />
                <span>
                  <span className="block text-sm font-medium text-ink">{o.label}</span>
                  <span className="block text-sm text-muted">{o.hint}</span>
                </span>
              </label>
            ))}
            {chargeCents > 0 && <p className="mt-1 text-sm leading-relaxed text-muted">{t('paymentNote')}</p>}
          </fieldset>
        ) : (
          chargeCents > 0 && (
            <div className="rounded-2xl border border-stone bg-cream px-5 py-4">
              <p className="flex items-baseline justify-between gap-4 text-sm font-medium text-ink">
                <span>{t('dueNow')}</span>
                <span className="font-serif text-xl tabular-nums">{formatMoney(chargeCents)}</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t('paymentNote')}</p>
            </div>
          )
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
            {error}
          </p>
        )}

        <button type="submit" disabled={pending || expired || missing.length > 0} className="btn-dark w-full justify-center disabled:opacity-60">
          {pending ? (chargeCents > 0 ? t('redirecting') : t('submitting')) : chargeCents > 0 ? t('submitPay', { amount: formatMoney(chargeCents) }) : t('submit')}
        </button>
      </form>
    </div>
  );
}
