/**
 * Four built-in accounts, no authentication.
 *
 * Checks that the app opens without a sign-in, that all four accounts are
 * seeded, and that selecting one only ever reaches that account's data.
 *
 *   node --env-file=.env.local tests/user-separation.mjs
 *
 * WARNING: truncates `holidays`. Development database only.
 */
import { readFileSync } from 'node:fs';

import pg from 'pg';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const COOKIE = 'voyager.user';

const USERS = {
  aashish: '00000000-0000-4000-8000-000000000001',
  neha: '00000000-0000-4000-8000-000000000002',
  anshiv: '00000000-0000-4000-8000-000000000003',
  shivom: '00000000-0000-4000-8000-000000000004',
};

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`); }
};

/** Same TLS policy as the app — see src/lib/server/ssl.ts. */
function pgClient() {
  const url = process.env.DATABASE_URL;
  const host = new URL(url).hostname;
  const clean = (() => {
    try {
      const u = new URL(url);
      u.searchParams.delete('sslmode');
      u.searchParams.delete('uselibpqcompat');
      return u.toString();
    } catch {
      return url;
    }
  })();

  const ca = process.env.DATABASE_CA_CERT?.trim();
  const ssl = ['localhost', '127.0.0.1', '::1'].includes(host)
    ? false
    : process.env.DATABASE_SSL_NO_VERIFY === 'true'
      ? { rejectUnauthorized: false }
      : {
          rejectUnauthorized: true,
          servername: host,
          ...(ca ? { ca: ca.startsWith('-----BEGIN') ? ca : readFileSync(ca, 'utf8') } : {}),
        };

  return new pg.Client({ connectionString: clean, ssl });
}

async function call(method, path, { as, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      ...(as ? { cookie: `${COOKIE}=${as}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 160) }; }
  return { status: res.status, body: json, headers: res.headers };
}

const client = pgClient();
await client.connect();
await fetch(`${BASE}/api/health`);
await client.query('DELETE FROM holidays');

console.log('\n=== 1. Authentication is gone ===');
for (const path of ['/api/auth/session', '/api/auth/providers', '/api/auth/csrf', '/signin', '/signup']) {
  const r = await call('GET', path);
  ok(`${path} → 404`, r.status === 404, r.status);
}

console.log('\n=== 2. The app opens straight onto the dashboard ===');
let r = await call('GET', '/');
ok('/ returns the dashboard, no redirect', r.status === 200, { status: r.status, location: r.headers.get('location') });
r = await call('GET', '/api/holidays');
ok('the API works with no cookie at all', r.status === 200, r.body);
ok('with no cookie it defaults to the first account', Array.isArray(r.body.holidays), r.body);

console.log('\n=== 3. All four accounts are seeded ===');
const seeded = await client.query('SELECT id::text, name FROM users ORDER BY name');
const names = seeded.rows.map((row) => row.name);
for (const expected of ['Aashish Opal', 'Anshiv Opal', 'Neha Opal', 'Shivom Opal']) {
  ok(`${expected} exists`, names.includes(expected), names);
}
ok('no leftover accounts from the auth era', seeded.rows.length === 4, names);
const cols = await client.query(
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users'",
);
ok('password column is gone', !cols.rows.some((c) => c.column_name === 'password_hash'), cols.rows.map((c) => c.column_name));

console.log('\n=== 4. Each account starts empty ===');
for (const [name, id] of Object.entries(USERS)) {
  r = await call('GET', '/api/holidays', { as: id });
  ok(`${name} starts with no holidays`, r.body.holidays.length === 0, r.body.holidays?.length);
}

console.log('\n=== 5. Data is completely separate ===');
const created = {};
for (const [name, id] of Object.entries(USERS)) {
  r = await call('POST', '/api/holidays', {
    as: id,
    body: { name: `${name} private trip`, country: 'Japan', primaryCurrency: 'JPY' },
  });
  ok(`${name} creates a holiday`, r.status === 201, r.body);
  created[name] = r.body.holiday.id;
  ok(`${name} owns it`, r.body.holiday.ownerId === id, r.body.holiday.ownerId);
}

