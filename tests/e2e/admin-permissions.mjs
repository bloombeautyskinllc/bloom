// Back office permissions: staff vs admin vs client (local test server :3001)
import { chromium } from '@playwright/test';
import { ensureUser, sessionCookies } from './helpers.mjs';

await ensureUser('staff@bloom.test', 'Stella Staff', 'staff');
await ensureUser('maria@bloom.test', 'Maria Lopez', 'client');
const b = await chromium.launch();

for (const [email, label] of [['staff@bloom.test', 'staff'], ['maria@bloom.test', 'client']]) {
  const ctx = await b.newContext();
  await ctx.addCookies(await sessionCookies(email));
  const p = await ctx.newPage();
  const results = [];
  for (const path of ['/admin', '/admin/bookings', '/admin/calendar', '/admin/clients', '/admin/catalog', '/admin/team', '/admin/settings', '/admin/activity', '/api/admin/audit.csv', '/api/admin/bookings.csv']) {
    const res = await p.request.get(`http://localhost:3001${path}`, { maxRedirects: 0 });
    results.push(`${path}=${res.status()}`);
  }
  let nav = [];
  if (label === 'staff') {
    await p.goto('http://localhost:3001/admin', { waitUntil: 'networkidle' });
    nav = await p.locator('aside nav a').allInnerTexts();
  }
  console.log(label, '|', results.join(' '), nav.length ? `| menu: ${nav.join(', ')}` : '');
  await ctx.close();
}
await b.close();
