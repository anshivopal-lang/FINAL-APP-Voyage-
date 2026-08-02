# Voyager — Build Plan

Written for someone who has never coded before. No jargon without an explanation.

---

## 0. Where we are starting from

This repository is **not empty**. It already contains a partly-built version of
Voyager. Roughly:

- Sign up / sign in with email and password (working)
- A dashboard listing your holidays (working)
- Create / edit / delete a holiday (working)
- Members and permissions (working)
- Itinerary, bookings, expenses, documents, chat, photos exist as **screens
  only** — they draw on the page but the data is fake and nothing is stored
  properly
- An old, dead Express server in `server/` that should be deleted

The problem: it is built on a different stack than the one requested.

| Requested | Currently built |
| --- | --- |
| Supabase Database | Plain Postgres with hand-written SQL |
| Supabase Authentication | Auth.js (NextAuth) |
| Google Sign-In | Email + password only |
| File uploads for documents/photos | None — no storage exists |

**Recommendation: move to Supabase.** Reasons, in plain English:

1. **Security is enforced by the database itself.** Supabase has a feature
   called Row Level Security. You write the rule "you may only read a holiday
   you are a member of" *once*, inside the database. After that, it is
   impossible for any page, any button, or any mistake in our code to leak
   another person's data. In the current setup that rule is repeated by hand in
   every single API file — and one forgotten line means a leak.
2. **Google Sign-In is a checkbox.** You tick it in Supabase and paste two keys.
   Building it by hand is a day of fiddly work.
3. **File storage is included.** You asked to upload tickets, PDFs and photos.
   The current app has nowhere to put a file. Supabase Storage is free and
   included.
4. **Live chat is included.** Supabase Realtime pushes new messages to everyone
   instantly. Otherwise we would have to build that ourselves.
5. **It is all one free account** instead of stitching four services together.

What we keep: the entire look and feel. All the screens, components, colours,
the Tailwind styling, the currency list — those stay. We are replacing the
**engine**, not the **bodywork**. That is maybe 30% of the code, and it is the
30% that everything else depends on, so it must happen before Phase 2.

---

## 1. App structure — the pages

Think of the app as three zones.

### Zone A — Public (no account needed)

| Page | Address | What it does |
| --- | --- | --- |
| Landing page | `/` | Explains what Voyager is. Buttons: Sign up, Sign in. |
| Sign up | `/signup` | Create an account with email + password, or with Google. |
| Sign in | `/signin` | Log in with email + password, or with Google. |
| Auth callback | `/auth/callback` | Invisible. Google sends you here after you approve. It finishes the login and forwards you to the dashboard. |

### Zone B — Your personal area (account needed)

| Page | Address | What it does |
| --- | --- | --- |
| Dashboard | `/dashboard` | Welcome message, your upcoming trips, a big "New Holiday" button, count of pending invitations. |
| Profile | `/profile` | Your name, photo, username, notification preferences. |
| Invitations | `/invitations` | Trips other people invited you to. Accept or decline. |
| Notifications | `/notifications` | One list of everything that happened across all your trips. |
| Archive | `/archive` | Finished trips, tucked out of the way. |
| Translator | `/tools/translator` | Type a phrase, pick a language, get the translation. |
| Currency converter | `/tools/converter` | Convert between any two supported currencies at today's rate. |
| AI assistant | `/assistant` | Ask "what should I do in Tokyo for 3 days?" and get suggestions. |

### Zone C — Inside one holiday (account + membership needed)

Every address starts with `/holidays/[id]` where `[id]` is that specific trip.
All of these share one tab bar across the top, so moving between them feels
instant.

