'use client';

import { useState, useTransition } from 'react';
import { HiCheck } from 'react-icons/hi';
import { useTranslations } from 'next-intl';
import { CONSENT_FORM_VERSION, type ConsentAnswers } from '@/lib/consent/form';
import { submitConsentLink } from '@/lib/consent/link-actions';
import ConsentStep, { type ConsentDraft } from './ConsentStep';

type Props = { token: string; initialAnswers: ConsentAnswers };

/** The consent form signed from a studio link, outside the booking flow. */
export default function ConsentLinkForm({ token, initialAnswers }: Props) {
  const t = useTranslations('consentLink');
  const [draft, setDraft] = useState<ConsentDraft>({ answers: initialAnswers, signedName: '', signature: null });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="rounded-2xl border border-stone bg-white/70 px-6 py-6">
        <p className="flex items-center gap-2 font-serif text-2xl text-ink">
          <HiCheck className="h-6 w-6 text-bronze" aria-hidden /> {t('doneTitle')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('doneBody')}</p>
      </div>
    );
  }

  const submit = () => {
    setError(null);
    start(async () => {
      const result = await submitConsentLink({
        token,
        consent: { version: CONSENT_FORM_VERSION, answers: draft.answers, signedName: draft.signedName, signature: draft.signature ?? '' },
      });
      if (!result.ok) return setError(t(`errors.${result.error}`));
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <>
      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
          {error}
        </p>
      )}
      <ConsentStep value={draft} onChange={setDraft} prefilledOn={null} finishLabel={pending ? t('sending') : t('finish')} busy={pending} onDone={submit} />
    </>
  );
}
