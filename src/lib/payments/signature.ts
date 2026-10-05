import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies a Square webhook: base64 HMAC-SHA256 of "{notification URL}{raw body}" with the
 * subscription's signature key, sent in the x-square-hmacsha256-signature header. The URL must be
 * exactly the one registered in Square.
 */
export function verifySquareSignature(body: string, signature: string | null, notificationUrl: string, signatureKey: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', signatureKey).update(notificationUrl + body).digest();
  const received = Buffer.from(signature, 'base64');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
