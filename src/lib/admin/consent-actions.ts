'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { analysisFields, estheticianSchema, recordFields } from '@/lib/consent/form';
import { consentLinkUrl } from '@/lib/consent/link';
import { createClient } from '@/lib/supabase/server';

export type ConsentRecordResult = { ok: true } | { ok: false; error: 'forbidden' | 'not_found' | 'invalid_record' | 'generic' };

const png = z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/).max(300_000);
const text = (max: number) => z.string().trim().max(max);

// Strict on input (the stored shape is read leniently by estheticianSchema)
const inputSchema = z.object({
  bookingId: z.uuid(),
  record: z.object({
    estheticianName: text(120),
    analysis: z.object(Object.fromEntries(analysisFields.map((f) => [f.id, text(300)]))),
    faceMaps: z.object({ front: png.nullable(), profile: png.nullable() }),
    record: z.object(Object.fromEntries(recordFields.map((f) => [f.id, text(1000)]))),
  }),
  /** New esthetician signature; null keeps the current one */
  signature: png.nullable(),
});

/** Esthetician part of the consent form: skin analysis, face maps, treatment record, signature. */
export async function saveConsentRecord(input: z.input<typeof inputSchema>): Promise<ConsentRecordResult> {
  const session = await getSession();
  if (!session || (session.profile.role !== 'staff' && session.profile.role !== 'admin')) return { ok: false, error: 'forbidden' };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_record' };

  const { error } = await (await createClient()).rpc('staff_save_consent_record', {
    p_booking_id: parsed.data.bookingId,
    p_record: estheticianSchema.parse(parsed.data.record),
    p_signature: parsed.data.signature ?? undefined,
  });
  if (error) {
    if (error.code === '42501') return { ok: false, error: 'forbidden' };
    if (error.message === 'not_found' || error.message === 'invalid_record') return { ok: false, error: error.message };
    console.error('[admin] consent record save failed', error.message);
    return { ok: false, error: 'generic' };
  }
  revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
  return { ok: true };
}

export type ConsentLinkResult =
  | { ok: true; data: { url: string; expiresAt: string } }
  | { ok: false; error: 'forbidden' | 'not_found' | 'not_signable' | 'already_signed' | 'generic' };

const linkSchema = z.object({ bookingId: z.uuid() });

/** Link the client opens to sign the booking's consent form without signing in (created on first use). */
export async function getConsentLink(input: z.input<typeof linkSchema>): Promise<ConsentLinkResult> {
  const session = await getSession();
  if (!session || (session.profile.role !== 'staff' && session.profile.role !== 'admin')) return { ok: false, error: 'forbidden' };
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'not_found' };

  const { data, error } = await (await createClient()).rpc('staff_consent_link', { p_booking_id: parsed.data.bookingId });
  const link = data?.[0];
  if (error || !link) {
    if (error?.code === '42501') return { ok: false, error: 'forbidden' };
    if (error && ['not_found', 'not_signable', 'already_signed'].includes(error.message)) return { ok: false, error: error.message as 'not_found' };
    console.error('[admin] consent link failed', error?.message);
    return { ok: false, error: 'generic' };
  }
  return { ok: true, data: { url: consentLinkUrl(link.token), expiresAt: link.expires_at } };
}
