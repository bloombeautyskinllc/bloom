import 'server-only';
import { z } from 'zod';
import { startOfLocalDay } from '@/lib/admin/time';
import { addDays } from '@/lib/availability/timezone';
import { createClient } from '@/lib/supabase/server';

export const auditFiltersSchema = z.object({
  actor: z.string().trim().max(120).optional().catch(undefined), // email of the person
  actorType: z.enum(['user', 'staff', 'admin', 'system']).optional().catch(undefined),
  action: z.string().trim().regex(/^[\w.]*$/).max(60).optional().catch(undefined),
  entity: z.string().trim().regex(/^\w*$/).max(40).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export type AuditFilters = z.infer<typeof auditFiltersSchema>;

export const AUDIT_COLUMNS = 'id, occurred_at, actor_profile_id, actor_type, actor_role, action, entity_type, entity_id, diff, metadata, ip, user_agent, correlation_id';

/** Audit log query shared by the page and the CSV export. RLS: admins only. */
export async function queryAudit(filters: AuditFilters, timeZone: string, limit: number, offset = 0) {
  const supabase = await createClient();
  let actorId: string | null | undefined;
  if (filters.actor) {
    const { data } = await supabase.from('profiles').select('id').eq('email', filters.actor.toLowerCase()).maybeSingle();
    actorId = data?.id ?? null;
  }

  let query = supabase.from('audit_log').select(AUDIT_COLUMNS, { count: 'exact' });
  if (actorId === null) query = query.eq('actor_profile_id', '00000000-0000-0000-0000-000000000000'); // unknown email: no rows
  else if (actorId) query = query.eq('actor_profile_id', actorId);
  if (filters.actorType) query = query.eq('actor_type', filters.actorType);
  if (filters.action) query = query.ilike('action', `${filters.action}%`);
  if (filters.entity) query = query.eq('entity_type', filters.entity);
  if (filters.from) query = query.gte('occurred_at', new Date(startOfLocalDay(filters.from, timeZone)).toISOString());
  if (filters.to) query = query.lt('occurred_at', new Date(startOfLocalDay(addDays(filters.to, 1), timeZone)).toISOString());

  const result = await query.order('occurred_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limit - 1);

  const ids = [...new Set((result.data ?? []).map((r) => r.actor_profile_id).filter((x): x is string => Boolean(x)))];
  const { data: actors } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] };
  const names = new Map((actors ?? []).map((a) => [a.id, a.full_name ?? a.email ?? a.id]));
  return { ...result, names };
}

export const ENTITY_TYPES = [
  'bookings',
  'booking_items',
  'booking_notes',
  'profiles',
  'client_notes',
  'client_documents',
  'client_document',
  'treatments',
  'treatment_options',
  'service_categories',
  'specialists',
  'working_hours',
  'availability_blocks',
  'business_settings',
  'notification',
  'notifications',
  'calendar_events',
  'google_calendar',
  'auth',
  'export',
];
