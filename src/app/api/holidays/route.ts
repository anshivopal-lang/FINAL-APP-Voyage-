import { NextResponse } from 'next/server';

import { DEFAULT_NOTIFICATIONS } from '@/lib/defaults';
import { badRequest, requireUser, route, serialiseForViewer } from '@/lib/server/guard';
import { insertHoliday, listHolidaysForUser } from '@/lib/server/repository';
import {
  createHolidaySchema,
  parse,
  readJson,
} from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Only the caller's own holidays — the query joins on their membership. */
export const GET = route(async (request: Request) => {
  const user = await requireUser();

  const status = new URL(request.url).searchParams.get('status') ?? 'all';
  if (!['active', 'archived', 'all'].includes(status)) {
    throw badRequest('status must be active, archived or all.');
  }

  const holidays = await listHolidaysForUser(
    user.id,
    status as 'active' | 'archived' | 'all',
  );

  return NextResponse.json({
    holidays: holidays.map((holiday) => serialiseForViewer(holiday, user.id)),
  });
});

export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const input = parse(createHolidaySchema, await readJson(request));

  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw badRequest('The end date cannot be before the start date.');
  }

  const timestamp = new Date().toISOString();

  const holiday = await insertHoliday(user, {
    name: input.name,
    country: input.country,
    cities: input.cities,
    startDate: input.startDate,
    endDate: input.endDate,
    departure: { date: input.startDate, time: '', location: '', reference: '' },
    arrival: { date: input.endDate, time: '', location: '', reference: '' },
    primaryCurrency: input.primaryCurrency,
    secondaryCurrencies: input.secondaryCurrencies.filter(
      (code) => code !== input.primaryCurrency,
    ),
    coverImage: input.coverImage,
    description: input.description,
    status: 'active',
    archivedAt: null,
    restoreEnabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    notifications: { ...DEFAULT_NOTIFICATIONS },
    itinerary: [],
    bookings: [],
    expenses: [],
    documents: [],
    chat: [],
    photos: [],
  });

  return NextResponse.json(
    { holiday: serialiseForViewer(holiday, user.id) },
    { status: 201 },
  );
});
