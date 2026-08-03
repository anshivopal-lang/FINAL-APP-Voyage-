# Voyager — Holiday Management System

A platform for planning, sharing and archiving holidays. Next.js (App Router),
TypeScript, Tailwind CSS v4 and Postgres.

## No authentication

Authentication has been removed for now. The app opens straight onto the
dashboard with no sign-in, and acts as one of four built-in accounts:

| Name | Email |
| --- | --- |
| Aashish Opal | `aashishopal@gmail.com` |
| Neha Opal | `neha.opal29@gmail.com` |
| Anshiv Opal | `anshivopal@gmail.com` |
| Shivom Opal | `shivomopal@gmail.com` |

They are defined in `src/lib/users.ts` with fixed UUIDs and seeded by the schema
script, so a reseed or a fresh database keeps every holiday attached to the same
person. Switch between them from the header — the change is instant and does not
reload the page.

The addresses are identifiers, not mailboxes: they are what you invite by, and
what the members list shows. Nothing is ever sent to them — the app has no mail
transport, and with no sign-in there is no password to deliver. Changing one in
`src/lib/users.ts` also updates the seeded row and any existing membership bound
to that account on the next boot.

> **This app is open to anyone who can reach it.** The selected account lives in
> a plain cookie the browser can write, so it is a convenience, not a security
> boundary. If you deploy it anywhere public, turn on Vercel's Deployment
> Protection (Settings → Deployment Protection → Vercel Authentication) so the
> URL is not simply open to the internet.

## Data separation

Each account has completely separate holidays, itineraries, expenses, bookings,
documents, chats and settings. Nothing is shared unless one account explicitly
invites another to a trip.

That separation is enforced server-side and survived the removal of auth
unchanged — only the source of the user id changed, from a signed session to the
cookie:

- **Reads are scoped by a membership join**, so listing holidays cannot return
  another account's row.
- **Every API route resolves the account server-side** via `requireUser()`. The
  client's own permission checks decide only what to *render*.
- **An unknown or hand-edited cookie falls back to the default account** rather
  than reaching the database as an arbitrary value.
- **Reaching another account's holiday by id returns 404**, not 403.
- **Confidential documents are filtered out server-side.**
- **Chat authorship comes from the resolved account**, never the request body.

Run the proof:

```bash
node --env-file=.env.local tests/user-separation.mjs   # 49 checks
```

## Roles

Roles are per-holiday, not global. There is no admin or superuser.

| Role | What it grants |
| --- | --- |
| Owner | Everything, including archive, restore and permanent deletion. |
| Organiser | Plans the trip and manages members. Cannot archive or delete. |
| Traveller | Itinerary, expenses, photos and chat. |
| Viewer | Read-only. |

Extra permissions can be granted individually on top of a role. Trips are
private to their owner until another account is invited by email.

## Local setup

1. **Postgres.** Any instance will do:

   ```bash
   createdb voyager_dev
   ```

2. **Environment.** Copy `.env.example` to `.env.local` and set `DATABASE_URL`.
   There is no auth secret to generate.

3. **Run.**

   ```bash
   npm install
   npm run dev
   ```

The schema and the four accounts are created automatically on first request.
`GET /api/health` reports whether the process can reach Postgres.

## Deploying to Vercel

1. Push to GitHub and import the repository in Vercel.
2. Add a Postgres database — Vercel Postgres, Neon and Supabase all work.
   Set `DATABASE_URL` to its pooled connection string.
3. Set these environment variables for **Production, Preview and Development**:

   | Variable | Notes |
   | --- | --- |
   | `DATABASE_URL` | Pooled Postgres connection string |
   | `DATABASE_CA_CERT` | Only if the provider's certificate is not publicly trusted |

   There is no auth secret, no OAuth client and no redirect URI to keep in sync.

4. **Turn on Deployment Protection.** With no sign-in, the deployment is
   otherwise open to anyone with the URL.

## Architecture

```
src/
  app/
    (app)/                    All pages; layout resolves the selected account
    api/holidays/…            REST API; every route calls requireUser()
    api/health/               Liveness probe
  lib/
    users.ts                  The four built-in accounts and the cookie name
    permissions.ts            Roles and grants — shared by client and server
    store.tsx                 Client store; talks to the API, holds no identity
    server/
      db.ts                   Postgres pool, schema migration
      repository.ts           Data access — every read scoped by user
      guard.ts                requireUser (reads the cookie), authoriseHoliday
      ssl.ts                  TLS policy for the database connection
      validation.ts           Zod schemas for every request body
tests/
  user-separation.mjs         Four-account separation proof
```

Data lives in Postgres in three tables: `users`, `holidays` (trip document as
JSONB) and `holiday_members` (a real table, so "which holidays may this user
see" is an indexed join rather than a scan).

User identifiers are `uuid`, generated by Postgres via `gen_random_uuid()`
(built in from Postgres 13; no `pgcrypto` extension needed). `holidays.owner_id`
and `holiday_members.user_id` are the same type, so both foreign keys hold.
Holiday and item ids remain prefixed text (`hol_`, `mem_`, `itin_`).

## Known gaps

- **No authentication at all.** Anyone who can reach the app can select any of
  the four accounts. Use Vercel Deployment Protection if it is deployed
  anywhere reachable.
- **Only four accounts.** New ones cannot be created from the UI; add them to
  `src/lib/users.ts` and the seed block in `src/lib/server/db.ts`.
## Upgrading a database that predates UUID user ids

User ids used to be prefixed text (`usr_kX3n…`). Those values cannot be cast to
UUID, so the migration mints a new id for every user and remaps all three
references — `users.id`, `holidays.owner_id`, `holiday_members.user_id` — plus
the author ids embedded in chat messages inside `holidays.data`, which no
foreign key covers.

It runs automatically on the first request after deploy, only on a database
still carrying the text column, and the whole schema script is one transaction:
if any step fails the database is left on the old schema untouched.

Every catalogue lookup is qualified to `current_schema()`. This matters on
Supabase, which ships an `auth.users` table whose `id` is already `uuid`: an
unqualified `table_name = 'users'` matches both schemas and the guard then
fails with *"more than one row returned by a subquery used as an expression"*,
taking the whole schema script — and the app — down with it. If you see
`/api/health` reporting `database: unreachable` with that message in the logs,
you are on a build from before this was fixed.

This ran before authentication was removed. It is retained because a database
created under the older schema still needs it on first boot.

## Note on `server/`

The standalone Express API in `server/` predates this work and is **superseded**.
It has a second, separate email/password implementation and a JSON-file store
that cannot persist on Vercel. It is not part of the Next.js
build and is not deployed, but it should be deleted rather than left as a second
way into the same data model.
