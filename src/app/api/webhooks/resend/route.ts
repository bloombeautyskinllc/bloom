import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logAppEvent } from '@/lib/audit/log';
import { serverEnv } from '@/lib/env.server';
import { verifySvixSignature } from '@/lib/notifications/svix';
import { createAdminClient } from '@/lib/supabase/admin';

const eventSchema = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: z.object({ email_id: z.string() }).passthrough(),
});

// Delivery status from Resend (delivered, bounced, complained...), recorded on the notification
const STATUS: Record<string, { status: 'delivered' | 'bounced' | 'complained' | 'failed'; column?: 'delivered_at' | 'bounced_at' }> = {
  'email.delivered': { status: 'delivered', column: 'delivered_at' },
  'email.bounced': { status: 'bounced', column: 'bounced_at' },
  'email.complained': { status: 'complained' },
  'email.failed': { status: 'failed' },
};

export async function POST(request: NextRequest) {
  const secret = serverEnv().RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const body = await request.text();
  const valid = verifySvixSignature(
    body,
    { id: request.headers.get('svix-id'), timestamp: request.headers.get('svix-timestamp'), signature: request.headers.get('svix-signature') },
    secret,
  );
  if (!valid) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });

  const parsed = eventSchema.safeParse(JSON.parse(body));
  if (!parsed.success) return NextResponse.json({ ok: true }); // unknown shape: acknowledge, nothing to do
  const event = parsed.data;
  const eventId = request.headers.get('svix-id')!;

  // Idempotency: Resend retries; each event is processed once
  const admin = createAdminClient();
  const { error: dupError } = await admin.from('webhook_events').insert({ provider: 'resend', event_id: eventId, event_type: event.type });
  if (dupError) {
    if (dupError.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
    throw new Error(dupError.message);
  }

  const mapping = STATUS[event.type];
  if (mapping) {
    const at = event.created_at ?? new Date().toISOString();
    const update = {
      status: mapping.status,
      ...(mapping.column === 'delivered_at' ? { delivered_at: at } : {}),
      ...(mapping.column === 'bounced_at' ? { bounced_at: at } : {}),
    };
    const { data: notification } = await admin
      .from('notifications')
      .update(update)
      .eq('provider_message_id', event.data.email_id)
      .select('id, template, booking_id')
      .maybeSingle();
    if (notification && mapping.status !== 'delivered') {
      await logAppEvent({
        action: `email.${mapping.status}`,
        entityType: 'notification',
        entityId: notification.id,
        metadata: { template: notification.template, booking_id: notification.booking_id, provider_message_id: event.data.email_id },
      });
    }
  }

  await admin.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('provider', 'resend').eq('event_id', eventId);
  return NextResponse.json({ ok: true });
}
