// Calendar: drag and drop reschedule + realtime refresh (local stack, test server on :3001)
import { chromium } from '@playwright/test';
import { admin, ensureUser, sessionCookies, userClient } from './helpers.mjs';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies(await sessionCookies('owner@bloom.test'));
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));

// A future booking to drag: next week Wednesday 10:00 (week view of that week)
const staff = await userClient('owner@bloom.test');
const clientId = await ensureUser('dnd@bloom.test', 'Dana Drag');
const { data: t } = await admin.from('treatments').select('id').eq('slug', 'laminated-brows').single();
const now = new Date();
const nextMon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7) + 7));
const wed = new Date(nextMon.getTime() + 2 * 86_400_000);
const iso = (d, h, m = 0) => new Date(d.getTime() + (h + 4) * 3_600_000 + m * 60_000).toISOString();
const { data: bookingId, error } = await staff.rpc('admin_create_booking', {
  p_start_at: iso(wed, 10), p_client_id: clientId, p_treatment_id: t.id, p_notify: false, p_idempotency_key: `dnd-${wed.toISOString()}`,
});
if (error) throw error;
const dateParam = nextMon.toISOString().slice(0, 10);

await p.goto(`http://localhost:3001/admin/calendar?view=week&date=${dateParam}`, { waitUntil: 'networkidle' });
await p.getByText('Live').waitFor();
await p.waitForFunction(() => document.querySelector('span.bg-emerald-600') !== null, null, { timeout: 15000 });
console.log('realtime subscribed');

// Drag the 10:00 event two hours down in the same column (grid is 1.1 px per minute)
const event = p.locator(`a[href="/admin/bookings/${bookingId}"]`);
const box = await event.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + 8);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2, box.y + 8 + 120 * 1.1, { steps: 12 });
await p.mouse.up();
const dialog = p.getByRole('dialog');
const opened = await dialog.waitFor({ timeout: 5000 }).then(() => true, () => false);
if (!opened) {
  // Playwright's mouse does not always trigger HTML5 drag events; use its native drag helper
  await event.dragTo(p.locator('div.relative.border-l').nth(2), { targetPosition: { x: 40, y: (12 * 60 - 8 * 60) * 1.1 + 8 } });
  await dialog.waitFor({ timeout: 5000 });
}
console.log('dialog:', (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 200));
await dialog.getByRole('button', { name: 'Move booking' }).click();
await dialog.waitFor({ state: 'hidden', timeout: 15000 });
const { data: moved } = await admin.from('bookings').select('start_at').eq('id', bookingId).single();
console.log('moved:', iso(wed, 10), '->', new Date(moved.start_at).toISOString());

// Realtime: another booking created elsewhere shows up without reloading
const before = await p.locator('a[href^="/admin/bookings/"]').count();
const { data: rtId } = await staff.rpc('admin_create_booking', {
  p_start_at: iso(wed, 16), p_client_id: clientId, p_treatment_id: t.id, p_notify: false, p_idempotency_key: `rt-${wed.toISOString()}`,
});
await p.locator(`a[href="/admin/bookings/${rtId}"]`).waitFor({ timeout: 15000 });
console.log('realtime: events', before, '->', await p.locator('a[href^="/admin/bookings/"]').count());

console.log('errors:', errors);
await b.close();
