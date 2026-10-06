'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { HiArrowLeft } from 'react-icons/hi';
import { useTranslations } from 'next-intl';
import { routes } from '@/data/site';
import { holdSlot, startPayment, submitBooking, type Hold } from '@/lib/booking/actions';
import { quote as computeQuote } from '@/lib/booking/pricing';
import type { BookingCatalog } from '@/lib/booking/types';
import { CONSENT_FORM_VERSION, interestFor, prefillAnswers } from '@/lib/consent/form';
import { scrollToTarget } from '@/lib/smoothScroll';
import { cn } from '@/lib/utils';
import BookingSummary from './BookingSummary';
import ConfirmStep, { type PolicySummary } from './ConfirmStep';
import ConsentStep, { type ConsentDraft } from './ConsentStep';
import DateTimePicker from './DateTimePicker';
import { CategoryStep, OptionsStep, StepHeading, TreatmentStep } from './steps';

type Step = 'category' | 'treatment' | 'options' | 'consent' | 'datetime' | 'confirm';

type Props = {
  catalog: BookingCatalog;
  timeZone: string;
  maxWindowDays: number;
  policy: PolicySummary;
  initial: { categorySlug: string | null; treatmentId: string | null; optionIds: string[] };
  /** The client's latest consent form (prefills the new one) and their profile basics */
  consent: { previousAnswers: unknown; previousSignedOn: string | null; profile: { fullName: string | null; email: string | null; phone: string | null } };
};

