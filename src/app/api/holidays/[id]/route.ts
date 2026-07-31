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
import { getHolidayForUser, saveHolidayTx } from '@/lib/server/repository';
import { deleteHoliday } from '@/lib/server/repository';
import {
  COLLECTIONS,
  deleteHolidaySchema,
  parse,
  readJson,
  updateHolidaySchema,
} from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const holiday = await getHolidayForUser(id, user.id);
  if (!holiday) throw notFound('That holiday no longer exists.');

  return NextResponse.json({ holiday: serialiseForViewer(holiday, user.id) });
});

export const PATCH = route(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const patch = parse(updateHolidaySchema, await readJson(request));

  const holiday = await transaction(async (client) => {
    const target = await authoriseHoliday(client, id, user, 'holiday.edit');

    const startDate = patch.startDate ?? target.startDate;
    const endDate = patch.endDate ?? target.endDate;
    if (startDate && endDate && endDate < startDate) {
      throw badRequest('The end date cannot be before the start date.');
    }

    const next = { ...target, ...patch, updatedAt: new Date().toISOString() };
    next.secondaryCurrencies = next.secondaryCurrencies.filter(
      (code) => code !== next.primaryCurrency,
    );

    await saveHolidayTx(client, next);
    return next;
  });

  return NextResponse.json({ holiday: serialiseForViewer(holiday, user.id) });
});

export const DELETE = route(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const { confirmName } = parse(deleteHolidaySchema, await readJson(request));

  const summary = await transaction(async (client) => {
    const target = await authoriseHoliday(client, id, user, 'holiday.delete', {
      ownerOnly: true,
      rejectArchived: false,
    });

    // Deliberate friction: the client lists what will be destroyed, and the
    // API refuses unless the caller echoes the exact name back.
    if (confirmName !== target.name) {
      throw badRequest(
        'confirmName must exactly match the holiday name to delete it.',
      );
    }

    return {
      id: target.id,
      name: target.name,
      deleted: Object.fromEntries(
        COLLECTIONS.map((key) => [key, (target[key] as unknown[]).length]),
      ),
      members: target.members.length,
    };
  });

  await deleteHoliday(id);

  return NextResponse.json({ deleted: summary });
});
