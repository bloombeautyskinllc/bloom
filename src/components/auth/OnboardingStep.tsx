'use client';

import Link from 'next/link';
import { useActionState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { routes } from '@/data/site';
import { switchAccount } from '@/lib/auth/actions';
import { completeOnboarding, type OnboardingState } from '@/lib/auth/onboarding';
import { cn } from '@/lib/utils';
import { useCountryOptions } from '../account/useCountryOptions';
import type { OnboardingDefaults } from './AuthModal';

const inputClass =
  'h-12 w-full rounded-xl border border-taupe bg-white px-4 text-base text-ink placeholder:text-muted/60 transition focus:border-bronze focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-red-700';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-red-800">
      {message}
    </p>
  );
}

type Props = { next: string; returnTo: string; defaults: OnboardingDefaults | null };

export default function OnboardingStep({ next, returnTo, defaults }: Props) {
  const t = useTranslations('onboarding');
  const tm = useTranslations('authModal');
  const countries = useCountryOptions();
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});

  const saved = defaults?.phoneE164 ? parsePhoneNumberFromString(defaults.phoneE164) : undefined;
  const values = state.values ?? {
    fullName: defaults?.fullName ?? '',
    country: saved?.country ?? 'US',
    phone: saved?.formatNational() ?? '',
    reminders: defaults?.reminders ?? false,
  };
  const err = state.errors ?? {};
  const link = (href: string) => (chunks: ReactNode) => (
    <Link href={href} target="_blank" className="underline decoration-taupe underline-offset-4 hover:text-ink">
      {chunks}
    </Link>
  );

  return (
    <>
      {/* key: remount with the submitted values after a failed attempt (inputs are uncontrolled) */}
      <form key={JSON.stringify(values)} action={action} noValidate className="flex flex-col gap-6">
        <input type="hidden" name="next" value={next} />

        {err.form && (
          <p role="alert" className="rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
            {t(`errors.${err.form}`)}
          </p>
        )}

        <div>
          <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-ink">
            {t('fullName')}
          </label>
          <input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            maxLength={120}
            defaultValue={values.fullName}
            aria-invalid={Boolean(err.fullName)}
            aria-describedby={err.fullName ? 'fullName-error' : undefined}
            className={inputClass}
          />
          <FieldError id="fullName-error" message={err.fullName && t(`errors.${err.fullName}`)} />
        </div>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-ink">{t('phone')}</legend>
          <div className="flex gap-2">
            <label htmlFor="country" className="sr-only">
              {t('country')}
            </label>
            <select
              id="country"
              name="country"
              autoComplete="tel-country-code"
              defaultValue={values.country}
              className={cn(inputClass, 'w-[124px] shrink-0 px-3')}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <label htmlFor="phone" className="sr-only">
              {t('phone')}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              placeholder="(212) 555-0123"
              defaultValue={values.phone}
              aria-invalid={Boolean(err.phone)}
              aria-describedby={err.phone ? 'phone-error phone-hint' : 'phone-hint'}
              className={inputClass}
            />
          </div>
          <p id="phone-hint" className="mt-1.5 text-sm text-muted">
            {t('phoneHint')}
          </p>
          <FieldError id="phone-error" message={err.phone && t(`errors.${err.phone}`)} />
        </fieldset>

        <div className="flex flex-col gap-4">
          <div>
            <label className="flex items-start gap-3 text-sm leading-relaxed text-ink">
              <input
                type="checkbox"
                name="terms"
                required
                aria-invalid={Boolean(err.terms)}
                aria-describedby={err.terms ? 'terms-error' : undefined}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-taupe accent-cocoa"
              />
              <span>{t.rich('terms', { terms: link(routes.terms), policy: link(`${routes.terms}#cancellation`) })}</span>
            </label>
            <FieldError id="terms-error" message={err.terms && t(`errors.${err.terms}`)} />
          </div>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-ink">
            <input
              type="checkbox"
              name="reminders"
              defaultChecked={values.reminders}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-taupe accent-cocoa"
            />
            <span>{t('reminders')}</span>
          </label>
        </div>

        <button type="submit" disabled={pending} className="btn-dark w-full justify-center disabled:opacity-60">
          {pending ? t('submitting') : t('submit')}
        </button>
      </form>

      <form action={switchAccount} className="mt-5 text-center text-sm text-muted">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {tm.rich('notYou', {
          link: (chunks) => (
            <button type="submit" className="underline decoration-taupe underline-offset-4 hover:text-ink">
              {chunks}
            </button>
          ),
        })}
      </form>
    </>
  );
}
