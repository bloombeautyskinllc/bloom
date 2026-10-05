import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { createPublicClient } from '@/lib/supabase/public';

const publicSettingsSchema = z.object({
  business_name: z.string(),
  legal_name: z.string(),
  timezone: z.string(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  phone_e164: z.string().nullable(),
  whatsapp_e164: z.string().nullable(),
  public_email: z.string().nullable(),
  privacy_email: z.string(),
  slot_interval_min: z.number(),
  min_notice_min: z.number(),
  max_window_days: z.number(),
  hold_minutes: z.number(),
  cancel_cutoff_hours: z.number(),
  reschedule_cutoff_hours: z.number(),
  max_reschedules: z.number(),
  cancellation_refund_percent: z.number(),
  late_cancellation_refund_percent: z.number(),
  minors_allowed_with_guardian: z.boolean(),
  payments_enabled: z.boolean(),
  // Missing until the deposit migration is applied: the database default
  deposit_percent: z.number().default(40),
  terms_version: z.string(),
});

export type PublicSettings = z.infer<typeof publicSettingsSchema>;

/** Booking rules and policy values that visitors may see (from business_settings, via RPC). */
export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  const { data, error } = await createPublicClient().rpc('get_public_settings');
  if (error) throw new Error(`get_public_settings failed: ${error.message}`);
  return publicSettingsSchema.parse(data);
});
