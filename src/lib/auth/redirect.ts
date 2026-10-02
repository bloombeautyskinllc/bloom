// Only same-site relative paths are allowed after login (prevents open redirects)
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null;
  }
  try {
    const url = new URL(value, 'http://local');
    return url.origin === 'http://local' ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export type AuthStep = 'signin' | 'onboarding';

// Query params that open the auth modal on any page: ?auth=signin|onboarding&next=...&auth_error=...
export const AUTH_PARAMS = ['auth', 'next', 'auth_error'] as const;

/** A page URL (default: home) that opens the auth modal at `step`, continuing to `next` afterwards. */
export function authModalUrl(step: AuthStep, next: string | null, options: { base?: string; error?: string } = {}) {
  const url = new URL(safeNext(options.base) ?? '/', 'http://local');
  AUTH_PARAMS.forEach((p) => url.searchParams.delete(p));
  url.searchParams.set('auth', step);
  if (next) url.searchParams.set('next', next);
  if (options.error) url.searchParams.set('auth_error', options.error);
  return `${url.pathname}${url.search}`;
}
