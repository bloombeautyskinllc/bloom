import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/database.types';
import { authModalUrl } from './redirect';

export type Profile = Tables<'profiles'>;

// One lookup per request, shared by layouts and pages. getClaims verifies the JWT locally against the
// project's signing keys (no round trip to the Auth server); with legacy symmetric keys it calls getUser.
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  return profile ? { user: { id: userId }, profile } : null;
});

/** Signed-in client who finished onboarding; otherwise opens the auth modal at the right step (on the home page). */
export async function requireOnboardedProfile(next: string) {
  const session = await getSession();
  if (!session) redirect(authModalUrl('signin', next));
  if (!session.profile.onboarded_at) redirect(authModalUrl('onboarding', next));
  return session;
}

/** Admin only (catalog, team, settings, activity log); staff get a 404 like everyone else. */
export async function requireAdmin(next: string) {
  const session = await requireOnboardedProfile(next);
  if (session.profile.role !== 'admin') notFound();
  return session;
}

/** Staff or admin; everyone else gets a 404 so the back office is not discoverable. */
export async function requireStaff(next: string) {
  const session = await requireOnboardedProfile(next);
  if (session.profile.role !== 'staff' && session.profile.role !== 'admin') notFound();
  return session;
}
