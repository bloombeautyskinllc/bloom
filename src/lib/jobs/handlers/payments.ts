import 'server-only';
import { z } from 'zod';
import { environmentOfOrder, reconcileLinks, refreshPendingRefunds } from '@/lib/payments/links';
import { REFUND_STATUS, refundPayment } from '@/lib/payments/square';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Job } from '../types';

// -----------------------------------------------------------------------------
// payments.reconcile: from pg_cron (all open links) or when a booking stops waiting for payment
// -----------------------------------------------------------------------------
const reconcilePayload = z.object({ booking_id: z.uuid().optional() });

export async function paymentsReconcile(job: Job) {
  const { booking_id } = reconcilePayload.parse(job.payload);
  // Only calls Square when there are open links (so it is a no-op where payments are not set up)
  await reconcileLinks({ bookingId: booking_id });
  await refreshPendingRefunds({ bookingId: booking_id });
}

// -----------------------------------------------------------------------------
// payment.refund: cancellations, late payments and staff refunds
// -----------------------------------------------------------------------------
const refundPayload = z.object({
  booking_id: z.uuid(),
  amount_cents: z.number().int().positive(),
  reason: z.string().default('Refund'),
  payment_id: z.uuid().optional(), // refund this payment only (late payments)
  requested_by: z.uuid().nullish(),
});

type PaymentRow = {
  id: string;
  provider_payment_id: string;
  provider_order_id: string | null;
  amount_cents: number;
  refunds: { amount_cents: number; status: string; created_at: string }[];
};

/**
 * Refunds an amount across the booking's payments, newest first. Retries are safe: each Square
 * call reuses an idempotency key derived from this job, and the split ignores refunds made by this
 * job, so a retry sends exactly the same requests. A failed or rejected refund throws, so staff are
 * alerted when the job runs out of attempts.
 */
export async function paymentRefund(job: Job) {
  const p = refundPayload.parse(job.payload);
  const admin = createAdminClient();

  let query = admin
    .from('payments')
    .select('id, provider_payment_id, provider_order_id, amount_cents, refunds(amount_cents, status, created_at)')
    .eq('booking_id', p.booking_id)
    .order('paid_at', { ascending: false });
  if (p.payment_id) query = query.eq('id', p.payment_id);
  const { data, error } = await query;
  if (error) throw new Error(`payments lookup failed: ${error.message}`);

  let left = p.amount_cents;
  for (const payment of (data ?? []) as PaymentRow[]) {
    if (left <= 0) break;
    const refundedBefore = payment.refunds
      .filter((r) => (r.status === 'pending' || r.status === 'completed') && Date.parse(r.created_at) < Date.parse(job.created_at))
      .reduce((sum, r) => sum + r.amount_cents, 0);
    const amount = Math.min(left, payment.amount_cents - refundedBefore);
    if (amount <= 0) continue;

    if (!payment.provider_order_id) throw new Error(`payment ${payment.id} has no Square order`);
    // Refunded in the environment the payment was taken in (a test payment stays in the sandbox)
    const refund = await refundPayment(await environmentOfOrder(payment.provider_order_id), { idempotencyKey: `refund:${job.id}:${payment.id}`, paymentId: payment.provider_payment_id, amountCents: amount, reason: p.reason });
    const { error: recordError } = await admin.rpc('record_refund', {
      p_provider_payment_id: payment.provider_payment_id,
      p_provider_refund_id: refund.id,
      p_amount_cents: amount,
      p_status: REFUND_STATUS[refund.status],
      p_reason: p.reason,
      p_requested_by: p.requested_by ?? undefined,
    });
    if (recordError) throw new Error(`record_refund failed: ${recordError.message}`);
    if (refund.status === 'FAILED' || refund.status === 'REJECTED') throw new Error(`Square ${refund.status.toLowerCase()} refund ${refund.id}`);
    left -= amount;
  }

  if (left > 0) throw new Error(`${left} cents could not be refunded: more than what was paid online for booking ${p.booking_id}`);
}
