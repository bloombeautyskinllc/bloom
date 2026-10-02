// Fills the LOCAL database with a realistic week of bookings for visual checks of the back office.
//   node tests/e2e/seed-demo.mjs
import { admin, ensureUser, userClient } from './helpers.mjs';

const OWNER = 'owner@bloom.test';
await ensureUser(OWNER, 'Olivia Owner', 'admin');
const staff = await userClient(OWNER);

const clients = [
  ['maria@bloom.test', 'Maria Lopez'],
  ['ana@bloom.test', 'Ana Rivera'],
  ['jess@bloom.test', 'Jessica Brown'],
  ['kim@bloom.test', 'Kimberly Diaz'],
  ['sofia@bloom.test', 'Sofia Martinez'],
];
const clientIds = [];
for (const [email, name] of clients) clientIds.push(await ensureUser(email, name));

const { data: treatments } = await admin.from('treatments').select('id, slug').in('slug', ['hydrodermabrasion', 'microneedling', 'laminated-brows', 'vajacial', 'shadow-brows', 'dermaplaning', 'diode-laser-session']);
const bySlug = Object.fromEntries(treatments.map((t) => [t.slug, t.id]));
const { data: areas } = await admin.from('treatment_options').select('id, slug').in('slug', ['laser-underarms', 'laser-bikini']);

// New York wall clock -> ISO for this week's days (EDT until Nov 1)
const now = new Date();
const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
const at = (dayOffset, hour, minute = 0) => new Date(monday.getTime() + dayOffset * 86_400_000 + (hour + 4) * 3_600_000 + minute * 60_000).toISOString();

const plan = [
  [0, 10, 0, 'hydrodermabrasion', 0],
  [0, 13, 30, 'laminated-brows', 1],
  [1, 11, 0, 'microneedling', 2],
  [1, 15, 0, 'diode-laser-session', 3, true],
  [2, 10, 30, 'vajacial', 4],
  [2, 12, 0, 'shadow-brows', 0],
  [3, 16, 0, 'dermaplaning', 1],
  [4, 10, 0, 'hydrodermabrasion', 2],
  [4, 14, 15, 'microneedling', 3],
  [5, 11, 0, 'laminated-brows', 4],
  [7, 10, 0, 'hydrodermabrasion', 1],
  [8, 12, 0, 'microneedling', 0],
];

let created = 0;
for (const [day, h, m, slug, ci, laser] of plan) {
  const { data, error } = await staff.rpc('admin_create_booking', {
    p_start_at: at(day, h, m),
    p_client_id: clientIds[ci],
    p_treatment_id: bySlug[slug],
    p_option_ids: laser ? areas.map((a) => a.id) : [],
    p_override_rules: true, // demo data may be in the past
    p_override_reason: 'Demo data',
    p_notify: false,
    p_idempotency_key: `demo-${day}-${h}-${m}`,
  });
  if (error) console.log('skip', slug, day, error.message);
  else created++;
  // Close past ones like staff would
  if (data && Date.parse(at(day, h, m)) < Date.now() - 3_600_000) {
    await staff.rpc('staff_set_booking_status', { p_booking_id: data, p_status: ci === 3 ? 'no_show' : 'completed' });
  }
}
console.log(`demo bookings created: ${created}`);
