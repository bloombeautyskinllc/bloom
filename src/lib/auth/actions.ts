'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { routes } from '@/data/site';
import { env } from '@/lib/env';
import { logAppEvent } from '@/lib/audit/log';
import { getRequestContext } from '@/lib/request-context';
import { createClient } from '@/lib/supabase/server';
import { authModalUrl, safeNext } from './redirect';

/**
 * Step 1 of the auth modal. Google cannot be embedded, so the browser goes to Google and the
 * callback brings it back to `returnTo` (the page the modal was opened on) at the next step.
 */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get('next')) ?? routes.dashboard;
  const returnTo = safeNext(formData.get('returnTo')) ?? routes.home;
  const origin = (await headers()).get('origin') ?? env.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();

  const callback = new URL(routes.authCallback, origin);
  callback.searchParams.set('next', next);
  callback.searchParams.set('returnTo', returnTo);

  // Basic scopes only. Calendar access is a separate, optional consent (phase 4).
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback.toString(), queryParams: { prompt: 'select_account' } },
  });

  if (error || !data.url) {
    console.error('[auth] signInWithOAuth failed', error?.message);
    redirect(authModalUrl('signin', next, { base: returnTo, error: 'oauth' }));
  }
  redirect(data.url);
}

async function endSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) {
    await logAppEvent({
      action: 'auth.logout',
      entityType: 'auth',
      entityId: user.id,
      actorUserId: user.id,
      context: await getRequestContext(),
    });
  }
}

export async function signOut() {
  await endSession();
  redirect(routes.home);
}

/** "Not you?" in the modal: sign out and go back to step 1 on the same page. */
export async function switchAccount(formData: FormData) {
  await endSession();
  const next = safeNext(formData.get('next')) ?? routes.dashboard;
  redirect(authModalUrl('signin', next, { base: safeNext(formData.get('returnTo')) ?? routes.home }));
}
