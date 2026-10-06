import 'server-only';
import { cache } from 'react';
import { serverEnv } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';

// Pinned API version: Square changes response shapes between versions
const SQUARE_VERSION = '2026-09-16';

export const SQUARE_ENVIRONMENTS = ['sandbox', 'production'] as const;
export type SquareEnvironment = (typeof SQUARE_ENVIRONMENTS)[number];

export type SquareConfig = { baseUrl: string; accessToken: string; locationId: string; environment: SquareEnvironment };

/** Credentials for one Square environment, or null when they are not set on this server. */
export function squareCredentials(environment: SquareEnvironment): SquareConfig | null {
  const env = serverEnv();
  const scoped =
    environment === 'sandbox'
      ? { accessToken: env.SQUARE_SANDBOX_ACCESS_TOKEN, locationId: env.SQUARE_SANDBOX_LOCATION_ID }
      : { accessToken: env.SQUARE_PRODUCTION_ACCESS_TOKEN, locationId: env.SQUARE_PRODUCTION_LOCATION_ID };
  // The legacy single set (SQUARE_ACCESS_TOKEN...) fills in for the environment it belongs to
  const legacyEnvironment = env.SQUARE_ENVIRONMENT ?? (env.SQUARE_APPLICATION_ID?.startsWith('sandbox-') ? 'sandbox' : 'production');
  const legacy = legacyEnvironment === environment ? { accessToken: env.SQUARE_ACCESS_TOKEN, locationId: env.SQUARE_LOCATION_ID } : {};
  const accessToken = scoped.accessToken || legacy.accessToken;
  const locationId = scoped.locationId || legacy.locationId;
  if (!accessToken || !locationId) return null;
  return {
    baseUrl: environment === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com',
    accessToken,
    locationId,
    environment,
  };
}

/** Signature keys of the webhook subscriptions (one per environment, both may point to the same URL). */
export function squareWebhookKeys(): string[] {
  const env = serverEnv();
  return [env.SQUARE_SANDBOX_WEBHOOK_SIGNATURE_KEY, env.SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY, env.SQUARE_WEBHOOK_SIGNATURE_KEY].filter(
    (k): k is string => Boolean(k),
  );
}

/** Test or live mode, chosen in the back office (business_settings.payments_mode). One lookup per request. */
export const squareMode = cache(async (): Promise<SquareEnvironment> => {
  const { data, error } = await createAdminClient().from('business_settings').select('payments_mode').eq('id', 1).single();
  // Missing until the payments_mode migration is applied: test mode, the column's default
  if (error) {
    console.error('[payments] payments mode lookup failed, using sandbox', error.message);
    return 'sandbox';
  }
  return data.payments_mode === 'production' ? 'production' : 'sandbox';
});

/** Credentials for the current mode, or null when that mode is not set up: new checkouts use these. */
export async function activeSquare(): Promise<SquareConfig | null> {
  return squareCredentials(await squareMode());
}

export class SquareError extends Error {
  constructor(
    readonly status: number,
    readonly errors: { code: string; detail?: string; field?: string; category?: string }[],
  ) {
    super(`Square ${status}: ${errors.map((e) => `${e.code}${e.field ? ` (${e.field})` : ''}${e.detail ? `: ${e.detail}` : ''}`).join('; ')}`);
  }
}

function requireCredentials(environment: SquareEnvironment): SquareConfig {
  const config = squareCredentials(environment);
  const prefix = `SQUARE_${environment.toUpperCase()}`;
  if (!config) throw new Error(`Square ${environment} is not configured (${prefix}_ACCESS_TOKEN / ${prefix}_LOCATION_ID)`);
  return config;
}

async function square<T>(environment: SquareEnvironment, method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const config = requireCredentials(environment);
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
export async function createPaymentLink(environment: SquareEnvironment, input: CreateLinkInput): Promise<SquarePaymentLink> {
  const config = requireCredentials(environment);
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
    return (await square<{ payment_link: SquarePaymentLink }>(environment, 'POST', '/v2/online-checkout/payment-links', request(true))).payment_link;
  } catch (e) {
    // Square rejects some valid-looking emails; prefilling is a convenience, never a blocker
    if (e instanceof SquareError && e.errors.some((x) => x.field?.includes('buyer_email'))) {
      return (await square<{ payment_link: SquarePaymentLink }>(environment, 'POST', '/v2/online-checkout/payment-links', request(false))).payment_link;
    }
    throw e;
  }
}

/** Deletes a link (Square cancels its unpaid order). Deleting twice is harmless. */
export async function deletePaymentLink(environment: SquareEnvironment, linkId: string): Promise<void> {
  try {
    await square(environment, 'DELETE', `/v2/online-checkout/payment-links/${encodeURIComponent(linkId)}`);
  } catch (e) {
    if (e instanceof SquareError && e.status === 404) return;
    throw e;
  }
}

export async function retrieveOrder(environment: SquareEnvironment, orderId: string): Promise<SquareOrder> {
  return (await square<{ order: SquareOrder }>(environment, 'GET', `/v2/orders/${encodeURIComponent(orderId)}`)).order;
}

export async function retrievePayment(environment: SquareEnvironment, paymentId: string): Promise<SquarePayment> {
  return (await square<{ payment: SquarePayment }>(environment, 'GET', `/v2/payments/${encodeURIComponent(paymentId)}`)).payment;
}

export async function retrieveRefund(environment: SquareEnvironment, refundId: string): Promise<SquareRefund> {
  return (await square<{ refund: SquareRefund }>(environment, 'GET', `/v2/refunds/${encodeURIComponent(refundId)}`)).refund;
}

export async function refundPayment(environment: SquareEnvironment, input: { idempotencyKey: string; paymentId: string; amountCents: number; reason: string }): Promise<SquareRefund> {
  return (
    await square<{ refund: SquareRefund }>(environment, 'POST', '/v2/refunds', {
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
