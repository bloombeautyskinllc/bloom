'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { logAppEvent } from '@/lib/audit/log';
import { getSession } from '@/lib/auth/session';
import { processJobs } from '@/lib/jobs/runner';
import { paymentUrlFor } from '@/lib/payments/links';
import { getRequestContext } from '@/lib/request-context';
import { createClient } from '@/lib/supabase/server';

// Stable error keys from the staff RPCs (supabase/migrations/*_back_office.sql)
const KNOWN = [
  'forbidden',
  'not_found',
  'invalid_transition',
  'not_started',
  'not_reschedulable',
  'override_reason_required',
  'outside_availability',
  'slot_taken',
  'too_soon',
  'client_required',
  'invalid_custom_service',
  'not_bookable',
  'invalid_options',
  'invalid_price',
  'not_cancellable',
  'invalid_amount',
  'refund_exceeds_paid',
  'not_payable',
  'payments_unavailable',
] as const;

export type AdminErrorKey = (typeof KNOWN)[number] | 'generic';
export type AdminResult<T = undefined> = { ok: true; data: T } | { ok: false; error: AdminErrorKey };

function toError(error: { message?: string; code?: string } | null): AdminErrorKey {
  if (error?.code === '42501') return 'forbidden';
  const key = KNOWN.find((k) => k === error?.message);
  if (!key) console.error('[admin] unexpected error', error);
  return key ?? 'generic';
}

async function staff() {
  const session = await getSession();
  if (!session || (session.profile.role !== 'staff' && session.profile.role !== 'admin')) return null;
  return session;
}

function done(paths: string[]) {
  paths.forEach((p) => revalidatePath(p));
  // Emails and calendar syncs were enqueued in the same transaction; send them now
  after(() => processJobs({ limit: 10 }).catch((e) => console.error('[jobs] inline run failed', e)));
}

// -----------------------------------------------------------------------------
// Booking status, cancel, reschedule
// -----------------------------------------------------------------------------
const statusSchema = z.object({ bookingId: z.uuid(), status: z.enum(['confirmed', 'completed', 'no_show']) });

export async function setBookingStatus(input: z.input<typeof statusSchema>): Promise<AdminResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success || !(await staff())) return { ok: false, error: 'forbidden' };
  const { error } = await (await createClient()).rpc('staff_set_booking_status', { p_booking_id: parsed.data.bookingId, p_status: parsed.data.status });
  if (error) return { ok: false, error: toError(error) };
  done(['/admin', '/admin/bookings', `/admin/bookings/${parsed.data.bookingId}`, '/admin/calendar']);
  return { ok: true, data: undefined };
}

const cancelSchema = z.object({
  bookingId: z.uuid(),
  reason: z.string().max(500).optional(),
  notify: z.boolean(),
  // What was paid online: all of it (the business cancels), the client policy amount, or nothing
  refund: z.enum(['full', 'policy', 'none']).default('full'),
});

export async function cancelBookingAsStaff(input: z.input<typeof cancelSchema>): Promise<AdminResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success || !(await staff())) return { ok: false, error: 'forbidden' };
  const { error } = await (await createClient()).rpc('staff_cancel_booking', {
    p_booking_id: parsed.data.bookingId,
    p_reason: parsed.data.reason,
    p_notify: parsed.data.notify,
    p_refund: parsed.data.refund,
  });
  if (error) return { ok: false, error: toError(error) };
  done(['/admin', '/admin/bookings', `/admin/bookings/${parsed.data.bookingId}`, '/admin/calendar']);
  return { ok: true, data: undefined };
}

const linkSchema = z.object({ bookingId: z.uuid(), amountCents: z.number().int().positive().max(1_000_000).optional() });

