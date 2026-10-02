import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { serverEnv } from '@/lib/env.server';
import type { Database } from './database.types';

/**
 * Service-role client: bypasses RLS. Only for webhooks, cron/jobs and system tasks
 * that are authorized in code first. `server-only` makes importing it from a Client Component a build error.
 */
export function createAdminClient(headers?: Record<string, string>) {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: headers ? { headers } : undefined,
  });
}
