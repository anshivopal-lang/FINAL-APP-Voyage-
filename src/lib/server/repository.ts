import 'server-only';

import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';

import { query, transaction } from './db';
import { DEFAULT_NOTIFICATIONS } from '@/lib/defaults';
import type { Holiday, Member, MemberRole } from '@/lib/types';

export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString('base64url')}`;
}

const AVATAR_COLORS = [
  '#8b6f3f',
  '#3f6b8b',
  '#6b3f8b',
  '#3f8b6b',
  '#8b3f4f',
  '#4f4f8b',
  '#8b7a3f',
];

export interface AppUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

/* ------------------------------------------------------------------ *
 * Users — email + password
 * ------------------------------------------------------------------ */

/** Work factor for bcrypt. 12 is a sane 2020s default; lower only in tests. */
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

/**
 * A hash of a throwaway value, compared against when no account matches so
 * that a wrong email and a wrong password cost the same amount of time.
 * Without this, response latency tells an attacker which emails are registered.
 */
const DUMMY_HASH = bcrypt.hashSync('voyager-timing-equaliser', BCRYPT_ROUNDS);

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const rows = await query<{
    id: string;
    email: string;
    name: string;
    image: string | null;
  }>(
    `SELECT id, email, name, image
       FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );

  const row = rows[0];
  return row ? { id: row.id, email: row.email, name: row.name, image: row.image } : null;
}

/**
 * Creates an account and adopts any holiday invitations that were addressed to
 * this email before the person had registered.
 *
 * Returns null when the email is already taken, so the caller can decide what
 * to tell the user.
 */
export async function createUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<AppUser | null> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const email = input.email.trim().toLowerCase();

  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );
    if (existing.rows.length > 0) return null;

    const inserted = await client.query(
      `INSERT INTO users (id, email, name, password_hash)
            VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, image`,
      [createId('usr'), email, input.name.trim(), passwordHash],
    );

    const row = inserted.rows[0];

    await client.query(
      `UPDATE holiday_members
          SET user_id = $1, joined_at = now()
        WHERE user_id IS NULL AND lower(email) = lower($2)`,
      [row.id, email],
    );

    return { id: row.id, email: row.email, name: row.name, image: row.image };
  });
}

/**
 * Checks an email and password against the database.
 *
 * Always performs a bcrypt comparison — even when no account exists — so the
 * response takes the same time either way. Returns null for every failure mode
 * without distinguishing them, because the caller must not leak which one it
 * was.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AppUser | null> {
  const rows = await query<{
    id: string;
    email: string;
    name: string;
    image: string | null;
    password_hash: string | null;
  }>(
    `SELECT id, email, name, image, password_hash
       FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );

  const row = rows[0];
  const matches = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);

  // `password_hash` is null for accounts created under the old Google-only
  // flow; those cannot sign in with a password until one is set.
  if (!row || !row.password_hash || !matches) return null;

  return { id: row.id, email: row.email, name: row.name, image: row.image };
}

/* ------------------------------------------------------------------ *
 * Holidays
 * ------------------------------------------------------------------ */

interface HolidayRow {
  id: string;
  owner_id: string;
  data: Omit<Holiday, 'id' | 'ownerId' | 'members'>;
  status: string;
  updated_at: Date;
}

interface MemberRow {
  id: string;
  holiday_id: string;
  user_id: string | null;
  email: string;
  invited_name: string;
  role: MemberRole;
  permissions: string[];
  notifications: Record<string, unknown>;
  avatar_color: string;
  joined_at: Date;
  user_name: string | null;
  user_image: string | null;
}

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    name: row.user_name ?? row.invited_name ?? row.email,
    image: row.user_image ?? null,
    role: row.role,
    permissions: (row.permissions ?? []) as Member['permissions'],
    avatarColor: row.avatar_color,
    joinedAt:
      row.joined_at instanceof Date
        ? row.joined_at.toISOString()
        : String(row.joined_at),
    pending: row.user_id === null,
    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      ...(row.notifications as object),
    } as Member['notifications'],
  };
}

