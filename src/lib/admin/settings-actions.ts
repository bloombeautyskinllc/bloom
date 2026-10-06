'use server';

import { revalidatePath } from 'next/cache';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { SQUARE_ENVIRONMENTS, squareCredentials } from '@/lib/payments/square';
import { createClient } from '@/lib/supabase/server';

export type SettingsResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | 'generic' | 'payments_not_configured'; field?: string };

// Any common format ("(347) 483-3337", "+1 347 483 3337"); US when there is no country code. Saved as E.164.
const phoneNumber = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return '';
    const parsed = parsePhoneNumberFromString(v, 'US');
    if (!parsed?.isValid()) {
      ctx.addIssue({ code: 'custom', message: 'invalid phone number' });
      return z.NEVER;
    }
    return parsed.number;
  });
const emails = z
  .string()
  .transform((v) => v.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))
  .pipe(z.array(z.email()).max(10));

const settingsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(120),
  addressLine1: z.string().trim().max(160),
  addressLine2: z.string().trim().max(160),
  phone: phoneNumber,
  whatsapp: phoneNumber,
  publicEmail: z.email().or(z.literal('')),
  privacyEmail: z.email(),
  slotIntervalMin: z.coerce.number().int().min(5).max(120),
  minNoticeMin: z.coerce.number().int().min(0).max(10_080),
  maxWindowDays: z.coerce.number().int().min(1).max(365),
  holdMinutes: z.coerce.number().int().min(5).max(60),
  cancelCutoffHours: z.coerce.number().int().min(0).max(720),
  rescheduleCutoffHours: z.coerce.number().int().min(0).max(720),
  maxReschedules: z.coerce.number().int().min(0).max(20),
  refundPercent: z.coerce.number().int().min(0).max(100),
  lateRefundPercent: z.coerce.number().int().min(0).max(100),
  minorsAllowed: z.boolean(),
  reminderHours: z
    .string()
    .transform((v) => v.split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0))
    .pipe(z.array(z.number().max(24 * 14)).max(5)),
  alertEmails: emails,
  reviewUrl: z.url().or(z.literal('')),
  reviewDelayHours: z.coerce.number().int().min(0).max(168),
  paymentsEnabled: z.boolean(),
  paymentsMode: z.enum(SQUARE_ENVIRONMENTS),
  depositPercent: z.coerce.number().int().min(0).max(100),
});

export type SettingsInput = z.input<typeof settingsSchema>;

export async function saveSettings(input: SettingsInput): Promise<SettingsResult> {
  if ((await getSession())?.profile.role !== 'admin') return { ok: false, error: 'forbidden' };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid', field: String(parsed.error.issues[0]?.path[0] ?? '') };
  const v = parsed.data;
  // Bookings would wait for a payment that cannot be taken (the chosen mode needs its credentials)
  if (v.paymentsEnabled && !squareCredentials(v.paymentsMode)) return { ok: false, error: 'payments_not_configured' };

  const { error } = await (await createClient())
    .from('business_settings')
    .update({
      business_name: v.businessName,
      legal_name: v.legalName,
      address_line1: v.addressLine1 || null,
      address_line2: v.addressLine2 || null,
      phone_e164: v.phone || null,
      whatsapp_e164: v.whatsapp || null,
      public_email: v.publicEmail || null,
      privacy_email: v.privacyEmail,
      slot_interval_min: v.slotIntervalMin,
      min_notice_min: v.minNoticeMin,
      max_window_days: v.maxWindowDays,
      hold_minutes: v.holdMinutes,
      cancel_cutoff_hours: v.cancelCutoffHours,
      reschedule_cutoff_hours: v.rescheduleCutoffHours,
      max_reschedules: v.maxReschedules,
      cancellation_refund_percent: v.refundPercent,
      late_cancellation_refund_percent: v.lateRefundPercent,
      minors_allowed_with_guardian: v.minorsAllowed,
      reminder_offsets_min: [...new Set(v.reminderHours.map((h) => Math.round(h * 60)))].sort((a, b) => b - a),
      admin_alert_emails: v.alertEmails,
      review_url: v.reviewUrl || null,
      review_request_delay_hours: v.reviewDelayHours,
      payments_enabled: v.paymentsEnabled,
      payments_mode: v.paymentsMode,
      deposit_percent: v.depositPercent,
    })
    .eq('id', 1);
  if (error) return { ok: false, error: 'generic' };

  // Every public page shows the contact details (footer, WhatsApp buttons); terms, privacy and booking show the policies
  revalidatePath('/', 'layout');
  return { ok: true };
}