/** Square payment link to send to the client: the deposit or the balance by default, or a custom amount. */
export async function createPaymentLinkAsStaff(input: z.input<typeof linkSchema>): Promise<AdminResult<{ url: string; amountCents: number; kind: string }>> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_amount' };
  if (!(await staff())) return { ok: false, error: 'forbidden' };
  try {
    const result = await paymentUrlFor(parsed.data.bookingId, { amountCents: parsed.data.amountCents });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
    return { ok: true, data: { url: result.url, amountCents: result.amountCents, kind: result.kind } };
  } catch (e) {
    console.error('[payments] staff payment link failed', e);
    return { ok: false, error: 'payments_unavailable' };
  }
}

const refundSchema = z.object({ bookingId: z.uuid(), amountCents: z.number().int().positive(), reason: z.string().max(500).optional() });

/** Admin refund of an online payment (partial or full). Queued; the worker sends it to Square right away. */
export async function refundBookingAsStaff(input: z.input<typeof refundSchema>): Promise<AdminResult> {
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_amount' };
  if ((await getSession())?.profile.role !== 'admin') return { ok: false, error: 'forbidden' };
  const { error } = await (await createClient()).rpc('staff_request_refund', {
    p_booking_id: parsed.data.bookingId,
    p_amount_cents: parsed.data.amountCents,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: toError(error) };
  done(['/admin/bookings', `/admin/bookings/${parsed.data.bookingId}`]);
  return { ok: true, data: undefined };
}

const rescheduleSchema = z.object({
  bookingId: z.uuid(),
  startAt: z.iso.datetime({ offset: true }),
  specialistId: z.uuid().optional(),
  override: z.boolean().default(false),
  reason: z.string().max(500).optional(),
  notify: z.boolean().default(true),
});

export async function rescheduleBookingAsStaff(input: z.input<typeof rescheduleSchema>): Promise<AdminResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success || !(await staff())) return { ok: false, error: 'forbidden' };
  const { error } = await (await createClient()).rpc('staff_reschedule_booking', {
    p_booking_id: parsed.data.bookingId,
    p_new_start: parsed.data.startAt,
    p_specialist_id: parsed.data.specialistId,
    p_override: parsed.data.override,
    p_reason: parsed.data.reason,
    p_notify: parsed.data.notify,
  });
  if (error) return { ok: false, error: toError(error) };
  done(['/admin', '/admin/bookings', `/admin/bookings/${parsed.data.bookingId}`, '/admin/calendar']);
  return { ok: true, data: undefined };
}

// -----------------------------------------------------------------------------
// Custom booking
// -----------------------------------------------------------------------------
const createSchema = z
  .object({
    startAt: z.iso.datetime({ offset: true }),
    clientId: z.uuid().optional(),
    newClient: z.object({ fullName: z.string().trim().min(2).max(120), email: z.email().optional().or(z.literal('')), phoneE164: z.string().optional() }).optional(),
    treatmentId: z.uuid().optional(),
    optionIds: z.array(z.uuid()).max(30).default([]),
    custom: z.object({ name: z.string().trim().min(2).max(120), durationMinutes: z.number().int().min(5).max(600), priceCents: z.number().int().min(0) }).optional(),
    specialistId: z.uuid().optional(),
    priceCents: z.number().int().min(0).optional(),
    discountCents: z.number().int().min(0).default(0),
    override: z.boolean().default(false),
    overrideReason: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
    notify: z.boolean().default(true),
    idempotencyKey: z.string().min(8).max(100),
  })
  .refine((v) => v.clientId || v.newClient, { message: 'client_required' })
  .refine((v) => v.treatmentId || v.custom, { message: 'not_bookable' });

