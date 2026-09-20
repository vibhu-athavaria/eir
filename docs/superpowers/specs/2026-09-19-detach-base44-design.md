# Detach from Base44 (Supabase backend)

Status: approved design, pending implementation plan
Date: 2026-09-19

## Context

This app (React 18 + Vite, mental-health support: mood/self-harm journaling,
"venting", coping activities, crisis contacts, progress tracking) currently
runs entirely on top of Base44 (base44.com), a hosted backend-as-a-service
platform: Base44 provides auth, a Postgres-backed entity store with
row-level security, hosts the login UI, and injects a Vite plugin for
HMR/analytics/visual-editor sync back to the Base44 Builder.

Goal: remove all Base44 dependency and replace it with a self-hosted-data,
managed-auth backend (Supabase), so the app can be developed and deployed
independently of Base44. This is phase 1 of a two-phase effort — phase 2
(packaging this web app for Android/iOS via Capacitor) is a separate,
follow-up spec and is explicitly out of scope here.

### Current Base44 surface area (confirmed by codebase audit)

Data: two entities only —
- `DailyLog` (date, mood, moods[], self_harmed, journal, description,
  alternatives_used[], seed_user_id) — RLS scoped to `created_by_id`, with
  an admin-role bypass and a `seed_user_id` back door for admin-seeded demo
  data.
- `Vent` (content, anonymous_name, seed_user_id) — same RLS shape.
- `User` has a `role` (`admin` | `user`) field.

