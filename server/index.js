/**
 * Voyager API — holiday management backend.
 *
 * ES Modules ("type": "module"), matching the web app. Every route that touches
 * a holiday goes through `authorise()`, so the permission model is enforced
 * here rather than trusted from the client.
 *
 * Persistence is a JSON file behind the `store` module: serialised writes,
 * atomic rename, no external service to provision. Swapping it for Postgres
 * means reimplementing `store.read`/`store.write` and nothing else.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

const PORT = Number(process.env.PORT ?? 4000);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const DATA_FILE =
  process.env.DATA_FILE ?? path.join(__dirname, 'data', 'voyager.json');
const TOKEN_TTL = process.env.TOKEN_TTL ?? '7d';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

/**
 * A signing secret that only lives for one process lifetime is fine in
 * development but would silently invalidate every session on each deploy in
 * production — so refuse to boot instead.
 */
const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (IS_PRODUCTION) {
    console.error('JWT_SECRET must be set when NODE_ENV=production.');
    process.exit(1);
  }
  console.warn(
    '[voyager] JWT_SECRET is unset — using an ephemeral development secret. ' +
      'Tokens will be invalidated on restart.',
  );
  return crypto.randomBytes(32).toString('hex');
})();

const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/* ------------------------------------------------------------------ *
 * Domain constants — kept in step with src/lib/permissions.ts
 * ------------------------------------------------------------------ */

const PERMISSIONS = [
  'holiday.view',
  'holiday.edit',
  'members.manage',
  'itinerary.manage',
  'bookings.manage',
  'expenses.manage',
  'documents.manage',
  'photos.manage',
  'chat.post',
  'holiday.archive',
  'holiday.delete',
];

/** Reserved for the owner. Never grantable, never delegable. */
const OWNER_ONLY_PERMISSIONS = ['holiday.archive', 'holiday.delete'];

const ROLES = ['owner', 'organiser', 'traveller', 'viewer'];
const ASSIGNABLE_ROLES = ['organiser', 'traveller', 'viewer'];

const ROLE_PERMISSIONS = {
  owner: [...PERMISSIONS],
  organiser: [
    'holiday.view',
    'holiday.edit',
    'members.manage',
    'itinerary.manage',
    'bookings.manage',
    'expenses.manage',
    'documents.manage',
    'photos.manage',
    'chat.post',
  ],
  traveller: [
    'holiday.view',
    'itinerary.manage',
    'expenses.manage',
    'photos.manage',
    'chat.post',
  ],
  viewer: ['holiday.view'],
};

const COLLECTIONS = [
  'itinerary',
  'bookings',
  'expenses',
  'documents',
  'chat',
  'photos',
];

const DEFAULT_NOTIFICATIONS = {
  itineraryChanges: true,
  newExpenses: true,
  memberActivity: true,
  documentUploads: true,
  chatMessages: false,
  departureReminder: true,
  digest: 'instant',
};

const AVATAR_COLORS = [
  '#8b6f3f',
  '#3f6b8b',
  '#6b3f8b',
  '#3f8b6b',
  '#8b3f4f',
  '#4f4f8b',
  '#8b7a3f',
];

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) =>
  new ApiError(400, 'bad_request', message, details);
const unauthorised = (message = 'Authentication required.') =>
  new ApiError(401, 'unauthorised', message);
const forbidden = (message = 'You do not have permission to do that.') =>
  new ApiError(403, 'forbidden', message);
const notFound = (message = 'Not found.') =>
  new ApiError(404, 'not_found', message);
const conflict = (message) => new ApiError(409, 'conflict', message);

/* ------------------------------------------------------------------ *
 * Store — JSON file, serialised writes, atomic replace
 * ------------------------------------------------------------------ */

const store = (() => {
  const EMPTY = { version: 1, users: [], holidays: [] };

  let cache = null;
  /** Write queue. Every mutation chains onto this so writes never interleave. */
  let queue = Promise.resolve();

  async function read() {
    if (cache) return cache;

    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      cache = {
        version: parsed.version ?? 1,
        users: Array.isArray(parsed.users) ? parsed.users : [],
        holidays: Array.isArray(parsed.holidays) ? parsed.holidays : [],
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // A corrupt file is a real problem: fail loudly rather than silently
        // starting from empty and appearing to have lost everyone's data.
        if (error instanceof SyntaxError) {
          throw new Error(
            `Data file at ${DATA_FILE} is not valid JSON. Refusing to start.`,
          );
        }
        throw error;
      }
      cache = structuredClone(EMPTY);
    }

    return cache;
  }

  async function persist(state) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temporary = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(state, null, 2), 'utf8');
    // Rename is atomic on the same filesystem: readers never see a half file.
    await fs.rename(temporary, DATA_FILE);
  }

  /**
   * Runs `mutator` against the current state with exclusive access, persists
   * the result, and resolves with whatever the mutator returned.
   */
  function transaction(mutator) {
    const run = queue.then(async () => {
      const state = await read();
      const result = await mutator(state);
      await persist(state);
      return result;
    });

    // Keep the chain alive even when this transaction rejects.
    queue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  return { read, transaction };
})();

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const nowIso = () => new Date().toISOString();