function toHoliday(row: HolidayRow, members: Member[]): Holiday {
  return {
    ...(row.data as object),
    id: row.id,
    ownerId: row.owner_id,
    status: row.status,
    members,
  } as Holiday;
}

async function loadMembers(
  holidayIds: string[],
  client?: PoolClient,
): Promise<Map<string, Member[]>> {
  if (holidayIds.length === 0) return new Map();

  const sql = `
    SELECT m.*, u.name AS user_name, u.image AS user_image
      FROM holiday_members m
      LEFT JOIN users u ON u.id = m.user_id
     WHERE m.holiday_id = ANY($1::text[])
     ORDER BY m.joined_at ASC`;

  const rows = client
    ? ((await client.query(sql, [holidayIds])).rows as MemberRow[])
    : await query<MemberRow>(sql, [holidayIds]);

  const grouped = new Map<string, Member[]>();
  for (const row of rows) {
    const list = grouped.get(row.holiday_id) ?? [];
    list.push(toMember(row));
    grouped.set(row.holiday_id, list);
  }

  return grouped;
}

/**
 * Every holiday the user may see: ones they own, plus ones they were invited
 * to. The membership join *is* the authorisation filter — there is no code
 * path that lists holidays without it.
 */
export async function listHolidaysForUser(
  userId: string,
  status: 'active' | 'archived' | 'all',
): Promise<Holiday[]> {
  const rows = await query<HolidayRow>(
    `SELECT h.id, h.owner_id, h.data, h.status, h.updated_at
       FROM holidays h
       JOIN holiday_members m ON m.holiday_id = h.id
      WHERE m.user_id = $1
        AND ($2 = 'all' OR h.status = $2)
      ORDER BY h.updated_at DESC`,
    [userId, status],
  );

  const members = await loadMembers(rows.map((row) => row.id));
  return rows.map((row) => toHoliday(row, members.get(row.id) ?? []));
}

/**
 * A single holiday, but only if this user is a member of it.
 *
 * Returns null for both "does not exist" and "not yours", so callers can
 * answer 404 in either case and never confirm that someone else's id is real.
 */
export async function getHolidayForUser(
  holidayId: string,
  userId: string,
): Promise<Holiday | null> {
  const rows = await query<HolidayRow>(
    `SELECT h.id, h.owner_id, h.data, h.status, h.updated_at
       FROM holidays h
       JOIN holiday_members m ON m.holiday_id = h.id
      WHERE h.id = $1 AND m.user_id = $2
      LIMIT 1`,
    [holidayId, userId],
  );

  const row = rows[0];
  if (!row) return null;

  const members = await loadMembers([row.id]);
  return toHoliday(row, members.get(row.id) ?? []);
}

/** Same guarantee as `getHolidayForUser`, inside an open transaction. */
export async function getHolidayForUserTx(
  client: PoolClient,
  holidayId: string,
  userId: string,
): Promise<Holiday | null> {
  const result = await client.query(
    `SELECT h.id, h.owner_id, h.data, h.status, h.updated_at
       FROM holidays h
       JOIN holiday_members m ON m.holiday_id = h.id
      WHERE h.id = $1 AND m.user_id = $2
      FOR UPDATE OF h
      LIMIT 1`,
    [holidayId, userId],
  );

  const row = result.rows[0] as HolidayRow | undefined;
  if (!row) return null;

  const members = await loadMembers([row.id], client);
  return toHoliday(row, members.get(row.id) ?? []);
}

