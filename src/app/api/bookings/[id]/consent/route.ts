import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logAppEvent } from '@/lib/audit/log';
import { getSession } from '@/lib/auth/session';
import { formatDateLong, formatTime } from '@/lib/booking/format';
import { answersSchema, estheticianSchema } from '@/lib/consent/form';
import { renderConsentPdf } from '@/lib/consent/pdf';
import { getContact } from '@/lib/contact';
import { getRequestContext } from '@/lib/request-context';
import { getPublicSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';

// Signed intake & consent form as a PDF. RLS limits it to the client's own bookings and to staff;
// staff downloads are audited because the form holds health data.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const supabase = await createClient();
  const [{ data: form }, { data: booking }, settings, contact] = await Promise.all([
    supabase
      .from('consent_forms')
      .select('id, client_id, form_version, answers, signed_name, client_signature, signed_at, esthetician, esthetician_signature, esthetician_signed_at')
      .eq('booking_id', id.data)
      .maybeSingle(),
    supabase.from('bookings').select('code, start_at, items:booking_items(kind, name, sort_order)').eq('id', id.data).maybeSingle(),
    getPublicSettings(),
    getContact(),
  ]);
  if (!form || !booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const tz = settings.timezone;
  const items = [...booking.items].sort((a, z) => a.sort_order - z.sort_order);
  const treatment = items.find((i) => i.kind !== 'option')?.name ?? 'Appointment';
  const options = items.filter((i) => i.kind === 'option').map((i) => i.name);
  const dateTime = (iso: string) => `${formatDateLong(iso, tz)} · ${formatTime(iso, tz)}`;

  const pdf = await renderConsentPdf({
    bookingCode: booking.code,
    contactLine: [contact.phone, contact.email].filter(Boolean).join(' · '),
    treatmentName: options.length ? `${treatment} (${options.join(', ')})` : treatment,
    appointmentLabel: dateTime(booking.start_at),
    formVersion: form.form_version,
    answers: answersSchema.parse(form.answers),
    signedName: form.signed_name,
    clientSignature: form.client_signature,
    signedAtLabel: dateTime(form.signed_at),
    esthetician: form.esthetician ? estheticianSchema.parse(form.esthetician) : null,
    estheticianSignature: form.esthetician_signature,
    estheticianSignedAtLabel: form.esthetician_signed_at ? dateTime(form.esthetician_signed_at) : null,
  });

  if (form.client_id !== session.profile.id) {
    await logAppEvent({
      action: 'consent.downloaded',
      entityType: 'consent_forms',
      entityId: form.id,
      actorUserId: session.user.id,
      metadata: { booking_id: id.data, client_id: form.client_id },
      context: await getRequestContext(),
    });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bloom-consent-${booking.code}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
