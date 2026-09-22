# Eir

Eir is a private, account-based wellness app for getting through hard moments — a mood and self-harm calendar, a private space to vent, evidence-based coping tools, and crisis contacts, all in one place. Runs as a web app today, with iOS/Android builds scaffolded (see [INSTRUCTIONS.md](INSTRUCTIONS.md)).

## About Eir

Eir is aimed at people managing self-harm urges, low mood, or anxiety day to day — a pocket-sized companion for the moments in between therapy sessions, not a replacement for professional care. Everything in it is private to the signed-in account; there's no public feed, no social layer.

**Core features:**

- **Mood & self-harm calendar** (Home) — log each day's mood(s), whether you self-harmed, and a journal note; see the month at a glance and a running "days clean" counter that survives relapses instead of resetting to zero at the first setback.
- **Vent** — a private space to write out what you're feeling, with your own recent entries kept close at hand. Not a public feed — only you ever see your own vents.
- **Coping activities** — guided box breathing and Wim Hof breathing exercises, a memory game and a stacking game for redirecting focus, and a freeform drawing pad.
- **Alternatives** — evidence-based urge-redirection techniques (the Butterfly Project, the Bracelet Project, and others) with step-by-step guidance and community tips, for the moment an urge hits.
- **Emergency contacts** — a searchable directory of crisis hotlines worldwide, with an opt-in, location-aware "nearest hotline" shortcut.
- **Progress insights** — mood trends over time and clean-streak milestones, charted from your own logged data.
- **Daily reminders, journal history, and color themes** round out the day-to-day experience.

Journaling and mood data are sensitive by nature — every row in the database is scoped to its owner via Postgres row-level security (see Tech Specs below), and there is deliberately no admin UI that can browse user data today.

## Tech Specs

### Stack

