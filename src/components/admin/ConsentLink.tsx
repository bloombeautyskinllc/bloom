'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HiOutlineLink } from 'react-icons/hi';
import { getConsentLink } from '@/lib/admin/consent-actions';
import { formatDateLong } from '@/lib/booking/format';
import { Notice, buttonClass, inputClass } from './ui';

export type ConsentLinkValue = { url: string; expiresAt: string };

type Props = { bookingId: string; link: ConsentLinkValue | null; timeZone: string };

/** Link the client opens to sign a booking's consent form (created on first click, then copied). */
export default function ConsentLink({ bookingId, link: initial, timeZone }: Props) {
  const t = useTranslations('bo.consent');
  const router = useRouter();
  const [link, setLink] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false); // clipboard blocked: the field is selectable
    }
  };

  if (!link) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={pending}
          className={`${buttonClass.secondary} self-start`}
          onClick={() => {
            setError(null);
            start(async () => {
              const result = await getConsentLink({ bookingId });
              if (!result.ok) {
                setError(t(`errors.${result.error}`));
                if (result.error === 'already_signed') router.refresh();
                return;
              }
              setLink(result.data);
              await copy(result.data.url);
            });
          }}
        >
          <HiOutlineLink className="h-4 w-4" /> {t('createLink')}
        </button>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={t('linkLabel')} className={`${inputClass} min-w-0 font-mono text-xs`} />
        <button type="button" className={`${buttonClass.secondary} shrink-0`} onClick={() => copy(link.url)}>
          {copied ? t('copied') : t('copyLink')}
        </button>
      </div>
      <p className="text-xs text-muted">{t('linkIntro', { date: formatDateLong(link.expiresAt, timeZone) })}</p>
    </div>
  );
}
