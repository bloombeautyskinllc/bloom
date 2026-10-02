import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Anonymous, cookie-less client for public data (catalog, public settings). Because it never
 * reads cookies, pages using it can be statically generated and revalidated.
 */
export function createPublicClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
