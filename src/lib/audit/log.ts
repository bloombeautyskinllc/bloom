import 'server-only';
import type { Json } from '@/lib/supabase/database.types';
import { createAdminClient } from '@/lib/supabase/admin';
import type { RequestContext } from '@/lib/request-context';

type AppEvent = {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  metadata?: Json;
  context?: RequestContext;
};

/**
 * Application-level audit events (logins, emails sent, syncs...). Row changes are audited by
 * Postgres triggers; this covers what never touches a business table. Never throws: an audit
 * failure is reported but must not break the user's action.
 */
export async function logAppEvent(event: AppEvent) {
  const { error } = await createAdminClient().rpc('log_app_event', {
    p_action: event.action,
    p_entity_type: event.entityType,
    p_entity_id: event.entityId ?? undefined,
    p_actor_user_id: event.actorUserId ?? undefined,
    p_metadata: event.metadata ?? {},
    p_ip: event.context?.ip ?? undefined,
    p_user_agent: event.context?.userAgent ?? undefined,
    p_correlation_id: event.context?.correlationId,
  });
  if (error) console.error('[audit] failed to log event', event.action, error.message);
}
