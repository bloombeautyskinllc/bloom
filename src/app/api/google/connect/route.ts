import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { routes } from '@/data/site';
import { authModalUrl, safeNext } from '@/lib/auth/redirect';
import { authorizationUrl } from '@/lib/google/oauth';
import { STATE_COOKIE } from '@/lib/google/state';
import { createClient } from '@/lib/supabase/server';

const querySchema = z.object({ kind: z.enum(['client', 'business']), next: z.string().optional() });

// Starts the optional Google Calendar consent (separate from sign-in). Business calendar: admins only.
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { kind } = parsed.data;
  const next = safeNext(parsed.data.next) ?? (kind === 'business' ? '/admin/settings' : routes.dashboard);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(authModalUrl('signin', next), request.url));

  if (kind === 'business') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // CSRF: Google must hand back the same random state we store in an httpOnly cookie
  const state = crypto.randomUUID();
  const redirectUri = new URL('/api/google/callback', request.nextUrl.origin).toString();
  const response = NextResponse.redirect(authorizationUrl({ redirectUri, state, loginHint: user.email }));
  response.cookies.set(STATE_COOKIE, JSON.stringify({ state, kind, next, userId: user.id }), {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/google',
    maxAge: 600,
  });
  return response;
}
