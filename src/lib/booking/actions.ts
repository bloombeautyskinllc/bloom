'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { z } from 'zod';
import { routes } from '@/data/site';
import { logAppEvent } from '@/lib/audit/log';
import { CONSENT_FORM_VERSION, parseSubmission } from '@/lib/consent/form';
import { processJobs } from '@/lib/jobs/runner';
import { paymentUrlFor } from '@/lib/payments/links';
import { getRequestContext } from '@/lib/request-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Stable error keys raised by the booking RPCs (see supabase/migrations/*_bookings.sql)
const KNOWN_ERRORS = [
  'not_authenticated',
  'onboarding_required',
  'not_bookable',
  'invalid_options',
  'too_soon',
  'too_far',
  'invalid_time',
  'slot_taken',
  'not_found',
  'not_held',
  'hold_expired',
  'intake_required',
  'consent_required',
  'not_cancellable',
  'not_reschedulable',
  'outside_policy',
  'max_reschedules',
  'not_payable',
  'payments_unavailable',
] as const;

export type BookingErrorKey = (typeof KNOWN_ERRORS)[number] | 'invalid_request' | 'generic';
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: BookingErrorKey };

// Booking changes enqueue emails and calendar syncs in the same transaction; run the worker right
// after the response so they go out now (pg_cron picks up anything left within a minute).
function kickJobs() {
  after(() => processJobs({ limit: 10 }).catch((e) => console.error('[jobs] inline run failed', e)));
}

function toError(message: string | undefined): BookingErrorKey {
  const key = KNOWN_ERRORS.find((k) => k === message);
  if (!key) console.error('[booking] unexpected error', message);
  return key ?? 'generic';
}

// -----------------------------------------------------------------------------
// Booking flow
// -----------------------------------------------------------------------------

const holdSchema = z.object({
  treatmentId: z.uuid(),
  optionIds: z.array(z.uuid()).max(30),
  startAt: z.iso.datetime(),
  idempotencyKey: z.string().min(8).max(100),
});

export type Hold = { bookingId: string; code: string; holdExpiresAt: string; startAt: string; endAt: string; totalCents: number };

export async function holdSlot(input: z.input<typeof holdSchema>): Promise<ActionResult<Hold>> {
  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_request' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('hold_slot', {
      p_treatment_id: parsed.data.treatmentId,
      p_option_ids: parsed.data.optionIds,
      p_start_at: parsed.data.startAt,
      p_idempotency_key: parsed.data.idempotencyKey,
    })
    .single();
  if (error || !data) return { ok: false, error: toError(error?.message) };

  return {
    ok: true,
    data: {
      bookingId: data.booking_id,
      code: data.code,
      holdExpiresAt: data.hold_expires_at,
      startAt: data.start_at,
      endAt: data.end_at,
      totalCents: data.total_cents,
    },
  };
}

const submitSchema = z.object({
  bookingId: z.uuid(),
  notes: z.string().max(1000).optional(),
  intake: z.record(z.string(), z.union([z.string().max(2000), z.boolean()])).optional(),
  // Pay the full price online instead of the deposit
  payFull: z.boolean().optional(),
  // Intake and consent form signed in the booking flow (answers checked by parseSubmission)
  consent: z.object({
    version: z.literal(CONSENT_FORM_VERSION),
    answers: z.unknown(),
    signedName: z.string().trim().min(2).max(120),
    signature: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/).max(300_000),
  }),
});

