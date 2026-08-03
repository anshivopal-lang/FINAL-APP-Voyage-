import 'server-only';

import { Pool, type PoolClient } from 'pg';

import { resolveSsl, stripSslMode } from './ssl';

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

  const { ssl, mode, reason } = resolveSsl(connectionString);

  // Must happen before the string reaches pg: an sslmode= parameter both
  // triggers a deprecation warning and causes pg to discard our CA.
  const cleanConnectionString = stripSslMode(connectionString);

  if (mode === 'no-verify') {
    console.warn(`[voyager] Postgres TLS is NOT verified: ${reason}`);
  } else {
    console.log(`[voyager] Postgres TLS: ${mode} — ${reason}`);
  }

  return new Pool({
    connectionString: cleanConnectionString,
    // The single source of truth for TLS — see ssl.ts.
    ssl,
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
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  name       TEXT NOT NULL,
  image      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Authentication was removed, so there are no credentials to store. Dropped
-- rather than left nullable: an unused password column invites something to
-- start writing to it again.
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'users'
       AND column_name = 'google_id'
  ) THEN
    -- Google is no longer an identity source, so the column must not block
    -- password sign-ups. Left in place rather than dropped so a rollback does
    -- not lose the mapping.
    ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;
  END IF;
END $$;

-- ------------------------------------------------------------------ --
-- Re-key user identifiers from prefixed text ("usr_kX3n…") to UUID.
--
-- This is not a type change: the old values are not parseable as UUIDs, so
-- every row gets a new identifier and all three references are remapped
-- together. Runs only on a database still carrying the text column, so a
-- fresh install skips it entirely.
--
-- It has to run BEFORE the child tables below are created, because those
-- declare UUID foreign keys and Postgres will not point a uuid column at a
-- text primary key.
--
-- Every catalogue lookup is qualified to current_schema(). Unqualified,
-- "table_name = 'users'" also matches other schemas — Supabase ships an
-- auth.users whose id is uuid — and the scalar subquery then fails with
-- "more than one row returned by a subquery used as an expression",
-- taking the whole schema script and therefore the app down with it.
--
-- The script executes as one implicit transaction, so a failure anywhere
-- rolls the database back to the text schema untouched.
-- ------------------------------------------------------------------ --
DO $$
DECLARE
  users_id_type TEXT;
  has_holidays  BOOLEAN;
  has_members   BOOLEAN;
BEGIN
  SELECT data_type INTO users_id_type
    FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'users'
     AND column_name = 'id';

  IF users_id_type IS DISTINCT FROM 'text' THEN
    RETURN;
  END IF;

  -- The child tables may not exist yet on a partially provisioned database.
  has_holidays := to_regclass(current_schema() || '.holidays') IS NOT NULL;
  has_members  := to_regclass(current_schema() || '.holiday_members') IS NOT NULL;

  -- 1. Mint the replacement identifiers.
  ALTER TABLE users ADD COLUMN new_id UUID NOT NULL DEFAULT gen_random_uuid();

  -- 2. Carry every reference across via the old text key.
  IF has_holidays THEN
    ALTER TABLE holidays ADD COLUMN new_owner_id UUID;

    UPDATE holidays h
       SET new_owner_id = u.new_id
      FROM users u
     WHERE u.id = h.owner_id;

    -- 3. Chat messages embed the author's user id inside holidays.data, which
    --    no foreign key covers. Left alone, every existing message would keep
    --    a dangling text id and stop being recognised as its author's.
    UPDATE holidays h
       SET data = jsonb_set(h.data, '{chat}', rewritten.chat)
      FROM (
        SELECT hh.id,
               jsonb_agg(
                 CASE
                   WHEN u.new_id IS NOT NULL
                   THEN message || jsonb_build_object('userId', u.new_id::text)
                   ELSE message
                 END
                 ORDER BY ordinality
               ) AS chat
          FROM holidays hh
          CROSS JOIN LATERAL jsonb_array_elements(
                 COALESCE(hh.data -> 'chat', '[]'::jsonb)
               ) WITH ORDINALITY AS element(message, ordinality)
          LEFT JOIN users u ON u.id = element.message ->> 'userId'
         GROUP BY hh.id
      ) AS rewritten
     WHERE h.id = rewritten.id;
  END IF;

  IF has_members THEN
    ALTER TABLE holiday_members ADD COLUMN new_user_id UUID;

    UPDATE holiday_members m
       SET new_user_id = u.new_id
      FROM users u
     WHERE u.id = m.user_id;
  END IF;

  -- 4. Swap the columns. The child foreign keys have to go first, otherwise
  --    users.id cannot be dropped.
  IF has_holidays THEN
    ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_owner_id_fkey;
    ALTER TABLE holidays DROP COLUMN owner_id;
    ALTER TABLE holidays RENAME COLUMN new_owner_id TO owner_id;
    ALTER TABLE holidays ALTER COLUMN owner_id SET NOT NULL;
  END IF;

  IF has_members THEN
    ALTER TABLE holiday_members DROP CONSTRAINT IF EXISTS holiday_members_user_id_fkey;
    ALTER TABLE holiday_members DROP COLUMN user_id;
    ALTER TABLE holiday_members RENAME COLUMN new_user_id TO user_id;
  END IF;

  -- Dropping the column takes the primary key constraint with it.
  ALTER TABLE users DROP COLUMN id;
  ALTER TABLE users RENAME COLUMN new_id TO id;
  ALTER TABLE users ADD PRIMARY KEY (id);
  ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();

  -- 5. Restore referential integrity with the new types.
  IF has_holidays THEN
    ALTER TABLE holidays
      ADD CONSTRAINT holidays_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS holidays_owner_idx ON holidays (owner_id);
  END IF;

  IF has_members THEN
    ALTER TABLE holiday_members
      ADD CONSTRAINT holiday_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS holiday_members_user_idx ON holiday_members (user_id);
  END IF;

  RAISE NOTICE 'voyager: re-keyed user identifiers to UUID';
END $$;

DROP INDEX IF EXISTS users_email_lower_idx;

-- Email is now the login identity, so it has to be unique. Case-insensitive,
-- because people do not type their own address consistently.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS holidays (
  id         TEXT PRIMARY KEY,
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
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

-- ------------------------------------------------------------------ --
-- The four built-in accounts.
--
-- Authentication was removed, so these are seeded rather than registered.
-- Fixed ids (see src/lib/users.ts) mean a reseed or a fresh database keeps
-- every holiday attached to the same person.
--
-- ON CONFLICT DO UPDATE only touches the display fields, so re-running never
-- disturbs the rows that holidays and memberships point at.
-- ------------------------------------------------------------------ --
INSERT INTO users (id, email, name) VALUES
  ('00000000-0000-4000-8000-000000000001', 'aashish@voyager.local', 'Aashish Opal'),
  ('00000000-0000-4000-8000-000000000002', 'neha@voyager.local',    'Neha Opal'),
  ('00000000-0000-4000-8000-000000000003', 'anshiv@voyager.local',  'Anshiv Opal'),
  ('00000000-0000-4000-8000-000000000004', 'shivom@voyager.local',  'Shivom Opal')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name  = EXCLUDED.name;
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
