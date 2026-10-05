import 'server-only';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type Status = Database['public']['Enums']['booking_status'];
type Payment = Database['public']['Enums']['payment_status'];

const STATUSES = ['pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
const PAYMENTS = ['unpaid', 'pending', 'paid', 'partially_paid', 'refunded', 'failed'] as const;
// created = when the booking was made (default); start = appointment time
const SORTS = ['created_desc', 'created_asc', 'start_asc', 'start_desc', 'client_asc', 'total_desc', 'total_asc'] as const;

const SORT_ORDER: Record<(typeof SORTS)[number], { column: 'created_at' | 'start_at' | 'client_name' | 'total_cents'; ascending: boolean }> = {
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  start_asc: { column: 'start_at', ascending: true },
  start_desc: { column: 'start_at', ascending: false },
  client_asc: { column: 'client_name', ascending: true },
  total_desc: { column: 'total_cents', ascending: false },
  total_asc: { column: 'total_cents', ascending: true },
};

export const bookingFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  payment: z.enum(PAYMENTS).optional().catch(undefined),
  treatment: z.uuid().optional().catch(undefined),
  specialist: z.uuid().optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
  sort: z.enum(SORTS).default('created_desc').catch('created_desc'),
});

export type BookingFilters = z.infer<typeof bookingFiltersSchema>;
export const BOOKING_STATUSES = STATUSES;
export const PAYMENT_STATUSES = PAYMENTS;
export const BOOKING_SORTS = SORTS;
export type BookingSort = (typeof SORTS)[number];

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

  const { column, ascending } = SORT_ORDER[filters.sort];
  // Ties (same day, same client...) keep a stable order: newest booking first
  return query
    .order(column, { ascending, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
}
