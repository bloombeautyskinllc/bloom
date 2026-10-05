import 'server-only';
import { serverEnv } from '@/lib/env.server';

// Pinned API version: Square changes response shapes between versions
const SQUARE_VERSION = '2026-09-16';

export type SquareConfig = { baseUrl: string; accessToken: string; locationId: string; environment: 'sandbox' | 'production' };

/** Square credentials, or null when payments are not configured in this environment. */
export function squareConfig(): SquareConfig | null {
  const env = serverEnv();
  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) return null;
  const environment = env.SQUARE_ENVIRONMENT ?? (env.SQUARE_APPLICATION_ID?.startsWith('sandbox-') ? 'sandbox' : 'production');
  return {
    baseUrl: environment === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com',
    accessToken: env.SQUARE_ACCESS_TOKEN,
    locationId: env.SQUARE_LOCATION_ID,
    environment,
  };
}

export class SquareError extends Error {
  constructor(
    readonly status: number,
    readonly errors: { code: string; detail?: string; field?: string; category?: string }[],
  ) {
    super(`Square ${status}: ${errors.map((e) => `${e.code}${e.field ? ` (${e.field})` : ''}${e.detail ? `: ${e.detail}` : ''}`).join('; ')}`);
  }
}

async function square<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const config = squareConfig();
  if (!config) throw new Error('Square is not configured (SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID)');
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${config.accessToken}`, 'Square-Version': SQUARE_VERSION, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await response.json().catch(() => ({}))) as { errors?: SquareError['errors'] };
  if (!response.ok || json.errors?.length) throw new SquareError(response.status, json.errors ?? [{ code: 'HTTP_ERROR' }]);
  return json as T;
}

type Money = { amount: number; currency: string };

export type SquarePaymentLink = { id: string; order_id: string; url: string; long_url?: string };

export type SquareOrder = {
  id: string;
  state: 'DRAFT' | 'OPEN' | 'COMPLETED' | 'CANCELED';
  reference_id?: string;
  tenders?: { id: string; payment_id?: string; type: string; amount_money?: Money }[];
};

export type SquarePayment = {
  id: string;
  status: 'APPROVED' | 'PENDING' | 'COMPLETED' | 'CANCELED' | 'FAILED';
  order_id?: string;
  amount_money: Money;
  total_money?: Money;
  receipt_url?: string;
  created_at: string;
  updated_at?: string;
  card_details?: { card?: { card_brand?: string; last_4?: string } };
};

export type SquareRefund = {
  id: string;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
  payment_id: string;
  amount_money: Money;
};

export type CreateLinkInput = {
  idempotencyKey: string;
  bookingId: string;
  code: string;
  itemName: string;
  amountCents: number;
  redirectUrl: string;
  buyerEmail?: string | null;
  supportEmail?: string | null;
};

/** Hosted checkout for one booking: an order with a single line (the amount due now). */
export async function createPaymentLink(input: CreateLinkInput): Promise<SquarePaymentLink> {
  const config = squareConfig()!;
  const request = (withEmail: boolean) => ({
    idempotency_key: withEmail ? input.idempotencyKey : `${input.idempotencyKey}:no-email`,
    order: {
      location_id: config.locationId,
      reference_id: input.bookingId,
      metadata: { booking_code: input.code },
      line_items: [{ name: input.itemName.slice(0, 500), quantity: '1', note: input.code, base_price_money: { amount: input.amountCents, currency: 'USD' } }],
    },
    checkout_options: {
      redirect_url: input.redirectUrl,
      ask_for_shipping_address: false,
      allow_tipping: false,
      merchant_support_email: input.supportEmail || undefined,
      accepted_payment_methods: { apple_pay: true, google_pay: true, cash_app_pay: false, afterpay_clearpay: false },
    },
    pre_populated_data: withEmail && input.buyerEmail ? { buyer_email: input.buyerEmail } : undefined,
    payment_note: `Bloom booking ${input.code}`,
  });

  try {
    return (await square<{ payment_link: SquarePaymentLink }>('POST', '/v2/online-checkout/payment-links', request(true))).payment_link;
  } catch (e) {
    // Square rejects some valid-looking emails; prefilling is a convenience, never a blocker
    if (e instanceof SquareError && e.errors.some((x) => x.field?.includes('buyer_email'))) {
      return (await square<{ payment_link: SquarePaymentLink }>('POST', '/v2/online-checkout/payment-links', request(false))).payment_link;
    }
    throw e;
  }
}

/** Deletes a link (Square cancels its unpaid order). Deleting twice is harmless. */
export async function deletePaymentLink(linkId: string): Promise<void> {
  try {
    await square('DELETE', `/v2/online-checkout/payment-links/${encodeURIComponent(linkId)}`);
  } catch (e) {
    if (e instanceof SquareError && e.status === 404) return;
    throw e;
  }
}

export async function retrieveOrder(orderId: string): Promise<SquareOrder> {
  return (await square<{ order: SquareOrder }>('GET', `/v2/orders/${encodeURIComponent(orderId)}`)).order;
}

export async function retrievePayment(paymentId: string): Promise<SquarePayment> {
  return (await square<{ payment: SquarePayment }>('GET', `/v2/payments/${encodeURIComponent(paymentId)}`)).payment;
}

export async function retrieveRefund(refundId: string): Promise<SquareRefund> {
  return (await square<{ refund: SquareRefund }>('GET', `/v2/refunds/${encodeURIComponent(refundId)}`)).refund;
}

export async function refundPayment(input: { idempotencyKey: string; paymentId: string; amountCents: number; reason: string }): Promise<SquareRefund> {
  return (
    await square<{ refund: SquareRefund }>('POST', '/v2/refunds', {
      idempotency_key: input.idempotencyKey,
      payment_id: input.paymentId,
      amount_money: { amount: input.amountCents, currency: 'USD' },
      reason: input.reason.slice(0, 192),
    })
  ).refund;
}

export const REFUND_STATUS = { PENDING: 'pending', COMPLETED: 'completed', REJECTED: 'rejected', FAILED: 'failed' } as const satisfies Record<
  SquareRefund['status'],
  string
>;
