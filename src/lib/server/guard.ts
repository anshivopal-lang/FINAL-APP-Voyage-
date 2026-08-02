import 'server-only';

import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';

import { getHolidayForUserTx } from './repository';
import { auth } from '@/auth';
import { can, isOwner } from '@/lib/permissions';
import type { Holiday, Permission } from '@/lib/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'bad_request', message, details);
export const unauthorised = (message = 'Sign in to continue.') =>
  new ApiError(401, 'unauthorised', message);
export const forbidden = (message = 'You do not have permission to do that.') =>
  new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') =>
  new ApiError(404, 'not_found', message);
export const conflict = (message: string) =>
  new ApiError(409, 'conflict', message);

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

/**
 * The only place a user id enters the system.
 *
 * It comes from the signed session cookie — never from a header, query
 * parameter or request body, so it cannot be forged by editing a request.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw unauthorised();
  }

  /**
   * Sessions issued before user ids became UUIDs carry a "usr_…" value. That
   * string reaches Postgres as a comparison against a uuid column and raises
   * `invalid input syntax for type uuid` — a 500 on every request rather than
   * a recoverable one. Rejecting it here turns a stale cookie into an ordinary
   * expired session: the user is sent back to sign in.
   */
  if (!UUID_PATTERN.test(session.user.id)) {
    throw unauthorised('Your session has expired. Please sign in again.');
  }

  return {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
    image: session.user.image ?? null,
  };
}

interface AuthoriseOptions {
  /** Reject anyone who is not the owner, whatever their permissions say. */
  ownerOnly?: boolean;
  /** Archived holidays are read-only unless this is explicitly false. */
  rejectArchived?: boolean;
}

/**
 * Loads a holiday for the signed-in user and checks one permission.
 *
 * `getHolidayForUserTx` joins on membership, so a holiday the user is not a
 * member of comes back null and we answer 404 — identical to a holiday that
 * does not exist. Someone probing ids learns nothing either way.
 */
export async function authoriseHoliday(
  client: PoolClient,
  holidayId: string,
  user: SessionUser,
  permission: Permission | null,
  options: AuthoriseOptions = {},
): Promise<Holiday> {
  const holiday = await getHolidayForUserTx(client, holidayId, user.id);

  if (!holiday) {
    throw notFound('That holiday no longer exists.');
  }

  if (options.ownerOnly && !isOwner(holiday, user.id)) {
    throw forbidden('Only the holiday owner can do that.');
  }

  if (
    options.rejectArchived !== false &&
    holiday.status === 'archived' &&
    permission !== 'holiday.view'
  ) {
    throw conflict(
      'This holiday is archived and read-only. Restore it before making changes.',
    );
  }

  if (permission && !can(holiday, user.id, permission)) {
    throw forbidden();
  }

  return holiday;
}

/**
 * Wraps a route handler so thrown ApiErrors become JSON responses and
 * everything else becomes a 500 without leaking internals.
 */
export function route<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>,
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.details ? { details: error.details } : {}),
            },
          },
          { status: error.status },
        );
      }

      console.error('[voyager] route error', error);

      return NextResponse.json(
        {
          error: {
            code: 'internal_error',
            message: 'Something went wrong on our side.',
          },
        },
        { status: 500 },
      );
    }
  };
}

/**
 * Strips anything the requesting user is not allowed to see, and attaches what
 * they are allowed to do. The client renders from this — it never receives
 * another member's confidential documents in the first place.
 */
export function serialiseForViewer(holiday: Holiday, userId: string): Holiday {
  const member = holiday.members.find((item) => item.userId === userId);
  const canSeeConfidential = can(holiday, userId, 'documents.manage');

  const documents = canSeeConfidential
    ? holiday.documents
    : holiday.documents.filter((doc) => !doc.confidential);

  return {
    ...holiday,
    documents,
    hiddenDocumentCount: holiday.documents.length - documents.length,
    // Notification preferences are per-member; surface only the caller's.
    notifications: member?.notifications ?? holiday.notifications,
    members: holiday.members.map((item) => ({
      ...item,
      // Nobody needs to see anyone else's notification preferences.
      notifications: undefined,
    })),
  };
}
