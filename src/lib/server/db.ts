import 'server-only';

import { Pool, type PoolClient } from 'pg';

/**
 * Postgres connection.
 *
 * On Vercel every lambda is short-lived and the filesystem is read-only, so a
 * JSON file cannot be the store — data would silently vanish between requests.
 * A small pool cached on `globalThis` survives hot reloads in dev and module
 * re-evaluation in serverless, which keeps connection count sane.
 */

declare global {
  // eslint-disable-next-line no-var
  var __voyagerPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __voyagerSchema: Promise<void> | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Point it at a Postgres instance ' +
        '(Neon, Vercel Postgres, Supabase or a local server).',
    );
  }

  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1');

  return new Pool({
    connectionString,
    // Managed Postgres providers terminate non-TLS connections; local ones
    // usually have no certificate at all.
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function pool(): Pool {
  globalThis.__voyagerPool ??= createPool();
  return globalThis.__voyagerPool;
}

export async function query<T = unknown>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const result = await pool().query(text, params);
  return result.rows as T[];
}

/** Runs `fn` inside a transaction, rolling back on any throw. */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await ensureSchema();
  const client = await pool().connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------------ *
 * Schema
 * ------------------------------------------------------------------ */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  google_id   TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  image       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invitations are matched on email, so the lookup must be case-insensitive
-- and fast.
CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS holidays (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS holidays_owner_idx ON holidays (owner_id);

-- Membership is a real table, not an array inside the holiday document, so
-- that "which holidays may this user see" is a single indexed join rather
-- than a scan over every row in the table.
CREATE TABLE IF NOT EXISTS holiday_members (
  id            TEXT PRIMARY KEY,
  holiday_id    TEXT NOT NULL REFERENCES holidays(id) ON DELETE CASCADE,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  email         TEXT NOT NULL,
  invited_name  TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'traveller',
  permissions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  notifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  avatar_color  TEXT NOT NULL DEFAULT '#3f6b8b',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS holiday_members_user_idx ON holiday_members (user_id);
CREATE INDEX IF NOT EXISTS holiday_members_holiday_idx ON holiday_members (holiday_id);
CREATE INDEX IF NOT EXISTS holiday_members_email_idx ON holiday_members (lower(email));

-- One membership per person per holiday.
CREATE UNIQUE INDEX IF NOT EXISTS holiday_members_unique_email
  ON holiday_members (holiday_id, lower(email));
`;

/** Applied once per process, before the first query. */
async function ensureSchema(): Promise<void> {
  globalThis.__voyagerSchema ??= (async () => {
    await pool().query(SCHEMA);
  })();

  try {
    await globalThis.__voyagerSchema;
  } catch (error) {
    // Let the next request retry rather than caching a failed migration.
    globalThis.__voyagerSchema = undefined;
    throw error;
  }
}
