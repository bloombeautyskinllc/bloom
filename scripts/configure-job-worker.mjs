/**
 * Tells pg_cron where the app's job worker lives, for the Supabase project in the current env.
 * Stores the URL and JOBS_SECRET in Supabase Vault (public.configure_job_worker, service role only).
 *
 *   Local (DB runs in Docker, the app on your machine):
 *     node --env-file=.env.local scripts/configure-job-worker.mjs http://host.docker.internal:3000
 *   Production:
 *     node --env-file=.env.production.local scripts/configure-job-worker.mjs https://www.bloombeautyskinllc.com
 */
import { createClient } from '@supabase/supabase-js';

const appUrl = process.argv[2];
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, JOBS_SECRET: secret } = process.env;

if (!appUrl || !url || !key || !secret) {
  console.error('Usage: node --env-file=<env file> scripts/configure-job-worker.mjs <app url>');
  console.error('Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and JOBS_SECRET in the env file.');
  process.exit(1);
}

// A hosted database can never reach a worker on this machine: refuse the mix-up
const localDb = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
const localApp = /(host\.docker\.internal|localhost|127\.0\.0\.1)/.test(appUrl);
if (localApp && !localDb) {
  console.error(`Refusing: ${url} is a hosted project but ${appUrl} is only reachable from this machine.`);
  console.error('For the local stack, run with the local keys (see scripts/dev-local.mjs); for hosted, pass the public site URL.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error } = await supabase.rpc('configure_job_worker', { p_app_url: appUrl, p_secret: secret });
if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}
console.log(`Job worker configured: pg_cron will POST ${appUrl.replace(/\/$/, '')}/api/jobs/run every minute when jobs are due.`);
