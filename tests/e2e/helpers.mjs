// Helpers for browser checks against the LOCAL Supabase stack (never the hosted project).
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export const LOCAL_URL = 'http://127.0.0.1:54321';
// Fixed, public development keys of the local stack (not secrets)
export const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export const admin = createClient(LOCAL_URL, LOCAL_SERVICE, { auth: { persistSession: false } });
const PASSWORD = 'pw-local-123456';

/** Creates (or recreates) an onboarded user with a role; returns their profile id. */
export async function ensureUser(email, fullName, role = 'client') {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = data.users.find((u) => u.email === email);
  if (!user) ({ data: { user } } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } }));
  const { data: profile } = await admin
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString(), phone_e164: '+12125550100', terms_accepted_at: new Date().toISOString(), role })
    .eq('user_id', user.id)
    .select('id')
    .single();
  return profile.id;
}

/** A supabase-js client signed in as that user (for RPCs with RLS) */
export async function userClient(email) {
  const client = createClient(LOCAL_URL, LOCAL_ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

/** Session cookies for Playwright (domain localhost) */
export async function sessionCookies(email) {
  const jar = [];
  const ssr = createServerClient(LOCAL_URL, LOCAL_ANON, {
    cookies: {
      getAll: () => jar,
      setAll: (c) => {
        for (const x of c) {
          const i = jar.findIndex((j) => j.name === x.name);
          if (i >= 0) jar.splice(i, 1);
          if (x.value) jar.push({ name: x.name, value: x.value });
        }
      },
    },
  });
  const { error } = await ssr.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return jar.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' }));
}
