import 'server-only';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type Status = Database['public']['Enums']['booking_status'];
type Payment = Database['public']['Enums']['payment_status'];

const STATUSES = ['pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
const PAYMENTS = ['unpaid', 'pending', 'paid', 'partially_paid', 'refunded', 'failed'] as const;

export const bookingFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  payment: z.enum(PAYMENTS).optional().catch(undefined),
  treatment: z.uuid().optional().catch(undefined),
  specialist: z.uuid().optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export type BookingFilters = z.infer<typeof bookingFiltersSchema>;
export const BOOKING_STATUSES = STATUSES;
export const PAYMENT_STATUSES = PAYMENTS;

export const BOOKING_COLUMNS =
  'id, code, status, payment_status, source, start_at, end_at, total_cents, subtotal_cents, discount_cents, client_id, client_name, client_email, client_phone, specialist_name, service, options, rules_overridden, client_notes, cancellation_reason, created_at';

/**
 * The bookings list query (page and CSV export share it). Dates are interpreted in the business
 * time zone by the caller passing instants; free-text search covers client name, email, phone and reference.
 */
export async function queryBookings(filters: BookingFilters, range: { from?: Date; to?: Date }, limit: number, offset = 0) {
  const supabase = await createClient();
  let query = supabase.from('booking_search').select(BOOKING_COLUMNS, { count: 'exact' });

  if (filters.status) query = query.eq('status', filters.status as Status);
  if (filters.payment) query = query.eq('payment_status', filters.payment as Payment);
  if (filters.specialist) query = query.eq('specialist_id', filters.specialist);
  if (filters.treatment) query = query.contains('treatment_ids', [filters.treatment]);
  if (range.from) query = query.gte('start_at', range.from.toISOString());
  if (range.to) query = query.lt('start_at', range.to.toISOString());
  if (filters.q) {
    // Only characters that are safe inside a PostgREST or() filter
    const q = filters.q.replace(/[^\p{L}\p{N}@.+\-_ ]/gu, '').trim();
    if (q) query = query.or(`client_name.ilike.%${q}%,client_email.ilike.%${q}%,client_phone.ilike.%${q}%,code.ilike.%${q}%`);
  }

  // Upcoming first when looking forward, most recent first otherwise
  const ascending = Boolean(range.from && range.from.getTime() >= Date.now() - 86_400_000);
  return query.order('start_at', { ascending }).range(offset, offset + limit - 1);
}
