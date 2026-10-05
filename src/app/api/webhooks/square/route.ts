import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { serverEnv } from '@/lib/env.server';
import { processJobs } from '@/lib/jobs/runner';
import { recordSquarePayment } from '@/lib/payments/links';
import { verifySquareSignature } from '@/lib/payments/signature';
import { REFUND_STATUS, type SquarePayment, type SquareRefund } from '@/lib/payments/square';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  event_id: z.string(),
  type: z.string(),
  data: z.object({ object: z.record(z.string(), z.unknown()).optional() }).optional(),
});

// Subscribed events: payment.created, payment.updated, refund.created, refund.updated.
// Payments of the business that are not ours (in-store sales) are acknowledged and ignored.
export async function POST(request: NextRequest) {
  const { SQUARE_WEBHOOK_SIGNATURE_KEY: key, SQUARE_WEBHOOK_URL } = serverEnv();
  if (!key) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const body = await request.text();
  const notificationUrl = SQUARE_WEBHOOK_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/api/webhooks/square`;
  if (!verifySquareSignature(body, request.headers.get('x-square-hmacsha256-signature'), notificationUrl, key)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 403 });
  }

  const parsed = eventSchema.safeParse(JSON.parse(body));
  if (!parsed.success) return NextResponse.json({ ok: true }); // unknown shape: acknowledge, nothing to do
  const event = parsed.data;

  // Idempotency: Square retries. Processing is idempotent too, so a failed attempt is simply redone.
  const admin = createAdminClient();
  await admin.from('webhook_events').upsert({ provider: 'square', event_id: event.event_id, event_type: event.type }, { onConflict: 'provider,event_id', ignoreDuplicates: true });
  const { data: seen } = await admin.from('webhook_events').select('processed_at').eq('provider', 'square').eq('event_id', event.event_id).single();
  if (seen?.processed_at) return NextResponse.json({ ok: true, duplicate: true });

  const object = event.data?.object ?? {};
  if (event.type === 'payment.created' || event.type === 'payment.updated') {
    const payment = object.payment as SquarePayment | undefined;
    if (payment?.status === 'COMPLETED' && payment.order_id) await recordSquarePayment(payment.order_id, payment);
  } else if (event.type === 'refund.created' || event.type === 'refund.updated') {
    const refund = object.refund as SquareRefund | undefined;
    if (refund?.id && refund.payment_id && REFUND_STATUS[refund.status]) {
      const { error } = await admin.rpc('record_refund', {
        p_provider_payment_id: refund.payment_id,
        p_provider_refund_id: refund.id,
        p_amount_cents: refund.amount_money.amount,
        p_status: REFUND_STATUS[refund.status],
      });
      if (error) throw new Error(`record_refund failed: ${error.message}`);
    }
  }

  await admin.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('provider', 'square').eq('event_id', event.event_id);
  // A confirmed booking queued its emails and calendar sync: send them now, not at the next cron tick
  after(() => processJobs({ limit: 10 }).catch((e) => console.error('[jobs] inline run failed', e)));
  return NextResponse.json({ ok: true });
}
