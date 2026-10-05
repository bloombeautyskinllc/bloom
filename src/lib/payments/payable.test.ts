import { describe, expect, it } from 'vitest';
import { payableNow, type PayableBooking } from './payable';

const now = Date.parse('2026-10-05T15:00:00Z');
const booking = (over: Partial<PayableBooking>): PayableBooking => ({
  status: 'pending_payment',
  hold_expires_at: '2026-10-05T15:30:00Z',
  total_cents: 18000,
  amount_due_cents: 7200, // 40% deposit
  amount_paid_cents: 0,
  amount_refunded_cents: 0,
  ...over,
});

describe('payableNow', () => {
  it('asks for the deposit while the booking waits for payment', () => {
    expect(payableNow(booking({}), now)).toEqual({ kind: 'deposit', amountCents: 7200 });
  });
  it('does not send the client to pay when the hold is about to run out', () => {
    expect(payableNow(booking({ hold_expires_at: '2026-10-05T15:01:00Z' }), now)).toBeNull();
  });
  it('asks for the balance once the deposit is paid', () => {
    expect(payableNow(booking({ status: 'confirmed', amount_paid_cents: 7200 }), now)).toEqual({ kind: 'balance', amountCents: 10800 });
    expect(payableNow(booking({ status: 'completed', amount_paid_cents: 7200 }), now)).toEqual({ kind: 'balance', amountCents: 10800 });
  });
  it('counts refunds as not paid', () => {
    expect(payableNow(booking({ status: 'confirmed', amount_paid_cents: 7200, amount_refunded_cents: 2000 }), now)).toEqual({ kind: 'balance', amountCents: 12800 });
  });
  it('has nothing to pay when fully paid, cancelled, expired or missed', () => {
    expect(payableNow(booking({ status: 'confirmed', amount_paid_cents: 18000 }), now)).toBeNull();
    for (const status of ['cancelled', 'expired', 'no_show', 'held']) expect(payableNow(booking({ status }), now)).toBeNull();
  });
});
