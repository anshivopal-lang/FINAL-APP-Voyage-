import { NextResponse } from 'next/server';

import { query } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe. Unauthenticated on purpose so a platform health check can
 * reach it, and deliberately returns nothing about the data — just whether the
 * process can talk to Postgres. Touching the database here also applies the
 * schema migration on cold start.
 */
export async function GET() {
  try {
    await query('SELECT 1');
    return NextResponse.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('[voyager] health check failed', error);
    return NextResponse.json(
      { status: 'degraded', database: 'unreachable' },
      { status: 503 },
    );
  }
}
