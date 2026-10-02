'use client';

import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { HiX } from 'react-icons/hi';
import { useTranslations } from 'next-intl';
import type { AuthStep } from '@/lib/auth/redirect';
import { cn } from '@/lib/utils';
import OnboardingStep from './OnboardingStep';
import SignInStep from './SignInStep';

export type OnboardingDefaults = { fullName: string; phoneE164: string | null; reminders: boolean };

type Props = {
  open: boolean;
  step: AuthStep;
  next: string;
  error: string | null;
  returnTo: string;
  defaults: OnboardingDefaults | null;
  onClose: () => void;
};

export default function AuthModal({ open, step, next, error, returnTo, defaults, onClose }: Props) {
  const t = useTranslations();
  const ns = step === 'signin' ? 'login' : 'onboarding';
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] animate-page-in bg-ink/55 backdrop-blur-[3px]" />
        {/* Bottom sheet on phones, centered card from sm up */}
        <div className="pointer-events-none fixed inset-0 z-[101] flex items-end justify-center sm:items-center sm:p-6">
          <Dialog.Content
            ref={contentRef}
            data-lenis-prevent
            // Focus the dialog itself: focusing a field would pop the keyboard over the sheet on phones
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              contentRef.current?.focus();
            }}
            tabIndex={-1}
            className="pointer-events-auto relative max-h-[92dvh] w-full animate-enter-up overflow-y-auto overscroll-contain rounded-t-[26px] bg-cream px-5 pb-8 pt-6 shadow-soft focus:outline-none sm:max-w-[480px] sm:rounded-[26px] sm:px-10 sm:pb-10 sm:pt-9"
          >
            <span aria-hidden className="mx-auto mb-5 block h-1 w-10 rounded-full bg-taupe sm:hidden" />

            <Dialog.Close
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-sand hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:right-5 sm:top-5"
              aria-label={t('authModal.close')}
            >
              <HiX className="h-5 w-5" />
            </Dialog.Close>

            {/* Two-step progress */}
            <div className="flex gap-1.5 pr-12" aria-hidden>
              <span className="h-1 flex-1 rounded-full bg-cocoa" />
              <span className={cn('h-1 flex-1 rounded-full transition-colors duration-500', step === 'onboarding' ? 'bg-cocoa' : 'bg-stone')} />
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.3em] text-bronze">{t(`${ns}.label`)}</p>

            <Dialog.Title className="heading-md mt-3">
              {t(`${ns}.titleLead`)} <em>{t(`${ns}.titleAccent`)}</em>
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-[15px] leading-relaxed text-muted">{t(`${ns}.body`)}</Dialog.Description>

            <div className="mt-7">
              {step === 'signin' ? (
                <SignInStep next={next} returnTo={returnTo} error={error} />
              ) : (
                <OnboardingStep key={next} next={next} returnTo={returnTo} defaults={defaults} />
              )}
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
