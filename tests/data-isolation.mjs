/**
 * Data-isolation test — the proof that two accounts cannot reach each other.
 *
 * Run against a server started with the same AUTH_SECRET and DATABASE_URL:
 *
 *   node --env-file=.env.local tests/data-isolation.mjs
 *
 * WARNING: it truncates `users` and `holidays`. Point DATABASE_URL at a
 * development database, never production.
 *
 * Mints genuine Auth.js session cookies (same secret, same encoder the app
 * uses) for two distinct accounts, then tries every way one account might
 * reach the other's data.
 */
import { encode } from 'next-auth/jwt';
import pg from 'pg';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (!SECRET) throw new Error('Set AUTH_SECRET to the value the running server uses.');
const COOKIE = 'authjs.session-token';

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`); }
};

// --- seed two accounts, exactly as a Google sign-in would ---
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});
await client.connect();
await fetch(`${BASE}/api/health`);
await client.query('DELETE FROM holidays');
await client.query('DELETE FROM users');

const ALICE = { id: 'usr_alice', googleId: 'google-alice-111', email: 'alice@example.com', name: 'Alice Nakamura' };
const BOB = { id: 'usr_bob', googleId: 'google-bob-222', email: 'bob@example.com', name: 'Bob Oyelaran' };

for (const u of [ALICE, BOB]) {
  await client.query(
    'INSERT INTO users (id, google_id, email, name) VALUES ($1,$2,$3,$4)',
    [u.id, u.googleId, u.email, u.name],
  );
}

async function cookieFor(user) {
  const token = await encode({
    token: { sub: user.googleId, userId: user.id, email: user.email, name: user.name },
    secret: SECRET,
    salt: COOKIE,
    maxAge: 3600,
  });
  return `${COOKIE}=${token}`;
}

const aliceCookie = await cookieFor(ALICE);
const bobCookie = await cookieFor(BOB);

async function call(method, path, { cookie, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 120) }; }
  return { status: res.status, body: json, headers: res.headers };
}

console.log('\n=== 1. Authentication is required ===');
let r = await call('GET', '/api/holidays');
ok('no cookie → 401 on API', r.status === 401, r.body);

r = await call('GET', '/api/holidays', { cookie: `${COOKIE}=totally.made.up` });
ok('garbage cookie → 401', r.status === 401, r.body);

// A cookie signed with a DIFFERENT secret must not be accepted.
const forged = await encode({
  token: { sub: 'google-alice-111', userId: ALICE.id, email: ALICE.email },
  secret: 'an-attacker-chosen-secret-that-is-long-enough',
  salt: COOKIE,
  maxAge: 3600,
});
r = await call('GET', '/api/holidays', { cookie: `${COOKIE}=${forged}` });
ok('cookie signed with wrong secret → 401', r.status === 401, r.body);

r = await call('GET', '/', {});
ok('unauthenticated page redirects to /signin',
  r.status === 307 && (r.headers.get('location') ?? '').includes('/signin'),
  { status: r.status, location: r.headers.get('location') });

console.log('\n=== 2. A fresh account starts empty ===');
r = await call('GET', '/api/holidays', { cookie: aliceCookie });
ok('Alice starts with zero holidays (no demo data)', r.status === 200 && r.body.holidays.length === 0, r.body);
r = await call('GET', '/api/holidays', { cookie: bobCookie });
ok('Bob starts with zero holidays', r.status === 200 && r.body.holidays.length === 0, r.body);

console.log('\n=== 3. Each account sees only its own data ===');
r = await call('POST', '/api/holidays', { cookie: aliceCookie, body: { name: 'Alice Private Kyoto', country: 'Japan', primaryCurrency: 'JPY', cities: ['Kyoto'] } });
ok('Alice creates a holiday', r.status === 201, r.body);
const aliceHoliday = r.body.holiday.id;
ok('Alice is the owner', r.body.holiday.ownerId === ALICE.id, r.body.holiday.ownerId);

r = await call('POST', '/api/holidays', { cookie: bobCookie, body: { name: 'Bob Private Lisbon', country: 'Portugal', primaryCurrency: 'EUR', cities: ['Lisbon'] } });
ok('Bob creates a holiday', r.status === 201, r.body);
const bobHoliday = r.body.holiday.id;

r = await call('GET', '/api/holidays', { cookie: aliceCookie });
ok('Alice list has exactly her own holiday', r.body.holidays.length === 1 && r.body.holidays[0].id === aliceHoliday, r.body.holidays.map(h => h.name));
r = await call('GET', '/api/holidays', { cookie: bobCookie });
ok("Bob list does NOT contain Alice's holiday", r.body.holidays.length === 1 && r.body.holidays[0].id === bobHoliday, r.body.holidays.map(h => h.name));

console.log("\n=== 4. Bob cannot reach Alice's holiday by guessing the URL/ID ===");
const attacks = [
  ['GET    read holiday',        () => call('GET', `/api/holidays/${aliceHoliday}`, { cookie: bobCookie })],
  ['PATCH  rename holiday',      () => call('PATCH', `/api/holidays/${aliceHoliday}`, { cookie: bobCookie, body: { name: 'Hijacked' } })],
  ['DELETE holiday',             () => call('DELETE', `/api/holidays/${aliceHoliday}`, { cookie: bobCookie, body: { confirmName: 'Alice Private Kyoto' } })],
  ['POST   archive',             () => call('POST', `/api/holidays/${aliceHoliday}/lifecycle`, { cookie: bobCookie, body: { action: 'archive' } })],
  ['POST   purge data',          () => call('POST', `/api/holidays/${aliceHoliday}/lifecycle`, { cookie: bobCookie, body: { action: 'purge', sections: ['expenses'] } })],
  ['POST   duplicate',           () => call('POST', `/api/holidays/${aliceHoliday}/duplicate`, { cookie: bobCookie })],
  ['POST   add itinerary',       () => call('POST', `/api/holidays/${aliceHoliday}/items/itinerary`, { cookie: bobCookie, body: { title: 'Injected plan' } })],
  ['POST   add expense',         () => call('POST', `/api/holidays/${aliceHoliday}/items/expenses`, { cookie: bobCookie, body: { title: 'x', amount: 5, currency: 'JPY', paidByMemberId: 'whatever' } })],
  ['POST   post chat message',   () => call('POST', `/api/holidays/${aliceHoliday}/items/chat`, { cookie: bobCookie, body: { body: 'I should not be here' } })],
  ['POST   invite self',         () => call('POST', `/api/holidays/${aliceHoliday}/members`, { cookie: bobCookie, body: { email: 'bob@example.com', role: 'organiser' } })],
  ['POST   transfer ownership',  () => call('POST', `/api/holidays/${aliceHoliday}/settings`, { cookie: bobCookie, body: { action: 'transfer-ownership', memberId: 'mem_anything' } })],
  ['POST   change currencies',   () => call('POST', `/api/holidays/${aliceHoliday}/settings`, { cookie: bobCookie, body: { action: 'currencies', primaryCurrency: 'USD' } })],
];

for (const [label, run] of attacks) {
  const res = await run();
  ok(`${label} → 404 (not even existence leaked)`, res.status === 404, { status: res.status, body: res.body });
}

// And Alice's data is genuinely untouched.
r = await call('GET', `/api/holidays/${aliceHoliday}`, { cookie: aliceCookie });
ok("Alice's holiday still named correctly after all attacks", r.body.holiday.name === 'Alice Private Kyoto', r.body.holiday.name);
ok("Alice's holiday still has no injected itinerary", r.body.holiday.itinerary.length === 0, r.body.holiday.itinerary);
ok("Alice's holiday still has no injected chat", r.body.holiday.chat.length === 0, r.body.holiday.chat);
ok("Alice's holiday still has only her as member", r.body.holiday.members.length === 1, r.body.holiday.members.map(m => m.email));

console.log('\n=== 5. Sharing works, and only as far as it should ===');
r = await call('POST', `/api/holidays/${aliceHoliday}/members`, { cookie: aliceCookie, body: { email: 'bob@example.com', role: 'viewer' } });
ok('Alice invites Bob as a viewer', r.status === 201, r.body);
const bobMembership = r.body.holiday.members.find(m => m.email === 'bob@example.com');
ok('Bob bound to his account id, not just email', bobMembership.userId === BOB.id, bobMembership);

r = await call('GET', '/api/holidays', { cookie: bobCookie });
ok('Bob now sees the shared holiday', r.body.holidays.some(h => h.id === aliceHoliday), r.body.holidays.map(h => h.name));
r = await call('GET', '/api/holidays', { cookie: aliceCookie });
ok("Alice still cannot see Bob's private holiday", !r.body.holidays.some(h => h.id === bobHoliday), r.body.holidays.map(h => h.name));

r = await call('PATCH', `/api/holidays/${aliceHoliday}`, { cookie: bobCookie, body: { name: 'Viewer Rename' } });
ok('shared viewer still cannot edit (403)', r.status === 403, r.body);
r = await call('DELETE', `/api/holidays/${aliceHoliday}`, { cookie: bobCookie, body: { confirmName: 'Alice Private Kyoto' } });
ok('shared viewer still cannot delete (403)', r.status === 403, r.body);
r = await call('POST', `/api/holidays/${aliceHoliday}/lifecycle`, { cookie: bobCookie, body: { action: 'archive' } });
ok('shared viewer still cannot archive (403)', r.status === 403, r.body);

console.log('\n=== 6. No privilege escalation ===');
r = await call('PATCH', `/api/holidays/${aliceHoliday}/members/${bobMembership.id}`, { cookie: bobCookie, body: { role: 'organiser' } });
ok('viewer cannot promote himself (403)', r.status === 403, r.body);

r = await call('PATCH', `/api/holidays/${aliceHoliday}/members/${bobMembership.id}`, { cookie: aliceCookie, body: { permissions: ['holiday.delete', 'holiday.archive', 'expenses.manage'] } });
ok('owner-only permissions stripped, not granted', r.status === 200 && !r.body.holiday.members.find(m => m.id === bobMembership.id).permissions.includes('holiday.delete'), r.body.holiday?.members?.find(m => m.id === bobMembership.id));
r = await call('DELETE', `/api/holidays/${aliceHoliday}`, { cookie: bobCookie, body: { confirmName: 'Alice Private Kyoto' } });
ok('after grant attempt Bob still cannot delete', r.status === 403, r.body);

console.log('\n=== 7. Confidential documents are withheld per-viewer ===');
await call('POST', `/api/holidays/${aliceHoliday}/items/documents`, { cookie: aliceCookie, body: { name: 'Alice passport.pdf', type: 'passport', confidential: true } });
await call('POST', `/api/holidays/${aliceHoliday}/items/documents`, { cookie: aliceCookie, body: { name: 'Hotel booking.pdf', type: 'reservation', confidential: false } });

r = await call('GET', `/api/holidays/${aliceHoliday}`, { cookie: bobCookie });
const bobDocs = r.body.holiday.documents.map(d => d.name);
ok('viewer never receives the confidential document', !bobDocs.includes('Alice passport.pdf'), bobDocs);
ok('viewer is told a document was withheld', r.body.holiday.hiddenDocumentCount === 1, r.body.holiday.hiddenDocumentCount);
r = await call('GET', `/api/holidays/${aliceHoliday}`, { cookie: aliceCookie });
ok('owner sees both documents', r.body.holiday.documents.length === 2, r.body.holiday.documents.map(d => d.name));

console.log('\n=== 8. Chat authorship cannot be spoofed ===');
r = await call('POST', `/api/holidays/${aliceHoliday}/items/chat`, { cookie: aliceCookie, body: { body: 'Hello', userId: BOB.id, memberId: 'mem_spoof' } });
const msg = r.body.holiday.chat[0];
ok('author taken from session, not body', msg.userId === ALICE.id && msg.memberId !== 'mem_spoof', msg);

console.log('\n=== 9. Removing a member revokes access immediately ===');
r = await call('DELETE', `/api/holidays/${aliceHoliday}/members/${bobMembership.id}`, { cookie: aliceCookie });
ok('Alice removes Bob', r.status === 200, r.body);
r = await call('GET', `/api/holidays/${aliceHoliday}`, { cookie: bobCookie });
ok('Bob immediately gets 404 again', r.status === 404, r.body);
r = await call('GET', '/api/holidays', { cookie: bobCookie });
ok('shared holiday gone from Bob list', !r.body.holidays.some(h => h.id === aliceHoliday), r.body.holidays.map(h => h.name));

console.log('\n=== 10. Pending invitation is claimed on first sign-in ===');
r = await call('POST', `/api/holidays/${aliceHoliday}/members`, { cookie: aliceCookie, body: { email: 'carol@example.com', role: 'traveller' } });
const carolPending = r.body.holiday.members.find(m => m.email === 'carol@example.com');
ok('invite before signup is pending', carolPending.pending === true && carolPending.userId === null, carolPending);

// Simulate Carol's first Google sign-in.
const { rows } = await client.query('SELECT 1');
void rows;
await client.query(
  'INSERT INTO users (id, google_id, email, name) VALUES ($1,$2,$3,$4)',
  ['usr_carol', 'google-carol-333', 'carol@example.com', 'Carol Byrne'],
);
await client.query(
  "UPDATE holiday_members SET user_id = 'usr_carol' WHERE user_id IS NULL AND lower(email) = 'carol@example.com'",
);
const carolCookie = await cookieFor({ id: 'usr_carol', googleId: 'google-carol-333', email: 'carol@example.com', name: 'Carol Byrne' });
r = await call('GET', '/api/holidays', { cookie: carolCookie });
ok('Carol sees the trip she was invited to', r.body.holidays.some(h => h.id === aliceHoliday), r.body.holidays.map(h => h.name));
ok("Carol does NOT see Bob's private trip", !r.body.holidays.some(h => h.id === bobHoliday), r.body.holidays.map(h => h.name));

console.log(`\n${pass} passed, ${fail} failed`);
await client.end();
process.exit(fail ? 1 : 0);