Auth: `base44.auth.me()`, `updateMe()`, `logout()`, `redirectToLogin()`
(redirects off-site to Base44's hosted login UI).

User profile fields actually read/written by the app: `full_name`,
`tutorial_done`, `location_asked`, `created_date`, `role`, `id`.

Platform-only pieces that are not app functionality: the `@base44/vite-plugin`
(HMR/analytics/visual-editor sync), `src/pages/OAuthConsent.jsx` (lets
external AI clients request account access via Base44's own MCP server), and
a "Admin Note" block on the 404 page that references the Base44 AI Builder
chat.

No other Base44 integrations (LLM invocation, email, file upload) are used
anywhere in the codebase.

## Decisions

- **Backend**: Supabase (Postgres + Supabase Auth). Its RLS model maps
  almost directly onto Base44's existing per-row `created_by_id` rules, it
  has a mature JS SDK, and it works fine from a future Capacitor-wrapped
  mobile build.
- **Data migration**: none — fresh start, no existing production data to
  preserve.
- **Admin role**: *reinstated*. A `role` column (`'user' | 'admin'`,
  default `'user'`) is added to `profiles` now, with RLS admin-bypass
  policies granting full read/write access to `daily_logs`, `vents`, and
  `profiles` — this is foundational at the schema/RLS level, cheap to add
  now, and expensive to retrofit later. The *admin backend itself* (any
  UI/routes for browsing users or their data) is out of scope for this
  phase — see "Out of scope" below. The `seed_user_id` fields and the
  Base44-Builder-referencing 404 note remain dropped: those were
  Base44-platform/demo scaffolding tied to Base44's own admin-seeding
  mechanism and Builder chat, not the role concept itself.
- **Seed data generation**: *kept*, but re-scoped — not as an in-app
  admin/RLS-bypass feature (which no longer exists), but as a local
  dev-only Node script that uses Supabase's secret key to insert
  sample `daily_logs`/`vents` rows for one target account, for local
  development and demoing.
- **Auth methods**: email/password, Google OAuth, and Apple OAuth (Apple
  Sign-In is also an App Store requirement once any other third-party
  social login is offered on iOS). Google/Apple provider registration
  (Google Cloud Console, Apple Developer portal, then pasting
  client id/secret into Supabase's Auth provider settings) is manual setup
  the user will do themselves — not something implementation can automate.

## Data model

All tables live in the `public` schema and reference Supabase's built-in
`auth.users`.

```sql
-- profiles: one row per user, auto-created on signup via trigger
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  tutorial_done boolean not null default false,
  location_asked boolean not null default false,
  role text not null default 'user' check (role in ('user', 'admin'))
);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  mood numeric,
  moods numeric[],
  self_harmed boolean not null default false,
  journal text,
  description text,
  alternatives_used text[],
  created_at timestamptz not null default now()
);

create table public.vents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  anonymous_name text,
  created_at timestamptz not null default now()
);
```

RLS: enabled on all three tables. Each table gets an owner policy
(`user_id = auth.uid()`, or `id = auth.uid()` for `profiles`) plus an
admin-bypass policy using a `security definer` helper function (querying
`profiles` directly inside a `profiles` RLS policy would recurse):

```sql
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
```

Each policy's `using`/`with check` clause becomes
`user_id = auth.uid() or public.is_admin()` (`id = auth.uid() or
public.is_admin()` for `profiles`) — giving admins full read/write/delete
access to every user's `daily_logs`, `vents`, and `profiles` rows, per the
"full data access" scope decision above.

**Role-escalation guard**: a user must never be able to grant themselves
admin by calling the ordinary profile-update path. A `before update`
trigger on `profiles` rejects any change to `role` unless the actor is
already an admin (`public.is_admin()`), regardless of RLS. The client-side
profile-update wrapper (used by Settings' username editor and the
tutorial/location-prompt flags) also simply never sends a `role` field.

A `handle_new_user()` trigger function on `auth.users` (`after insert`)
inserts the corresponding `profiles` row (`role` defaults to `'user'`;
the first/only admin account is promoted with a one-off manual SQL
update in the Supabase dashboard, not through the app).

`created_date` is not duplicated onto app tables — `auth.users.created_at`
(exposed via the session/user object) covers the one place it's read
(`useCleanDays`'s join-date fallback).

## Auth

- `src/lib/supabaseClient.js` — single `createClient(VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY)` instance, replacing `src/api/base44Client.js`.
- `AuthContext.jsx` is rewritten around `supabase.auth.getSession()` +
  `onAuthStateChange()` for `user` / `isAuthenticated` / `isLoadingAuth`,
  and `supabase.auth.signOut()` for `logout()`. The profile fields
  (`full_name`, `tutorial_done`, `location_asked`) are read from/written to
  the `profiles` table.
- `user.role` (read-only from the client's perspective) is included in
  the profile data `AuthContext` exposes, so future admin-only UI can
  gate on it — but this phase adds no UI that uses it.
- Base44's app-level access-gating state (`appPublicSettings`,
  `isLoadingPublicSettings`, the `user_not_registered` auth-error type) is
  removed entirely — it existed for Base44's invite-only app gating, which
  has no equivalent need here.
- **New `/login` page** (`src/pages/Login.jsx`, reusing the existing
  `AuthLayout.jsx` shell): email/password sign-in and sign-up, plus
  "Continue with Google" / "Continue with Apple" buttons calling
  `supabase.auth.signInWithOAuth({ provider })`. This replaces Base44's
  previous behavior of redirecting off-site to its own hosted login UI —
  the app now needs to own its login UI.
- `src/pages/OAuthConsent.jsx` and its route are deleted (Base44 MCP-client
  consent flow; not app functionality).

## Client code changes

Thin data-access wrapper modules replace direct `base44.entities.*` calls,
so page components change minimally beyond their import and call sites:

- `src/api/dailyLogs.js`: `listDailyLogs()`, `createDailyLog(data)`,
  `updateDailyLog(id, data)`, `deleteAllDailyLogsForUser(userId)`.
- `src/api/vents.js`: `listRecentVents(n)`, `createVent(data)`,
  `deleteAllVentsForUser(userId)`.

Base44's `'-date', 500` sort/limit convention on `.list()` becomes Supabase
query-builder `.order('date', { ascending: false }).limit(500)`.

### Files rewritten
`src/lib/AuthContext.jsx`, `src/hooks/useCleanDays.js`, `src/pages/Home.jsx`,
`src/pages/JournalHistory.jsx`, `src/pages/Vent.jsx`, `src/pages/Settings.jsx`,
`src/components/AppLayout.jsx` (swap `base44.*` calls for the wrappers
above / new auth context shape), `src/lib/PageNotFound.jsx` (drop the
admin-role check and the Base44-Builder-referencing note — becomes a plain
404).

### Files deleted
`src/api/base44Client.js`, `src/lib/app-params.js` (existed solely for
Base44's URL-param/localStorage token injection — Supabase's client
manages its own session persistence), `src/pages/OAuthConsent.jsx` and its
route, the `base44/` directory (its `.jsonc` entity schemas are superseded
by the SQL migration; `config.jsonc` is Base44-platform-only).

### Files added
`src/lib/supabaseClient.js`, `src/pages/Login.jsx`,
`supabase/migrations/0001_init.sql` (the schema above), `scripts/seed.js`
(dev-only seed script, see below).

### Config/dependencies
- `package.json`: remove `@base44/sdk`, `@base44/vite-plugin`; add
  `@supabase/supabase-js`.
- `vite.config.js`: drop the `base44()` plugin; keep `react()` only.
- Env vars: `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` replace
  `VITE_BASE44_APP_ID` / `VITE_BASE44_APP_BASE_URL` /
  `VITE_BASE44_FUNCTIONS_VERSION`. `SUPABASE_SECRET_KEY` is
  documented as local-only (never committed, never used client-side),
  needed only by `scripts/seed.js`.
- `README.md` and `CLAUDE.md` updated to describe the Supabase-based setup
  once this lands. `README.md` is currently pure Base44 boilerplate
  (links to Base44.com/docs.base44.com, `VITE_BASE44_*` instructions) and
  is rewritten from scratch for local/Supabase setup.
- `package.json`'s `"name": "base44-app"` is renamed; the `.gitignore`
  entry for `base44/.app.jsonc` is removed along with the `base44/`
  directory it referred to.

### Seed script (`scripts/seed.js`)
A dev-only Node script, run manually (e.g. `node scripts/seed.js
<user-email>`), using the Supabase secret key to look up the target
user and insert a batch of realistic sample `daily_logs` and `vents` rows
for that one account — for local development/demoing. Runs outside RLS via
the secret key; not part of the shipped app bundle.

## Testing / verification

No test runner is configured in this repo (unchanged by this work).
Verification: `npm run lint` and `npm run typecheck`, then a manual pass
through the real flows in a browser — sign up, sign in via email + Google +
Apple, sign out, create/edit a daily log, view journal history, post a
vent, "delete all my data" in Settings, and (using two separate accounts)
confirming RLS actually isolates each user's rows from the other's.

Final check: `grep -ri base44` across the repo (excluding `node_modules`
and this spec's own history) returns nothing — no leftover imports, env
var names, URLs, or package name/dependency references.

## Out of scope

- Data migration from Base44 (none needed — fresh start).
- Mobile packaging (Capacitor, Android/iOS builds) — separate follow-up
  spec once this backend swap is implemented and verified as a web app.
- **Admin backend UI** — any actual screens/routes for an admin to browse
  users, view/moderate their `daily_logs`/`vents`, or promote/demote
  roles. This phase only lays the schema/RLS groundwork (`role` column,
  admin-bypass policies, escalation guard); the admin experience itself is
  a separate follow-up spec, same treatment as the mobile phase.
- Adding an automated test runner (noted as a possible future improvement,
  not part of this change).
