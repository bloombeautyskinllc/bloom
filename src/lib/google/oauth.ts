import 'server-only';
import { serverEnv } from '@/lib/env.server';

// Calendar access is requested separately from sign-in (Supabase handles sign-in with basic scopes)
export const CALENDAR_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    /** invalid_grant: the user revoked access or the token expired; the credential must be dropped */
    readonly revoked: boolean,
  ) {
    super(message);
  }
}

function clientCredentials() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = serverEnv();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error('Google OAuth client is not configured');
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET };
}

export function authorizationUrl({ redirectUri, state, loginHint }: { redirectUri: string; state: string; loginHint?: string | null }) {
  const params = new URLSearchParams({
    client_id: clientCredentials().clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: CALENDAR_SCOPES.join(' '),
    access_type: 'offline', // we need a refresh token
    prompt: 'consent', // Google only returns a refresh token on consent
    include_granted_scopes: 'true',
    state,
  });
  if (loginHint) params.set('login_hint', loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok) throw new GoogleAuthError(`Google token error: ${json.error ?? res.status} ${json.error_description ?? ''}`.trim(), json.error === 'invalid_grant');
  return json;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const tokens = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  if (!tokens.refresh_token) throw new GoogleAuthError('Google did not return a refresh token', false);
  // The id_token comes straight from Google's token endpoint over TLS, so its claims can be read without re-verifying
  const claims = tokens.id_token ? JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString()) : {};
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: (tokens.scope ?? '').split(' ').filter(Boolean),
    email: typeof claims.email === 'string' ? (claims.email as string) : null,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const tokens = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  return { accessToken: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
}

/** Best effort: the user can also revoke from their Google account */
export async function revokeToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST', cache: 'no-store' }).catch(() => undefined);
}
