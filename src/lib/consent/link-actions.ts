'use server';

import { z } from 'zod';
import { CONSENT_FORM_VERSION, parseSubmission } from '@/lib/consent/form';
import { consentTokenSchema } from '@/lib/consent/link';
import { createPublicClient } from '@/lib/supabase/public';

export type ConsentLinkSubmitResult = { ok: true } | { ok: false; error: 'invalid_link' | 'already_signed' | 'consent_required' | 'generic' };

const submitSchema = z.object({
  token: consentTokenSchema,
  consent: z.object({
    version: z.literal(CONSENT_FORM_VERSION),
    answers: z.unknown(),
    signedName: z.string().trim().min(2).max(120),
    signature: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/).max(300_000),
  }),
});

/** Client signs a booking's consent form from a link sent by the studio (no sign-in: the token is the access). */
export async function submitConsentLink(input: z.input<typeof submitSchema>): Promise<ConsentLinkSubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === 'token') ? 'invalid_link' : 'consent_required' };

  // Dates of birth are checked against tomorrow (UTC) so a client ahead of UTC is never rejected
  const answers = parseSubmission(parsed.data.consent, new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  if (!answers) return { ok: false, error: 'consent_required' };

  const { error } = await createPublicClient().rpc('submit_consent_link', {
    p_token: parsed.data.token,
    p_version: parsed.data.consent.version,
    p_answers: answers,
    p_signed_name: parsed.data.consent.signedName,
    p_signature: parsed.data.consent.signature,
  });
  if (error) {
    if (['invalid_link', 'already_signed', 'consent_required'].includes(error.message)) return { ok: false, error: error.message as 'invalid_link' };
    console.error('[consent] link submission failed', error.message);
    return { ok: false, error: 'generic' };
  }
  return { ok: true };
}
