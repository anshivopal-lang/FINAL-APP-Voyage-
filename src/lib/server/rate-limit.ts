import 'server-only';

/**
 * In-memory fixed-window rate limiter for credential endpoints.
 *
 * Serverless instances do not share memory, so this is a speed bump against
 * casual brute force rather than a guarantee — an attacker spread across
 * enough cold starts gets more attempts than the nominal limit. For a real
 * throttle, move the counter to Redis (Upstash) or Vercel KV.
 */

interface Window {
  count: number;
  resetAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __voyagerRateLimit: Map<string, Window> | undefined;
}

function store(): Map<string, Window> {
  globalThis.__voyagerRateLimit ??= new Map();
  return globalThis.__voyagerRateLimit;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const buckets = store();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });

    // Opportunistic cleanup so the map cannot grow without bound.
    if (buckets.size > 5_000) {
      for (const [candidate, window] of buckets) {
        if (window.resetAt <= now) buckets.delete(candidate);
      }
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort client address, for keying the limiter. */
export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return `${prefix}:${ip}`;
}
