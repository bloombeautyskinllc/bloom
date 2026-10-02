import { getTranslations } from 'next-intl/server';
import { formatDateShort, formatTime } from '@/lib/booking/format';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';

type Props = { entityType: 'bookings' | 'profiles'; entityId: string; timeZone: string; limit?: number };

// Fields that only add noise to a human timeline
const HIDDEN = new Set(['updated_at', 'created_at', 'blocked_range', 'hold_expires_at', 'policy', 'idempotency_key']);

export function describeDiff(diff: Json | null): string[] {
  if (!diff || typeof diff !== 'object' || Array.isArray(diff)) return [];
  return Object.entries(diff)
    .filter(([key]) => !HIDDEN.has(key))
    .map(([key, change]) => {
      const c = change as { from?: unknown; to?: unknown } | null;
      const show = (v: unknown) => (v === null || v === undefined ? '∅' : typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60));
      return `${key}: ${show(c?.from)} → ${show(c?.to)}`;
    });
}

/** Activity for one booking (or client) and the rows that belong to it. Admins only (RLS on audit_log). */
export default async function AuditTimeline({ entityType, entityId, timeZone, limit = 60 }: Props) {
  const t = await getTranslations('bo.activity');
  const supabase = await createClient();
  const related =
    entityType === 'bookings'
      ? `and(entity_type.eq.bookings,entity_id.eq.${entityId}),after->>booking_id.eq.${entityId},before->>booking_id.eq.${entityId},metadata->>booking_id.eq.${entityId},and(entity_type.eq.booking,entity_id.eq.${entityId})`
      : `and(entity_type.eq.profiles,entity_id.eq.${entityId}),after->>client_id.eq.${entityId},metadata->>client_id.eq.${entityId},actor_profile_id.eq.${entityId}`;

  const { data: rows } = await supabase
    .from('audit_log')
    .select('id, occurred_at, actor_type, actor_role, actor_profile_id, action, entity_type, diff, metadata')
    .or(related)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_profile_id).filter((x): x is string => Boolean(x)))];
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id, full_name, email').in('id', actorIds) : { data: [] };
  const names = new Map((actors ?? []).map((a) => [a.id, a.full_name ?? a.email ?? '—']));

  if (!rows?.length) return <p className="text-sm text-muted">{t('noEntries')}</p>;

  return (
    <ol className="relative flex flex-col gap-4 border-l border-stone pl-5">
      {rows.map((r) => {
        const changes = describeDiff(r.diff);
        return (
          <li key={r.id} className="relative text-sm">
            <span aria-hidden className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-bronze" />
            <p className="text-ink">
              <span className="font-medium">{r.action}</span>{' '}
              <span className="text-muted">· {r.actor_profile_id ? names.get(r.actor_profile_id) : t('system')}</span>
            </p>
            <p className="text-xs text-muted">
              {formatDateShort(r.occurred_at, timeZone)} {formatTime(r.occurred_at, timeZone)}
            </p>
            {changes.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[11px] text-muted">
                {changes.slice(0, 8).map((c) => (
                  <li key={c} className="break-all">
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
