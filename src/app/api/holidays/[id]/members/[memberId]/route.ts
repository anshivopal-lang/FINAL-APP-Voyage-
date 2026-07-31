import { NextResponse } from 'next/server';

import { OWNER_ONLY_PERMISSIONS, ROLE_PERMISSIONS } from '@/lib/permissions';
import { transaction } from '@/lib/server/db';
import {
  authoriseHoliday,
  forbidden,
  notFound,
  requireUser,
  route,
  serialiseForViewer,
} from '@/lib/server/guard';
import {
  getHolidayForUserTx,
  removeMemberTx,
  updateMemberTx,
} from '@/lib/server/repository';
import { parse, readJson, updateMemberSchema } from '@/lib/server/validation';
import type { Permission } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; memberId: string }> };

export const PATCH = route(async (request: Request, context: Context) => {
  const user = await requireUser();
  const { id, memberId } = await context.params;
  const patch = parse(updateMemberSchema, await readJson(request));

  const holiday = await transaction(async (client) => {
    const target = await authoriseHoliday(client, id, user, 'members.manage');

    const member = target.members.find((item) => item.id === memberId);
    if (!member) throw notFound('That member is not on this holiday.');

    if (member.userId && member.userId === target.ownerId) {
      throw forbidden(
        'The owner’s role and permissions cannot be changed. Transfer ownership instead.',
      );
    }

    const role = patch.role ?? member.role;

    let permissions = (patch.permissions ??
      member.permissions) as Permission[];

    // Owner-only permissions are stripped rather than rejected, so a client
    // that posts the whole grid cannot escalate by accident.
    permissions = permissions.filter(
      (permission) => !OWNER_ONLY_PERMISSIONS.includes(permission),
    );
    // Anything the role already grants is redundant as an individual grant.
    permissions = permissions.filter(
      (permission) => !ROLE_PERMISSIONS[role].includes(permission),
    );

    await updateMemberTx(client, memberId, { role, permissions });
    return getHolidayForUserTx(client, id, user.id);
  });

  return NextResponse.json({ holiday: serialiseForViewer(holiday!, user.id) });
});

export const DELETE = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id, memberId } = await context.params;

  const holiday = await transaction(async (client) => {
    const target = await authoriseHoliday(client, id, user, 'members.manage');

    const member = target.members.find((item) => item.id === memberId);
    if (!member) throw notFound('That member is not on this holiday.');

    if (member.userId && member.userId === target.ownerId) {
      throw forbidden('The owner cannot be removed from their own holiday.');
    }

    await removeMemberTx(client, memberId);
    return getHolidayForUserTx(client, id, user.id);
  });

  return NextResponse.json({ holiday: serialiseForViewer(holiday!, user.id) });
});
