import 'server-only';
import { routes } from '@/data/site';
import { logAppEvent } from '@/lib/audit/log';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { payableNow, type PayableBooking, type PaymentKind } from './payable';
import { activeSquare, createPaymentLink, deletePaymentLink, REFUND_STATUS, retrieveOrder, retrievePayment, retrieveRefund, SQUARE_ENVIRONMENTS, squareCredentials, type SquareEnvironment, type SquarePayment } from './square';

export { payableNow, type PaymentKind };

export type PaymentUrlResult =
  | { ok: true; url: string; amountCents: number; kind: PaymentKind }
  | { ok: false; error: 'not_payable' | 'payments_unavailable' };

export const paymentReturnUrl = (bookingId: string, kind: PaymentKind) =>
  `${env.NEXT_PUBLIC_SITE_URL}${routes.booking}/return?booking=${bookingId}${kind === 'balance' ? '&for=balance' : ''}`;

/**
 * Checkout URL for what the booking owes now (see payableNow), reusing the open link when it is for
 * the same amount. Staff may set another amount (e.g. the final price after the consultation).
 * The caller must have checked that the current user may pay this booking.
 */
export async function paymentUrlFor(bookingId: string, { amountCents }: { amountCents?: number } = {}): Promise<PaymentUrlResult> {
  const square = await activeSquare();
  if (!square) return { ok: false, error: 'payments_unavailable' };
  const admin = createAdminClient();

  const { data: b, error } = await admin
    .from('bookings')
    .select(
      'id, code, status, hold_expires_at, total_cents, amount_due_cents, amount_paid_cents, amount_refunded_cents, ' +
        'client:profiles!client_id(email), items:booking_items(kind, name, sort_order)',
    )
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw new Error(`booking lookup failed: ${error.message}`);
  if (!b) return { ok: false, error: 'not_payable' };
  const booking = b as unknown as PayableBooking & {
    id: string;
    code: string;
    client: { email: string | null } | null;
    items: { kind: string; name: string; sort_order: number }[];
  };
  const due = payableNow(booking);
  if (!due) return { ok: false, error: 'not_payable' };
  const amount = amountCents ?? due.amountCents;

  const { data: open } = await admin
    .from('payment_links')
    .select('id, url, amount_cents, kind, environment, provider_link_id, provider_order_id')
    .eq('booking_id', booking.id)
    .eq('status', 'open')
    .maybeSingle();
  if (open) {
    const environment = open.environment as SquareEnvironment;
    if (open.amount_cents === amount && open.kind === due.kind && environment === square.environment) return { ok: true, url: open.url, amountCents: amount, kind: due.kind };
    // Replace a link for another amount (or made in the other mode), unless it was just paid (then what is owed has changed)
    if (await syncOrder(environment, open.provider_order_id)) return { ok: false, error: 'not_payable' };
    await deletePaymentLink(environment, open.provider_link_id);
    await admin.from('payment_links').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', open.id).eq('status', 'open');
  }

  const items = [...booking.items].sort((a, z) => a.sort_order - z.sort_order);
  const service = [items.find((i) => i.kind !== 'option')?.name ?? 'Appointment', ...items.filter((i) => i.kind === 'option').map((i) => i.name)].join(' · ');
  const paidBefore = booking.amount_paid_cents - booking.amount_refunded_cents > 0;
  const itemName = due.kind === 'deposit' ? (amount < booking.total_cents ? `Deposit · ${service}` : service) : paidBefore ? `Balance · ${service}` : service;
  const { data: settings } = await admin.from('business_settings').select('public_email').eq('id', 1).single();

  const link = await createPaymentLink(square.environment, {
    idempotencyKey: crypto.randomUUID(),
    bookingId: booking.id,
    code: booking.code,
    itemName,
    amountCents: amount,
    redirectUrl: paymentReturnUrl(booking.id, due.kind),
    buyerEmail: booking.client?.email,
    supportEmail: settings?.public_email,
  });

  const { error: insertError } = await admin.from('payment_links').insert({
    booking_id: booking.id,
    kind: due.kind,
    environment: square.environment,
    provider_link_id: link.id,
    provider_order_id: link.order_id,
    url: link.url,
    amount_cents: amount,
  });
  if (insertError) {
    // Another request (a double click) stored its link first: use that one and drop ours
    await deletePaymentLink(square.environment, link.id).catch((e) => console.error('[payments] could not delete duplicate link', e));
    const { data: winner } = await admin.from('payment_links').select('url, amount_cents').eq('booking_id', booking.id).eq('status', 'open').maybeSingle();
    if (winner) return { ok: true, url: winner.url, amountCents: winner.amount_cents, kind: due.kind };
    throw new Error(`payment link insert failed: ${insertError.message}`);
  }
  return { ok: true, url: link.url, amountCents: amount, kind: due.kind };
}

/** Records one completed Square payment (idempotent). Returns the outcome from public.record_payment. */
export async function recordSquarePayment(orderId: string, payment: SquarePayment): Promise<string> {
  const { data: outcome, error } = await createAdminClient().rpc('record_payment', {
    p_provider_order_id: orderId,
    p_provider_payment_id: payment.id,
    p_amount_cents: payment.amount_money.amount,
    p_card_brand: payment.card_details?.card?.card_brand,
    p_card_last4: payment.card_details?.card?.last_4,
    p_receipt_url: payment.receipt_url,
    p_paid_at: payment.updated_at ?? payment.created_at,
  });
  if (error) throw new Error(`record_payment failed: ${error.message}`);
  if (outcome !== 'duplicate' && outcome !== 'unknown_order') {
    await logAppEvent({
      action: `payment.${outcome}`,
      entityType: 'payment',
      entityId: payment.id,
      metadata: { provider: 'square', order_id: orderId, amount_cents: payment.amount_money.amount },
    });
  }
  return outcome;
}