export async function submitBooking(input: z.input<typeof submitSchema>): Promise<ActionResult<{ status: string }>> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_request' };

  // Dates of birth are checked against tomorrow (UTC) so a client ahead of UTC is never rejected
  const answers = parseSubmission(parsed.data.consent, new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  if (!answers) return { ok: false, error: 'consent_required' };

  const supabase = await createClient();
  const { error: consentError } = await supabase.rpc('save_booking_consent', {
    p_booking_id: parsed.data.bookingId,
    p_version: parsed.data.consent.version,
    p_answers: answers,
    p_signed_name: parsed.data.consent.signedName,
    p_signature: parsed.data.consent.signature,
  });
  if (consentError) return { ok: false, error: toError(consentError.message) };

  const { data, error } = await supabase.rpc('submit_booking', {
    p_booking_id: parsed.data.bookingId,
    p_notes: parsed.data.notes,
    p_intake: parsed.data.intake,
    p_pay_full: parsed.data.payFull,
  });
  if (error || !data) return { ok: false, error: toError(error?.message) };

  revalidatePath(routes.dashboard);
  kickJobs();
  return { ok: true, data: { status: data } };
}

const paySchema = z.object({ bookingId: z.uuid() });

/** Square checkout URL for a booking awaiting payment (the client is sent there to pay). */
export async function startPayment(input: z.input<typeof paySchema>): Promise<ActionResult<{ url: string }>> {
  const parsed = paySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_request' };

  // RLS: only the client (or staff) can see the booking
  const { data: booking } = await (await createClient()).from('bookings').select('id').eq('id', parsed.data.bookingId).maybeSingle();
  if (!booking) return { ok: false, error: 'not_found' };

  try {
    const result = await paymentUrlFor(booking.id);
    return result.ok ? { ok: true, data: { url: result.url } } : { ok: false, error: result.error };
  } catch (e) {
    console.error('[payments] could not start payment', e);
    return { ok: false, error: 'payments_unavailable' };
  }
}

// -----------------------------------------------------------------------------
// Client dashboard
// -----------------------------------------------------------------------------

const cancelSchema = z.object({ bookingId: z.uuid(), reason: z.string().max(500).optional() });

export async function cancelBooking(input: z.input<typeof cancelSchema>): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_request' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_booking', { p_booking_id: parsed.data.bookingId, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: toError(error.message) };

  revalidatePath(routes.dashboard);
  kickJobs();
  return { ok: true, data: undefined };
}

const rescheduleSchema = z.object({ bookingId: z.uuid(), startAt: z.iso.datetime() });

export async function rescheduleBooking(input: z.input<typeof rescheduleSchema>): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_request' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('reschedule_booking', { p_booking_id: parsed.data.bookingId, p_new_start: parsed.data.startAt });
  if (error) return { ok: false, error: toError(error.message) };

  revalidatePath(routes.dashboard);
  kickJobs();
  return { ok: true, data: undefined };
}

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

export type ProfileFormState = { ok?: boolean; errors?: Partial<Record<'fullName' | 'phone' | 'form', true>> };

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  country: z.string().regex(/^[A-Z]{2}$/),
  phone: z.string().trim().min(4).max(30),
  reminders: z.literal('on').optional(),
});

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  const phone = parsePhoneNumberFromString(String(formData.get('phone') ?? ''), String(formData.get('country') ?? 'US') as CountryCode);
  const errors: ProfileFormState['errors'] = {};
  if (!parsed.success && parsed.error.issues.some((i) => i.path[0] === 'fullName')) errors.fullName = true;
  if (!phone?.isValid()) errors.phone = true;
  if (!parsed.success || !phone?.isValid()) return { errors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: { form: true } };

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName, phone_e164: phone.number, reminders_opt_in: parsed.data.reminders === 'on' })
    .eq('user_id', user.id);
  if (error) {
    console.error('[profile] update failed', error.message);
    return { errors: { form: true } };
  }

  revalidatePath(routes.dashboard);
  return { ok: true };
}

/** Anonymizes the profile (keeps booking history and the audit log), then deletes the login. */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(routes.home);

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(`delete_my_account failed: ${error.message}`);

  const context = await getRequestContext();
  await logAppEvent({ action: 'auth.account_deleted', entityType: 'auth', entityId: user.id, actorUserId: user.id, context });

  const { error: authError } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (authError) console.error('[profile] auth user deletion failed (profile already anonymized)', authError.message);

  await supabase.auth.signOut();
  redirect(`${routes.home}?account=deleted`);
}
