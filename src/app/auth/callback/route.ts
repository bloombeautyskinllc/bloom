import { NextResponse, type NextRequest } from 'next/server';
import { routes } from '@/data/site';
import { logAppEvent } from '@/lib/audit/log';
import { authModalUrl, safeNext } from '@/lib/auth/redirect';
import { serverEnv } from '@/lib/env.server';
import { getRequestContext } from '@/lib/request-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Google -> Supabase -> here with ?code: exchange it for a session cookie, then either continue to
// `next` or reopen the auth modal on the page the visitor started from (`returnTo`).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get('next')) ?? routes.dashboard;
  const returnTo = safeNext(searchParams.get('returnTo')) ?? routes.home;
  const context = await getRequestContext();
  const go = (path: string) => NextResponse.redirect(`${origin}${path}`);
  const fail = (reason: string) => go(authModalUrl('signin', next, { base: returnTo, error: reason }));

  const code = searchParams.get('code');
  if (!code) {
    const reason = searchParams.get('error') === 'access_denied' ? 'access_denied' : 'auth';
    await logAppEvent({ action: 'auth.login_failed', entityType: 'auth', metadata: { reason: searchParams.get('error') ?? 'missing_code' }, context });
    return fail(reason);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    await logAppEvent({ action: 'auth.login_failed', entityType: 'auth', metadata: { reason: error?.message ?? 'no_user' }, context });
    return fail('auth');
  }

  const { user } = data;
  const email = user.email?.toLowerCase();

  // Admin allowlist, applied server-side only (never from the client)
  if (email && serverEnv().ADMIN_EMAILS.includes(email)) {
    const { error: roleError } = await createAdminClient({ 'x-correlation-id': context.correlationId })
      .from('profiles')
      .update({ role: 'admin' })
      .eq('user_id', user.id)
      .neq('role', 'admin');
    if (roleError) console.error('[auth] admin allowlist update failed', roleError.message);
  }

  const isNewUser = Date.now() - new Date(user.created_at).getTime() < 60_000;
  await logAppEvent({
    action: isNewUser ? 'auth.sign_up' : 'auth.login',
    entityType: 'auth',
    entityId: user.id,
    actorUserId: user.id,
    metadata: { provider: user.app_metadata.provider ?? 'google' },
    context,
  });

  const { data: profile } = await supabase.from('profiles').select('onboarded_at').eq('user_id', user.id).maybeSingle();
  return go(profile?.onboarded_at ? next : authModalUrl('onboarding', next, { base: returnTo }));
}
