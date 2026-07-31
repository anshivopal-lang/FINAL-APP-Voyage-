import { NextResponse } from 'next/server';

import { transaction } from '@/lib/server/db';
import {
  authoriseHoliday,
  requireUser,
  route,
  serialiseForViewer,
} from '@/lib/server/guard';
import {
  addMemberTx,
  createId,
  getHolidayForUserTx,
  insertHoliday,
} from '@/lib/server/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export const POST = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  // Read under the same authorisation rules as any other access.
  const source = await transaction(async (client) =>
    authoriseHoliday(client, id, user, 'holiday.view', {
      rejectArchived: false,
    }),
  );

  const timestamp = new Date().toISOString();

  // Planning detail carries over; anything that actually happened on the
  // original trip does not — including confidential documents, which belong
  // to the trip they were uploaded for.
  const copy = await insertHoliday(user, {
    name: `${source.name} (copy)`,
    country: source.country,
    cities: [...source.cities],
    startDate: '',
    endDate: '',
    departure: {
      date: '',
      time: '',
      location: source.departure.location,
      reference: '',
    },
    arrival: {
      date: '',
      time: '',
      location: source.arrival.location,
      reference: '',
    },
    primaryCurrency: source.primaryCurrency,
    secondaryCurrencies: [...source.secondaryCurrencies],
    coverImage: source.coverImage,
    description: source.description,
    status: 'active',
    archivedAt: null,
    restoreEnabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    notifications: source.notifications,
    itinerary: source.itinerary.map((item) => ({
      ...item,
      id: createId('itin'),
      date: '',
    })),
    bookings: [],
    expenses: [],
    documents: source.documents
      .filter((doc) => !doc.confidential)
      .map((doc) => ({ ...doc, id: createId('doc'), addedAt: timestamp })),
    chat: [],
    photos: [],
  });

  // Carry the travelling party across, minus the duplicating user (already
  // the owner) and anyone whose invitation is still unclaimed.
  const withMembers = await transaction(async (client) => {
    let index = 1;

    for (const member of source.members) {
      if (member.userId === user.id) continue;

      await addMemberTx(client, copy.id, {
        email: member.email,
        name: member.name,
        role: member.role === 'owner' ? 'organiser' : member.role,
        userId: member.userId,
        memberCount: index,
      });
      index += 1;
    }

    return getHolidayForUserTx(client, copy.id, user.id);
  });

  return NextResponse.json(
    { holiday: serialiseForViewer(withMembers ?? copy, user.id) },
    { status: 201 },
  );
});