export async function createBookingAsStaff(input: z.input<typeof createSchema>): Promise<AdminResult<{ id: string; code: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!(await staff())) return { ok: false, error: 'forbidden' };
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return { ok: false, error: message === 'client_required' || message === 'not_bookable' ? message : 'generic' };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('admin_create_booking', {
    p_start_at: v.startAt,
    p_client_id: v.clientId,
    p_new_client: v.newClient ? { full_name: v.newClient.fullName, email: v.newClient.email || null, phone_e164: v.newClient.phoneE164 || null } : undefined,
    p_treatment_id: v.custom ? undefined : v.treatmentId,
    p_option_ids: v.custom ? [] : v.optionIds,
    p_custom: v.custom ? { name: v.custom.name, duration_minutes: v.custom.durationMinutes, price_cents: v.custom.priceCents } : undefined,
    p_specialist_id: v.specialistId,
    p_price_cents: v.priceCents,
    p_discount_cents: v.discountCents,
    p_override_rules: v.override,
    p_override_reason: v.overrideReason,
    p_notes: v.notes,
    p_notify: v.notify,
    p_idempotency_key: v.idempotencyKey,
  });
  if (error || !id) return { ok: false, error: toError(error) };
  const { data: booking } = await supabase.from('bookings').select('code').eq('id', id).single();
  done(['/admin', '/admin/bookings', '/admin/calendar', '/admin/clients']);
  return { ok: true, data: { id, code: booking?.code ?? '' } };
}

export type ClientMatch = { id: string; name: string | null; email: string | null; phone: string | null; visits: number };

