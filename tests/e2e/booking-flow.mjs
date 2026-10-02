// Browser walkthrough of the booking flow against the local stack (npx supabase start + npm run dev).
// Uses the fixed local-development Supabase keys. Becomes a Playwright spec in phase 7.
//   node tests/e2e/booking-flow.mjs <screenshots-dir>
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const SHOTS = process.argv[2];
const BASE = 'http://localhost:3000';
const URL_ = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const admin = createClient(URL_, SVC, { auth: { persistSession: false } });

async function removeUser(email) {
  const { data } = await admin.auth.admin.listUsers();
  for (const u of data.users.filter((u) => u.email === email)) await admin.auth.admin.deleteUser(u.id);
}
async function cookiesFor(email, name) {
  await removeUser(email);
  await admin.auth.admin.createUser({ email, password: 'pw-123456', email_confirm: true, user_metadata: { full_name: name } });
  await admin.from('profiles').update({ onboarded_at: new Date().toISOString(), phone_e164: '+12125550199', terms_accepted_at: new Date().toISOString() }).eq('email', email);
  const jar = [];
  const ssr = createServerClient(URL_, ANON, { cookies: { getAll: () => jar, setAll: (c) => { for (const x of c) { const i = jar.findIndex((j) => j.name === x.name); if (i >= 0) jar.splice(i, 1); if (x.value) jar.push({ name: x.name, value: x.value }); } } } });
  await ssr.auth.signInWithPassword({ email, password: 'pw-123456' });
  return jar.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' }));
}

const errs = [];
const b = await chromium.launch();
async function page(cookies, viewport = { width: 390, height: 844 }) {
  const ctx = await b.newContext({ viewport });
  if (cookies) await ctx.addCookies(cookies);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
  return p;
}
const rel = (p) => decodeURIComponent(p.url().replace(BASE, ''));
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

// ---------------------------------------------------------------------------
// 1. From the laser page to a confirmed booking (phone)
// ---------------------------------------------------------------------------
const cookiesA = await cookiesFor('flow-a@example.com', 'Maria Lopez');
let p = await page(cookiesA);
await p.goto(`${BASE}/treatments/diode-laser`, { waitUntil: 'networkidle' });
await p.locator('a[aria-label^="Book Upper Lip"]').scrollIntoViewIfNeeded();
await p.locator('a[aria-label^="Book Upper Lip"]').click();
await p.waitForFunction(() => location.pathname === '/booking', null, { timeout: 15000 });
await p.waitForLoadState('networkidle');
console.log('1. menu row ->', rel(p));
console.log('   step:', (await p.locator('nav[aria-label^="Step"] p').textContent())?.trim(), '| Upper Lip checked:', await p.getByRole('checkbox', { name: /Upper Lip/ }).isChecked());
await p.getByText('Underarms', { exact: true }).click();
await p.waitForTimeout(300);
console.log('   summary bar:', (await p.locator('div.fixed.bottom-0').innerText()).replace(/\s+/g, ' '));
await shot(p, 'b1-options');
await p.getByRole('button', { name: 'Continue' }).click();
await p.getByRole('button', { name: /AM|PM/ }).first().waitFor({ timeout: 20000 });
console.log('   date step: first day =', (await p.locator('p.font-serif.text-xl').first().textContent())?.trim(), '| slots:', await p.getByRole('button', { name: /^\d{1,2}:\d{2}\s?(AM|PM)$/ }).count());
await shot(p, 'b2-datetime');
// Book a few days out so the booking is outside the 24h change cutoff
await p.getByRole('button', { name: 'Next month' }).click();
await p.locator('[role=grid] button:not([disabled])').nth(2).waitFor({ timeout: 20000 });
await p.locator('[role=grid] button:not([disabled])').nth(2).click();
await p.waitForTimeout(300);
console.log('   picked day:', (await p.locator('p.font-serif.text-xl').first().textContent())?.trim());
const firstSlot = p.getByRole('button', { name: /^\d{1,2}:\d{2}\s?(AM|PM)$/ }).first();
const slotLabel = (await firstSlot.textContent())?.trim();
await firstSlot.click();
await p.getByRole('heading', { name: 'Review and confirm' }).waitFor({ timeout: 15000 });
console.log('   held', slotLabel, '|', (await p.getByRole('status').first().textContent())?.trim());
await p.fill('#notes', 'First laser session, sensitive skin.');
await shot(p, 'b3-confirm');
await p.getByRole('button', { name: 'Confirm booking' }).click();
await p.waitForFunction(() => location.pathname === '/dashboard', null, { timeout: 30000 });
await p.waitForLoadState('networkidle');
console.log('   ->', rel(p), '|', (await p.getByRole('status').first().textContent())?.trim());
await shot(p, 'b4-dashboard');

