/**
 * Email + password auth test.
 *
 * Drives the real NextAuth credentials flow over HTTP — CSRF token, callback,
 * session cookie — with no forged tokens, then re-checks that data isolation
 * still holds between two password accounts.
 *
 *   node --env-file=.env.local tests/credentials-auth.mjs
 *
 * WARNING: truncates `users` and `holidays`. Development database only.
 */
import { readFileSync } from 'node:fs';

import pg from 'pg';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`); }
};

/**
 * Same TLS policy as the app (src/lib/server/ssl.ts): no TLS to loopback, full
 * verification otherwise. An sslmode= parameter is stripped because it makes
 * node-postgres discard the CA and emits a deprecation warning.
 */
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
          ...(ca
            ? { ca: ca.startsWith('-----BEGIN') ? ca : readFileSync(ca, 'utf8') }
            : {}),
        };

  return new pg.Client({ connectionString: clean, ssl });
}

const client = pgClient();
await client.connect();
await fetch(`${BASE}/api/health`);
await client.query('DELETE FROM holidays');
await client.query('DELETE FROM users');

/** A cookie jar per simulated browser. */
function jar() {
  const cookies = new Map();
  return {
    header: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(response) {
      for (const raw of response.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (value === '' ) cookies.delete(name);
        else cookies.set(name, value);
      }
    },
    has: (name) => [...cookies.keys()].some((k) => k.includes(name)),
  };
}

async function call(method, path, { cookies, body, form } = {}) {
  const headers = {};
  if (cookies) headers.cookie = cookies.header();
  if (form) headers['content-type'] = 'application/x-www-form-urlencoded';
  else if (body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers,
    body: form ? new URLSearchParams(form).toString()
       : body === undefined ? undefined : JSON.stringify(body),
  });

  if (cookies) cookies.absorb(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json, headers: res.headers };
}

/** The genuine NextAuth credentials sign-in: CSRF token then callback POST. */
async function signIn(cookies, email, password) {
  const csrf = await call('GET', '/api/auth/csrf', { cookies });
  const token = csrf.body.csrfToken;
  return call('POST', '/api/auth/callback/credentials', {
    cookies,
    form: { csrfToken: token, email, password, callbackUrl: `${BASE}/` },
  });
}

console.log('\n=== 1. Google is gone ===');
let r = await call('GET', '/api/auth/providers');
const providers = Object.keys(r.body ?? {});
ok('only the credentials provider is registered', providers.length === 1 && providers[0] === 'credentials', providers);
r = await call('GET', '/api/auth/signin/google');
ok('google sign-in route no longer works', r.status >= 400 || (r.headers.get('location') ?? '').includes('error'), { status: r.status, location: r.headers.get('location') });

console.log('\n=== 2. Registration validation ===');
r = await call('POST', '/api/auth/register', { body: { name: 'A', email: 'not-an-email', password: 'short' } });
ok('rejects bad email and short password with field detail', r.status === 400 && r.body.error.details.length === 2, r.body);
r = await call('POST', '/api/auth/register', { body: { name: '', email: 'a@b.com', password: 'longenoughpassword' } });
ok('rejects empty name', r.status === 400, r.body);
r = await call('POST', '/api/auth/register', { body: { name: 'X', email: 'a@b.com', password: 'x'.repeat(100) } });
ok('rejects password over bcrypt 72-byte limit', r.status === 400, r.body);

console.log('\n=== 3. Register and sign in ===');
r = await call('POST', '/api/auth/register', { body: { name: 'Alice Nakamura', email: '  Alice@Example.COM ', password: 'correct-horse-battery' } });
ok('registers Alice (201)', r.status === 201, r.body);
ok('email normalised to lowercase', r.body.user.email === 'alice@example.com', r.body.user);
ok('response never contains a password hash', !JSON.stringify(r.body).match(/\$2[aby]\$/), r.body);

const stored = await client.query('SELECT password_hash FROM users WHERE email = $1', ['alice@example.com']);
ok('password stored as a bcrypt hash, not plain text', /^\$2[aby]\$\d{2}\$/.test(stored.rows[0].password_hash), stored.rows[0].password_hash?.slice(0, 12));
ok('plain password is nowhere in the row', !stored.rows[0].password_hash.includes('correct-horse-battery'));

r = await call('POST', '/api/auth/register', { body: { name: 'Impostor', email: 'ALICE@example.com', password: 'another-password-here' } });
ok('duplicate email rejected case-insensitively (409)', r.status === 409, r.body);

console.log('\n=== 4. Sign-in outcomes ===');
const wrongPass = jar();
r = await signIn(wrongPass, 'alice@example.com', 'wrong-password-entirely');
ok('wrong password does not create a session', !wrongPass.has('session-token'), r.headers.get('location'));
const noAccount = jar();
r = await signIn(noAccount, 'nobody@example.com', 'correct-horse-battery');
ok('unknown email does not create a session', !noAccount.has('session-token'));

const alice = jar();
r = await signIn(alice, 'alice@example.com', 'correct-horse-battery');
ok('correct credentials create a session cookie', alice.has('session-token'), r.headers.get('location'));

r = await call('GET', '/api/holidays', { cookies: alice });
ok('session works against the API', r.status === 200, r.body);
ok('Alice starts with no holidays', r.body.holidays.length === 0, r.body.holidays);

console.log('\n=== 5. Session cookie is httpOnly and not readable by JS ===');
const raw = await fetch(`${BASE}/api/auth/csrf`);
const jarProbe = jar();
jarProbe.absorb(raw);
const setCookies = (await (await fetch(`${BASE}/api/auth/csrf`)).headers.getSetCookie?.()) ?? [];
ok('auth cookies are flagged HttpOnly', setCookies.every((c) => /HttpOnly/i.test(c)), setCookies);
ok('auth cookies are flagged SameSite=Lax', setCookies.every((c) => /SameSite=Lax/i.test(c)), setCookies);

console.log('\n=== 6. Unauthenticated access still blocked ===');
r = await call('GET', '/api/holidays');
ok('no cookie → 401', r.status === 401, r.body);
r = await call('GET', '/');
ok('page redirects to /signin', r.status === 307 && (r.headers.get('location') ?? '').includes('/signin'), r.headers.get('location'));

console.log('\n=== 7. Two password accounts stay isolated ===');
await call('POST', '/api/auth/register', { body: { name: 'Bob Oyelaran', email: 'bob@example.com', password: 'a-different-passphrase' } });
const bob = jar();
await signIn(bob, 'bob@example.com', 'a-different-passphrase');
ok('Bob signs in', bob.has('session-token'));

r = await call('POST', '/api/holidays', { cookies: alice, body: { name: 'Alice Private Kyoto', country: 'Japan', primaryCurrency: 'JPY' } });
const aliceHoliday = r.body.holiday.id;
ok('Alice creates a holiday', r.status === 201, r.body);

r = await call('POST', '/api/holidays', { cookies: bob, body: { name: 'Bob Private Lisbon', country: 'Portugal', primaryCurrency: 'EUR' } });
ok('Bob creates a holiday', r.status === 201, r.body);

r = await call('GET', '/api/holidays', { cookies: bob });
ok("Bob's list excludes Alice's holiday", r.body.holidays.length === 1 && r.body.holidays[0].name === 'Bob Private Lisbon', r.body.holidays.map(h => h.name));

for (const [label, req] of [
  ['GET    read',   () => call('GET', `/api/holidays/${aliceHoliday}`, { cookies: bob })],
  ['PATCH  rename', () => call('PATCH', `/api/holidays/${aliceHoliday}`, { cookies: bob, body: { name: 'Hijacked' } })],
  ['DELETE holiday',() => call('DELETE', `/api/holidays/${aliceHoliday}`, { cookies: bob, body: { confirmName: 'Alice Private Kyoto' } })],
  ['POST   expense',() => call('POST', `/api/holidays/${aliceHoliday}/items/expenses`, { cookies: bob, body: { title: 'x', amount: 1, currency: 'JPY', paidByMemberId: 'm' } })],
]) {
  const res = await req();
  ok(`Bob ${label} on Alice's holiday → 404`, res.status === 404, { status: res.status });
}