/** Square environment of the link that created this order (payments and refunds stay in that environment). */
export async function environmentOfOrder(orderId: string): Promise<SquareEnvironment> {
  const { data, error } = await createAdminClient().from('payment_links').select('environment').eq('provider_order_id', orderId).maybeSingle();
  if (error) throw new Error(`payment link lookup failed: ${error.message}`);
  if (!data) throw new Error(`no payment link for Square order ${orderId}`);
  return data.environment as SquareEnvironment;
}

/** Pulls the order from Square and records any completed payment. True if something was paid. */
export async function syncOrder(environment: SquareEnvironment, orderId: string): Promise<boolean> {
  const order = await retrieveOrder(environment, orderId);
  let paid = false;
  for (const tender of order.tenders ?? []) {
    if (!tender.payment_id) continue;
    const payment = await retrievePayment(environment, tender.payment_id);
    if (payment.status !== 'COMPLETED') continue;
    await recordSquarePayment(orderId, payment);
    paid = true;
  }
  return paid;
}

type OpenLink = {
  id: string;
  kind: PaymentKind;
  environment: SquareEnvironment;
  provider_link_id: string;
  provider_order_id: string;
  booking: { status: string; hold_expires_at: string | null } | null;
};

/**
 * Safety net for webhooks: records payments on open links, and deletes the links of bookings that
 * no longer wait for payment (expired, cancelled, confirmed at the studio) so they cannot be paid.
 * Without a booking id it covers deposit links and balance links from the last 2 hours (older balance
 * links stay open for the client and are recorded by the webhook or the return page).
 */
export async function reconcileLinks({ bookingId }: { bookingId?: string } = {}): Promise<{ checked: number; paid: number; closed: number }> {
  const admin = createAdminClient();
  let query = admin
    .from('payment_links')
    .select('id, kind, environment, provider_link_id, provider_order_id, booking:bookings!booking_id(status, hold_expires_at)')
    .eq('status', 'open')
    .order('created_at')
    .limit(25);
  query = bookingId
    ? query.eq('booking_id', bookingId)
    : query.or(`kind.eq.deposit,created_at.gt.${new Date(Date.now() - 2 * 3_600_000).toISOString()}`);
  const { data, error } = await query;
  if (error) throw new Error(`payment_links lookup failed: ${error.message}`);

  const result = { checked: 0, paid: 0, closed: 0 };
  for (const link of (data ?? []) as unknown as OpenLink[]) {
    result.checked++;
    if (await syncOrder(link.environment, link.provider_order_id)) {
      result.paid++;
      continue;
    }
    const b = link.booking;
    const stale =
      !b ||
      (link.kind === 'deposit'
        ? b.status !== 'pending_payment' || (b.hold_expires_at !== null && Date.parse(b.hold_expires_at) < Date.now())
        : b.status === 'cancelled' || b.status === 'expired');
    if (!stale) continue;

    await deletePaymentLink(link.environment, link.provider_link_id);
    await admin.from('payment_links').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', link.id).eq('status', 'open');
    result.closed++;
    // A payment that landed between the check and the deletion is still recorded (and refunded if the slot is gone)
    if (await syncOrder(link.environment, link.provider_order_id)) result.paid++;
  }
  return result;
}

/**
 * Asks Square for the final status of refunds still marked pending (normally the refund webhook does
 * this; this covers a missed or unconfigured webhook). Refunds settle within seconds to minutes.
 */
export async function refreshPendingRefunds({ bookingId }: { bookingId?: string } = {}): Promise<number> {
  if (!SQUARE_ENVIRONMENTS.some((e) => squareCredentials(e))) return 0;
  const admin = createAdminClient();
  let query = admin
    .from('refunds')
    .select('provider_refund_id, amount_cents, payment:payments!payment_id(provider_payment_id, provider_order_id)')
    .eq('status', 'pending')
    .lt('created_at', new Date(Date.now() - 30_000).toISOString())
    .limit(20);
  if (bookingId) query = query.eq('booking_id', bookingId);
  const { data, error } = await query;
  if (error) throw new Error(`refunds lookup failed: ${error.message}`);

  let updated = 0;
  for (const r of (data ?? []) as unknown as { provider_refund_id: string; amount_cents: number; payment: { provider_payment_id: string; provider_order_id: string | null } | null }[]) {
    if (!r.payment?.provider_order_id) continue;
    const refund = await retrieveRefund(await environmentOfOrder(r.payment.provider_order_id), r.provider_refund_id);
    if (refund.status === 'PENDING') continue;
    const { error: recordError } = await admin.rpc('record_refund', {
      p_provider_payment_id: r.payment.provider_payment_id,
      p_provider_refund_id: r.provider_refund_id,
      p_amount_cents: r.amount_cents,
      p_status: REFUND_STATUS[refund.status],
    });
    if (recordError) throw new Error(`record_refund failed: ${recordError.message}`);
    updated++;
  }
  return updated;
}
