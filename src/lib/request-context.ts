import 'server-only';
import { headers } from 'next/headers';

export type RequestContext = { ip: string | null; userAgent: string | null; correlationId: string };

export const CORRELATION_HEADER = 'x-correlation-id';

// Who is making this request, forwarded to Postgres so the audit log records the end user, not our server
export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    ip: forwarded || h.get('x-real-ip') || null,
    userAgent: h.get('user-agent'),
    correlationId: h.get(CORRELATION_HEADER) ?? crypto.randomUUID(),
  };
}

export function contextHeaders(ctx: RequestContext): Record<string, string> {
  const out: Record<string, string> = { [CORRELATION_HEADER]: ctx.correlationId };
  if (ctx.ip) out['x-client-ip'] = ctx.ip;
  if (ctx.userAgent) out['x-client-user-agent'] = ctx.userAgent.slice(0, 500);
  return out;
}