export default function BookingFlow({ catalog, timeZone, maxWindowDays, policy, initial, consent: consentSource }: Props) {
  const t = useTranslations('booking');
  const router = useRouter();
  const queryClient = useQueryClient();
  const top = useRef<HTMLDivElement>(null);

  const [categorySlug, setCategorySlug] = useState(initial.categorySlug);
  const [treatmentId, setTreatmentId] = useState(initial.treatmentId);
  const [optionIds, setOptionIds] = useState<string[]>(initial.optionIds);
  const [slot, setSlot] = useState<string | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const category = catalog.categories.find((c) => c.slug === categorySlug) ?? null;
  const treatment = category?.treatments.find((x) => x.id === treatmentId) ?? null;
  const hasOptions = (treatment?.options.length ?? 0) > 0;
  const quote = useMemo(() => (treatment ? computeQuote(treatment, optionIds) : null), [treatment, optionIds]);

  // Signed for every booking; answers carry over from the last form, the signature never does
  const [consent, setConsent] = useState<ConsentDraft>(() => ({
    answers: prefillAnswers(consentSource.previousAnswers, consentSource.profile, treatment?.name ?? null),
    signedName: '',
    signature: null,
  }));

  // A preselected laser area still lands on "Customize": clients usually add more areas
  const initialStep: Step = treatment ? (hasOptions ? 'options' : 'consent') : category ? 'treatment' : 'category';
  const [step, setStep] = useState<Step>(initialStep);

  const steps: Step[] = ['category', 'treatment', ...(hasOptions ? (['options'] as const) : []), 'consent', 'datetime', 'confirm'];
  const index = steps.indexOf(step);

  // Keep the selection in the URL so a refresh (or the sign-in round trip) resumes it
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('category');
    url.searchParams.delete('treatment');
    url.searchParams.delete('options');
    if (treatment) url.searchParams.set('treatment', treatment.slug);
    else if (category) url.searchParams.set('category', category.slug);
    if (treatment && optionIds.length) {
      url.searchParams.set('options', treatment.options.filter((o) => optionIds.includes(o.id)).map((o) => o.slug).join(','));
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  }, [category, treatment, optionIds]);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
    if (top.current && top.current.getBoundingClientRect().top < 0) scrollToTarget(top.current, { offset: -120 });
  };

  const back = () => go(steps[Math.max(0, index - 1)]);

  const pickSlot = (iso: string) => {
    if (!treatment) return;
    setSlot(iso);
    setError(null);
    startTransition(async () => {
      const result = await holdSlot({ treatmentId: treatment.id, optionIds, startAt: iso, idempotencyKey: crypto.randomUUID() });
      if (result.ok) {
        setHold(result.data);
        go('confirm');
      } else {
        setSlot(null);
        setError(t(`errors.${result.error}`));
        void queryClient.invalidateQueries({ queryKey: ['availability'] });
      }
    });
  };

  const confirm = (values: { notes: string; intake?: Record<string, string | boolean>; payFull: boolean }) => {
    if (!hold) return;
    startTransition(async () => {
      const result = await submitBooking({
        bookingId: hold.bookingId,
        notes: values.notes || undefined,
        intake: values.intake,
        payFull: values.payFull,
        consent: { version: CONSENT_FORM_VERSION, answers: consent.answers, signedName: consent.signedName, signature: consent.signature ?? '' },
      });
      if (result.ok) {
        if (result.data.status === 'pending_payment') {
          const payment = await startPayment({ bookingId: hold.bookingId });
          // The slot stays held while paying; if checkout cannot open, the dashboard offers to retry
          if (payment.ok) return window.location.assign(payment.data.url);
        }
        router.push(`${routes.dashboard}?booked=${encodeURIComponent(hold.code)}`);
      } else {
        setError(t(`errors.${result.error}`));
        if (result.error === 'hold_expired' || result.error === 'not_held') {
          setHold(null);
          setSlot(null);
          go('datetime');
        } else if (result.error === 'consent_required') {
          // The hold stays; the client fixes the form and picks the time again
          setHold(null);
          setSlot(null);
          setStep('consent');
        }
      }
    });
  };

  return (
    <div ref={top} className="grid gap-10 pb-28 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12 lg:pb-0">
      <div>
        {/* Progress */}
        <nav aria-label={t('stepOf', { current: index + 1, total: steps.length })}>
          <ol className="flex gap-1.5">
            {steps.map((s, i) => (
              <li key={s} className="flex-1">
                <span className={cn('block h-1 rounded-full transition-colors duration-500', i <= index ? 'bg-cocoa' : 'bg-stone')} />
                <span className={cn('mt-2 hidden text-[11px] uppercase tracking-[0.14em] sm:block', i === index ? 'font-bold text-ink' : 'text-muted')}>
                  {t(`steps.${s}`)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.3em] text-bronze sm:hidden">
            {t('stepOf', { current: index + 1, total: steps.length })} · {t(`steps.${step}`)}
          </p>
        </nav>

        {/* The consent form has its own Back button per section */}
        {index > 0 && step !== 'consent' && (
          <button type="button" onClick={back} className="mt-6 inline-flex items-center gap-2 text-sm text-muted transition hover:text-ink">
            <HiArrowLeft className="h-4 w-4" /> {t('back')}
          </button>
        )}

        <div className={cn(index > 0 ? 'mt-4' : 'mt-8')}>
          {step === 'category' && (
            <CategoryStep
              categories={catalog.categories}
              onSelect={(slug) => {
                if (slug !== categorySlug) {
                  setTreatmentId(null);
                  setOptionIds([]);
                }
                setCategorySlug(slug);
                go('treatment');
              }}
            />
          )}

          {step === 'treatment' && category && (
            <TreatmentStep
              category={category}
              selectedId={treatmentId}
              onSelect={(id) => {
                if (id !== treatmentId) {
                  setOptionIds([]);
                  setSlot(null);
                  setHold(null);
                }
                setTreatmentId(id);
                const next = category.treatments.find((x) => x.id === id);
                // "What are you interested in today?" follows the booked treatment
                if (next) setConsent((c) => ({ ...c, answers: { ...c.answers, preferences: { ...c.answers.preferences, ...interestFor(next.name) } } }));
                go(next && next.options.length > 0 ? 'options' : 'consent');
              }}
            />
          )}

          {step === 'options' && treatment && (
            <>
              <OptionsStep
                treatment={treatment}
                selected={optionIds}
                onToggle={(id) => {
                  setSlot(null);
                  setHold(null);
                  setOptionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
                }}
              />
              <button type="button" onClick={() => go('consent')} disabled={!quote?.optionsValid} className="btn-dark mt-8 w-full justify-center disabled:opacity-50 sm:w-auto">
                {t('continue')}
              </button>
            </>
          )}

          {step === 'consent' && error && (
            <p role="alert" className="mb-6 rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
              {error}
            </p>
          )}
          {step === 'consent' && treatment && (
            <ConsentStep value={consent} onChange={setConsent} prefilledOn={consentSource.previousSignedOn} onExit={back} onDone={() => go('datetime')} />
          )}

          {step === 'datetime' && treatment && (
            <div>
              <StepHeading>{t('datetime.title')}</StepHeading>
              {error && (
                <p role="alert" className="mt-4 rounded-xl border border-accent/30 bg-sand px-4 py-3 text-sm text-ink">
                  {error}
                </p>
              )}
              {pending && <p className="mt-4 text-sm text-muted">{t('datetime.holding')}</p>}
              <div className="mt-6">
                <DateTimePicker
                  source={{ treatmentId: treatment.id, optionIds }}
                  timeZone={timeZone}
                  maxWindowDays={maxWindowDays}
                  selected={slot}
                  pending={pending}
                  onSelect={pickSlot}
                />
              </div>
            </div>
          )}

          {step === 'confirm' && treatment && hold && (
            <ConfirmStep
              hold={hold}
              intake={treatment.intake?.questions ?? null}
              policy={policy}
              // Mirrors public.hold_slot: the fixed deposit, otherwise a percentage of the price
              amountDueCents={policy.paymentsEnabled ? Math.min(treatment.depositCents ?? Math.round((hold.totalCents * (treatment.depositPercent ?? policy.depositPercent)) / 100), hold.totalCents) : 0}
              pending={pending}
              error={error}
              onExpired={() => {
                setHold(null);
                setSlot(null);
                go('datetime');
              }}
              onSubmit={confirm}
            />
          )}
        </div>
      </div>

      <BookingSummary
        treatment={treatment}
        selectedOptions={treatment?.options.filter((o) => optionIds.includes(o.id)) ?? []}
        quote={quote}
        slot={hold?.startAt ?? slot}
        timeZone={timeZone}
      />
    </div>
  );
}
