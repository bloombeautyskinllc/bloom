import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySvixSignature } from './svix';

const secretBytes = Buffer.from('bloom-test-secret-bloom-test-secret');
const secret = `whsec_${secretBytes.toString('base64')}`;
const now = Date.parse('2026-09-30T12:00:00Z');
const ts = String(now / 1000);
const body = '{"type":"email.delivered","data":{"email_id":"abc"}}';
const sign = (content: string, key = secretBytes) => `v1,${createHmac('sha256', key).update(content).digest('base64')}`;

describe('verifySvixSignature', () => {
  it('accepts a valid signature', () => {
    expect(verifySvixSignature(body, { id: 'msg_1', timestamp: ts, signature: sign(`msg_1.${ts}.${body}`) }, secret, now)).toBe(true);
  });
  it('accepts when any of several rotated signatures matches', () => {
    const header = `v1,AAAA ${sign(`msg_1.${ts}.${body}`)}`;
    expect(verifySvixSignature(body, { id: 'msg_1', timestamp: ts, signature: header }, secret, now)).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(verifySvixSignature(body.replace('delivered', 'bounced'), { id: 'msg_1', timestamp: ts, signature: sign(`msg_1.${ts}.${body}`) }, secret, now)).toBe(false);
  });
  it('rejects a signature made with another secret', () => {
    expect(verifySvixSignature(body, { id: 'msg_1', timestamp: ts, signature: sign(`msg_1.${ts}.${body}`, Buffer.from('other')) }, secret, now)).toBe(false);
  });
  it('rejects old timestamps (replays)', () => {
    const old = String(now / 1000 - 3600);
    expect(verifySvixSignature(body, { id: 'msg_1', timestamp: old, signature: sign(`msg_1.${old}.${body}`) }, secret, now)).toBe(false);
  });
  it('rejects missing headers', () => {
    expect(verifySvixSignature(body, { id: null, timestamp: ts, signature: 'v1,x' }, secret, now)).toBe(false);
  });
});