| Tab | Address | What it does |
| --- | --- | --- |
| Overview | `/holidays/[id]` | Trip name, dates, countdown, cities, who's coming, quick stats. |
| Itinerary | `/holidays/[id]/itinerary` | Day-by-day plan. Add, edit, delete, drag to reorder activities. |
| Bookings | `/holidays/[id]/bookings` | Flights, hotels, restaurants, attractions, transport, with confirmation numbers. |
| Documents | `/holidays/[id]/documents` | Upload and download tickets and PDFs. |
| Expenses | `/holidays/[id]/expenses` | Log spending in any currency, split it between people, see who owes whom. |
| Chat | `/holidays/[id]/chat` | Private group chat for this trip only. |
| Photos | `/holidays/[id]/photos` | Shared photo album. |
| Members | `/holidays/[id]/members` | Invite friends by email or username, set their role. |
| Settings | `/holidays/[id]/settings` | Edit trip details, currencies, archive, delete. |

### How people move around

```
Landing → Sign up/in → Dashboard
                          │
                          ├─ New Holiday → (form) → that holiday's Overview
                          ├─ click a trip card → that holiday's Overview
                          │                          │
                          │                          └─ tab bar → any of the 9 tabs
                          ├─ Invitations → Accept → that holiday's Overview
                          ├─ Profile
                          └─ Tools / AI assistant
```

The rule: **the dashboard is home.** From anywhere, the logo takes you back
there. Inside a holiday you never lose the tab bar. On a phone the tab bar
becomes a scrollable strip and the main navigation becomes a bottom bar —
that's the "mobile-first" part.

---

## 2. Database design

A database is a set of **tables**. A table is like one sheet in Excel: columns
are the kinds of information, rows are the actual entries. Tables are linked by
storing one row's ID inside another row.

### What has to be stored

People, trips, who is on which trip, invitations that haven't been accepted
yet, activities, bookings, files, spending, who owes whom, repayments,
messages, photos, and alerts.

### The tables

**1. `profiles`** — one row per person.
Supabase already keeps a hidden, protected table of accounts (`auth.users`)
holding the email and password. We never touch that. `profiles` sits alongside
it for the things *we* care about.

| Column | Meaning |
| --- | --- |
| `id` | Same ID as the Supabase account. This is the link. |
| `username` | Unique handle, so friends can be invited by name not just email. |
| `full_name`, `avatar_url` | Display name and photo. |
| `created_at` | When they joined. |

**2. `holidays`** — one row per trip.

| Column | Meaning |
| --- | --- |
| `id` | Unique trip ID. |
| `owner_id` | The `profiles.id` of whoever created it. |
| `name`, `country`, `description`, `cover_image` | Basics. |
| `cities` | A list, e.g. `["Tokyo","Kyoto"]`. |
| `start_date`, `end_date` | Dates. |
| `departure_time`, `arrival_time` | Times. |
| `primary_currency` | e.g. `GBP`. Everything is totalled in this. |
| `secondary_currencies` | A list, e.g. `["JPY","USD"]`. |
| `status` | `active` or `archived`. |

**3. `holiday_members`** — the join table. This is the most important table in
the whole app. One row = "this person is on this trip".

| Column | Meaning |
| --- | --- |
| `holiday_id` | Which trip. |
| `user_id` | Which person. |
| `role` | `owner`, `organiser`, `traveller` or `viewer`. |
| `joined_at` | When they accepted. |

**Every single security rule in the app boils down to one question: is there a
row in this table with your ID and this trip's ID?** If yes, you're in. If no,
the trip does not exist as far as you're concerned.

**4. `holiday_invitations`** — invites not yet accepted.

| Column | Meaning |
| --- | --- |
| `holiday_id`, `invited_by` | Which trip, who sent it. |
| `email` or `username` | Who it's for. They may not have an account yet. |
| `status` | `pending`, `accepted`, `declined`. |
| `token` | A long random string used in the invite link. |

Kept separate from `holiday_members` on purpose. An invitation is *not*
access — you get access only when a `holiday_members` row is created on accept.

**5. `itinerary_items`** — activities.
`holiday_id`, `day_date`, `start_time`, `title`, `city`, `notes`,
`sort_order` (a number used for drag-to-reorder), `created_by`.

**6. `bookings`**
`holiday_id`, `type` (`flight`/`hotel`/`attraction`/`restaurant`/`transport`),
`title`, `confirmation_number`, `start_at`, `end_at`, `location`, `cost`,
`currency`, `notes`, `created_by`.

