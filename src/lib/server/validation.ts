import 'server-only';

import { z } from 'zod';

import { badRequest } from './guard';
import { PERMISSIONS } from '@/lib/permissions';

const permissionKeys = PERMISSIONS.map((permission) => permission.key) as [
  string,
  ...string[],
];

export const ASSIGNABLE_ROLES = ['organiser', 'traveller', 'viewer'] as const;

export const COLLECTIONS = [
  'itinerary',
  'bookings',
  'expenses',
  'documents',
  'chat',
  'photos',
] as const;

export type CollectionKey = (typeof COLLECTIONS)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
  .or(z.literal(''));

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a HH:MM time')
  .or(z.literal(''));

const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Expected a 3-letter currency code');

const travelLeg = z.object({
  date: isoDate.default(''),
  time: timeOfDay.default(''),
  location: z.string().max(200).default(''),
  reference: z.string().max(60).default(''),
});

export const createHolidaySchema = z.object({
  name: z.string().trim().min(1, 'The holiday needs a name.').max(120),
  country: z.string().trim().min(1).max(80),
  cities: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  startDate: isoDate.default(''),
  endDate: isoDate.default(''),
  primaryCurrency: currencyCode.default('GBP'),
  secondaryCurrencies: z.array(currencyCode).max(10).default([]),
  coverImage: z.string().trim().max(500).default('aurora'),
  description: z.string().max(2000).default(''),
});

export const updateHolidaySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    country: z.string().trim().min(1).max(80),
    cities: z.array(z.string().trim().min(1).max(80)).max(40),
    startDate: isoDate,
    endDate: isoDate,
    departure: travelLeg,
    arrival: travelLeg,
    primaryCurrency: currencyCode,
    secondaryCurrencies: z.array(currencyCode).max(10),
    coverImage: z.string().trim().max(500),
    description: z.string().max(2000),
  })
  .partial();

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email.')),
  name: z.string().trim().max(80).optional(),
  role: z.enum(ASSIGNABLE_ROLES).default('traveller'),
});

export const updateMemberSchema = z
  .object({
    role: z.enum(ASSIGNABLE_ROLES),
    permissions: z.array(z.enum(permissionKeys)),
  })
  .partial();

export const notificationsSchema = z
  .object({
    itineraryChanges: z.boolean(),
    newExpenses: z.boolean(),
    memberActivity: z.boolean(),
    documentUploads: z.boolean(),
    chatMessages: z.boolean(),
    departureReminder: z.boolean(),
    digest: z.enum(['instant', 'daily', 'weekly', 'off']),
  })
  .partial();

export const currencySchema = z.object({
  primaryCurrency: currencyCode,
  secondaryCurrencies: z.array(currencyCode).max(10).default([]),
});

export const purgeSchema = z.object({
  sections: z.array(z.enum(COLLECTIONS)).min(1, 'Pick at least one section.'),
});

export const deleteHolidaySchema = z.object({ confirmName: z.string() });

export const transferSchema = z.object({ memberId: z.string().min(1) });

export const archiveSettingsSchema = z.object({ restoreEnabled: z.boolean() });

/* -- Collections ------------------------------------------------------- */

export const COLLECTION_SCHEMAS = {
  itinerary: z.object({
    title: z.string().trim().min(1).max(160),
    date: isoDate.default(''),
    time: timeOfDay.default(''),
    city: z.string().trim().max(80).default(''),
    notes: z.string().max(1000).default(''),
  }),
  bookings: z.object({
    title: z.string().trim().min(1).max(160),
    type: z
      .enum(['flight', 'hotel', 'transport', 'activity', 'other'])
      .default('other'),
    reference: z.string().trim().max(60).default(''),
    date: isoDate.default(''),
    amount: z.number().nonnegative().finite().default(0),
    currency: currencyCode,
  }),
  expenses: z.object({
    title: z.string().trim().min(1).max(160),
    category: z
      .enum(['food', 'travel', 'stay', 'activity', 'shopping', 'other'])
      .default('other'),
    amount: z.number().positive('Enter an amount greater than zero.').finite(),
    currency: currencyCode,
    date: isoDate.default(''),
    paidByMemberId: z.string().min(1),
  }),
  documents: z.object({
    name: z.string().trim().min(1).max(200),
    type: z
      .enum(['passport', 'visa', 'insurance', 'ticket', 'reservation', 'other'])
      .default('other'),
    sizeKb: z.number().nonnegative().finite().default(0),
    confidential: z.boolean().default(false),
  }),
  photos: z.object({
    caption: z.string().trim().max(200).default(''),
    gradient: z.string().trim().max(200).default(''),
  }),
  chat: z.object({
    body: z.string().trim().min(1, 'Message is empty.').max(4000),
  }),
} as const;

export const COLLECTION_PERMISSIONS = {
  itinerary: 'itinerary.manage',
  bookings: 'bookings.manage',
  expenses: 'expenses.manage',
  documents: 'documents.manage',
  photos: 'photos.manage',
  chat: 'chat.post',
} as const;

export const COLLECTION_ID_PREFIX = {
  itinerary: 'itin',
  bookings: 'bk',
  expenses: 'exp',
  documents: 'doc',
  photos: 'pho',
  chat: 'msg',
} as const;

/** Parses a payload, turning a Zod failure into a 400 with field detail. */
export function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw badRequest(
      'Some fields need attention.',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(body)',
        message: issue.message,
      })),
    );
  }

  return result.data;
}

/** Reads and parses a JSON body, tolerating an absent one. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    throw badRequest('Request body is not valid JSON.');
  }
}
