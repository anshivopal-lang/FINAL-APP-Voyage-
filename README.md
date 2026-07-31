# Voyager — Holiday Management System

A private, multi-user platform for planning, sharing and archiving holidays.
Next.js (App Router), TypeScript, Tailwind CSS v4, Auth.js v5 with Google
Sign-In, and Postgres.

## Security model

Identity comes from one place only: the signed session cookie. There is no way
to select, spoof or switch accounts from the UI.

- **Google OAuth via Auth.js v5.** Sessions are stateless JWTs in an httpOnly,
  SameSite=Lax cookie. No token is ever readable from client JavaScript.
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

Run the proof:

```bash
node --env-file=.env.local tests/data-isolation.mjs
```

47 checks covering: unauthenticated access, forged and wrong-secret cookies,
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
first time they sign in with Google.

## Local setup

1. **Postgres.** Any instance will do:

   ```bash
   createdb voyager_dev
   ```

2. **Google OAuth client.** Google Cloud Console → APIs & Services →
   Credentials → *Create OAuth client ID* → Web application.

   Authorised redirect URI (must match exactly):

   ```
   http://localhost:3000/api/auth/callback/google
   ```

3. **Environment.** Copy `.env.example` to `.env.local` and fill it in.
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
   | `GOOGLE_CLIENT_ID` | From the Google OAuth client |
   | `GOOGLE_CLIENT_SECRET` | Server-only; never prefix with `NEXT_PUBLIC_` |
   | `AUTH_SECRET` | `openssl rand -base64 32`. Changing it signs everyone out |
   | `NEXTAUTH_SECRET` | Same value — set both so either convention works |
   | `DATABASE_URL` | Pooled Postgres connection string |

   `NEXTAUTH_URL` is **not** required on Vercel: the deployment URL is detected
   automatically and `trustHost` is enabled. Set it only for a custom domain.

4. Add your production redirect URI to the Google OAuth client:

   ```
   https://your-domain.com/api/auth/callback/google
   ```

   Preview deployments get a new URL each time, so either add them explicitly
   or test OAuth on production only.

No secret is exposed to the browser: nothing is prefixed with `NEXT_PUBLIC_`,
and OAuth, session verification and every database query run server-side.

## Architecture

```
src/
  auth.ts                     Auth.js config — Google provider, JWT sessions
  app/
    (app)/                    Authenticated pages; layout redirects to /signin
    signin/                   Public sign-in page
    api/holidays/…            REST API; every route calls requireUser()
    api/health/               Liveness probe
  lib/
    permissions.ts            Roles and grants — shared by client and server
    store.tsx                 Client store; talks to the API, holds no identity
    server/
      db.ts                   Postgres pool, schema migration
      repository.ts           Data access — every read scoped by user
      guard.ts                requireUser, authoriseHoliday, error handling
      validation.ts           Zod schemas for every request body
tests/
  data-isolation.mjs          Two-account isolation proof
```

Data lives in Postgres in three tables: `users`, `holidays` (trip document as
JSONB) and `holiday_members` (a real table, so "which holidays may this user
see" is an indexed join rather than a scan).

## Note on `server/`

The standalone Express API in `server/` predates this work and is **superseded**.
It has its own email/password authentication that bypasses Google entirely, and
its JSON-file store cannot persist on Vercel. It is not part of the Next.js
build and is not deployed, but it should be deleted rather than left as a second
way into the same data model.