**7. `documents`**
The *file itself* goes to Supabase Storage (a private folder per trip). This
table stores only the label: `holiday_id`, `file_name`, `storage_path`,
`file_size`, `mime_type`, `category`, `uploaded_by`.

**8. `expenses`**
`holiday_id`, `title`, `category`, `amount`, `currency`, `amount_in_primary`
(converted at the time of entry and saved, so history never changes when rates
move), `exchange_rate_used`, `spent_on`, `paid_by`, `notes`.

**9. `expense_splits`** — the Splitwise part.
One row per person per expense: `expense_id`, `user_id`, `share_amount`.
Dinner costing £90 split three ways = one `expenses` row + three
`expense_splits` rows of £30. "Who owes whom" is then just arithmetic over
these two tables.

**10. `settlements`** — repayments.
`holiday_id`, `from_user`, `to_user`, `amount`, `currency`, `settled_on`.
Records "Sam paid Alex back £30", so the balances go to zero.

**11. `messages`** — chat.
`holiday_id`, `sender_id`, `body`, `created_at`.

**12. `photos`**
Like documents: file in Storage, row here with `holiday_id`, `storage_path`,
`caption`, `taken_at`, `uploaded_by`.

**13. `notifications`**
`user_id` (who to tell), `holiday_id`, `type`, `title`, `body`, `link`,
`read_at`.

**Not a table: the currency list.** All 42 currencies with their symbols and
names live in a normal code file. They never change, so a database table would
be pointless work.

### How it all connects

```
              auth.users  (Supabase's own, protected)
                   │ 1:1
               profiles
                   │
     ┌─────────────┼──────────────┐
     │ owns        │ is member of │ is told about
 holidays ────< holiday_members   notifications
     │
     ├──< holiday_invitations
     ├──< itinerary_items
     ├──< bookings
     ├──< documents ──────→ Supabase Storage bucket
     ├──< photos ─────────→ Supabase Storage bucket
     ├──< messages
     ├──< settlements
     └──< expenses ──< expense_splits
```

`──<` means "one of these has many of those". One holiday has many expenses;
one expense has many splits.

---

## 3. Security plan

Four requirements were given. Here is how each is met.

### The core idea: Row Level Security (RLS)

Normally, security lives in the app code: "before showing this trip, check the
person is allowed." That works until someone forgets a check on one page out of
forty.

Supabase lets us push the rule **into the database**. Every table gets locked
by default — nothing is readable by anyone. Then we attach rules. The database
applies them to every query, forever, no matter which page asked. If our code
has a bug and asks for all holidays, the database still hands back only the
ones you're allowed to see.

This is why Supabase is the right choice here.

### One helper does the heavy lifting

We write a tiny database function once:

```
is_member(holiday_id) → true or false
```

It answers: "does a row exist in `holiday_members` with this trip and the
currently-logged-in person?"

Then nearly every rule in the app is one line:

- `holidays`: you may READ a row if `is_member(id)`
- `itinerary_items`, `bookings`, `documents`, `expenses`, `messages`,
  `photos`, `settlements`: READ/WRITE if `is_member(holiday_id)`
- `expense_splits`: `is_member` of the parent expense's holiday
- `profiles`: everyone may read name/username/photo (needed to show who's on a
  trip); only you may edit your own
- `notifications`: `user_id = you`. Nobody else, ever.

Destructive actions get a stricter rule: only `role = 'owner'` may delete a
holiday.

**Requirement 1 — each user has their own account.** Supabase Auth issues a
permanent, unique ID per account. Every row we create stamps that ID.
Crucially, the ID comes from the signed session cookie, never from anything the
browser sends us — so it cannot be faked by editing a form.

**Requirement 2 — users only see their own private data.** `notifications` and
`profiles` edits key directly on your ID. Nothing else can reach them.

**Requirement 3 — shared holidays only for invited members.** The
`holiday_members` row *is* the permission. Create it → instant access. Delete
it → instant loss of access, mid-session, no logout needed.

