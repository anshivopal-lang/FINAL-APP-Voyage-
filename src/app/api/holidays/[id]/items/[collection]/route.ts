import { NextResponse } from 'next/server';

import { transaction } from '@/lib/server/db';
import {
  authoriseHoliday,
  badRequest,
  notFound,
  requireUser,
  route,
  serialiseForViewer,
} from '@/lib/server/guard';
import { createId, saveHolidayTx } from '@/lib/server/repository';
import {
  COLLECTION_ID_PREFIX,
  COLLECTION_PERMISSIONS,
  COLLECTION_SCHEMAS,
  COLLECTIONS,
  parse,
  readJson,
  type CollectionKey,
} from '@/lib/server/validation';
import type { Permission } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; collection: string }> };

function assertCollection(value: string): CollectionKey {
  if (!(COLLECTIONS as readonly string[]).includes(value)) {
    throw notFound(`Unknown collection "${value}".`);
  }
  return value as CollectionKey;
}

const SORTERS: Record<CollectionKey, (a: never, b: never) => number> = {
  itinerary: (a: { date: string; time: string }, b: { date: string; time: string }) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  bookings: (a: { date: string }, b: { date: string }) =>
    (a.date ?? '').localeCompare(b.date ?? ''),
  expenses: (a: { date: string }, b: { date: string }) =>
    (b.date ?? '').localeCompare(a.date ?? ''),
  documents: (a: { addedAt: string }, b: { addedAt: string }) =>
    (b.addedAt ?? '').localeCompare(a.addedAt ?? ''),
  photos: (a: { takenAt: string }, b: { takenAt: string }) =>
    (b.takenAt ?? '').localeCompare(a.takenAt ?? ''),
  chat: (a: { sentAt: string }, b: { sentAt: string }) =>
    (a.sentAt ?? '').localeCompare(b.sentAt ?? ''),
} as never;

export const POST = route(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id, collection } = await context.params;
  const key = assertCollection(collection);

  const payload = parse(
    COLLECTION_SCHEMAS[key] as never,
    await readJson(request),
  ) as Record<string, unknown>;

  const holiday = await transaction(async (client) => {
    const target = await authoriseHoliday(
      client,
      id,
      user,
      COLLECTION_PERMISSIONS[key] as Permission,
    );

    if (key === 'expenses') {
      const payer = target.members.find(
        (member) => member.id === payload.paidByMemberId,
      );
      if (!payer) {
        throw badRequest('paidByMemberId must be a member of this holiday.');
      }
    }

    const now = new Date().toISOString();
    const membership = target.members.find(
      (member) => member.userId === user.id,
    )!;

    const item = {
      id: createId(COLLECTION_ID_PREFIX[key]),
      ...payload,
      ...(key === 'documents' ? { addedAt: now } : {}),
      ...(key === 'photos' ? { takenAt: now } : {}),
      // Authorship comes from the session, never the request body.
      ...(key === 'chat'
        ? { memberId: membership.id, userId: user.id, sentAt: now }
        : {}),
    };

    const list = [...(target[key] as unknown[]), item];
    list.sort(SORTERS[key] as never);

    const next = { ...target, [key]: list, updatedAt: now };
    await saveHolidayTx(client, next);
    return next;
  });

  return NextResponse.json(
    { holiday: serialiseForViewer(holiday, user.id) },
    { status: 201 },
  );
});
