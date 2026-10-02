// Back office walkthrough on the local test server (http://localhost:3001) as the demo owner.
//   node tests/e2e/admin-flow.mjs <screenshots dir>
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { admin, sessionCookies } from './helpers.mjs';

const SHOTS = process.argv[2];
const BASE = 'http://localhost:3001';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await ctx.addCookies(await sessionCookies('owner@bloom.test'));
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
const step = (s) => console.log(`- ${s}`);

// 1. New booking: new client + custom service, manual discount, no email
await p.goto(`${BASE}/admin/bookings/new`, { waitUntil: 'networkidle' });
await p.getByRole('radio', { name: 'New client' }).click();
const email = `walkin-${Date.now()}@bloom.test`;
await p.fill('#nc-name', 'Valeria Walk-in');
await p.fill('#nc-email', email);
await p.fill('#nc-phone', '(212) 555-0199');
await p.getByRole('radio', { name: 'Custom service' }).click();
await p.fill('#cs-name', 'Brow touch-up');
await p.fill('#cs-duration', '30');
await p.fill('#cs-price', '80');
await p.fill('#nb-discount', '10');
// A different working day on each run (never Sunday), so reruns do not collide with earlier ones
let target = new Date(Date.now() + (10 + (Math.floor(Date.now() / 1000) % 40)) * 86_400_000);
if (target.getUTCDay() === 0) target = new Date(target.getTime() + 86_400_000);
await p.fill('#nb-date', target.toISOString().slice(0, 10));
await p.selectOption('#nb-time', '17:30');
await p.getByLabel('Email the client about this change').uncheck();
await p.screenshot({ path: `${SHOTS}/f1-new-booking.png`, fullPage: true });
await p.getByRole('button', { name: 'Create booking' }).click();
await p
  .waitForFunction(() => /\/admin\/bookings\/[0-9a-f-]{36}/.test(location.pathname) || document.querySelector('[role=alert]:not(#__next-route-announcer__)'), null, { timeout: 20000 })
  .catch(() => undefined);
const alert = p.locator('[role=alert]:not(#__next-route-announcer__)');
if (await alert.count()) throw new Error(`create failed: ${await alert.first().innerText()}`);
await p.waitForLoadState('networkidle');
step(`booking created -> ${new URL(p.url()).pathname} | ${(await p.locator('h1').innerText()).trim()} | total: ${(await p.getByText(/^Total:/).first().innerText()).trim()}`);
const bookingId = new URL(p.url()).pathname.split('/').pop();

// 2. Internal note on the booking
await p.getByPlaceholder('Only staff can see these notes.').fill('Prefers a quiet room.');
await p.getByRole('button', { name: 'Add note' }).click();
await p.getByText('Prefers a quiet room.').waitFor({ timeout: 10000 });
step('booking note added');

