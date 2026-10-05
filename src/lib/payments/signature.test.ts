import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySquareSignature } from './signature';

const key = 'bloom-test-signature-key';
const url = 'https://bloombeautyskinllc.com/api/webhooks/square';
const body = '{"type":"payment.updated","event_id":"evt_1","data":{"object":{"payment":{"id":"p1","status":"COMPLETED"}}}}';
const sign = (content: string, k = key) => createHmac('sha256', k).update(content).digest('base64');

describe('verifySquareSignature', () => {
  it('accepts a valid signature', () => {
    expect(verifySquareSignature(body, sign(url + body), url, key)).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(verifySquareSignature(body.replace('COMPLETED', 'FAILED'), sign(url + body), url, key)).toBe(false);
  });
  it('rejects a signature for another URL (e.g. a preview deployment)', () => {
    expect(verifySquareSignature(body, sign(`https://preview.vercel.app/api/webhooks/square${body}`), url, key)).toBe(false);
  });
  it('rejects a signature made with another key', () => {
    expect(verifySquareSignature(body, sign(url + body, 'other'), url, key)).toBe(false);
  });
  it('rejects a missing or malformed header', () => {
    expect(verifySquareSignature(body, null, url, key)).toBe(false);
    expect(verifySquareSignature(body, 'not-base64!', url, key)).toBe(false);
  });
});
