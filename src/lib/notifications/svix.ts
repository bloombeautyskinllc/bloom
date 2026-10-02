import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies a Svix-signed webhook (the scheme Resend uses): HMAC-SHA256 over
 * "{svix-id}.{svix-timestamp}.{body}" with the base64 secret after "whsec_".
 * Rejects stale timestamps to stop replays.
 */
export function verifySvixSignature(
  body: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  now = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();

  // The header can hold several space-separated "v1,<base64>" signatures (key rotation)
  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const received = Buffer.from(value, 'base64');
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}
