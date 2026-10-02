import { NextResponse, type NextRequest } from 'next/server';
import { auditFiltersSchema, queryAudit } from '@/lib/admin/audit-query';
import { toCsv } from '@/lib/admin/csv';
import { logAppEvent } from '@/lib/audit/log';
import { getSession } from '@/lib/auth/session';
import { getRequestContext } from '@/lib/request-context';
import { getPublicSettings } from '@/lib/settings';

// Same filters as /admin/activity; up to 20,000 rows. Admins only; the export itself is audited.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session?.profile.role !== 'admin') return new NextResponse(null, { status: 404 });

  const filters = auditFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const { timezone } = await getPublicSettings();
  const { data, names, error } = await queryAudit(filters, timezone, 20_000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const csv = toCsv(
    ['Time (UTC)', 'Actor', 'Actor type', 'Role', 'Action', 'Entity type', 'Entity id', 'Changes', 'Metadata', 'IP', 'User agent', 'Correlation id'],
    (data ?? []).map((r) => [
      r.occurred_at, r.actor_profile_id ? names.get(r.actor_profile_id) : 'system', r.actor_type, r.actor_role, r.action, r.entity_type, r.entity_id,
      r.diff ? JSON.stringify(r.diff) : '', r.metadata ? JSON.stringify(r.metadata) : '', r.ip ? String(r.ip) : '', r.user_agent, r.correlation_id,
    ]),
  );

  await logAppEvent({ action: 'export.audit_csv', entityType: 'export', actorUserId: session.user.id, metadata: { filters, rows: data?.length ?? 0 }, context: await getRequestContext() });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bloom-activity-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
