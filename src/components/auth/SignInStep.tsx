'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { routes } from '@/data/site';
import { signInWithGoogle } from '@/lib/auth/actions';
import GoogleIcon from '../account/GoogleIcon';

const ERRORS = ['auth', 'oauth', 'access_denied'] as const;

export default function SignInStep({ next, returnTo, error }: { next: string; returnTo: string; error: string | null }) {
  const t = useTranslations('login');
  const tm = useTranslations('authModal');
  const [pending, setPending] = useState(false);
  const knownError = ERRORS.find((e) => e === error);
  const link = (href: string) => (chunks: ReactNode) => (
    <Link href={href} target="_blank" className="underline decoration-taupe underline-offset-4 hover:text-ink">
      {chunks}
    </Link>
  );

  return (
    <>
      {knownError && (
        <p role="alert" className="mb-5 rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
          {t(`errors.${knownError}`)}
        </p>
      )}
      <form action={signInWithGoogle} onSubmit={() => setPending(true)}>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-taupe bg-white px-6 py-3.5 text-base font-medium text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:translate-y-0 disabled:opacity-70"
        >
          <GoogleIcon className="h-5 w-5" />
          {pending ? tm('redirecting') : t('google')}
        </button>
      </form>
      <p className="mt-5 text-center text-xs leading-relaxed text-muted">
        {t.rich('privacy', { terms: link(routes.terms), privacy: link(routes.privacy) })}
      </p>
    </>
  );
}
