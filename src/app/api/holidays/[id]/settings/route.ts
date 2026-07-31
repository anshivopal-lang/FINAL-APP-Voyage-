import { NextResponse } from 'next/server';

import { transaction } from '@/lib/server/db';
import {
  authoriseHoliday,
  badRequest,
  conflict,
  notFound,
  requireUser,
  route,
  serialiseForViewer,
} from '@/lib/server/guard';
import {
  getHolidayForUserTx,
  saveHolidayTx,
  setMemberNotificationsTx,
  transferOwnershipTx,
} from '@/lib/server/repository';
import {
  currencySchema,
  notificationsSchema,
  parse,
  readJson,
  transferSchema,
} from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Holiday-level settings that are not plain field edits: currency, the
 * caller's own notification preferences, and ownership transfer.
 */
export const POST = route(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const body = (await readJson(request)) as { action?: string };

  const holiday = await transaction(async (client) => {
    switch (body.action) {
      case 'notifications': {
        // Personal preferences: any member may set their own, and the write
        // targets their own membership row only.
        const target = await authoriseHoliday(
          client,
          id,
          user,
          'holiday.view',
          { rejectArchived: false },
        );

        const membership = target.members.find(
          (member) => member.userId === user.id,
        );
        if (!membership) throw notFound('You are not on this holiday.');

        const patch = parse(notificationsSchema, body);
        await setMemberNotificationsTx(client, membership.id, {
          ...membership.notifications,
          ...patch,
        });
        break;
      }

      case 'currencies': {
        const target = await authoriseHoliday(client, id, user, 'holiday.edit');
        const input = parse(currencySchema, body);

        await saveHolidayTx(client, {
          ...target,
          primaryCurrency: input.primaryCurrency,
          secondaryCurrencies: input.secondaryCurrencies.filter(
            (code) => code !== input.primaryCurrency,
          ),
          updatedAt: new Date().toISOString(),
        });
        break;
      }

      case 'transfer-ownership': {
        const target = await authoriseHoliday(client, id, user, null, {
          ownerOnly: true,
        });
        const { memberId } = parse(transferSchema, body);

        const member = target.members.find((item) => item.id === memberId);
        if (!member) throw notFound('That member is not on this holiday.');
        if (!member.userId) {
          throw conflict(
            'That person has not signed in yet, so they cannot own the holiday.',
          );
        }

        await transferOwnershipTx(
          client,
          id,
          user.id,
          member.id,
          member.userId,
        );
        break;
      }

      default:
        throw badRequest(
          'action must be notifications, currencies or transfer-ownership.',
        );
    }

    return getHolidayForUserTx(client, id, user.id);
  });

  return NextResponse.json({ holiday: serialiseForViewer(holiday!, user.id) });
});