**Requirement 4 — no cross-user access to anything.** Because every child table
routes through `is_member`, there is no path in. Even if someone guesses a
trip's ID and types it into the address bar, the database returns nothing and
they see "not found".

### Files

Uploads go into a **private** Storage bucket, in a folder named after the trip
ID: `holiday-files/<holiday_id>/<filename>`. A storage rule checks
`is_member(<the folder name>)`. Downloads use short-lived signed links that
expire after a few minutes, so a copied link can't be passed around.

### Two traps we must avoid

1. **The infinite loop.** If the rule on `holiday_members` itself asks
   "am I a member?", the database has to read `holiday_members` to answer,
   which triggers the rule again, forever. This is the single most common
   Supabase mistake. Fix: mark `is_member` as `SECURITY DEFINER`, which lets it
   read the table without re-triggering rules.
2. **The wrong key.** Supabase gives two keys. The `anon` key is safe in the
   browser and obeys RLS. The `service_role` key **bypasses all security**. It
   must never appear in browser code — only in server-side files, and never
   committed to Git.

### Verifying, not assuming

The repo already has a 47-check data-isolation test suite. We rewrite it for
Supabase and run it after every phase. Two real accounts, and we try to break
in: read someone else's trip, write to it, escalate a role, download a
document, post a message as someone else. Every attempt must fail.

---

## 4. Technology plan

| Technology | What it is, in one sentence | Why we're using it |
| --- | --- | --- |
| **Next.js** | The framework that turns files into web pages. | A file called `dashboard/page.tsx` automatically becomes the `/dashboard` page. It runs code on the server too, so secret keys stay hidden. It's made by Vercel, so deploying is one click. |
| **TypeScript** | JavaScript that checks your work as you type. | If you write `holiday.nmae`, it underlines it in red before you ever run the app. For a beginner this is the single biggest source of caught mistakes. |
| **Tailwind CSS** | Styling by writing short words in the HTML. | `class="text-blue-600 rounded-xl p-4"` instead of a separate styling file. You see the design change as you type, and it makes mobile-friendly layouts easy. |
| **Supabase Database** | A Postgres database with a website to click around in. | Real, professional database. You can look at your data in a table view like Excel. Free tier: 500 MB, plenty. |
| **Supabase Auth** | Handles accounts, passwords, sessions. | Passwords are hashed and stored by them, not us — safer than rolling our own. Also gives password reset and email verification for free, which the current app is missing. |
| **Google Sign-In** | "Continue with Google". | One tick-box inside Supabase Auth. |
| **Supabase Storage** | A private folder in the cloud for files. | For tickets, PDFs and photos. Free tier: 1 GB. |
| **Supabase Realtime** | Pushes database changes to open browsers instantly. | Chat messages appear without refreshing. |
| **Vercel** | The company that puts your app on the internet. | Connect GitHub, and every save publishes automatically. Free for personal projects. |
| **Exchange rate API** | A free web service returning today's rates. | `open.er-api.com` — free, no signup, covers all 42 currencies. |
| **Translation API** | A free web service for phrases. | MyMemory — free, no signup, daily limit. |

### How the pieces fit together

```
   Your phone / laptop
          │
          ▼
   ┌──────────────┐
   │    Vercel    │   ← your Next.js app lives here
   │  (Next.js)   │
   └──────┬───────┘
          │  every request carries your login cookie
          ▼
   ┌──────────────────────────────┐
   │           Supabase           │
   │  Auth  →  who are you?       │
   │  RLS   →  what may you see?  │
   │  DB    →  your trip data     │
   │  Storage → your files        │
   │  Realtime → live chat        │
   └──────────────────────────────┘
          │
          ▼   (server-side only, keys hidden)
   Exchange rates · Translation · AI
```

You write code → push to GitHub → Vercel builds and publishes it → the live
app talks to Supabase → Supabase checks the rules before answering.

### Honest notes about "free"

