# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview a production build
- `npm run lint` — ESLint (quiet: errors only)
- `npm run lint:fix` — ESLint with autofix
- `npm run typecheck` — `tsc -p ./jsconfig.json` (JS type-checking via `checkJs`, no emit)

There is no test runner configured in this repo (no Jest/Vitest/Playwright). Verify changes via `npm run lint`, `npm run typecheck`, and manual/browser testing.

Local dev requires a `.env` with:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```
(see `.env.example` for the full set, including the server/script-only vars used by `scripts/seed.js`).

## Architecture

This is a React 18 + Vite SPA backed by **Supabase** (Postgres + Auth) — see `supabase/migrations/0001_init.sql` for the schema.

**Backend access**: `src/lib/supabaseClient.js` creates the single Supabase client (`supabase`) using `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Thin wrapper modules — `src/api/dailyLogs.js`, `src/api/vents.js` — are the only places that call `supabase.from(...)` directly; pages import from these rather than querying Supabase inline. `supabase/migrations/0001_init.sql` is the schema/RLS source of truth (tables: `profiles`, `daily_logs`, `vents`; every table scoped by row-level security to `auth.uid()`, with an admin-bypass policy gated by a `profiles.role` column — no admin UI exists yet, this is schema-level groundwork only). `scripts/seed.js` is a dev-only script (uses the secret key, never shipped to the client) that populates sample data for a test account: `npm run seed -- <email>`.

**Auth**: `src/lib/AuthContext.jsx` (`AuthProvider`/`useAuth`) wraps the whole app and exposes `user` (merged Supabase session + `profiles` row, or `null`), `isAuthenticated`, `isLoadingAuth`, `logout()`, and `updateProfile(fields)`. `App.jsx`'s `AuthenticatedApp` gates on these: unauthenticated users only reach `/login` (`src/pages/Login.jsx` — email/password plus Google/Apple OAuth via `supabase.auth.signInWithOAuth`); everyone else gets the full route tree under `AppLayout`.

**Routing/layout**: `App.jsx` defines all routes with `react-router-dom`, nested under a single `AppLayout` (`src/components/AppLayout.jsx`, which composes `TopNav`, `BottomNav`, `Footer`). Pages live flat in `src/pages/*.jsx` (Home, Activities, Vent, EmergencyContacts, Settings, Alternatives, Progress, JournalHistory) — this is a mental-health support app (journaling, "venting", coping activities/alternatives, crisis/emergency contacts, progress tracking).

**State/data fetching**: `@tanstack/react-query` via a single shared `queryClientInstance` (`src/lib/query-client.js`) provided at the app root.

**Theming**: `src/lib/ThemeContext.jsx` (`ThemeProvider`) plus `next-themes` conventions; styling is Tailwind CSS with CSS variables (`tailwind.config.js`, `src/index.css`).

**UI components**: `src/components/ui/` holds shadcn/ui-style primitives built on Radix UI (style: "new-york", base color "neutral", icon library lucide — see `components.json`). This directory and `src/lib/**` and `src/api/**` are excluded from ESLint's React rules and from `typecheck`'s `include` (see `eslint.config.js` / `jsconfig.json`) — they're treated as vendored/lower-level code. Feature-specific components are grouped under `src/components/{activities,alternatives,calendar}/`.

**Path alias**: `@/*` maps to `src/*` (`jsconfig.json`, mirrored in `components.json` aliases) — use `@/...` imports, not relative paths, to match existing code.

**Custom hooks** (`src/hooks/`): `useCleanDays`, `useDailyReminder`, `usePullToRefresh`, `use-mobile` — domain hooks specific to this app's streak-tracking/reminder/mobile-gesture behavior.
