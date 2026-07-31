# Voyager — Holiday Management System

A private, premium-feeling platform for planning, sharing and archiving holidays.
Built with Next.js (App Router), React 19, TypeScript and Tailwind CSS v4.

## What it does

### Create holidays

- Unlimited holidays, created straight from the dashboard.
- Upcoming, in-progress and past trips are grouped automatically.
- **Duplicate** any holiday to reuse its planning details. The copy keeps the
  destination, cities, members, cover, currencies and the shape of the itinerary,
  and deliberately drops dates, bookings, expenses, chat, photos and confidential
  documents.

### Edit holidays

Everything on a holiday is editable from its settings page: name, country, one or
many cities, start and end dates, departure and arrival date/time/location/reference,
primary currency, secondary currencies, cover image, description, and members and
their permissions. Saving writes through the shared store, so every open view for
every authorised member updates immediately.

### Delete and archive

- **Archive** moves a finished trip out of the active list while keeping every
  itinerary item, booking, expense, document, message and photo.
- **Restore** brings it back, and can be switched off per holiday when a trip
  should stay permanently in the travel history.
- **Delete** is permanent, owner-only, and requires typing the holiday's exact name
  after being shown a precise count of what will be destroyed.
- **Data deletion** clears individual sections (itinerary, bookings, expenses,
  documents, chat, photos) without deleting the holiday itself.

### Holiday archive

Archived trips get their own page with search across trip names, cities, expenses,
documents, photos and itinerary titles, plus country and year filters. Expanding a
trip shows the full record: what was spent, which documents were kept, the photo
album and who travelled. Archived holidays remain private to their members.

### Holiday settings

One page per holiday covering holiday details, members, permissions, notifications,
currency, documents, archive options and data deletion.

## Roles and permissions

| Role | What it grants |
| --- | --- |
| Owner | Everything, including archive, restore and permanent deletion. |
| Organiser | Plans the trip and manages members. Cannot archive or delete. |
| Traveller | Itinerary, expenses, photos and chat. |
| Viewer | Read-only. |

Extra permissions can be granted to an individual on top of their role from the
permission grid. `holiday.archive` and `holiday.delete` are owner-only and can never
be delegated — every mutation in `src/lib/store.tsx` runs through `can()` in
`src/lib/permissions.ts` before touching state.

Use the member switcher in the header to view the app as any member and see the
permission model applied.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run typecheck
```

Deploying to Vercel needs no extra configuration — Next.js is detected
automatically, `npm run build` is the build command and `.next` the output.

## Module system

This project uses **ES Modules**, declared by `"type": "module"` in `package.json`.
Config files use the `.mjs` extension with `export default` (`next.config.mjs`,
`postcss.config.mjs`) so Node and the Vercel build image resolve them unambiguously.
Do not convert this project to CommonJS: Next.js App Router source is ESM, and mixing
`require`/`module.exports` into it is what produces
`ReferenceError: module is not defined in ES module scope` on Vercel.

## Data

State lives in the browser (`localStorage`, key `voyager.state.v1`) behind the
repository-shaped API in `src/lib/store.tsx`, and is seeded with four example
holidays on first run. Open the app in two tabs to see changes propagate between
sessions. Swapping the store's persistence for a real database and API routes
requires no changes to the components or the permission layer.

Cross-currency totals use an indicative rate table for display only — not a live FX
feed, and not suitable for settlement.
