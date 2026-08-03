import 'server-only';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';

import { getHolidayForUserTx } from './repository';
import { can, isOwner } from '@/lib/permissions';
import { resolveUser, USER_COOKIE } from '@/lib/users';
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
export const unauthorised = (message = 'No user selected.') =>
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
 * The account the request is acting as.
 *
 * There is no authentication: this reads the selected account from a plain
 * cookie and maps it onto one of the four built-in users. `resolveUser` falls
 * back to the default for anything it does not recognise, so an absent,
 * unknown or hand-edited cookie can only ever produce a valid built-in id —
 * never an arbitrary string reaching the database.
 *
 * It is deliberately still the single place a user id enters the system, so
 * every route keeps its existing per-user scoping unchanged.
 */
export async function requireUser(): Promise<SessionUser> {
  const store = await cookies();
  const user = resolveUser(store.get(USER_COOKIE)?.value);

  return { id: user.id, email: user.email, name: user.name, image: null };
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
