import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createUser } from '@/lib/server/repository';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Password policy: length is what actually matters. A long passphrase beats a
 * short one full of symbols, so the floor is 10 characters with no composition
 * rules, and the top end is capped because bcrypt silently ignores input past
 * 72 bytes.
 */
const registerSchema = z.object({
  name: z.string().trim().min(1, 'Tell us your name.').max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address.')),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(72, 'Use 72 characters or fewer.'),
});

export async function POST(request: Request) {
  // 30/hour rather than something tighter: shared office and mobile-carrier
  // NAT puts many legitimate users behind one address, and locking them out
  // is worse than the bulk sign-ups this is meant to slow down.
  const limit = rateLimit(clientKey(request, 'register'), 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Too many sign-up attempts. Try again later.',
        },
      },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'bad_json', message: 'Request body is not valid JSON.' } },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'bad_request',
          message: 'Some fields need attention.',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.') || '(body)',
            message: issue.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  try {
    const user = await createUser(parsed.data);

    if (!user) {
      // The email is taken. This does reveal that the address is registered —
      // unavoidable for a self-service sign-up form, since the user has to be
      // told why they cannot proceed. The sign-IN path stays non-revealing.
      return NextResponse.json(
        {
          error: {
            code: 'email_taken',
            message: 'An account with that email already exists. Sign in instead.',
          },
        },
        { status: 409 },
      );
    }

    // No session is issued here: the client signs in immediately afterwards so
    // there is exactly one place that mints sessions.
    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 },
    );
  } catch (error) {
    console.error('[voyager] registration failed', error);
    return NextResponse.json(
      {
        error: {
          code: 'internal_error',
          message: 'Could not create your account. Please try again.',
        },
      },
      { status: 500 },
    );
  }
}