React 18 + Vite (SPA), Tailwind CSS + Radix UI (shadcn "new-york" style), `@tanstack/react-query` for server state, `framer-motion` for interaction/motion, `recharts` for the Progress charts. Backend: Supabase (Postgres + Auth). Mobile: [Capacitor](https://capacitorjs.com) — see [INSTRUCTIONS.md](INSTRUCTIONS.md).

### Architecture

- **Auth**: Supabase Auth (email/password, Google, Apple OAuth) via `src/lib/AuthContext.jsx` (`AuthProvider`/`useAuth`), gating the whole route tree in `src/App.jsx`. The app owns its own `/login` and `/reset-password` pages rather than redirecting to a hosted login UI.
- **Data**: `src/lib/supabaseClient.js` is the single Supabase client. Thin wrapper modules — `src/api/dailyLogs.js`, `src/api/vents.js` — are the only places that call `supabase.from(...)` directly; pages consume those, not Supabase inline.
- **Schema & security**: `supabase/migrations/` is the schema/RLS source of truth. Three tables — `profiles`, `daily_logs`, `vents` — each row-level-security-scoped to `auth.uid()`, with a `role` column and admin-bypass RLS policies at the schema level (no admin UI is built on top of it yet). `daily_logs` has a `(user_id, date)` uniqueness constraint, so saving a day's log is a database-level upsert rather than a client-decided create-or-update.
- **Routing/layout**: `react-router-dom`, nested under a single `AppLayout` (`src/components/AppLayout.jsx`) composing `TopNav`/`BottomNav`/`Footer`. Pages live flat in `src/pages/*.jsx`.
- **Dev tooling**: `scripts/seed.js` creates a test account (if the email doesn't already exist, pre-confirmed, with a generated or given password) and populates it with sample daily logs/vents, using Supabase's secret key server-side only. Safe to re-run against the same account — it upserts, not duplicates.

### Project structure

```
src/
  api/          # dailyLogs.js, vents.js — the only files that call supabase.from(...)
  lib/          # AuthContext, supabaseClient, ThemeContext, query-client, crisisContacts
  pages/        # one file per route (Home, Vent, Settings, Login, ResetPassword, ...)
  components/   # AppLayout, nav, feature components; components/ui/ = shadcn primitives
  hooks/        # useCleanDays, useDailyReminder, usePullToRefresh
supabase/
  migrations/   # schema + RLS, applied in order
scripts/
  seed.js       # dev-only sample-data seeder (uses the Supabase secret key)
ios/, android/  # Capacitor native projects — see INSTRUCTIONS.md
```

## Getting started (local development)

1. Clone the repo and move into it:
   ```bash
   git clone https://github.com/vibhu-athavaria/eir.git
   cd eir
   ```
2. Install dependencies: `npm install`
3. Create a Supabase project at https://supabase.com (sign in → "New project").
4. Copy `.env.example` to `.env` and fill in your Supabase project's URL and keys (Project Settings → API, and → Database for the connection string, `SUPABASE_DB_URL`).
5. Run the migrations against it, **in order** — `0002` depends on the table `0001` creates. Three equivalent options:
   - **Supabase CLI** (`brew install supabase/tap/supabase`), the most idiomatic path for ongoing development — this is what `supabase migration new`/`supabase db push` expect going forward:
     ```bash
     supabase login
     supabase link --project-ref <your-project-ref>   # ref is in your project's dashboard URL
     set -a; source .env; set +a
     supabase db push --db-url "$SUPABASE_DB_URL"
     ```
     Use `--dry-run` first if you want to preview what would be applied without touching anything. `supabase migration new <name>` creates a new timestamped migration file for any future schema change; `supabase db push` applies whatever's new.
   - **Terminal via `psql`**, if you'd rather not install the Supabase CLI:
     ```bash
     set -a; source .env; set +a
     psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
     psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_daily_logs_unique_date.sql
     ```
   - **Dashboard SQL Editor**, if you'd rather not use a terminal at all:
     1. Open **SQL Editor** (sidebar icon) → **"+ New query"**.
     2. Open `supabase/migrations/0001_init.sql` in this repo, copy its entire contents, paste into the SQL editor, click **Run**. You should see "Success. No rows returned".
     3. Click **"+ New query"** again, repeat with `supabase/migrations/0002_daily_logs_unique_date.sql`.

   Whichever you use, if your project's **direct** connection string fails to resolve (some networks lack IPv6, which the direct host requires), use the **Session pooler** connection string instead (Project Settings → Database → Connection string) as `SUPABASE_DB_URL`.

   If you ever apply a migration via `psql`/the dashboard on a project you've also linked with the CLI, the CLI won't know it was applied — `supabase migration list` will show it missing from the "Remote" column, and a later `supabase db push` will try to re-run it and fail on "already exists". Fix with `supabase migration repair --status applied <version> --db-url "$SUPABASE_DB_URL"`, which just corrects the CLI's bookkeeping without touching your schema.
6. Run the app in dev mode: `npm run dev` (Vite prints a local URL, typically http://localhost:5173).
7. When you're ready to build for production: `npm run build` (outputs to `dist/`). Preview that build locally with `npm run preview` before deploying — see [Deployment (web)](#deployment-web) below.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run typecheck` — type-check with `tsc`
- `npm run seed -- <email> [password]` — create a test account if it doesn't exist (email pre-confirmed) and populate it with sample daily logs/vents; safe to re-run (requires `SUPABASE_SECRET_KEY` in `.env`; never used client-side)
- `npm run cap:sync` / `cap:open:ios` / `cap:open:android` — mobile build workflow, see [INSTRUCTIONS.md](INSTRUCTIONS.md)

## Deployment (web)

Deploys as a static site (Vercel, Netlify, Cloudflare Pages, or any static host) — build with `npm run build`, serve `dist/`. This is a client-routed single-page app, so the host needs a catch-all rewrite to `index.html` for direct navigation/refresh on routes like `/settings` or `/vent` to work (a server that just serves files will 404 on those without one).

- **Vercel**: `vercel.json` in this repo already has the rewrite rule — no extra config needed. Set the four `VITE_`/`SUPABASE_` env vars from `.env.example` in the project's dashboard (Settings → Environment Variables).
- **Netlify / Cloudflare Pages**: add a `public/_redirects` file containing `/* /index.html 200`, and set the same env vars in the site's dashboard.

## Before going to production

A few things need configuring in the Supabase dashboard before real users sign up — none of this is set up by the migration or by this repo:

### Custom SMTP provider (required)

Supabase's built-in email sender is rate-limited (a handful of emails per hour) and meant for dev/test only — it isn't viable for real signup-confirmation or password-reset emails. Without this, real users will see their confirmation/reset emails silently fail to arrive once the built-in sender's cap is hit.

1. Sign up with a transactional email provider. [Resend](https://resend.com) is the easiest pairing with Supabase (generous free tier, first-class docs for this exact setup) — SendGrid, Postmark, and AWS SES are equally fine alternatives if you already use one.
2. Verify a sending domain with that provider (add the DNS records they give you — SPF/DKIM — to your domain).
3. In the Supabase dashboard: **Project Settings → Authentication → SMTP Settings**, enable "Custom SMTP" and fill in the host/port/username/password your provider gives you, plus a "Sender email" on your verified domain (e.g. `noreply@yourdomain.com`) and a "Sender name" (e.g. `Eir`).
4. Send a test email from that same settings page to confirm it works before relying on it.

### Google and Apple OAuth credentials

Required for the Google/Apple buttons on `Login.jsx` to work — both are unconfigured out of the box, so those buttons will error until set up.

- **Google**: create an OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), then paste the client ID/secret into **Authentication → Providers → Google** in the Supabase dashboard. Add Supabase's callback URL (shown on that same page) to the OAuth client's authorized redirect URIs.
- **Apple**: create a Services ID + key in the [Apple Developer portal](https://developer.apple.com/account), then configure **Authentication → Providers → Apple** the same way. Apple's setup has more steps (a Sign in with Apple key, a Services ID tied to your domain) — follow [Supabase's Apple OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-apple) directly, it's more involved than Google's.

### Site URL and redirect URL allow-list

**Authentication → URL Configuration** — must include your production origin (and `https://<your-domain>/reset-password`), since `Login.jsx` calls `signInWithOAuth({ redirectTo: window.location.origin })` and `resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/reset-password\` })`. Requests to either flow will fail or silently redirect to the wrong place if the actual origin isn't in this allow-list.

Also see [docs/qa-checklist.md](docs/qa-checklist.md) — a manual pass through the app worth running before shipping, since no browser automation tool has verified this UI end-to-end.

## Contact

Questions or feedback: Contact@eirselfhelp.com
