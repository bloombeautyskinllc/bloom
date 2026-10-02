import { NextResponse, type NextRequest } from 'next/server';
import { logAppEvent } from '@/lib/audit/log';
import { bookingFiltersSchema, queryBookings } from '@/lib/admin/bookings-query';
import { toCsv } from '@/lib/admin/csv';
import { startOfLocalDay } from '@/lib/admin/time';
import { addDays } from '@/lib/availability/timezone';
import { getSession } from '@/lib/auth/session';
import { getRequestContext } from '@/lib/request-context';
import { getPublicSettings } from '@/lib/settings';

// Same filters as /admin/bookings; up to 10,000 rows. Staff only; every export is audited.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.profile.role !== 'staff' && session.profile.role !== 'admin')) return new NextResponse(null, { status: 404 });

  const filters = bookingFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const { timezone } = await getPublicSettings();
  const range = {
    from: filters.from ? new Date(startOfLocalDay(filters.from, timezone)) : undefined,
    to: filters.to ? new Date(startOfLocalDay(addDays(filters.to, 1), timezone)) : undefined,
  };
  const { data, error } = await queryBookings(filters, range, 10_000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const local = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat('en-CA', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(iso)) : '';
  const csv = toCsv(
    ['Reference', 'Start (local)', 'End (local)', 'Status', 'Payment', 'Source', 'Client', 'Email', 'Phone', 'Service', 'Options', 'Specialist', 'Catalog price', 'Discount', 'Total', 'Rules overridden', 'Client notes', 'Cancellation reason', 'Created'],
    (data ?? []).map((b) => [
      b.code, local(b.start_at), local(b.end_at), b.status, b.payment_status, b.source, b.client_name, b.client_email, b.client_phone, b.service, b.options,
      b.specialist_name, (b.subtotal_cents ?? 0) / 100, (b.discount_cents ?? 0) / 100, (b.total_cents ?? 0) / 100, b.rules_overridden ? 'yes' : '', b.client_notes, b.cancellation_reason, local(b.created_at),
    ]),
  );

  await logAppEvent({ action: 'export.bookings_csv', entityType: 'export', actorUserId: session.user.id, metadata: { filters, rows: data?.length ?? 0 }, context: await getRequestContext() });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bloom-bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
