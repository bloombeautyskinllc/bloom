import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';

export type BookingDetails = {
  id: string;
  code: string;
  status: Database['public']['Enums']['booking_status'];
  paymentStatus: Database['public']['Enums']['payment_status'];
  startAt: string;
  endAt: string;
  totalCents: number;
  isStartingPrice: boolean;
  treatmentName: string;
  optionNames: string[];
  clientNotes: string | null;
  rescheduleCount: number;
  cancellationReason: string | null;
  client: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    remindersOptIn: boolean;
    locale: string;
    gone: boolean; // deleted or anonymized: never contact
  };
};

/** Everything a notification or calendar sync needs about one booking (service role: system tasks only). */
export async function loadBooking(bookingId: string): Promise<BookingDetails | null> {
  const { data: b, error } = await createAdminClient()
    .from('bookings')
    .select(
      'id, code, status, payment_status, start_at, end_at, total_cents, client_notes, reschedule_count, cancellation_reason, ' +
        'items:booking_items(kind, name, price_type, sort_order), ' +
        'client:profiles!client_id(id, full_name, email, phone_e164, reminders_opt_in, locale, anonymized_at, deleted_at)',
    )
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw new Error(`booking lookup failed: ${error.message}`);
  if (!b) return null;

  const row = b as unknown as {
    id: string;
    code: string;
    status: BookingDetails['status'];
    payment_status: BookingDetails['paymentStatus'];
    start_at: string;
    end_at: string;
    total_cents: number;
    client_notes: string | null;
    reschedule_count: number;
    cancellation_reason: string | null;
    items: { kind: string; name: string; price_type: 'fixed' | 'from'; sort_order: number }[];
    client: { id: string; full_name: string | null; email: string | null; phone_e164: string | null; reminders_opt_in: boolean; locale: string; anonymized_at: string | null; deleted_at: string | null };
  };
  const items = [...row.items].sort((a, z) => a.sort_order - z.sort_order);

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    paymentStatus: row.payment_status,
    startAt: row.start_at,
    endAt: row.end_at,
    totalCents: row.total_cents,
    isStartingPrice: items.some((i) => i.price_type === 'from'),
    treatmentName: items.find((i) => i.kind !== 'option')?.name ?? 'Appointment',
    optionNames: items.filter((i) => i.kind === 'option').map((i) => i.name),
    clientNotes: row.client_notes,
    rescheduleCount: row.reschedule_count,
    cancellationReason: row.cancellation_reason,
    client: {
      id: row.client.id,
      name: row.client.full_name,
      email: row.client.email,
      phone: row.client.phone_e164,
      remindersOptIn: row.client.reminders_opt_in,
      locale: row.client.locale,
      gone: Boolean(row.client.anonymized_at || row.client.deleted_at),
    },
  };
}

/** Where staff alerts go: the recipients configured in settings, otherwise every admin. */
export async function staffRecipients(): Promise<string[]> {
  const admin = createAdminClient();
  const { data: settings } = await admin.from('business_settings').select('admin_alert_emails').eq('id', 1).single();
  if (settings?.admin_alert_emails?.length) return settings.admin_alert_emails;
  const { data: admins } = await admin.from('profiles').select('email').eq('role', 'admin').is('deleted_at', null).not('email', 'is', null);
  return (admins ?? []).map((a) => a.email!).filter(Boolean);
}
