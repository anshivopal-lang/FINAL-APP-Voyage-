import { NextResponse } from 'next/server';

import { transaction } from '@/lib/server/db';
import {
  authoriseHoliday,
  conflict,
  requireUser,
  route,
  serialiseForViewer,
} from '@/lib/server/guard';
import {
  addMemberTx,
  findUserByEmail,
  getHolidayForUserTx,
} from '@/lib/server/repository';
import { addMemberSchema, parse, readJson } from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Invite by email. If that email already has an account the membership is
 * bound to their user id immediately; otherwise it stays pending and is
 * claimed the first time they sign in with Google.
 */
export const POST = route(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const input = parse(addMemberSchema, await readJson(request));

  const holiday = await transaction(async (client) => {
    const target = await authoriseHoliday(client, id, user, 'members.manage');

    if (
      target.members.some(
        (member) => member.email.toLowerCase() === input.email,
      )
    ) {
      throw conflict('That person is already on this holiday.');
    }

    const existing = await findUserByEmail(input.email);

    await addMemberTx(client, id, {
      email: input.email,
      name: input.name ?? existing?.name ?? input.email.split('@')[0],
      role: input.role,
      userId: existing?.id ?? null,
      memberCount: target.members.length,
    });

    return getHolidayForUserTx(client, id, user.id);
  });

  return NextResponse.json(
    { holiday: serialiseForViewer(holiday!, user.id) },
    { status: 201 },
  );
});
