import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { bookingCalendarEvent } from '@/lib/booking/calendar-event';
import { buildIcs } from '@/lib/calendar/ics';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

// .ics download for the signed-in client's own booking (RLS limits the lookup to their bookings)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, code, start_at, end_at, reschedule_count, status, items:booking_items(kind, name, sort_order)')
    .eq('id', id.data)
    .in('status', ['confirmed', 'pending_payment', 'cancelled'])
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const ics = buildIcs(bookingCalendarEvent(booking, env.NEXT_PUBLIC_SITE_URL));
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="bloom-${booking.code}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