Free and workable, no card needed: Next.js, TypeScript, Tailwind, Vercel,
Supabase (500 MB database, 1 GB files, 50k users), exchange rates, translation
(with a daily cap).

**Not free: the AI assistant (Phase 8).** Every serious AI provider charges per
use. Expect roughly £3–8/month for personal use. Three options:

1. Pay a few pounds a month and get proper AI. *(recommended)*
2. Build the screen, ship it with hand-written destination guides for popular
   cities, add real AI later. Zero cost.
3. Skip Phase 8 entirely.

One more: **Supabase pauses a free project after 7 days of no activity.** One
click un-pauses it. Fine while learning, worth knowing before showing it to
anyone.

---

## 5. Development roadmap

The order matters. Each step depends on the one before it. We do not move on
until the current step actually works.

### Part 1 — Foundations (nothing visible yet, but everything rests on it)

| Step | What happens | Roughly |
| --- | --- | --- |
| 1 | Create your Supabase account and project. Clicking only. | 15 min |
| 2 | Connect the app to Supabase. Install the library, add the keys. | 20 min |
| 3 | Create the `profiles`, `holidays` and `holiday_members` tables. | 30 min |
| 4 | Turn on RLS and write the `is_member` helper and first rules. | 45 min |

### Part 2 — Getting in *(your Phase 1)*

| Step | What happens | Roughly |
| --- | --- | --- |
| 5 | Sign up and sign in with email + password. | 45 min |
| 6 | Turn on Google Sign-In. | 30 min |
| 7 | Sign out, plus protecting pages so logged-out people bounce to sign-in. | 20 min |
| 8 | **Security test.** Two accounts. Prove one cannot see the other. | 30 min |

### Part 3 — The core app *(your Phases 2, 3, 4)*

| Step | What happens | Roughly |
| --- | --- | --- |
| 9 | Dashboard + profile page. | 1 hr |
| 10 | Create a holiday — the full form, all 42 currencies. | 1.5 hr |
| 11 | View, edit, delete holidays. | 1 hr |
| 12 | Invite by email/username; accept invitations; roles. | 2 hr |
| 13 | **Security test again.** Invited members in, everyone else out. | 30 min |

### Part 4 — Trip content *(your Phases 5, 6, 7)*

| Step | What happens | Roughly |
| --- | --- | --- |
| 14 | Itinerary: add, edit, delete, drag to reorder. | 2 hr |
| 15 | Bookings: all five types with confirmation numbers. | 1.5 hr |
| 16 | Documents: real file upload and private download. | 2 hr |

### Part 5 — Money *(your Phases 9, 10)*

| Step | What happens | Roughly |
| --- | --- | --- |
| 17 | Live exchange rates + the standalone converter tool. | 1 hr |
| 18 | Expense tracker with automatic conversion to primary currency. | 2 hr |
| 19 | Splitting, "who owes whom", and recording repayments. | 2.5 hr |

### Part 6 — Together *(your Phase 11)*

| Step | What happens | Roughly |
| --- | --- | --- |
| 20 | Group chat, live via Realtime. | 2 hr |
| 21 | Shared photo album. | 1.5 hr |
| 22 | Notifications. | 1.5 hr |

### Part 7 — Extras *(your Phases 8, 9)*

| Step | What happens | Roughly |
| --- | --- | --- |
| 23 | Translator. | 1 hr |
| 24 | AI travel assistant. | 2 hr |

### Part 8 — Live

| Step | What happens | Roughly |
| --- | --- | --- |
| 25 | Design polish pass — mobile, spacing, loading states, empty states. | 2 hr |
| 26 | Deploy to Vercel. Real URL you can send to people. | 45 min |
| 27 | Final full security audit. | 1 hr |

**Total: roughly 35–40 hours of focused work.**

### Two rules for the whole build

1. **We deploy at step 8, not step 26.** Getting a broken deploy fixed is much
   easier when the app is small. After that, every step goes live as we finish
   it.
2. **We test security after every part**, not once at the end. Security bugs
   found late are the expensive kind.
