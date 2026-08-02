/**
 * Creates an account, or resets an existing account's password.
 *
 *   node --env-file=.env.local scripts/create-account.mjs you@example.com "Your Name"
 *   node --env-file=.env.local scripts/create-account.mjs you@example.com --reset
 *
 * The password is generated here and printed once. It is never written to a
 * file, never committed, and cannot be recovered afterwards — only replaced by
 * running this again with --reset.
 *
 * This is an operator tool, not a privilege escalation: it needs DATABASE_URL,
 * so anyone who can run it already has full database access. It grants no
 * capability that direct SQL would not.
 *
 * Note that Voyager has no admin role. The account this creates is an ordinary
 * user; "owner" is a per-holiday role earned by creating a holiday.
 */
import { randomInt } from 'node:crypto';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const [, , email, ...rest] = process.argv;
const reset = rest.includes('--reset');
const name = rest.find((argument) => !argument.startsWith('--'));

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  die(
    'Usage: node --env-file=.env.local scripts/create-account.mjs ' +
      '<email> [name] [--reset]',
  );
}

if (!process.env.DATABASE_URL) {
  die('DATABASE_URL is not set. Pass --env-file=.env.local, or export it.');
}

/**
 * Six groups of four from an unambiguous alphabet — no 0/O or 1/l/I, so it can
 * be read aloud or copied by hand without errors. ~123 bits of entropy.
 */
function generatePassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const groups = [];

  for (let group = 0; group < 6; group += 1) {
    let chunk = '';
    for (let character = 0; character < 4; character += 1) {
      chunk += alphabet[randomInt(alphabet.length)];
    }
    groups.push(chunk);
  }

  return groups.join('-');
}

const password = generatePassword();
const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
const passwordHash = await bcrypt.hash(password, rounds);
const normalised = email.trim().toLowerCase();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL.includes('localhost') ||
    process.env.DATABASE_URL.includes('127.0.0.1')
      ? undefined
      : { rejectUnauthorized: false },
});

await client.connect();

try {
  const existing = await client.query(
    'SELECT id, name FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [normalised],
  );

  let id;
  let action;

  if (existing.rows.length > 0) {
    if (!reset) {
      die(
        `An account for ${normalised} already exists.\n  ` +
          'Re-run with --reset to replace its password.',
      );
    }

    id = existing.rows[0].id;
    action = 'Password reset for';
    await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [
      id,
      passwordHash,
    ]);
  } else {
    const inserted = await client.query(
      `INSERT INTO users (email, name, password_hash)
            VALUES ($1, $2, $3)
       RETURNING id`,
      [normalised, name?.trim() || normalised.split('@')[0], passwordHash],
    );

    id = inserted.rows[0].id;
    action = 'Account created for';

    // Adopt any holiday invitations already addressed to this email, exactly
    // as registering through the sign-up form would.
    const claimed = await client.query(
      `UPDATE holiday_members
          SET user_id = $1, joined_at = now()
        WHERE user_id IS NULL AND lower(email) = lower($2)`,
      [id, normalised],
    );

    if (claimed.rowCount > 0) {
      console.log(
        `\n  Claimed ${claimed.rowCount} pending holiday invitation(s).`,
      );
    }
  }

  console.log(`
  ${action} ${normalised}

    User ID   ${id}
    Email     ${normalised}
    Password  ${password}

  Shown once. Store it in a password manager and sign in at /signin.
  Voyager has no admin role — this is an ordinary account.
`);
} finally {
  await client.end();
}
