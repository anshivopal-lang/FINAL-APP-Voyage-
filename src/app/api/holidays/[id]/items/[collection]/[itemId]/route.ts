import { NextResponse } from 'next/server';

import { isOwner } from '@/lib/permissions';
import { transaction } from '@/lib/server/db';
import {
  authoriseHoliday,
  forbidden,
  notFound,
  requireUser,
  route,
  serialiseForViewer,
} from '@/lib/server/guard';
import { saveHolidayTx } from '@/lib/server/repository';
import {
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

type Context = {
  params: Promise<{ id: string; collection: string; itemId: string }>;
};

function assertCollection(value: string): CollectionKey {
  if (!(COLLECTIONS as readonly string[]).includes(value)) {
    throw notFound(`Unknown collection "${value}".`);
  }
  return value as CollectionKey;
}

/** Chat is the one collection where authorship, not role, decides. */
function assertMayMutateItem(
  key: CollectionKey,
  item: Record<string, unknown>,
  userId: string,
  holiday: { ownerId: string },
) {
  if (key !== 'chat') return;
  if (item.userId === userId) return;
  if (isOwner(holiday as never, userId)) return;
  throw forbidden('You can only change your own messages.');
}

export const PATCH = route(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id, collection, itemId } = await context.params;
  const key = assertCollection(collection);

  const patch = parse(
    (COLLECTION_SCHEMAS[key] as never as { partial: () => never }).partial(),
    await readJson(request),
  ) as Record<string, unknown>;

  const holiday = await transaction(async (client) => {
    const target = await authoriseHoliday(
      client,
      id,
      user,
      COLLECTION_PERMISSIONS[key] as Permission,
    );

    const list = [...(target[key] as unknown as Record<string, unknown>[])];
    const index = list.findIndex((entry) => entry.id === itemId);
    if (index === -1) throw notFound('That item no longer exists.');

    assertMayMutateItem(key, list[index], user.id, target);

    list[index] = { ...list[index], ...patch };

    const next = {
      ...target,
      [key]: list,
      updatedAt: new Date().toISOString(),
    };
    await saveHolidayTx(client, next);
    return next;
  });

  return NextResponse.json({ holiday: serialiseForViewer(holiday, user.id) });
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id, collection, itemId } = await context.params;
  const key = assertCollection(collection);

  const holiday = await transaction(async (client) => {
    const target = await authoriseHoliday(
      client,
      id,
      user,
      COLLECTION_PERMISSIONS[key] as Permission,
    );

    const list = target[key] as unknown as Record<string, unknown>[];
    const item = list.find((entry) => entry.id === itemId);
    if (!item) throw notFound('That item no longer exists.');

    assertMayMutateItem(key, item, user.id, target);

    const next = {
      ...target,
      [key]: list.filter((entry) => entry.id !== itemId),
      updatedAt: new Date().toISOString(),
    };
    await saveHolidayTx(client, next);
    return next;
  });

  return NextResponse.json({ holiday: serialiseForViewer(holiday, user.id) });
});