console.log('\n=== 8. Invitations still bind on registration ===');
r = await call('POST', `/api/holidays/${aliceHoliday}/members`, { cookies: alice, body: { email: 'carol@example.com', role: 'traveller' } });
ok('Alice invites an unregistered email', r.status === 201 && r.body.holiday.members.some(m => m.email === 'carol@example.com' && m.pending), r.body?.error);

await call('POST', '/api/auth/register', { body: { name: 'Carol Byrne', email: 'carol@example.com', password: 'carols-long-passphrase' } });
const carol = jar();
await signIn(carol, 'carol@example.com', 'carols-long-passphrase');
r = await call('GET', '/api/holidays', { cookies: carol });
ok('Carol sees the trip after registering', r.body.holidays.some(h => h.id === aliceHoliday), r.body.holidays?.map(h => h.name));
ok("Carol does not see Bob's trip", !r.body.holidays.some(h => h.name === 'Bob Private Lisbon'), r.body.holidays?.map(h => h.name));

console.log('\n=== 9. Sign out ===');
const csrf = await call('GET', '/api/auth/csrf', { cookies: alice });
await call('POST', '/api/auth/signout', { cookies: alice, form: { csrfToken: csrf.body.csrfToken, callbackUrl: `${BASE}/signin` } });
r = await call('GET', '/api/holidays', { cookies: alice });
ok('after sign-out the session no longer works', r.status === 401, r.body);

console.log(`\n${pass} passed, ${fail} failed`);
await client.end();
process.exit(fail ? 1 : 0);