for (const [name, id] of Object.entries(USERS)) {
  r = await call('GET', '/api/holidays', { as: id });
  const visible = r.body.holidays.map((h) => h.name);
  ok(`${name} sees exactly one holiday — their own`,
    visible.length === 1 && visible[0] === `${name} private trip`, visible);
}

console.log("\n=== 6. One account cannot reach another's data by id ===");
const victim = created.aashish;
for (const [label, req] of [
  ['GET    read',      () => call('GET', `/api/holidays/${victim}`, { as: USERS.neha })],
  ['PATCH  rename',    () => call('PATCH', `/api/holidays/${victim}`, { as: USERS.neha, body: { name: 'Taken' } })],
  ['DELETE holiday',   () => call('DELETE', `/api/holidays/${victim}`, { as: USERS.neha, body: { confirmName: 'aashish private trip' } })],
  ['POST   expense',   () => call('POST', `/api/holidays/${victim}/items/expenses`, { as: USERS.neha, body: { title: 'x', amount: 1, currency: 'JPY', paidByMemberId: 'm' } })],
  ['POST   itinerary', () => call('POST', `/api/holidays/${victim}/items/itinerary`, { as: USERS.anshiv, body: { title: 'x' } })],
  ['POST   chat',      () => call('POST', `/api/holidays/${victim}/items/chat`, { as: USERS.shivom, body: { body: 'hello' } })],
  ['POST   archive',   () => call('POST', `/api/holidays/${victim}/lifecycle`, { as: USERS.neha, body: { action: 'archive' } })],
] ) {
  const res = await req();
  ok(`${label} on another account's holiday → 404`, res.status === 404, res.status);
}

r = await call('GET', `/api/holidays/${victim}`, { as: USERS.aashish });
ok("the owner's holiday is untouched", r.body.holiday.name === 'aashish private trip', r.body.holiday?.name);
ok('no itinerary was injected', r.body.holiday.itinerary.length === 0, r.body.holiday?.itinerary);
ok('no chat was injected', r.body.holiday.chat.length === 0, r.body.holiday?.chat);

console.log('\n=== 7. A tampered cookie cannot invent an account ===');
for (const bad of ['not-a-uuid', '99999999-9999-4999-8999-999999999999', "'; DROP TABLE users; --", '']) {
  r = await call('GET', '/api/holidays', { as: bad });
  const visible = r.body?.holidays?.map((h) => h.name) ?? null;
  ok(`cookie ${JSON.stringify(bad.slice(0, 20))} falls back to the default account`,
    r.status === 200 && visible?.length === 1 && visible[0] === 'aashish private trip',
    { status: r.status, visible });
}

console.log('\n=== 8. Sharing still works between built-in accounts ===');
r = await call('POST', `/api/holidays/${victim}/members`, {
  as: USERS.aashish,
  body: { email: 'neha@voyager.local', role: 'traveller' },
});
ok('Aashish invites Neha', r.status === 201, r.body);
const nehaMember = r.body.holiday?.members?.find((m) => m.email === 'neha@voyager.local');
ok('Neha is bound to her seeded account id', nehaMember?.userId === USERS.neha, nehaMember);

r = await call('GET', '/api/holidays', { as: USERS.neha });
const nehaNames = r.body.holidays.map((h) => h.name);
ok('Neha now sees the shared holiday', nehaNames.includes('aashish private trip'), nehaNames);
ok('Neha still sees her own too', nehaNames.includes('neha private trip'), nehaNames);
r = await call('GET', '/api/holidays', { as: USERS.shivom });
ok('Shivom sees neither of them', !r.body.holidays.some((h) => h.name.startsWith('aashish') || h.name.startsWith('neha')),
  r.body.holidays.map((h) => h.name));

console.log(`\n${pass} passed, ${fail} failed`);
await client.end();
process.exit(fail ? 1 : 0);
