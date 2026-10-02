import 'server-only';
import { logAppEvent } from '@/lib/audit/log';
import { createAdminClient } from '@/lib/supabase/admin';
import { CalendarClient } from './calendar';
import { GoogleAuthError, refreshAccessToken } from './oauth';

export type OwnerKind = 'business' | 'client';

export type ConnectedCalendar = { credentialId: string; calendarId: string; googleEmail: string | null; client: CalendarClient };

// Access tokens live about an hour; keep them per warm server instance, never in the database
const accessTokens = new Map<string, { token: string; expiresAt: number }>();

/**
 * A ready-to-use Calendar client for the business calendar or a client's calendar, or null when
 * that calendar is not connected. A revoked grant disconnects the credential (and is audited).
 */
export async function connectedCalendar(kind: OwnerKind, profileId?: string | null): Promise<ConnectedCalendar | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_google_credential', { p_owner_kind: kind, p_profile_id: profileId ?? undefined }).maybeSingle();
  if (error) throw new Error(`get_google_credential failed: ${error.message}`);
  if (!data) return null;

  let cached = accessTokens.get(data.credential_id);
  if (!cached || cached.expiresAt - 60_000 < Date.now()) {
    try {
      const fresh = await refreshAccessToken(data.refresh_token);
      cached = { token: fresh.accessToken, expiresAt: fresh.expiresAt };
      accessTokens.set(data.credential_id, cached);
    } catch (e) {
      if (e instanceof GoogleAuthError && e.revoked) {
        await admin.rpc('revoke_google_credential', { p_owner_kind: kind, p_profile_id: profileId ?? undefined, p_error: e.message });
        await logAppEvent({ action: 'google.calendar_access_lost', entityType: 'google_calendar', entityId: data.credential_id, metadata: { kind, reason: e.message } });
        return null;
      }
      throw e;
    }
  }

  return { credentialId: data.credential_id, calendarId: data.calendar_id, googleEmail: data.google_email, client: new CalendarClient(cached.token) };
}
