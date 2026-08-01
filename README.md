# Voyager — Holiday Management System

A private, multi-user platform for planning, sharing and archiving holidays.
Next.js (App Router), TypeScript, Tailwind CSS v4, Auth.js v5 with email +
password credentials, and Postgres.

## Security model

Identity comes from one place only: the signed session cookie. There is no way
to select, spoof or switch accounts from the UI.

- **Email + password via Auth.js v5 CredentialsProvider.** Sessions are
  stateless JWTs in an httpOnly, SameSite=Lax cookie. No token is ever readable
  from client JavaScript.
- **Passwords are hashed with bcrypt** (cost 12 by default) and never logged,
  returned by an API, or stored in plain text.
- **Sign-in never reveals whether an email is registered.** A wrong password
  and an unknown address produce the same message, and a dummy bcrypt
  comparison runs when no account matches so the two take the same time.
- **Credential endpoints are rate limited** — per IP and per target email on
  sign-in, per IP on sign-up.
- **Ownership keys on the account id**, never on an email or a membership id —
  both of which can be re-pointed at a different person.
- **Every API route re-checks the session server-side.** The client's own
  permission checks decide only what to *render*; they are never trusted.
- **Reads are scoped by a membership join**, so "list holidays" cannot return
  someone else's row even if the filter were forgotten downstream.
- **Unauthorised access returns 404, not 403**, so holiday ids cannot be probed
  for existence.
- **Confidential documents are filtered out server-side** — a member without
  `documents.manage` never receives them in the payload at all.
- **Chat authorship comes from the session**, never the request body.
- **Owner-only permissions** (`holiday.archive`, `holiday.delete`) are stripped
  from any member update rather than rejected, so a client posting the whole
  permission grid cannot escalate by accident.

Run the proofs:

```bash
node --env-file=.env.local tests/credentials-auth.mjs   # 32 checks
node --env-file=.env.local tests/data-isolation.mjs     # 47 checks
```

The isolation suite covers covering: unauthenticated access, forged and wrong-secret cookies,
cross-account reads and writes across twelve endpoints, sharing, privilege
escalation, confidential-document leakage, authorship spoofing, and immediate
revocation on member removal.

## Roles

| Role | What it grants |
| --- | --- |
| Owner | Everything, including archive, restore and permanent deletion. |
| Organiser | Plans the trip and manages members. Cannot archive or delete. |
| Traveller | Itinerary, expenses, photos and chat. |
| Viewer | Read-only. |

Extra permissions can be granted individually on top of a role. Trips are
private to their owner until someone is invited by email — if that person has
no account yet the membership stays pending and is claimed automatically the
first time they register with that address.

## Local setup

1. **Postgres.** Any instance will do:

   ```bash
   createdb voyager_dev
   ```

2. **Environment.** Copy `.env.example` to `.env.local` and fill it in.
   Generate the secret with `openssl rand -base64 32`.

4. **Run.**

   ```bash
   npm install
   npm run dev
   ```

The schema is created automatically on first request. `GET /api/health`
reports whether the process can reach Postgres.

## Deploying to Vercel

1. Push to GitHub and import the repository in Vercel.
2. Add a Postgres database — Vercel Postgres, Neon and Supabase all work.
   Set `DATABASE_URL` to its pooled connection string.
3. Set these environment variables for **Production, Preview and Development**:

   | Variable | Notes |
   | --- | --- |
   | `BCRYPT_ROUNDS` | Optional. Defaults to 12 |
   | `AUTH_SECRET` | `openssl rand -base64 32`. Changing it signs everyone out |
   | `NEXTAUTH_SECRET` | Same value — set both so either convention works |
   | `DATABASE_URL` | Pooled Postgres connection string |

   `NEXTAUTH_URL` is **not** required on Vercel: the deployment URL is detected
   automatically and `trustHost` is enabled. Set it only for a custom domain.

No secret is exposed to the browser: nothing is prefixed with `NEXT_PUBLIC_`,
and password hashing, session verification and every database query run
server-side. There is no OAuth provider to configure and no third-party
redirect URI to keep in sync.

## Architecture

```
src/
  auth.ts                     Auth.js config — credentials provider, JWT sessions
  app/
    (app)/                    Authenticated pages; layout redirects to /signin
    signin/                   Public sign-in page
    signup/                   Public registration page
    api/auth/register/        Account creation (bcrypt hashing, validation)
    api/holidays/…            REST API; every route calls requireUser()
    api/health/               Liveness probe
  lib/
    permissions.ts            Roles and grants — shared by client and server
    store.tsx                 Client store; talks to the API, holds no identity
    server/
      db.ts                   Postgres pool, schema migration
      repository.ts           Data access — every read scoped by user
      guard.ts                requireUser, authoriseHoliday, error handling
      rate-limit.ts           In-memory throttle for credential endpoints
      validation.ts           Zod schemas for every request body
tests/
  credentials-auth.mjs        Registration + sign-in + sign-out flow
  data-isolation.mjs          Two-account isolation proof
```

Data lives in Postgres in three tables: `users`, `holidays` (trip document as
JSONB) and `holiday_members` (a real table, so "which holidays may this user
see" is an indexed join rather than a scan).

## Known gaps

- **No password reset.** A user who forgets their password cannot recover the
  account without a manual database update. Adding it needs an email sender,
  which this app does not currently have.
- **No email verification.** Addresses are trusted as typed, so a holiday
  invitation could be claimed by someone who registers with an address they do
  not own.
- **The rate limiter is per-instance.** Serverless functions do not share
  memory, so it is a speed bump rather than a guarantee. Move it to Vercel KV
  or Upstash Redis for a real throttle.
- **Accounts created under the old Google flow have no password** and cannot
  sign in until one is set. The `google_id` column is kept, nullable, so that
  mapping is not lost.

## Note on `server/`

The standalone Express API in `server/` predates this work and is **superseded**.
It has a second, separate email/password implementation and a JSON-file store
that cannot persist on Vercel. It is not part of the Next.js
build and is not deployed, but it should be deleted rather than left as a second
way into the same data model.
