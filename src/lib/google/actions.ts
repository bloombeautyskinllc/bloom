'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { routes } from '@/data/site';
import { logAppEvent } from '@/lib/audit/log';
import { getRequestContext } from '@/lib/request-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revokeToken } from './oauth';

/** Disconnect the signed-in client's calendar, or (admins) the business calendar. */
export async function disconnectGoogleCalendar(formData: FormData) {
  const kind = formData.get('kind') === 'business' ? 'business' : 'client';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(routes.home);
  const { data: profile } = await supabase.from('profiles').select('id, role').eq('user_id', user.id).single();
  if (!profile || (kind === 'business' && profile.role !== 'admin')) redirect(routes.home);

  const admin = createAdminClient();
  const { data: credential } = await admin
    .rpc('get_google_credential', { p_owner_kind: kind, p_profile_id: kind === 'client' ? profile.id : undefined })
    .maybeSingle();

  if (credential) {
    await revokeToken(credential.refresh_token);
    await admin.rpc('revoke_google_credential', { p_owner_kind: kind, p_profile_id: kind === 'client' ? profile.id : undefined });
    if (kind === 'business') {
      await admin.from('google_watch_channels').update({ stopped_at: new Date().toISOString() }).eq('credential_id', credential.credential_id).is('stopped_at', null);
    }
    await logAppEvent({
      action: 'google.calendar_disconnected',
      entityType: 'google_calendar',
      entityId: credential.credential_id,
      actorUserId: user.id,
      metadata: { kind },
      context: await getRequestContext(),
    });
  }

  const target = kind === 'business' ? '/admin/settings' : routes.dashboard;
  revalidatePath(target);
  redirect(`${target}?calendar=disconnected`);
}
