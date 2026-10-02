import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import { contextHeaders, getRequestContext } from '@/lib/request-context';
import type { Database } from './database.types';

// Server Components, Route Handlers and Server Actions: the user's session from cookies, subject to RLS
export async function createClient() {
  const cookieStore = await cookies();
  const ctx = await getRequestContext();

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: contextHeaders(ctx) },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead
        }
      },
    },
  });
}
