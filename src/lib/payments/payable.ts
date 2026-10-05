export type PaymentKind = 'deposit' | 'balance';

// Do not send a client to pay when the slot is about to be released
const MIN_TIME_TO_PAY_MS = 2 * 60_000;

export type PayableBooking = {
  status: string;
  hold_expires_at: string | null;
  total_cents: number;
  amount_due_cents: number;
  amount_paid_cents: number;
  amount_refunded_cents: number;
};

/**
 * What can be paid online right now: the deposit while the booking waits for it (within the hold),
 * then the balance once it is confirmed or completed. Null when nothing is payable.
 */
export function payableNow(b: PayableBooking, now = Date.now()): { kind: PaymentKind; amountCents: number } | null {
  const net = b.amount_paid_cents - b.amount_refunded_cents;
  if (b.status === 'pending_payment') {
    if (b.hold_expires_at && Date.parse(b.hold_expires_at) - now < MIN_TIME_TO_PAY_MS) return null;
    const amountCents = b.amount_due_cents - net;
    return amountCents > 0 ? { kind: 'deposit', amountCents } : null;
  }
  if (b.status === 'confirmed' || b.status === 'completed') {
    const amountCents = b.total_cents - net;
    return amountCents > 0 ? { kind: 'balance', amountCents } : null;
  }
  return null;
}