/** Client picker for the new booking form */
export async function searchClients(q: string): Promise<ClientMatch[]> {
  if (!(await staff())) return [];
  const term = q.replace(/[^\p{L}\p{N}@.+\-_ ]/gu, '').trim();
  if (term.length < 2) return [];
  const { data } = await (await createClient())
    .from('client_overview')
    .select('id, full_name, email, phone_e164, visits')
    .is('anonymized_at', null)
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone_e164.ilike.%${term.replace(/\D/g, '') || term}%`)
    .order('full_name')
    .limit(8);
  return (data ?? []).map((c) => ({ id: c.id!, name: c.full_name, email: c.email, phone: c.phone_e164, visits: c.visits ?? 0 }));
}

// -----------------------------------------------------------------------------
// Notes
// -----------------------------------------------------------------------------
const noteSchema = z.object({ targetId: z.uuid(), body: z.string().trim().min(1).max(4000) });

export async function addBookingNote(input: z.input<typeof noteSchema>): Promise<AdminResult> {
  const parsed = noteSchema.safeParse(input);
  const session = await staff();
  if (!parsed.success || !session) return { ok: false, error: 'forbidden' };
  const { error } = await (await createClient())
    .from('booking_notes')
    .insert({ booking_id: parsed.data.targetId, author_id: session.profile.id, body: parsed.data.body });
  if (error) return { ok: false, error: toError(error) };
  revalidatePath(`/admin/bookings/${parsed.data.targetId}`);
  return { ok: true, data: undefined };
}

export async function addClientNote(input: z.input<typeof noteSchema>): Promise<AdminResult> {
  const parsed = noteSchema.safeParse(input);
  const session = await staff();
  if (!parsed.success || !session) return { ok: false, error: 'forbidden' };
  const { error } = await (await createClient())
    .from('client_notes')
    .insert({ client_id: parsed.data.targetId, author_id: session.profile.id, body: parsed.data.body });
  if (error) return { ok: false, error: toError(error) };
  revalidatePath(`/admin/clients/${parsed.data.targetId}`);
  return { ok: true, data: undefined };
}

export async function toggleClientNotePin(input: { noteId: string; clientId: string; pinned: boolean }): Promise<AdminResult> {
  if (!(await staff())) return { ok: false, error: 'forbidden' };
  const { error } = await (await createClient()).from('client_notes').update({ pinned: input.pinned }).eq('id', input.noteId);
  if (error) return { ok: false, error: toError(error) };
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true, data: undefined };
}

// -----------------------------------------------------------------------------
// Client details, tags, documents
// -----------------------------------------------------------------------------
const clientSchema = z.object({
  clientId: z.uuid(),
  fullName: z.string().trim().min(2).max(120),
  email: z.email().optional().or(z.literal('')),
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/).optional().or(z.literal('')),
});

export async function updateClient(input: z.input<typeof clientSchema>): Promise<AdminResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success || !(await staff())) return { ok: false, error: parsed.success ? 'forbidden' : 'generic' };
  const supabase = await createClient();
  const { data: current } = await supabase.from('profiles').select('user_id').eq('id', parsed.data.clientId).single();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      phone_e164: parsed.data.phoneE164 || null,
      // Emails of people who sign in come from Google and cannot be edited here
      ...(current?.user_id ? {} : { email: parsed.data.email ? parsed.data.email.toLowerCase() : null }),
    })
    .eq('id', parsed.data.clientId);
  if (error) return { ok: false, error: toError(error) };
  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return { ok: true, data: undefined };
}

export async function setClientTag(input: { clientId: string; tagName: string; on: boolean }): Promise<AdminResult> {
  const name = input.tagName.trim().slice(0, 40);
  if (!name || !(await staff())) return { ok: false, error: 'forbidden' };
  const supabase = await createClient();
  let { data: tag } = await supabase.from('client_tags').select('id').eq('name', name).maybeSingle();
  if (!tag && input.on) ({ data: tag } = await supabase.from('client_tags').insert({ name }).select('id').single());
  if (!tag) return { ok: true, data: undefined };
  const { error } = input.on
    ? await supabase.from('client_tag_links').upsert({ client_id: input.clientId, tag_id: tag.id }, { ignoreDuplicates: true })
    : await supabase.from('client_tag_links').delete().eq('client_id', input.clientId).eq('tag_id', tag.id);
  if (error) return { ok: false, error: toError(error) };
  revalidatePath(`/admin/clients/${input.clientId}`);
  revalidatePath('/admin/clients');
  return { ok: true, data: undefined };
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export async function uploadClientDocument(formData: FormData): Promise<AdminResult> {
  const session = await staff();
  if (!session) return { ok: false, error: 'forbidden' };
  const clientId = z.uuid().safeParse(formData.get('clientId'));
  const file = formData.get('file');
  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  const kind = z.enum(['consent', 'intake', 'photo', 'other']).catch('other').parse(formData.get('kind'));
  if (!clientId.success || !(file instanceof File) || file.size === 0 || file.size > MAX_DOCUMENT_BYTES) return { ok: false, error: 'generic' };

  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${clientId.data}/${crypto.randomUUID()}-${safeName}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage.from('client-documents').upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error('[admin] document upload failed', uploadError.message);
    return { ok: false, error: 'generic' };
  }
  const { error } = await supabase.from('client_documents').insert({
    client_id: clientId.data,
    kind,
    title: title || file.name,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    signed_at: kind === 'consent' ? new Date().toISOString() : null,
    uploaded_by: session.profile.id,
  });
  if (error) return { ok: false, error: toError(error) };
  revalidatePath(`/admin/clients/${clientId.data}`);
  return { ok: true, data: undefined };
}

/** Short-lived link to a private document. Every access to health/consent data is audited. */
export async function documentLink(documentId: string): Promise<AdminResult<{ url: string }>> {
  const session = await staff();
  if (!session || !z.uuid().safeParse(documentId).success) return { ok: false, error: 'forbidden' };
  const supabase = await createClient();
  const { data: doc } = await supabase.from('client_documents').select('id, client_id, storage_path, kind').eq('id', documentId).maybeSingle();
  if (!doc) return { ok: false, error: 'not_found' };
  const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(doc.storage_path, 60);
  if (error || !data) return { ok: false, error: 'generic' };
  await logAppEvent({
    action: 'document.viewed',
    entityType: 'client_document',
    entityId: doc.id,
    actorUserId: session.user.id,
    metadata: { client_id: doc.client_id, kind: doc.kind },
    context: await getRequestContext(),
  });
  return { ok: true, data: { url: data.signedUrl } };
}
