import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from './database.types';

// Browser client: anon key + the user's session cookie, always subject to RLS
export function createClient() {
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
