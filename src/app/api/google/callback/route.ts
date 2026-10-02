import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { logAppEvent } from '@/lib/audit/log';
import { exchangeCode } from '@/lib/google/oauth';
import { processJobs } from '@/lib/jobs/runner';
import { getRequestContext } from '@/lib/request-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { STATE_COOKIE } from '@/lib/google/state';

const stateSchema = z.object({ state: z.string(), kind: z.enum(['client', 'business']), next: z.string(), userId: z.string() });

function withStatus(next: string, status: string) {
  const url = new URL(next, 'http://local');
  url.searchParams.set('calendar', status);
  return `${url.pathname}${url.search}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const saved = stateSchema.safeParse(JSON.parse(request.cookies.get(STATE_COOKIE)?.value ?? 'null'));
  const context = await getRequestContext();
  if (!saved.success || saved.data.state !== searchParams.get('state')) {
    return NextResponse.json({ error: 'invalid_state' }, { status: 400 });
  }
  const { kind, next, userId } = saved.data;
  const finish = (status: string) => {
    const res = NextResponse.redirect(`${origin}${withStatus(next, status)}`);
    res.cookies.delete({ name: STATE_COOKIE, path: '/api/google' });
    return res;
  };

  const code = searchParams.get('code');
  if (!code) return finish(searchParams.get('error') === 'access_denied' ? 'cancelled' : 'error');

  // The same person who started the flow must still be signed in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== userId) return finish('error');
  const { data: profile } = await supabase.from('profiles').select('id, role').eq('user_id', user.id).single();
  if (!profile || (kind === 'business' && profile.role !== 'admin')) return finish('error');

  try {
    const tokens = await exchangeCode(code, `${origin}/api/google/callback`);
    if (!tokens.scopes.includes('https://www.googleapis.com/auth/calendar.events')) return finish('missing_permission');

    const admin = createAdminClient({ 'x-correlation-id': context.correlationId });
    const { data: credentialId, error } = await admin.rpc('store_google_credential', {
      p_owner_kind: kind,
      p_profile_id: profile.id,
      p_google_email: tokens.email ?? '',
      p_scopes: tokens.scopes,
      p_refresh_token: tokens.refreshToken,
    });
    if (error) throw new Error(error.message);

    // Put existing upcoming bookings in the newly connected calendar
    let bookings = admin.from('bookings').select('id').eq('status', 'confirmed').gt('start_at', new Date().toISOString());
    if (kind === 'client') bookings = bookings.eq('client_id', profile.id);
    const { data: upcoming } = await bookings;
    const minute = new Date().toISOString().slice(0, 16);
    const jobs = [
      ...(upcoming ?? []).map((b) => ({ type: 'calendar.sync', payload: { booking_id: b.id }, dedupe_key: `calendar.sync:connect:${credentialId}:${b.id}` })),
      ...(kind === 'business'
        ? [
            { type: 'calendar.pull', payload: {}, dedupe_key: `calendar.pull:connect:${credentialId}:${minute}` },
            { type: 'calendar.renew_watch', payload: {}, dedupe_key: `calendar.renew_watch:connect:${credentialId}` },
          ]
        : []),
    ];
    if (jobs.length) await admin.from('jobs').upsert(jobs, { onConflict: 'dedupe_key', ignoreDuplicates: true });
    after(() => processJobs({ limit: 20 }).catch((e) => console.error('[jobs] inline run failed', e)));

    await logAppEvent({
      action: 'google.calendar_connected',
      entityType: 'google_calendar',
      entityId: credentialId,
      actorUserId: user.id,
      metadata: { kind, google_email: tokens.email },
      context,
    });
    return finish('connected');
  } catch (e) {
    console.error('[google] calendar connect failed', e);
    await logAppEvent({ action: 'google.calendar_connect_failed', entityType: 'google_calendar', actorUserId: user.id, metadata: { kind, error: String(e) }, context });
    return finish('error');
  }
}
