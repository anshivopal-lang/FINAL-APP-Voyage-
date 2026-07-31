import { NextResponse } from 'next/server';

import { transaction } from '@/lib/server/db';
import {
  authoriseHoliday,
  badRequest,
  conflict,
  forbidden,
  requireUser,
  route,
  serialiseForViewer,
} from '@/lib/server/guard';
import { saveHolidayTx } from '@/lib/server/repository';
import {
  archiveSettingsSchema,
  parse,
  purgeSchema,
  readJson,
  type CollectionKey,
} from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Archive / restore / restore-toggle / purge, dispatched on an `action` field.
 *
 * All four are owner-only, so they share one guard rather than four
 * near-identical files that could drift apart.
 */
export const POST = route(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const body = (await readJson(request)) as { action?: string };

  const holiday = await transaction(async (client) => {
    const target = await authoriseHoliday(client, id, user, null, {
      ownerOnly: true,
      rejectArchived: false,
    });

    const now = new Date().toISOString();
    let next = { ...target, updatedAt: now };

    switch (body.action) {
      case 'archive': {
        if (target.status === 'archived') {
          throw conflict('That holiday is already archived.');
        }
        next = { ...next, status: 'archived', archivedAt: now };
        break;
      }

      case 'restore': {
        if (target.status !== 'archived') {
          throw conflict('That holiday is not archived.');
        }
        if (!target.restoreEnabled) {
          throw forbidden('Restore is disabled for this holiday.');
        }
        next = { ...next, status: 'active', archivedAt: null };
        break;
      }

      case 'set-restore-enabled': {
        const { restoreEnabled } = parse(archiveSettingsSchema, body);
        next = { ...next, restoreEnabled };
        break;
      }

      case 'purge': {
        const { sections } = parse(purgeSchema, body);
        for (const section of sections) {
          (next as Record<string, unknown>)[section as CollectionKey] = [];
        }
        break;
      }

      default:
        throw badRequest(
          'action must be archive, restore, set-restore-enabled or purge.',
        );
    }

    await saveHolidayTx(client, next);
    return next;
  });

  return NextResponse.json({ holiday: serialiseForViewer(holiday, user.id) });
});
