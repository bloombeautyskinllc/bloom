/**
 * Second dev server for testing against the LOCAL Supabase stack (Docker) while `npm run dev`
 * keeps using the hosted project from .env.local. Separate port and build folder, and emails
 * are recorded but never sent.
 *
 *   npx supabase start && node scripts/dev-local.mjs      -> http://localhost:3001
 */
import { spawn } from 'node:child_process';

// Fixed, public development keys of the local Supabase stack (not secrets)
const env = {
  ...process.env,
  NEXT_DIST_DIR: '.next-local',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3001',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  SUPABASE_SERVICE_ROLE_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  EMAIL_DRY_RUN: 'true',
};

spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev', '-p', '3001'], { env, stdio: 'inherit', shell: process.platform === 'win32' });
