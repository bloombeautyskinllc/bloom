import { describe, expect, it } from 'vitest';
import { authModalUrl, safeNext } from './redirect';

describe('safeNext', () => {
  it('keeps same-site paths with their query and hash', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard');
    expect(safeNext('/booking?treatment=microneedling')).toBe('/booking?treatment=microneedling');
    expect(safeNext('/#about')).toBe('/#about');
  });

  it.each([
    ['https://evil.example/phish'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['dashboard'],
    [''],
    [null],
    [undefined],
    [42],
  ])('rejects %j', (value) => {
    expect(safeNext(value)).toBeNull();
  });

  it('normalizes dot segments instead of escaping the site', () => {
    expect(safeNext('/a/../b')).toBe('/b');
  });
});

describe('authModalUrl', () => {
  it('opens the modal on the home page by default', () => {
    expect(authModalUrl('signin', '/booking?treatment=x')).toBe('/?auth=signin&next=%2Fbooking%3Ftreatment%3Dx');
  });

  it('reopens on the original page, replacing stale modal params', () => {
    expect(authModalUrl('onboarding', '/booking', { base: '/treatments/facials?auth=signin&auth_error=auth&ref=ig' })).toBe(
      '/treatments/facials?ref=ig&auth=onboarding&next=%2Fbooking',
    );
  });

  it('never uses an external base', () => {
    expect(authModalUrl('signin', null, { base: 'https://evil.example', error: 'oauth' })).toBe('/?auth=signin&auth_error=oauth');
  });
});