const bookedCode = new URL(p.url()).searchParams.get('booked');
const { data: booked } = await admin.from('bookings').select('id, code, status, total_cents, start_at, end_at, client_notes, items:booking_items(name)').eq('code', bookedCode).single();
console.log('   DB:', booked.status, booked.total_cents, (Date.parse(booked.end_at) - Date.parse(booked.start_at)) / 60000 + 'min', booked.items.map((i) => i.name).join(' + '), '| notes:', booked.client_notes);

// ---------------------------------------------------------------------------
// 2. Someone else tries the same time
// ---------------------------------------------------------------------------
const cookiesB = await cookiesFor('flow-b@example.com', 'Bea Smith');
const pb = await page(cookiesB);
const holdB = await pb.goto(`${BASE}/booking?treatment=diode-laser-session&options=laser-upper-lip,laser-underarms`, { waitUntil: 'networkidle' });
await pb.getByRole('button', { name: 'Continue' }).click();
await pb.getByRole('button', { name: /^\d{1,2}:\d{2}\s?(AM|PM)$/ }).first().waitFor({ timeout: 20000 });
console.log('2. other client first slot:', (await pb.getByRole('button', { name: /^\d{1,2}:\d{2}\s?(AM|PM)$/ }).first().textContent())?.trim(), '(taken one was', slotLabel + ')', holdB?.status());

// Client B books the first (near) slot: its card must explain that changes are closed
await pb.getByRole('button', { name: /^\d{1,2}:\d{2}\s?(AM|PM)$/ }).first().click();
await pb.getByRole('heading', { name: 'Review and confirm' }).waitFor({ timeout: 15000 });
await pb.getByRole('button', { name: 'Confirm booking' }).click();
await pb.waitForFunction(() => location.pathname === '/dashboard', null, { timeout: 30000 });
await pb.waitForLoadState('networkidle');
console.log('   near booking card:', (await pb.locator('article').first().innerText()).replace(/\s+/g, ' ').slice(0, 220));

// ---------------------------------------------------------------------------
// 3. .ics + reschedule + cancel from the dashboard (desktop)
// ---------------------------------------------------------------------------
p = await page(cookiesA, { width: 1280, height: 900 });
const ics = await p.request.get(`${BASE}/api/bookings/${booked.id}/ics`);
console.log('3. ics:', ics.status(), ics.headers()['content-type'], (await ics.text()).includes('BEGIN:VEVENT'));
await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await p.getByRole('button', { name: 'Reschedule' }).click();
// Move it within next month so it stays outside the 24h change cutoff
await p.getByRole('dialog').getByRole('button', { name: 'Next month' }).click();
await p.getByRole('dialog').locator('[role=grid] button:not([disabled])').nth(4).waitFor({ timeout: 20000 });
await p.getByRole('dialog').locator('[role=grid] button:not([disabled])').nth(4).click();
await p.getByRole('dialog').getByRole('button', { name: /^\d{1,2}:\d{2}\s?(AM|PM)$/ }).nth(3).waitFor({ timeout: 20000 });
await p.getByRole('dialog').getByRole('button', { name: /^\d{1,2}:\d{2}\s?(AM|PM)$/ }).nth(3).click();
await shot(p, 'b5-reschedule');
await p.getByRole('button', { name: 'Move my appointment' }).click();
await p.getByText('Your appointment was moved.').waitFor({ timeout: 15000 });
const { data: moved } = await admin.from('bookings').select('start_at, reschedule_count').eq('id', booked.id).single();
console.log('   rescheduled:', booked.start_at, '->', moved.start_at, '| count', moved.reschedule_count);
await p.getByRole('button', { name: 'Cancel', exact: true }).click();
await p.fill('textarea[id^="reason-"]', 'Change of plans');
await p.getByRole('button', { name: 'Yes, cancel it' }).click();
await p.getByText('Your appointment was cancelled.').waitFor({ timeout: 15000 }).catch(() => {});
await p.waitForTimeout(1500);
const { data: cancelled } = await admin.from('bookings').select('status, cancellation_reason').eq('id', booked.id).single();
console.log('   cancelled:', cancelled.status, '|', cancelled.cancellation_reason);
await p.reload({ waitUntil: 'networkidle' });
await shot(p, 'b6-dashboard-after');
console.log('   history shows:', (await p.locator('#history-title').locator('..').innerText()).replace(/\s+/g, ' ').slice(0, 140));

console.log('errors:', errs);
for (const e of ['flow-a@example.com', 'flow-b@example.com']) await removeUser(e);
await b.close();