export async function insertHoliday(
  owner: { id: string; email: string; name: string },
  holiday: Omit<Holiday, 'id' | 'ownerId' | 'members'>,
): Promise<Holiday> {
  return transaction(async (client) => {
    const id = createId('hol');

    await client.query(
      `INSERT INTO holidays (id, owner_id, data, status)
            VALUES ($1, $2, $3, $4)`,
      [id, owner.id, JSON.stringify(holiday), holiday.status ?? 'active'],
    );

    await client.query(
      `INSERT INTO holiday_members
         (id, holiday_id, user_id, email, invited_name, role, permissions,
          notifications, avatar_color)
       VALUES ($1, $2, $3, $4, $5, 'owner', '[]'::jsonb, $6, $7)`,
      [
        createId('mem'),
        id,
        owner.id,
        owner.email,
        owner.name,
        JSON.stringify(DEFAULT_NOTIFICATIONS),
        AVATAR_COLORS[0],
      ],
    );

    const created = await getHolidayForUserTx(client, id, owner.id);
    if (!created) throw new Error('Holiday vanished immediately after insert.');
    return created;
  });
}

export async function saveHolidayTx(
  client: PoolClient,
  holiday: Holiday,
): Promise<void> {
  const { id, ownerId, members, ...data } = holiday;
  void members;

  await client.query(
    `UPDATE holidays
        SET data = $2, status = $3, owner_id = $4, updated_at = now()
      WHERE id = $1`,
    [id, JSON.stringify(data), holiday.status, ownerId],
  );
}

export async function deleteHoliday(holidayId: string): Promise<void> {
  // holiday_members rows go with it via ON DELETE CASCADE.
  await query(`DELETE FROM holidays WHERE id = $1`, [holidayId]);
}

/* ------------------------------------------------------------------ *
 * Members
 * ------------------------------------------------------------------ */

export async function addMemberTx(
  client: PoolClient,
  holidayId: string,
  input: {
    email: string;
    name: string;
    role: MemberRole;
    userId: string | null;
    memberCount: number;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO holiday_members
       (id, holiday_id, user_id, email, invited_name, role, permissions,
        notifications, avatar_color)
     VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7, $8)`,
    [
      createId('mem'),
      holidayId,
      input.userId,
      input.email,
      input.name,
      input.role,
      JSON.stringify(DEFAULT_NOTIFICATIONS),
      AVATAR_COLORS[input.memberCount % AVATAR_COLORS.length],
    ],
  );
}

export async function updateMemberTx(
  client: PoolClient,
  memberId: string,
  patch: { role?: MemberRole; permissions?: string[] },
): Promise<void> {
  await client.query(
    `UPDATE holiday_members
        SET role        = COALESCE($2, role),
            permissions = COALESCE($3::jsonb, permissions)
      WHERE id = $1`,
    [
      memberId,
      patch.role ?? null,
      patch.permissions ? JSON.stringify(patch.permissions) : null,
    ],
  );
}

export async function removeMemberTx(
  client: PoolClient,
  memberId: string,
): Promise<void> {
  await client.query(`DELETE FROM holiday_members WHERE id = $1`, [memberId]);
}

export async function setMemberNotificationsTx(
  client: PoolClient,
  memberId: string,
  notifications: unknown,
): Promise<void> {
  await client.query(
    `UPDATE holiday_members SET notifications = $2::jsonb WHERE id = $1`,
    [memberId, JSON.stringify(notifications)],
  );
}

export async function transferOwnershipTx(
  client: PoolClient,
  holidayId: string,
  fromUserId: string,
  toMemberId: string,
  toUserId: string,
): Promise<void> {
  await client.query(
    `UPDATE holiday_members SET role = 'organiser'
      WHERE holiday_id = $1 AND user_id = $2`,
    [holidayId, fromUserId],
  );
  await client.query(
    `UPDATE holiday_members SET role = 'owner', permissions = '[]'::jsonb
      WHERE id = $1`,
    [toMemberId],
  );
  await client.query(`UPDATE holidays SET owner_id = $2 WHERE id = $1`, [
    holidayId,
    toUserId,
  ]);
}
