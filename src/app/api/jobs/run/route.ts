import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/lib/env.server';
import { processJobs } from '@/lib/jobs/runner';

export const dynamic = 'force-dynamic';

function authorized(request: NextRequest) {
  const expected = Buffer.from(`Bearer ${serverEnv().JOBS_SECRET}`);
  const received = Buffer.from(request.headers.get('authorization') ?? '');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Called every minute by pg_cron (pg_net) with the shared secret
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const results = await processJobs({ limit: 20 });
  return NextResponse.json({ processed: results.length, failed: results.filter((r) => !r.ok).length, results });
}
