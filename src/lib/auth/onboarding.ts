'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { z } from 'zod';
import { routes } from '@/data/site';
import { safeNext } from '@/lib/auth/redirect';
import { processJobs } from '@/lib/jobs/runner';
import { createClient } from '@/lib/supabase/server';

type ErrorKey = 'fullName' | 'phone' | 'terms' | 'generic';

export type OnboardingState = {
  errors?: Partial<Record<'fullName' | 'phone' | 'terms' | 'form', ErrorKey>>;
  values?: { fullName: string; country: string; phone: string; reminders: boolean };
};

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  country: z.string().regex(/^[A-Z]{2}$/),
  phone: z.string().trim().min(4).max(30),
  terms: z.literal('on'),
  reminders: z.literal('on').optional(),
  next: z.string().optional(),
});

/** Step 2 of the auth modal: mandatory details on first sign-in. */
export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const raw = Object.fromEntries(formData);
  const values = {
    fullName: String(raw.fullName ?? ''),
    country: String(raw.country ?? 'US'),
    phone: String(raw.phone ?? ''),
    reminders: raw.reminders === 'on',
  };

  const parsed = schema.safeParse(raw);
  const errors: NonNullable<OnboardingState['errors']> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'fullName') errors.fullName = 'fullName';
      if (field === 'phone' || field === 'country') errors.phone = 'phone';
      if (field === 'terms') errors.terms = 'terms';
    }
  }

  // Server-side validation is the source of truth: E.164 via libphonenumber (full metadata)
  const phone = parsePhoneNumberFromString(values.phone, values.country as CountryCode);
  if (!phone?.isValid()) errors.phone = 'phone';

  if (!parsed.success || !phone || Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { data: firstTime, error } = await supabase.rpc('complete_onboarding', {
    p_full_name: parsed.data.fullName,
    p_phone_e164: phone.number,
    p_accept_terms: true,
    p_reminders: values.reminders,
  });

  if (error) {
    console.error('[onboarding] complete_onboarding failed', error.message);
    return { errors: { form: 'generic' }, values };
  }

  // The welcome email was queued in the same transaction. Run the worker after the response
  // so it goes out right away; if this attempt fails, the scheduled worker retries it.
  if (firstTime) {
    after(() => processJobs({ limit: 5 }).catch((e) => console.error('[jobs] inline run failed', e)));
  }

  redirect(safeNext(parsed.data.next) ?? routes.dashboard);
}
