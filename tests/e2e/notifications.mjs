// End-to-end notification check through pg_cron -> pg_net -> /api/jobs/run (local stack + npm run dev,
// after `npm run jobs:configure -- http://host.docker.internal:3000`). Emails go to Resend's test inbox.
import { createClient } from '@supabase/supabase-js';
const URL_ = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const admin = createClient(URL_, SVC, { auth: { persistSession: false } });
const email = 'delivered@resend.dev';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Test client (Resend's test inbox), reminders on; staff alerts to the same test inbox
const { data: users } = await admin.auth.admin.listUsers();
for (const u of users.users.filter((u) => u.email === email)) await admin.auth.admin.deleteUser(u.id);
await admin.auth.admin.createUser({ email, password: 'pw-123456', email_confirm: true, user_metadata: { full_name: 'MARIA LOPEZ' } });
await admin.from('profiles').update({ onboarded_at: new Date().toISOString(), phone_e164: '+12125550123', reminders_opt_in: true }).eq('email', email);
await admin.from('business_settings').update({ admin_alert_emails: ['delivered@resend.dev'] }).eq('id', 1);

const client = createClient(URL_, ANON, { auth: { persistSession: false } });
await client.auth.signInWithPassword({ email, password: 'pw-123456' });

// Next Thursday 11:00 New York, Vitamin C facial
const { data: t } = await admin.from('treatments').select('id').eq('slug', 'vitamin-c-facial').single();
const now = new Date();
const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ((4 - now.getUTCDay() + 7) % 7 || 7) + 7, 15, 0));
const { data: hold, error: holdErr } = await client.rpc('hold_slot', { p_treatment_id: t.id, p_option_ids: [], p_start_at: d.toISOString(), p_idempotency_key: crypto.randomUUID() }).single();
if (holdErr) throw holdErr;
const { data: status } = await client.rpc('submit_booking', { p_booking_id: hold.booking_id, p_notes: 'Notify test' });
console.log('booked', hold.code, status, d.toISOString());

async function waitJobs(label, types, timeoutMs = 150_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const { data } = await admin.from('jobs').select('type, status, attempts, last_error, next_run_at').eq('payload->>booking_id', hold.booking_id).in('type', types);
    const due = (data ?? []).filter((j) => Date.parse(j.next_run_at) <= Date.now());
    if (due.length && due.every((j) => j.status === 'succeeded' || j.status === 'dead')) {
      console.log(`${label} (${Math.round((Date.now() - t0) / 1000)}s):`, due.map((j) => `${j.type}=${j.status}${j.last_error ? ' ' + j.last_error.slice(0, 80) : ''}`).join(', '));
      return;
    }
    await sleep(5000);
  }
  const { data } = await admin.from('jobs').select('type, status, attempts, last_error').eq('payload->>booking_id', hold.booking_id);
  console.log(`${label}: TIMEOUT`, data);
}

// No inline kick here: only pg_cron -> pg_net -> /api/jobs/run can process these
await waitJobs('confirmed', ['email.booking', 'email.admin_booking', 'calendar.sync']);
const { data: reminders } = await admin.from('jobs').select('next_run_at, payload').eq('type', 'email.reminder').eq('payload->>booking_id', hold.booking_id);
console.log('reminders scheduled:', reminders.map((r) => `${r.payload.offset_min}min before -> ${r.next_run_at}`).join(' | '));

await client.rpc('reschedule_booking', { p_booking_id: hold.booking_id, p_new_start: new Date(d.getTime() + 86_400_000).toISOString() });
await sleep(1000);
await waitJobs('rescheduled', ['email.booking', 'email.admin_booking', 'calendar.sync']);

await client.rpc('cancel_booking', { p_booking_id: hold.booking_id, p_reason: 'Testing notifications' });
await sleep(1000);
await waitJobs('cancelled', ['email.booking', 'email.admin_booking', 'calendar.sync']);

const { data: notes } = await admin.from('notifications').select('template, recipient, status, provider_message_id, error').eq('booking_id', hold.booking_id).order('created_at');
console.log('notifications:');
for (const n of notes) console.log(' ', n.template.padEnd(28), n.status, n.provider_message_id ? 'id ok' : n.error);

const { data: net } = await admin.schema('net').from('_http_response').select('status_code').order('created', { ascending: false }).limit(3).then((r) => r, () => ({ data: null }));
console.log('last pg_net responses:', net?.map((n) => n.status_code));

await admin.from('business_settings').update({ admin_alert_emails: [] }).eq('id', 1);