const createId = (prefix) =>
  `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;

const normaliseEmail = (email) => email.trim().toLowerCase();

/** Never let a password hash leave the process. */
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt,
  };
}

function findUserByEmail(state, email) {
  const target = normaliseEmail(email);
  return state.users.find((user) => user.email === target);
}

function findUserById(state, id) {
  return state.users.find((user) => user.id === id);
}

function findHoliday(state, id) {
  return state.holidays.find((holiday) => holiday.id === id);
}

/** The membership record for a user on a holiday, if any. */
function findMembership(holiday, userId) {
  return holiday.members.find((member) => member.userId === userId);
}

/* ------------------------------------------------------------------ *
 * Permissions
 * ------------------------------------------------------------------ */

function isOwner(holiday, userId) {
  return holiday.ownerId === userId;
}

/**
 * Role defaults plus individual grants, with owner-only permissions stripped
 * from everyone who is not the owner.
 */
function effectivePermissions(holiday, membership) {
  if (!membership) return [];
  if (membership.userId && isOwner(holiday, membership.userId)) {
    return [...ROLE_PERMISSIONS.owner];
  }

  const granted = new Set([
    ...(ROLE_PERMISSIONS[membership.role] ?? []),
    ...(membership.permissions ?? []),
  ]);

  for (const ownerOnly of OWNER_ONLY_PERMISSIONS) granted.delete(ownerOnly);

  return PERMISSIONS.filter((permission) => granted.has(permission));
}

function can(holiday, userId, permission) {
  const membership = findMembership(holiday, userId);
  if (!membership) return false;
  return effectivePermissions(holiday, membership).includes(permission);
}

/**
 * Resolves the holiday for a request and checks one permission.
 *
 * A user who is not a member gets 404 rather than 403 — a stranger should not
 * be able to confirm that a given holiday id exists.
 */
function authorise(state, holidayId, userId, permission, options = {}) {
  const holiday = findHoliday(state, holidayId);
  if (!holiday) throw notFound('That holiday no longer exists.');

  if (!can(holiday, userId, 'holiday.view')) {
    throw notFound('That holiday no longer exists.');
  }

  if (options.ownerOnly && !isOwner(holiday, userId)) {
    throw forbidden('Only the holiday owner can do that.');
  }

  if (
    options.rejectArchived !== false &&
    holiday.status === 'archived' &&
    permission !== 'holiday.view'
  ) {
    throw conflict(
      'This holiday is archived and read-only. Restore it before making changes.',
    );
  }

  if (permission && !can(holiday, userId, permission)) {
    throw forbidden();
  }

  return holiday;
}

/* ------------------------------------------------------------------ *
 * Serialisation
 * ------------------------------------------------------------------ */

/**
 * Shapes a holiday for one specific viewer: hides confidential documents from
 * members without `documents.manage`, resolves their own notification
 * preferences, and reports what they are allowed to do.
 */
function serialiseHoliday(state, holiday, userId) {
  const membership = findMembership(holiday, userId);
  const permissions = effectivePermissions(holiday, membership);
  const owner = isOwner(holiday, userId);
  const canSeeConfidential = permissions.includes('documents.manage');

  const hiddenDocuments = canSeeConfidential
    ? 0
    : holiday.documents.filter((doc) => doc.confidential).length;

  return {
    ...holiday,
    members: holiday.members.map((member) => {
      const user = member.userId ? findUserById(state, member.userId) : null;
      return {
        id: member.id,
        userId: member.userId,
        name: user?.name ?? member.invitedName ?? member.email,
        email: member.email,
        role: member.role,
        permissions: member.permissions,
        effectivePermissions: effectivePermissions(holiday, member),
        avatarColor: user?.avatarColor ?? member.avatarColor,
        joinedAt: member.joinedAt,
        pending: !member.userId,
      };
    }),
    documents: canSeeConfidential
      ? holiday.documents
      : holiday.documents.filter((doc) => !doc.confidential),
    hiddenDocumentCount: hiddenDocuments,
    notifications: membership?.notifications ?? { ...DEFAULT_NOTIFICATIONS },
    viewer: {
      userId,
      membershipId: membership?.id ?? null,
      role: owner ? 'owner' : (membership?.role ?? null),
      isOwner: owner,
      permissions,
    },
  };
}

/** Lighter payload for list endpoints. */
function serialiseSummary(state, holiday, userId) {
  const full = serialiseHoliday(state, holiday, userId);
  return {
    id: full.id,
    name: full.name,
    country: full.country,
    cities: full.cities,
    startDate: full.startDate,
    endDate: full.endDate,
    primaryCurrency: full.primaryCurrency,
    secondaryCurrencies: full.secondaryCurrencies,
    coverImage: full.coverImage,
    description: full.description,
    status: full.status,
    archivedAt: full.archivedAt,
    restoreEnabled: full.restoreEnabled,
    ownerId: full.ownerId,
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
    members: full.members,
    counts: {
      itinerary: holiday.itinerary.length,
      bookings: holiday.bookings.length,
      expenses: holiday.expenses.length,
      documents: full.documents.length,
      chat: holiday.chat.length,
      photos: holiday.photos.length,
    },
    viewer: full.viewer,
  };
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

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

const travelLegSchema = z.object({
  date: isoDate.default(''),
  time: timeOfDay.default(''),
  location: z.string().max(200).default(''),
  reference: z.string().max(60).default(''),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email.')),
  password: z.string().min(10, 'Use at least 10 characters.').max(200),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

const createHolidaySchema = z.object({
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

const updateHolidaySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    country: z.string().trim().min(1).max(80),
    cities: z.array(z.string().trim().min(1).max(80)).max(40),
    startDate: isoDate,
    endDate: isoDate,
    departure: travelLegSchema,
    arrival: travelLegSchema,
    primaryCurrency: currencyCode,
    secondaryCurrencies: z.array(currencyCode).max(10),
    coverImage: z.string().trim().max(500),
    description: z.string().max(2000),
  })
  .partial();

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email.')),
  name: z.string().trim().max(80).optional(),
  role: z.enum(ASSIGNABLE_ROLES).default('traveller'),
});

const updateMemberSchema = z
  .object({
    role: z.enum(ASSIGNABLE_ROLES),
    permissions: z.array(z.enum(PERMISSIONS)),
  })
  .partial();

const notificationsSchema = z
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

const currencySchema = z.object({
  primaryCurrency: currencyCode,
  secondaryCurrencies: z.array(currencyCode).max(10).default([]),
});

const itinerarySchema = z.object({
  title: z.string().trim().min(1).max(160),
  date: isoDate.default(''),
  time: timeOfDay.default(''),
  city: z.string().trim().max(80).default(''),
  notes: z.string().max(1000).default(''),
});

const bookingSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: z
    .enum(['flight', 'hotel', 'transport', 'activity', 'other'])
    .default('other'),
  reference: z.string().trim().max(60).default(''),
  date: isoDate.default(''),
  amount: z.number().nonnegative().finite().default(0),
  currency: currencyCode,
});

const expenseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z
    .enum(['food', 'travel', 'stay', 'activity', 'shopping', 'other'])
    .default('other'),
  amount: z.number().positive('Enter an amount greater than zero.').finite(),
  currency: currencyCode,
  date: isoDate.default(''),
  paidByMemberId: z.string().min(1),
});

const documentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z
    .enum(['passport', 'visa', 'insurance', 'ticket', 'reservation', 'other'])
    .default('other'),
  sizeKb: z.number().nonnegative().finite().default(0),
  confidential: z.boolean().default(false),
  url: z.string().trim().max(1000).default(''),
});

const photoSchema = z.object({
  caption: z.string().trim().max(200).default(''),
  takenAt: z.string().datetime().optional(),
  gradient: z.string().trim().max(200).default(''),
  url: z.string().trim().max(1000).default(''),
});

const messageSchema = z.object({
  body: z.string().trim().min(1, 'Message is empty.').max(4000),
});

const purgeSchema = z.object({
  sections: z.array(z.enum(COLLECTIONS)).min(1, 'Pick at least one section.'),
});

const deleteHolidaySchema = z.object({
  confirmName: z.string(),
});

/** Parses `payload`, converting a Zod failure into a 400 with field details. */
function parse(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(body)',
      message: issue.message,
    }));
    throw badRequest('Some fields need attention.', details);
  }
  return result.data;
}

/* ------------------------------------------------------------------ *
 * Authentication
 * ------------------------------------------------------------------ */

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

/** Requires a valid bearer token and loads the user onto `req`. */
function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return next(unauthorised('Provide a bearer token.'));
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Your session has expired. Sign in again.'
        : 'That token is not valid.';
    return next(unauthorised(message));
  }

  store
    .read()
    .then((state) => {
      const user = findUserById(state, payload.sub);
      if (!user) return next(unauthorised('That account no longer exists.'));
      req.user = user;
      next();
    })
    .catch(next);
}

/**
 * Someone can be invited to a holiday before they have an account. When they
 * register, adopt every membership waiting on their email address.
 */
function linkPendingMemberships(state, user) {
  let linked = 0;

  for (const holiday of state.holidays) {
    for (const member of holiday.members) {
      if (!member.userId && member.email === user.email) {
        member.userId = user.id;
        member.joinedAt = nowIso();
        linked += 1;
      }
    }
  }

  return linked;
}

/* ------------------------------------------------------------------ *
 * Holiday factory
 * ------------------------------------------------------------------ */

function buildHoliday(input, owner) {
  const timestamp = nowIso();

  return {
    id: createId('hol'),
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

    ownerId: owner.id,
    members: [
      {
        id: createId('mem'),
        userId: owner.id,
        email: owner.email,
        invitedName: owner.name,
        role: 'owner',
        permissions: [],
        notifications: { ...DEFAULT_NOTIFICATIONS },
        avatarColor: owner.avatarColor,
        joinedAt: timestamp,
      },
    ],

    status: 'active',
    archivedAt: null,
    restoreEnabled: true,

    createdAt: timestamp,
    updatedAt: timestamp,

    itinerary: [],
    bookings: [],
    expenses: [],
    documents: [],
    chat: [],
    photos: [],
  };
}

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and non-browser clients send no Origin header.
      if (!origin || CORS_ORIGINS.includes(origin)) return callback(null, true);
      callback(new ApiError(403, 'cors_denied', 'Origin not allowed.'));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
if (NODE_ENV !== 'test') {
  app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));
}

/** Credential endpoints get a tighter budget than the rest of the API. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts. Try again later.' } },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Slow down a moment.' } },
});

const api = express.Router();
app.use('/api', apiLimiter, api);

/* -- Health ---------------------------------------------------------- */

app.get('/health', async (_req, res) => {
  const state = await store.read();
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    users: state.users.length,
    holidays: state.holidays.length,
  });
});

/* -- Auth ------------------------------------------------------------ */

api.post('/auth/register', authLimiter, async (req, res) => {
  const input = parse(registerSchema, req.body);

  const { user, linked } = await store.transaction(async (state) => {
    if (findUserByEmail(state, input.email)) {
      throw conflict('An account with that email already exists.');
    }

    const created = {
      id: createId('usr'),
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      avatarColor: AVATAR_COLORS[state.users.length % AVATAR_COLORS.length],
      createdAt: nowIso(),
    };

    state.users.push(created);
    const linkedCount = linkPendingMemberships(state, created);

    return { user: created, linked: linkedCount };
  });

  res.status(201).json({
    user: publicUser(user),
    token: signToken(user),
    linkedInvitations: linked,
  });
});

api.post('/auth/login', authLimiter, async (req, res) => {
  const input = parse(loginSchema, req.body);
  const state = await store.read();
  const user = findUserByEmail(state, input.email);

  // Compare against a dummy hash when the account is missing so that timing
  // does not reveal which emails are registered.
  const hash =
    user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const valid = await bcrypt.compare(input.password, hash);

  if (!user || !valid) {
    throw unauthorised('That email and password do not match.');
  }

  res.json({ user: publicUser(user), token: signToken(user) });
});

api.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

/* -- Holidays -------------------------------------------------------- */

api.get('/holidays', requireAuth, async (req, res) => {
  const state = await store.read();
  const status = req.query.status ?? 'active';

  if (!['active', 'archived', 'all'].includes(status)) {
    throw badRequest('status must be active, archived or all.');
  }

  const holidays = state.holidays
    .filter((holiday) => can(holiday, req.user.id, 'holiday.view'))
    .filter((holiday) => status === 'all' || holiday.status === status)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .map((holiday) => serialiseSummary(state, holiday, req.user.id));

  res.json({ holidays });
});

api.post('/holidays', requireAuth, async (req, res) => {
  const input = parse(createHolidaySchema, req.body);

  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw badRequest('The end date cannot be before the start date.');
  }

  const holiday = await store.transaction(async (state) => {
    const created = buildHoliday(input, req.user);
    state.holidays.push(created);
    return created;
  });

  const state = await store.read();
  res.status(201).json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.get('/holidays/:id', requireAuth, async (req, res) => {
  const state = await store.read();
  const holiday = authorise(state, req.params.id, req.user.id, 'holiday.view', {
    rejectArchived: false,
  });
  res.json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.patch('/holidays/:id', requireAuth, async (req, res) => {
  const patch = parse(updateHolidaySchema, req.body);

  const holiday = await store.transaction(async (state) => {
    const target = authorise(state, req.params.id, req.user.id, 'holiday.edit');

    const startDate = patch.startDate ?? target.startDate;
    const endDate = patch.endDate ?? target.endDate;
    if (startDate && endDate && endDate < startDate) {
      throw badRequest('The end date cannot be before the start date.');
    }

    Object.assign(target, patch);

    // A currency cannot be both primary and secondary.
    target.secondaryCurrencies = target.secondaryCurrencies.filter(
      (code) => code !== target.primaryCurrency,
    );
    target.updatedAt = nowIso();

    return target;
  });

  const state = await store.read();
  res.json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.post('/holidays/:id/duplicate', requireAuth, async (req, res) => {
  const holiday = await store.transaction(async (state) => {
    const source = authorise(state, req.params.id, req.user.id, 'holiday.view', {
      rejectArchived: false,
    });

    const timestamp = nowIso();
    const owner = req.user;

    // Planning detail carries over. Anything that actually happened on the
    // original trip does not.
    const copy = {
      ...structuredClone(source),
      id: createId('hol'),
      name: `${source.name} (copy)`,
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
      ownerId: owner.id,
      status: 'active',
      archivedAt: null,
      restoreEnabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      bookings: [],
      expenses: [],
      chat: [],
      photos: [],
    };

    copy.members = [
      {
        id: createId('mem'),
        userId: owner.id,
        email: owner.email,
        invitedName: owner.name,
        role: 'owner',
        permissions: [],
        notifications: { ...DEFAULT_NOTIFICATIONS },
        avatarColor: owner.avatarColor,
        joinedAt: timestamp,
      },
      ...source.members
        .filter((member) => member.userId !== owner.id)
        .map((member) => ({
          ...structuredClone(member),
          id: createId('mem'),
          role: member.role === 'owner' ? 'organiser' : member.role,
          joinedAt: timestamp,
        })),
    ];

    copy.itinerary = source.itinerary.map((item) => ({
      ...item,
      id: createId('itin'),
      date: '',
    }));

    // Confidential documents belong to the trip they were uploaded for.
    copy.documents = source.documents
      .filter((doc) => !doc.confidential)
      .map((doc) => ({ ...doc, id: createId('doc'), addedAt: timestamp }));

    state.holidays.push(copy);
    return copy;
  });

  const state = await store.read();
  res.status(201).json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.post('/holidays/:id/archive', requireAuth, async (req, res) => {
  const holiday = await store.transaction(async (state) => {
    const target = authorise(
      state,
      req.params.id,
      req.user.id,
      'holiday.archive',
      { ownerOnly: true, rejectArchived: false },
    );

    if (target.status === 'archived') {
      throw conflict('That holiday is already archived.');
    }

    target.status = 'archived';
    target.archivedAt = nowIso();
    target.updatedAt = nowIso();
    return target;
  });

  const state = await store.read();
  res.json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.post('/holidays/:id/restore', requireAuth, async (req, res) => {
  const holiday = await store.transaction(async (state) => {
    const target = authorise(
      state,
      req.params.id,
      req.user.id,
      'holiday.archive',
      { ownerOnly: true, rejectArchived: false },
    );

    if (target.status !== 'archived') {
      throw conflict('That holiday is not archived.');
    }
    if (!target.restoreEnabled) {
      throw forbidden('Restore is disabled for this holiday.');
    }

    target.status = 'active';
    target.archivedAt = null;
    target.updatedAt = nowIso();
    return target;
  });

  const state = await store.read();
  res.json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.patch('/holidays/:id/archive-settings', requireAuth, async (req, res) => {
  const { restoreEnabled } = parse(
    z.object({ restoreEnabled: z.boolean() }),
    req.body,
  );

  const holiday = await store.transaction(async (state) => {
    const target = authorise(
      state,
      req.params.id,
      req.user.id,
      'holiday.archive',
      { ownerOnly: true, rejectArchived: false },
    );

    target.restoreEnabled = restoreEnabled;
    target.updatedAt = nowIso();
    return target;
  });

  const state = await store.read();
  res.json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.delete('/holidays/:id', requireAuth, async (req, res) => {
  const { confirmName } = parse(deleteHolidaySchema, req.body ?? {});

  const removed = await store.transaction(async (state) => {
    const target = authorise(
      state,
      req.params.id,
      req.user.id,
      'holiday.delete',
      { ownerOnly: true, rejectArchived: false },
    );

    // Deliberate friction: the client shows what will be destroyed, and the
    // API refuses unless the caller echoes the name back.
    if (confirmName !== target.name) {
      throw badRequest(
        'confirmName must exactly match the holiday name to delete it.',
      );
    }

    const summary = {
      id: target.id,
      name: target.name,
      deleted: Object.fromEntries(
        COLLECTIONS.map((key) => [key, target[key].length]),
      ),
      members: target.members.length,
    };

    state.holidays = state.holidays.filter((holiday) => holiday.id !== target.id);
    return summary;
  });

  res.json({ deleted: removed });
});

api.post('/holidays/:id/purge', requireAuth, async (req, res) => {
  const { sections } = parse(purgeSchema, req.body);

  const holiday = await store.transaction(async (state) => {
    const target = authorise(state, req.params.id, req.user.id, null, {
      ownerOnly: true,
    });

    for (const section of sections) target[section] = [];
    target.updatedAt = nowIso();
    return target;
  });

  const state = await store.read();
  res.json({
    holiday: serialiseHoliday(state, holiday, req.user.id),
    purged: sections,
  });
});

/* -- Members --------------------------------------------------------- */

api.post('/holidays/:id/members', requireAuth, async (req, res) => {
  const input = parse(addMemberSchema, req.body);

  const holiday = await store.transaction(async (state) => {
    const target = authorise(
      state,
      req.params.id,
      req.user.id,
      'members.manage',
    );

    if (target.members.some((member) => member.email === input.email)) {
      throw conflict('That person is already on this holiday.');
    }

    const existing = findUserByEmail(state, input.email);

    target.members.push({
      id: createId('mem'),
      // Null until they register: the invitation waits for the account.
      userId: existing?.id ?? null,
      email: input.email,
      invitedName: input.name ?? existing?.name ?? input.email.split('@')[0],
      role: input.role,
      permissions: [],
      notifications: { ...DEFAULT_NOTIFICATIONS },
      avatarColor:
        existing?.avatarColor ??
        AVATAR_COLORS[target.members.length % AVATAR_COLORS.length],
      joinedAt: nowIso(),
    });

    target.updatedAt = nowIso();
    return target;
  });

  const state = await store.read();
  res
    .status(201)
    .json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.patch('/holidays/:id/members/:memberId', requireAuth, async (req, res) => {
  const patch = parse(updateMemberSchema, req.body);

  const holiday = await store.transaction(async (state) => {
    const target = authorise(
      state,
      req.params.id,
      req.user.id,
      'members.manage',
    );

    const member = target.members.find((item) => item.id === req.params.memberId);
    if (!member) throw notFound('That member is not on this holiday.');

    if (member.userId && isOwner(target, member.userId)) {
      throw forbidden(
        'The owner’s role and permissions cannot be changed. Transfer ownership instead.',
      );
    }

    if (patch.role) member.role = patch.role;

    if (patch.permissions) {
      // Owner-only permissions are stripped rather than rejected, so a client
      // that sends the full grid cannot escalate by accident.
      member.permissions = patch.permissions.filter(
        (permission) => !OWNER_ONLY_PERMISSIONS.includes(permission),
      );
    }

    // Anything the role already grants is redundant as an individual grant.
    member.permissions = member.permissions.filter(
      (permission) => !ROLE_PERMISSIONS[member.role].includes(permission),
    );

    target.updatedAt = nowIso();
    return target;
  });

  const state = await store.read();
  res.json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.delete('/holidays/:id/members/:memberId', requireAuth, async (req, res) => {
  const holiday = await store.transaction(async (state) => {
    const target = authorise(
      state,
      req.params.id,
      req.user.id,
      'members.manage',
    );

    const member = target.members.find((item) => item.id === req.params.memberId);
    if (!member) throw notFound('That member is not on this holiday.');

    if (member.userId && isOwner(target, member.userId)) {
      throw forbidden('The owner cannot be removed from their own holiday.');
    }

    target.members = target.members.filter((item) => item.id !== member.id);
    target.updatedAt = nowIso();
    return target;
  });

  const state = await store.read();
  res.json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

api.post('/holidays/:id/transfer-ownership', requireAuth, async (req, res) => {
  const { memberId } = parse(z.object({ memberId: z.string().min(1) }), req.body);

  const holiday = await store.transaction(async (state) => {
    const target = authorise(state, req.params.id, req.user.id, null, {
      ownerOnly: true,
    });

    const member = target.members.find((item) => item.id === memberId);
    if (!member) throw notFound('That member is not on this holiday.');
    if (!member.userId) {
      throw conflict(
        'That person has not accepted their invitation yet, so they cannot own the holiday.',
      );
    }

    const previousOwner = target.members.find(
      (item) => item.userId === target.ownerId,
    );
    if (previousOwner) previousOwner.role = 'organiser';

    member.role = 'owner';
    member.permissions = [];
    target.ownerId = member.userId;
    target.updatedAt = nowIso();

    return target;
  });

  const state = await store.read();
  res.json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

/* -- Per-member settings --------------------------------------------- */

api.patch('/holidays/:id/notifications', requireAuth, async (req, res) => {
  const patch = parse(notificationsSchema, req.body);

  const holiday = await store.transaction(async (state) => {
    // Notification preferences are personal, so they are readable-and-writable
    // by any member and never gated behind holiday.edit.
    const target = authorise(state, req.params.id, req.user.id, 'holiday.view', {
      rejectArchived: false,
    });

    const membership = findMembership(target, req.user.id);
    membership.notifications = { ...membership.notifications, ...patch };
    return target;
  });

  const state = await store.read();
  res.json({
    notifications: findMembership(holiday, req.user.id).notifications,
  });
});

api.patch('/holidays/:id/currencies', requireAuth, async (req, res) => {
  const input = parse(currencySchema, req.body);

  const holiday = await store.transaction(async (state) => {
    const target = authorise(state, req.params.id, req.user.id, 'holiday.edit');

    target.primaryCurrency = input.primaryCurrency;
    target.secondaryCurrencies = input.secondaryCurrencies.filter(
      (code) => code !== input.primaryCurrency,
    );
    target.updatedAt = nowIso();
    return target;
  });

  const state = await store.read();
  res.json({ holiday: serialiseHoliday(state, holiday, req.user.id) });
});

/* -- Collections ------------------------------------------------------ *
 * itinerary / bookings / expenses / documents / photos / chat all share the
 * same list-create-delete shape, so they are registered from one definition
 * rather than copied six times.
 * -------------------------------------------------------------------- */

const COLLECTION_ROUTES = [
  {
    path: 'itinerary',
    key: 'itinerary',
    idPrefix: 'itin',
    permission: 'itinerary.manage',
    schema: itinerarySchema,
    sort: (a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  },
  {
    path: 'bookings',
    key: 'bookings',
    idPrefix: 'bk',
    permission: 'bookings.manage',
    schema: bookingSchema,
    sort: (a, b) => (a.date ?? '').localeCompare(b.date ?? ''),
  },
  {
    path: 'expenses',
    key: 'expenses',
    idPrefix: 'exp',
    permission: 'expenses.manage',
    schema: expenseSchema,
    sort: (a, b) => (b.date ?? '').localeCompare(a.date ?? ''),
    validate(holiday, input) {
      const payer = holiday.members.find(
        (member) => member.id === input.paidByMemberId,
      );
      if (!payer) {
        throw badRequest('paidByMemberId must be a member of this holiday.');
      }
    },
  },
  {
    path: 'documents',
    key: 'documents',
    idPrefix: 'doc',
    permission: 'documents.manage',
    schema: documentSchema,
    decorate: () => ({ addedAt: nowIso() }),
    sort: (a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''),
  },
  {
    path: 'photos',
    key: 'photos',
    idPrefix: 'pho',
    permission: 'photos.manage',
    schema: photoSchema,
    decorate: (input) => ({ takenAt: input.takenAt ?? nowIso() }),
    sort: (a, b) => (b.takenAt ?? '').localeCompare(a.takenAt ?? ''),
  },
  {
    path: 'messages',
    key: 'chat',
    idPrefix: 'msg',
    permission: 'chat.post',
    schema: messageSchema,
    // Authorship is taken from the token, never from the request body.
    decorate: (_input, req, holiday) => ({
      memberId: findMembership(holiday, req.user.id).id,
      userId: req.user.id,
      sentAt: nowIso(),
    }),
    sort: (a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? ''),
    // Anyone may delete their own message; the owner may delete any.
    canDelete: (item, req, holiday) =>
      item.userId === req.user.id || isOwner(holiday, req.user.id),
  },
];

for (const route of COLLECTION_ROUTES) {
  const base = `/holidays/:id/${route.path}`;

  api.get(base, requireAuth, async (req, res) => {
    const state = await store.read();
    const holiday = authorise(state, req.params.id, req.user.id, 'holiday.view', {
      rejectArchived: false,
    });

    let items = [...holiday[route.key]];

    // Confidential documents stay hidden from members who cannot manage them.
    if (route.key === 'documents' && !can(holiday, req.user.id, 'documents.manage')) {
      items = items.filter((item) => !item.confidential);
    }

    res.json({ [route.key]: items.sort(route.sort) });
  });

  api.post(base, requireAuth, async (req, res) => {
    const input = parse(route.schema, req.body);

    const created = await store.transaction(async (state) => {
      const holiday = authorise(
        state,
        req.params.id,
        req.user.id,
        route.permission,
      );

      route.validate?.(holiday, input);

      const item = {
        id: createId(route.idPrefix),
        ...input,
        ...(route.decorate?.(input, req, holiday) ?? {}),
      };

      holiday[route.key].push(item);
      holiday[route.key].sort(route.sort);
      holiday.updatedAt = nowIso();

      return item;
    });

    res.status(201).json({ [route.path]: created });
  });

  api.patch(`${base}/:itemId`, requireAuth, async (req, res) => {
    const patch = parse(route.schema.partial(), req.body);

    const updated = await store.transaction(async (state) => {
      const holiday = authorise(
        state,
        req.params.id,
        req.user.id,
        route.permission,
      );

      const item = holiday[route.key].find(
        (entry) => entry.id === req.params.itemId,
      );
      if (!item) throw notFound('That item no longer exists.');

      if (route.canDelete && !route.canDelete(item, req, holiday)) {
        throw forbidden('You can only edit your own entries.');
      }

      route.validate?.(holiday, { ...item, ...patch });

      Object.assign(item, patch);
      holiday[route.key].sort(route.sort);
      holiday.updatedAt = nowIso();

      return item;
    });

    res.json({ [route.path]: updated });
  });

  api.delete(`${base}/:itemId`, requireAuth, async (req, res) => {
    await store.transaction(async (state) => {
      const holiday = authorise(
        state,
        req.params.id,
        req.user.id,
        route.permission,
      );

      const item = holiday[route.key].find(
        (entry) => entry.id === req.params.itemId,
      );
      if (!item) throw notFound('That item no longer exists.');

      if (route.canDelete && !route.canDelete(item, req, holiday)) {
        throw forbidden('You can only remove your own entries.');
      }

      holiday[route.key] = holiday[route.key].filter(
        (entry) => entry.id !== item.id,
      );
      holiday.updatedAt = nowIso();
    });

    res.status(204).end();
  });
}

/* -- Archive search --------------------------------------------------- */

api.get('/archive/search', requireAuth, async (req, res) => {
  const state = await store.read();
  const query = String(req.query.q ?? '').trim().toLowerCase();
  const country = req.query.country ? String(req.query.country) : null;
  const year = req.query.year ? String(req.query.year) : null;

  const matches = state.holidays
    .filter(
      (holiday) =>
        holiday.status === 'archived' &&
        can(holiday, req.user.id, 'holiday.view'),
    )
    .filter((holiday) => !country || holiday.country === country)
    .filter((holiday) => !year || holiday.endDate.startsWith(year))
    .filter((holiday) => {
      if (!query) return true;

      // Search reaches into the trip's contents, so old expenses, documents
      // and photos stay findable — confidential documents only for those who
      // are allowed to see them.
      const canSeeConfidential = can(holiday, req.user.id, 'documents.manage');
      const haystack = [
        holiday.name,
        holiday.country,
        holiday.description,
        ...holiday.cities,
        ...holiday.itinerary.map((item) => item.title),
        ...holiday.expenses.map((item) => item.title),
        ...holiday.photos.map((item) => item.caption),
        ...holiday.documents
          .filter((doc) => canSeeConfidential || !doc.confidential)
          .map((doc) => doc.name),
      ];

      return haystack.some((value) =>
        String(value ?? '').toLowerCase().includes(query),
      );
    })
    .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))
    .map((holiday) => serialiseSummary(state, holiday, req.user.id));

  res.json({ holidays: matches, total: matches.length });
});

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

api.use((req, _res, next) => {
  next(notFound(`No route for ${req.method} /api${req.path}`));
});

app.use((req, _res, next) => {
  next(notFound(`No route for ${req.method} ${req.path}`));
});

// Express 5 forwards rejected async handlers here automatically.
// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'bad_json', message: 'Request body is not valid JSON.' },
    });
  }

  console.error('[voyager] unhandled error', error);

  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on our side.',
      // Never leak internals to a production client.
      ...(IS_PRODUCTION ? {} : { detail: error?.message }),
    },
  });
});

/* ------------------------------------------------------------------ *
 * Bootstrap
 * ------------------------------------------------------------------ */

const server = app.listen(PORT, () => {
  console.log(`[voyager] API listening on http://localhost:${PORT} (${NODE_ENV})`);
  console.log(`[voyager] data file: ${DATA_FILE}`);
  console.log(`[voyager] cors origins: ${CORS_ORIGINS.join(', ')}`);
});

function shutdown(signal) {
  console.log(`\n[voyager] ${signal} received, closing server.`);
  server.close(() => process.exit(0));
  // Do not hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, server };
