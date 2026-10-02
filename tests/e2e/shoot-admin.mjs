// Screenshots of back office pages on the local test server (http://localhost:3001) as the demo owner.
//   node tests/e2e/shoot-admin.mjs <out dir> /admin /admin/bookings ...   (add --mobile for a phone viewport)
import { chromium } from '@playwright/test';
import { sessionCookies } from './helpers.mjs';

const [out, ...rest] = process.argv.slice(2);
const mobile = rest.includes('--mobile');
const paths = rest.filter((p) => p.startsWith('/'));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
await ctx.addCookies(await sessionCookies('owner@bloom.test'));
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
for (const path of paths) {
  const res = await p.goto(`http://localhost:3001${path}`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForTimeout(800);
  const name = `${mobile ? 'm' : 'd'}${path.replace(/[/?=&]+/g, '_')}`;
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(path, res?.status(), `${name}.png`);
}
console.log('errors:', errors);
await b.close();