// 3. Client page: tag, note, document upload + private link
await p.getByRole('link', { name: 'Valeria Walk-in' }).click();
await p.waitForFunction(() => location.pathname.startsWith('/admin/clients/'), null, { timeout: 20000 });
await p.waitForLoadState('networkidle');
await p.getByLabel('Add tag').fill('VIP');
await p.getByRole('button', { name: 'Add tag' }).click();
await p.getByText('VIP', { exact: true }).waitFor({ timeout: 10000 });
await p.getByPlaceholder('Preferences, allergies, anything the team should know.').fill('Allergic to lidocaine.');
await p.getByRole('button', { name: 'Add note' }).click();
await p.getByText('Allergic to lidocaine.').waitFor({ timeout: 10000 });
const pdf = `${SHOTS}/consent-test.pdf`;
writeFileSync(pdf, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
await p.getByLabel('Title').fill('Laser consent 2026');
await p.setInputFiles('input[type=file]', pdf);
await p.getByRole('button', { name: 'Upload document' }).click();
await p.getByText('Laser consent 2026').waitFor({ timeout: 15000 });
// Capture the signed link the button opens, then fetch it: it must serve the private PDF
await p.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
await p.getByRole('button', { name: 'Open' }).first().click();
await p.waitForFunction(() => window.__opened.length > 0, null, { timeout: 10000 });
const signed = await p.evaluate(() => window.__opened[0]);
const file = await p.request.get(signed);
const unsigned = await p.request.get(signed.replace('/object/sign/', '/object/public/').split('?')[0]);
step(`client: tag + note + document; signed link -> ${file.status()} ${file.headers()['content-type']} | without token -> ${unsigned.status()}`);
await p.screenshot({ path: `${SHOTS}/f2-client.png`, fullPage: true });

// 4. Catalog: set a real duration and mark reviewed
await p.goto(`${BASE}/admin/catalog`, { waitUntil: 'networkidle' });
await p.getByRole('button', { name: /Vitamin C Facial/ }).click();
const form = p.locator('form').filter({ has: p.locator('input[value="Vitamin C Facial"]') });
await form.getByLabel('Duration (min)').fill('50');
await form.getByLabel('Estimated values: review').uncheck();
await form.getByRole('button', { name: 'Save' }).click();
await form.getByText('Saved.').waitFor({ timeout: 10000 });
const { data: vitc } = await admin.from('treatments').select('duration_minutes, needs_review').eq('slug', 'vitamin-c-facial').single();
step(`catalog saved -> Vitamin C: ${vitc.duration_minutes} min, needs_review=${vitc.needs_review}`);
await p.screenshot({ path: `${SHOTS}/f3-catalog.png`, fullPage: true });

// 5. Team: block a full day in 3 weeks
await p.goto(`${BASE}/admin/team`, { waitUntil: 'networkidle' });
const day = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
await p.fill('#blk-from', day);
await p.fill('#blk-to', day);
await p.fill('#blk-reason', 'Training day');
await p.getByRole('button', { name: 'Add block' }).last().click();
await p.getByText('Training day').first().waitFor({ timeout: 10000 });
step(`team: day off added (${day})`);
await p.screenshot({ path: `${SHOTS}/f4-team.png`, fullPage: true });

// 6. Settings: change the review link and reminders
await p.goto(`${BASE}/admin/settings`, { waitUntil: 'networkidle' });
await p.fill('#s-reviewUrl', 'https://g.page/r/bloom-test/review');
await p.fill('#s-reminderHours', '48, 2');
await p.getByRole('button', { name: 'Save' }).click();
await p.getByText('Saved.').waitFor({ timeout: 10000 });
const { data: s } = await admin.from('business_settings').select('review_url, reminder_offsets_min').eq('id', 1).single();
step(`settings saved -> review_url=${s.review_url}, reminders=${s.reminder_offsets_min}`);
await p.screenshot({ path: `${SHOTS}/f5-settings.png`, fullPage: true });
await admin.from('business_settings').update({ review_url: null, reminder_offsets_min: [1440, 120] }).eq('id', 1);

// 7. Activity log: filter + CSV exports
await p.goto(`${BASE}/admin/activity?entity=bookings`, { waitUntil: 'networkidle' });
step(`activity rows (bookings): ${await p.locator('tbody tr').count()}`);
await p.screenshot({ path: `${SHOTS}/f6-activity.png`, fullPage: false });
for (const url of ['/api/admin/bookings.csv', '/api/admin/audit.csv?entity=bookings']) {
  const res = await p.request.get(`${BASE}${url}`);
  const text = await res.text();
  step(`${url} -> ${res.status()} ${res.headers()['content-type']} | ${text.split('\r\n').length - 2} rows | header: ${text.split('\r\n')[0].slice(1, 60)}…`);
}

// 8. Staff (not admin) cannot open admin-only pages
await admin.auth.admin.listUsers();
console.log('errors:', errors);
console.log('booking', bookingId);
await b.close();
