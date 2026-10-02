'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { routes } from '@/data/site';
import type { Hold } from '@/lib/booking/actions';
import type { IntakeQuestion } from '@/lib/booking/types';
import { StepHeading } from './steps';

export type PolicySummary = {
  cancelCutoffHours: number;
  maxReschedules: number;
  refundPercent: number;
  paymentsEnabled: boolean;
};

type Props = {
  hold: Hold;
  intake: IntakeQuestion[] | null;
  policy: PolicySummary;
  pending: boolean;
  error: string | null;
  onExpired: () => void;
  onSubmit: (values: { notes: string; intake?: Record<string, string | boolean> }) => void;
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

export default function ConfirmStep({ hold, intake, policy, pending, error, onExpired, onSubmit }: Props) {
  const t = useTranslations('booking.confirm');
  const left = useCountdown(hold.holdExpiresAt);
  const [notes, setNotes] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
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
          onSubmit({ notes, intake: intake ? answers : undefined });
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

        {error && (
          <p role="alert" className="rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
            {error}
          </p>
        )}

        <button type="submit" disabled={pending || expired || missing.length > 0} className="btn-dark w-full justify-center disabled:opacity-60">
          {pending ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  );
}
