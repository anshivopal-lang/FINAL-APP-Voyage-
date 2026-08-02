import 'server-only';

import { readFileSync } from 'node:fs';

import type { ConnectionOptions } from 'node:tls';

/**
 * TLS settings for the Postgres connection.
 *
 * The point of this module is that verification is on unless someone
 * deliberately turns it off. Encryption without verification — `sslmode=require`,
 * or node-postgres' `rejectUnauthorized: false` — protects against passive
 * eavesdropping but not against an active attacker who can answer in the
 * database's place, because nothing checks that the certificate presented
 * actually belongs to the host named in the URL.
 *
 * A caller-supplied `ssl` object REPLACES anything `sslmode=` says in the
 * connection string; node-postgres does not merge the two. So the connection
 * string alone cannot secure this — it has to be decided here.
 */

/**
 * Removes `sslmode` (and its companion `uselibpqcompat`) from a connection
 * string. Everything about TLS is decided by `resolveSsl` below.
 *
 * Two reasons, and the second is the important one:
 *
 * 1. pg-connection-string emits a process warning whenever it parses
 *    `sslmode=prefer`, `require` or `verify-ca`, because pg currently treats
 *    all three as `verify-full` and will switch to weaker libpq semantics in
 *    pg v9. Stripping the parameter silences it at the source, so a stale
 *    DATABASE_URL cannot reintroduce it.
 *
 * 2. When `sslmode` is present, node-postgres drops the `ca` from an explicit
 *    `ssl` option. A provider whose certificate needs a custom root — Supabase,
 *    AWS RDS — then fails with "unable to verify the first certificate" even
 *    though DATABASE_CA_CERT was set correctly. Verified empirically: the same
 *    connection succeeds with the parameter removed and fails with it present.
 *
 * Nothing is lost by removing it, because the `ssl` object we pass is stricter
 * than any `sslmode` value.
 */
export function stripSslMode(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const before = url.search;

    url.searchParams.delete('sslmode');
    url.searchParams.delete('uselibpqcompat');

    return url.search === before ? connectionString : url.toString();
  } catch {
    // Not a parseable URL — resolveSsl reports that with a better message.
    return connectionString;
  }
}

export type SslDecision =
  | { ssl: false; mode: 'disabled'; reason: string }
  | { ssl: ConnectionOptions; mode: 'verify-full'; reason: string }
  | { ssl: ConnectionOptions; mode: 'no-verify'; reason: string };

function isLoopback(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.localhost')
  );
}

/** Reads a PEM from `DATABASE_CA_CERT`, either inline or as a file path. */
function readCaCertificate(): string | undefined {
  const value = process.env.DATABASE_CA_CERT?.trim();
  if (!value) return undefined;

  if (value.startsWith('-----BEGIN')) return value;

  try {
    return readFileSync(value, 'utf8');
  } catch (error) {
    throw new Error(
      `DATABASE_CA_CERT points at "${value}" but it could not be read: ` +
        `${(error as Error).message}. Give a readable path, or paste the ` +
        'PEM contents into the variable directly.',
    );
  }
}

/**
 * Decides how to connect, given the URL's host.
 *
 * - Loopback: no TLS. A local server usually has no certificate, and traffic
 *   never leaves the machine.
 * - Everything else: full verification (chain *and* hostname), which is what
 *   `sslmode=verify-full` means. Node does both once `rejectUnauthorized` is
 *   true and a trust anchor is available.
 * - `DATABASE_SSL_NO_VERIFY=true`: an explicit, logged escape hatch for a
 *   provider whose certificate cannot be verified.
 */
export function resolveSsl(connectionString: string): SslDecision {
  let host: string;

  try {
    host = new URL(connectionString).hostname;
  } catch {
    throw new Error(
      'DATABASE_URL is not a valid connection URL. Expected something like ' +
        'postgresql://user:password@host:5432/database',
    );
  }

  if (isLoopback(host)) {
    return {
      ssl: false,
      mode: 'disabled',
      reason: `${host} is loopback — traffic does not leave the machine`,
    };
  }

  if (process.env.DATABASE_SSL_NO_VERIFY === 'true') {
    return {
      ssl: { rejectUnauthorized: false },
      mode: 'no-verify',
      reason:
        'DATABASE_SSL_NO_VERIFY=true — encrypted but NOT authenticated, so a ' +
        'network attacker able to impersonate the database would not be detected',
    };
  }

  const ca = readCaCertificate();

  return {
    ssl: {
      rejectUnauthorized: true,
      // Node checks the certificate chain and the hostname once this is on.
      // `servername` is set explicitly so SNI and the identity check both use
      // the host from the URL rather than anything the socket infers.
      servername: host,
      ...(ca ? { ca } : {}),
    },
    mode: 'verify-full',
    reason: ca
      ? 'chain and hostname verified against DATABASE_CA_CERT'
      : "chain and hostname verified against Node's trusted roots",
  };
}
