# Detach from Base44 (Supabase backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every Base44 dependency from this app and replace auth + data storage with Supabase (Postgres + Supabase Auth), while adding a `role` column and admin-capable RLS policies (no admin UI yet) for a future admin backend.

**Architecture:** Supabase Postgres tables (`profiles`, `daily_logs`, `vents`) with row-level security replace Base44's entity store; Supabase Auth (email/password + Google + Apple OAuth) replaces Base44's hosted auth, with a new in-app `/login` page since the app now owns its own login UI instead of redirecting off-site. Thin wrapper modules (`src/api/dailyLogs.js`, `src/api/vents.js`) give page components a stable interface so most page-level code changes are import swaps.

**Tech Stack:** React 18, Vite, `@supabase/supabase-js` v2, `@tanstack/react-query` (unchanged), Tailwind/Radix UI (unchanged).

**Spec:** [docs/superpowers/specs/2026-09-19-detach-base44-design.md](../specs/2026-09-19-detach-base44-design.md)

## Global Constraints

- No automated test runner exists in this repo and none is added by this plan — verification is `npm run lint`, `npm run typecheck`, and manual browser walkthroughs, exactly as the spec's "Testing / verification" section specifies.
- Auth methods: email/password, Google OAuth, Apple OAuth (Google/Apple provider registration in their respective developer consoles is done by the user, not part of any task here).
- No data migration — fresh start, no existing production data.
- `role` column + RLS admin-bypass are added at the schema level now; no admin UI/routes are built in this plan (separate follow-up spec).
- Final state must contain **zero** case-insensitive `base44` references anywhere in the repo outside `docs/superpowers/specs/` and `docs/superpowers/plans/` (the spec/plan documents themselves, which describe the migration).
- Path alias `@/*` → `src/*` is used for all new imports, matching existing code.

---

## Task 1: Supabase project + database migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: Postgres tables `public.profiles(id, full_name, tutorial_done, location_asked, role)`, `public.daily_logs(id, user_id, date, mood, moods, self_harmed, journal, description, alternatives_used, created_at)`, `public.vents(id, user_id, content, anonymous_name, created_at)`; helper function `public.is_admin() returns boolean`; trigger `on_auth_user_created` (auto-creates a `profiles` row); trigger `profiles_guard_role` (blocks non-admin role changes). Later tasks assume these tables/policies exist on a live Supabase project reachable via `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.

- [ ] **Step 1: Create the Supabase project (manual, external)**

Go to https://supabase.com, create a new project (any name/region, e.g. "eir"). Once provisioned, from Project Settings → API, note down:
- Project URL (`https://<ref>.supabase.co`)
- **Publishable key**
- **Secret key** (keep this one secret — never put it in any `VITE_`-prefixed variable)

Under Authentication → Providers, confirm "Email" is enabled (it is by default). Leave Google/Apple disabled for now — the user configures those later per the spec.

- [ ] **Step 2: Write the migration file**

Create `supabase/migrations/0001_init.sql`:

```sql
-- Tables --------------------------------------------------------------

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

-- Row level security ----------------------------------------------------

alter table public.profiles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.vents enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "daily_logs_select_own_or_admin" on public.daily_logs
  for select using (user_id = auth.uid() or public.is_admin());
create policy "daily_logs_insert_own" on public.daily_logs
  for insert with check (user_id = auth.uid() or public.is_admin());
create policy "daily_logs_update_own_or_admin" on public.daily_logs
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "daily_logs_delete_own_or_admin" on public.daily_logs
  for delete using (user_id = auth.uid() or public.is_admin());

create policy "vents_select_own_or_admin" on public.vents
  for select using (user_id = auth.uid() or public.is_admin());
create policy "vents_insert_own" on public.vents
  for insert with check (user_id = auth.uid() or public.is_admin());
create policy "vents_update_own_or_admin" on public.vents
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "vents_delete_own_or_admin" on public.vents
  for delete using (user_id = auth.uid() or public.is_admin());

-- New-user bootstrap ------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role-escalation guard ---------------------------------------------------

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change role';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();
```

- [ ] **Step 3: Run the migration against the Supabase project**

In the Supabase dashboard, open SQL Editor → New query, paste the full contents of `supabase/migrations/0001_init.sql`, and run it. Expected: "Success. No rows returned" with no errors.

- [ ] **Step 4: Verify the schema**

In the Supabase dashboard, Table Editor: confirm `profiles`, `daily_logs`, `vents` tables exist with the columns above, and each shows "RLS enabled". In Database → Functions, confirm `is_admin`, `handle_new_user`, `prevent_role_escalation` exist. In Database → Triggers, confirm `on_auth_user_created` (on `auth.users`) and `profiles_guard_role` (on `profiles`) exist.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add Supabase schema migration (profiles, daily_logs, vents, RLS)"
```

---

## Task 2: Supabase client + env config (additive, Base44 stays functional)

**Files:**
- Create: `src/lib/supabaseClient.js`
- Create: `.env.example`
- Modify: `package.json` (add dependency)
- Modify: `.gitignore` (allow `.env.example` through the existing `.env.*` ignore rule)

**Interfaces:**
- Produces: `supabase` — a configured Supabase JS client, exported from `src/lib/supabaseClient.js` (`import { supabase } from '@/lib/supabaseClient'`). Every later task that talks to Supabase imports this.

- [ ] **Step 1: Install the Supabase JS SDK**

```bash
npm install @supabase/supabase-js@^2.116.0
```

Expected: `package.json`'s `dependencies` gains `"@supabase/supabase-js": "^2.116.0"` (npm will place it alphabetically; leave it wherever npm puts it).

- [ ] **Step 2: Create the Supabase client module**

Create `src/lib/supabaseClient.js`:

```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
```

- [ ] **Step 3: Add the env var template**

Create `.env.example`:

```
# Client-side (exposed to the browser bundle — safe to be public)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Server/script-only (used by scripts/seed.js — never prefix with VITE_, never commit real values)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
```

- [ ] **Step 4: Allow the example file through `.gitignore`**

Open `.gitignore` and change:

```
#env
.env
.env.*
```

to:

```
#env
.env
.env.*
!.env.example
```

- [ ] **Step 5: Create your local `.env` with real values**

Create `.env` (gitignored, not committed) in the repo root with your actual Supabase project's URL/publishable key/secret key, using the same variable names as `.env.example`.

- [ ] **Step 6: Verify connectivity**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$SUPABASE_URL/rest/v1/profiles" -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY"
```

(export `SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` in your shell first, matching `.env`.) Expected: `200` with an empty array body — reachable, and RLS correctly returns no rows to an unauthenticated request.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore src/lib/supabaseClient.js
git commit -m "feat: add Supabase client and env config"
```

---

## Task 3: Auth cutover — AuthContext, routing, new Login page

**Files:**
- Modify: `src/lib/AuthContext.jsx`
- Modify: `src/App.jsx`
- Create: `src/pages/Login.jsx`
- Delete: `src/pages/OAuthConsent.jsx`
- Delete: `src/components/ProtectedRoute.jsx`
- Delete: `src/components/UserNotRegisteredError.jsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabaseClient.js` (Task 2).
- Produces: `useAuth()` returning `{ user, isAuthenticated, isLoadingAuth, logout, updateProfile }`, where `user` is `null` when signed out, otherwise `{ id, email, created_at, full_name, tutorial_done, location_asked, role }` (session fields merged with the `profiles` row). `logout(): Promise<void>`. `updateProfile(fields: object): Promise<object>` — updates the caller's own `profiles` row (never send `role` through this — the DB trigger rejects it for non-admins anyway) and returns the updated row. All exported from `src/lib/AuthContext.jsx` (`AuthProvider`, `useAuth`). Tasks 4 and 5 consume `useAuth()` and `updateProfile`.

- [ ] **Step 1: Rewrite `src/lib/AuthContext.jsx`**

Replace the entire file with:

```jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      await loadProfile(initialSession?.user?.id);
      if (mounted) setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadProfile(newSession?.user?.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (fields) => {
    if (!session?.user?.id) return null;
    const { data, error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', session.user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    return data;
  };

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        created_at: session.user.created_at,
        ...profile,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!session,
        isLoadingAuth,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

- [ ] **Step 2: Create `src/pages/Login.jsx`**

```jsx
import React, { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';

export default function Login() {
  const [mode, setMode] = useState('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'sign_up') {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setInfo('Check your email to confirm your account, then sign in.');
        setMode('sign_in');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || `Could not sign in with ${provider}.`);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title={mode === 'sign_up' ? 'Create your account' : 'Welcome back'}
      subtitle="A private space for recovery"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      {info && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 text-primary text-sm">{info}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl mt-1"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl mt-1"
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-medium">
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {mode === 'sign_up' ? 'Sign up' : 'Sign in'}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px bg-border flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px bg-border flex-1" />
      </div>

      <div className="space-y-3">
        <Button type="button" variant="outline" className="w-full h-12 rounded-xl" onClick={() => handleOAuth('google')}>
          Continue with Google
        </Button>
        <Button type="button" variant="outline" className="w-full h-12 rounded-xl" onClick={() => handleOAuth('apple')}>
          Continue with Apple
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        {mode === 'sign_up' ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          className="text-primary font-medium"
          onClick={() => {
            setMode(mode === 'sign_up' ? 'sign_in' : 'sign_up');
            setError('');
            setInfo('');
          }}
        >
          {mode === 'sign_up' ? 'Sign in' : 'Sign up'}
        </button>
      </p>
    </AuthLayout>
  );
}
```

- [ ] **Step 3: Rewrite `src/App.jsx`**

Replace the entire file with:

```jsx
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Home from '@/pages/Home';
import Activities from '@/pages/Activities';
import Vent from '@/pages/Vent';
import EmergencyContacts from '@/pages/EmergencyContacts';
import Settings from '@/pages/Settings';
import Alternatives from '@/pages/Alternatives';
import Progress from '@/pages/Progress';
import JournalHistory from '@/pages/JournalHistory';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/vent" element={<Vent />} />
        <Route path="/contacts" element={<EmergencyContacts />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/alternatives" element={<Alternatives />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/journal" element={<JournalHistory />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ThemeProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 4: Delete the now-dead auth files**

```bash
rm src/pages/OAuthConsent.jsx src/components/ProtectedRoute.jsx src/components/UserNotRegisteredError.jsx
```

(`ProtectedRoute.jsx` was never imported anywhere even before this change — confirmed dead code. `UserNotRegisteredError.jsx` and `OAuthConsent.jsx` were only reachable through the Base44 app-gating flow just removed from `App.jsx`. `src/lib/app-params.js` is NOT deleted here, despite `AuthContext.jsx` and `OAuthConsent.jsx` no longer needing it — `src/api/base44Client.js` also imports it, and that file (along with everything that still transitively depends on it — `AppLayout.jsx`, `Home.jsx`, `Vent.jsx`, `Settings.jsx`, `JournalHistory.jsx`, `useCleanDays.js`, `PageNotFound.jsx` — none of which are rewritten until Tasks 4-5) is still load-bearing until Task 6. `app-params.js` moves to Task 6's deletion list instead, alongside `base44Client.js` itself.)

- [ ] **Step 5: Lint and typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: both pass with no errors.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open the app in a browser.
1. Confirm you land on `/login` (not authenticated yet).
2. Sign up with a test email/password. Expected: "Check your email to confirm your account" message (if email confirmation is on by default for a new Supabase project) — confirm the email via the Supabase Auth → Users dashboard (you can manually confirm a user there for local testing), then sign in with the same credentials.
3. Confirm successful sign-in redirects into the app shell (bottom nav visible). Note: pages like Home/Vent/Settings still call the old Base44 client at this point (fixed in Tasks 4–5) — they may render empty/broken data sections; that's expected here. The thing being verified in this task is login, session persistence (reload the page — you should stay logged in), and logout (Settings → Log Out returns you to `/login`).
4. In the Supabase dashboard's Table Editor, confirm a new row appeared in `profiles` with your test user's `id` and `role = 'user'`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: replace Base44 auth with Supabase auth and in-app login page"
```

---

## Task 4: Daily log data — wrapper module + Home/JournalHistory/useCleanDays cutover

**Files:**
- Create: `src/api/dailyLogs.js`
- Modify: `src/pages/Home.jsx`
- Modify: `src/pages/JournalHistory.jsx`
- Modify: `src/hooks/useCleanDays.js`

**Interfaces:**
- Consumes: `supabase` (Task 2), `useAuth()` (Task 3).
- Produces: from `src/api/dailyLogs.js` — `listDailyLogs(): Promise<Array<{id, date, mood, moods, self_harmed, journal, description, alternatives_used, created_at}>>`, `createDailyLog(data: object): Promise<object>`, `updateDailyLog(id: string, data: object): Promise<object>`, `deleteAllDailyLogsForUser(userId: string): Promise<void>`. Task 5 (Settings.jsx) consumes `deleteAllDailyLogsForUser`.

- [ ] **Step 1: Create `src/api/dailyLogs.js`**

```js
import { supabase } from '@/lib/supabaseClient';

export async function listDailyLogs() {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .order('date', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data;
}

export async function createDailyLog(data) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: row, error } = await supabase
    .from('daily_logs')
    .insert({ ...data, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function updateDailyLog(id, data) {
  const { data: row, error } = await supabase
    .from('daily_logs')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function deleteAllDailyLogsForUser(userId) {
  const { error } = await supabase.from('daily_logs').delete().eq('user_id', userId);
  if (error) throw error;
}
```

- [ ] **Step 2: Rewire `src/pages/Home.jsx`**

Replace the import line:

```js
import { base44 } from '@/api/base44Client';
```

with:

```js
import { listDailyLogs, createDailyLog, updateDailyLog } from '@/api/dailyLogs';
```

Replace the three call sites:

```js
queryFn: () => base44.entities.DailyLog.list('-date', 500),
```
→
```js
queryFn: listDailyLogs,
```

```js
mutationFn: (data) => base44.entities.DailyLog.create(data),
```
→
```js
mutationFn: (data) => createDailyLog(data),
```

```js
mutationFn: ({ id, data }) => base44.entities.DailyLog.update(id, data),
```
→
```js
mutationFn: ({ id, data }) => updateDailyLog(id, data),
```

Nothing else in `Home.jsx` changes.

- [ ] **Step 3: Rewire `src/pages/JournalHistory.jsx`**

Replace:

```js
import { base44 } from '@/api/base44Client';
```
with:
```js
import { listDailyLogs } from '@/api/dailyLogs';
```

Replace:
```js
queryFn: () => base44.entities.DailyLog.list('-date', 500),
```
with:
```js
queryFn: listDailyLogs,
```

- [ ] **Step 4: Rewire `src/hooks/useCleanDays.js`**

Replace the entire file with:

```js
import { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { listDailyLogs } from '@/api/dailyLogs';
import { useAuth } from '@/lib/AuthContext';

/**
 * Shared hook for "days clean" — the count of days since the user's most recent
 * self-harm log (or since they joined, if they have none). Shares the dailyLogs
 * query cache with other callers (e.g. the Home page).
 */
export function useCleanDays() {
  const { user } = useAuth();
  const joinDate = user?.created_at ? new Date(user.created_at) : null;

  const { data: logs = [] } = useQuery({
    queryKey: ['dailyLogs'],
    queryFn: listDailyLogs,
  });

  const cleanDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selfHarmDates = logs
      .filter(l => l.self_harmed && l.date)
      .map(l => new Date(l.date + 'T00:00:00'))
      .sort((a, b) => b.getTime() - a.getTime());

    const lastSelfHarm = selfHarmDates[0] || null;
    if (lastSelfHarm) return differenceInCalendarDays(today, lastSelfHarm);

    const firstLog = logs
      .filter(l => l.date)
      .map(l => new Date(l.date + 'T00:00:00'))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return firstLog ? differenceInCalendarDays(today, firstLog) : 0;
  }, [logs]);

  const longestStreak = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = joinDate ? new Date(joinDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const points = [
      start,
      ...logs
        .filter(l => l.self_harmed && l.date)
        .map(l => new Date(l.date + 'T00:00:00'))
        .sort((a, b) => a.getTime() - b.getTime()),
      today,
    ];

    let max = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const gap = differenceInCalendarDays(points[i + 1], points[i]);
      if (gap > max) max = gap;
    }
    return max;
  }, [logs, joinDate]);

  return { cleanDays, longestStreak, logs, joinDate };
}
```

(Note: `start` is now built with `new Date(joinDate)` instead of mutating `joinDate` directly with `setHours`, since `joinDate` is now derived from `useAuth()` on every render rather than owned local state — mutating it in place would be a latent bug.)

- [ ] **Step 5: Lint and typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: both pass.

- [ ] **Step 6: Manual verification**

With `npm run dev` running and signed in (from Task 3):
1. On Home, tap "Log Today", pick a mood, save. Expected: the calendar shows today marked, and the "clean days" counter updates.
2. In the Supabase dashboard Table Editor, confirm a row appeared in `daily_logs` with your user's `id` as `user_id`.
3. Edit that same day's log (change mood/journal) and save again. Expected: the existing row updates (not a duplicate row) — confirm in the Supabase table.
4. Open Settings → Journal History. Expected: any entry with journal text appears, most recent first.
5. Reload the page. Expected: "days clean" and the calendar still reflect the saved data (confirms `listDailyLogs` + `useCleanDays` work end-to-end after a fresh load, not just from the optimistic cache).

- [ ] **Step 7: Commit**

```bash
git add src/api/dailyLogs.js src/pages/Home.jsx src/pages/JournalHistory.jsx src/hooks/useCleanDays.js
git commit -m "feat: move daily log data access to Supabase"
```

---

## Task 5: Vent data, Settings, AppLayout, PageNotFound cutover

**Files:**
- Create: `src/api/vents.js`
- Modify: `src/pages/Vent.jsx`
- Modify: `src/pages/Settings.jsx`
- Modify: `src/components/AppLayout.jsx`
- Modify: `src/lib/PageNotFound.jsx`

**Interfaces:**
- Consumes: `supabase` (Task 2), `useAuth()` / `updateProfile` (Task 3), `deleteAllDailyLogsForUser` (Task 4).
- Produces: from `src/api/vents.js` — `listRecentVents(n: number): Promise<Array<{id, content, anonymous_name, created_at}>>`, `createVent(data: object): Promise<object>`, `deleteAllVentsForUser(userId: string): Promise<void>`.

- [ ] **Step 1: Create `src/api/vents.js`**

```js
import { supabase } from '@/lib/supabaseClient';

export async function listRecentVents(n) {
  const { data, error } = await supabase
    .from('vents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(n);
  if (error) throw error;
  return data;
}

export async function createVent(data) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: row, error } = await supabase
    .from('vents')
    .insert({ ...data, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function deleteAllVentsForUser(userId) {
  const { error } = await supabase.from('vents').delete().eq('user_id', userId);
  if (error) throw error;
}
```

- [ ] **Step 2: Rewire `src/pages/Vent.jsx`**

Replace the top of the file (imports through the `useEffect`/`useQuery`/`createMutation` block):

```jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { listRecentVents, createVent } from '@/api/vents';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, RefreshCw } from 'lucide-react';
import usePullToRefresh from '@/hooks/usePullToRefresh';

export default function Vent() {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [username, setUsername] = useState('Anonymous');

  useEffect(() => {
    if (user?.full_name) setUsername(user.full_name);
  }, [user]);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['vents'] });
  };
  const { containerRef, pullDistance, refreshing, threshold } = usePullToRefresh(handleRefresh);

  const { data: vents = [] } = useQuery({
    queryKey: ['vents'],
    queryFn: () => listRecentVents(3),
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {any} */ data) => createVent(data),
    onMutate: async (newVent) => {
      await queryClient.cancelQueries({ queryKey: ['vents'] });
      const previous = queryClient.getQueryData(['vents']);
      const optimistic = { id: `temp-${Date.now()}`, ...newVent, created_at: new Date().toISOString() };
      queryClient.setQueryData(['vents'], (/** @type {any[]} */ old) => [optimistic, ...(old || [])]);
      setContent('');
      setSending(false);
      return { previous };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['vents'], ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['vents'] });
    },
  });
```

Everything below `createMutation` (the `handleSend` function and the JSX `return (...)`) is unchanged from the current file.

- [ ] **Step 3: Rewire `src/pages/Settings.jsx`**

Replace the import line:
```js
import { base44 } from '@/api/base44Client';
```
with:
```js
import { useAuth } from '@/lib/AuthContext';
import { deleteAllDailyLogsForUser } from '@/api/dailyLogs';
import { deleteAllVentsForUser } from '@/api/vents';
```

Replace the component's top (from `export default function Settings()` through the `useEffect` that sets username):

```jsx
export default function Settings() {
  const { theme, setTheme, themes } = useTheme();
  const { user, updateProfile, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.full_name) setUsername(user.full_name);
  }, [user]);
```

Replace `handleSaveUsername`:
```js
const handleSaveUsername = async () => {
  await updateProfile({ full_name: username });
  setSaved(true);
  setTimeout(() => setSaved(false), 2000);
};
```

Replace `handleLogout`:
```js
const handleLogout = async () => {
  await logout();
};
```

Replace `handleDeleteAccount`:
```js
const handleDeleteAccount = async () => {
  setDeleting(true);
  try {
    if (user?.id) {
      await Promise.all([
        deleteAllDailyLogsForUser(user.id),
        deleteAllVentsForUser(user.id),
      ]);
    }
  } catch (_) {
    // Best-effort — proceed to logout regardless
  }
  localStorage.clear();
  await logout();
};
```

Nothing else in `Settings.jsx` (the JSX/theme/reminder sections) changes.

- [ ] **Step 4: Rewire `src/components/AppLayout.jsx`**

Replace the import line:
```js
import { base44 } from '@/api/base44Client';
```
with:
```js
import { useAuth } from '@/lib/AuthContext';
```

Replace the component's state/effect block (from `export default function AppLayout()` through the onboarding `useEffect`):

```jsx
export default function AppLayout() {
  useDailyReminder();
  const { user, updateProfile } = useAuth();
  const [showQuote, setShowQuote] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const location = useLocation();

  // Onboarding flags live on the user profile, not the device, so every new user
  // (on any device) logs in, shares location, and reads the intro exactly once.
  useEffect(() => {
    if (!user) return;
    setShowTutorial(!user.tutorial_done);
    setShowLocation(!user.location_asked);
  }, [user]);
```

Replace `handleTutorialComplete` / `handleLocationComplete`:
```js
const handleTutorialComplete = () => {
  setShowTutorial(false);
  updateProfile({ tutorial_done: true }).catch(() => {});
};

const handleLocationComplete = () => {
  setShowLocation(false);
  updateProfile({ location_asked: true }).catch(() => {});
};
```

Replace every remaining use of `onboardingLoaded` in the JSX with `!!user` (there is no more separate loading flag — `user` is populated by the time `AppLayout` renders, since `App.jsx` only renders it once `isAuthenticated` is true, which happens after profile load completes):

```jsx
  const isTabRoute = TAB_PATHS.includes(location.pathname);

  return (
    <>
      <AnimatePresence>
        {!!user && showTutorial && <TutorialOverlay onComplete={handleTutorialComplete} />}
      </AnimatePresence>
      {!!user && showQuote && !showTutorial && <QuoteOverlay onComplete={() => setShowQuote(false)} />}
      <AnimatePresence>
        {!!user && showLocation && !showTutorial && !showQuote && (
          <LocationPrompt onComplete={handleLocationComplete} />
        )}
      </AnimatePresence>
```

The rest of the JSX (`TopNav`, tab pages, `Outlet`, `Footer`, `BottomNav`) is unchanged.

- [ ] **Step 5: Simplify `src/lib/PageNotFound.jsx`**

Replace the entire file with:

```jsx
import { useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-muted-foreground/40">404</h1>
            <div className="h-0.5 w-16 bg-border mx-auto"></div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-foreground">
              Page Not Found
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The page <span className="font-medium text-foreground">"{pageName}"</span> could not be found in this application.
            </p>
          </div>

          <div className="pt-6">
            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Lint and typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: both pass.

- [ ] **Step 7: Manual verification**

With `npm run dev` running and signed in:
1. Go to Vent, submit a vent. Expected: it appears immediately in the feed below, and a row shows up in the `vents` Supabase table with your user's `id`.
2. Go to Settings, change "Your Name" and save. Expected: "Saved" checkmark shows; reload the page — the name persists (confirms it's reading from `profiles`, not local state).
3. First login after Task 3/4/5 combined (use a fresh test account if you already dismissed onboarding on your primary test account): confirm the tutorial overlay and location prompt each appear exactly once, and don't reappear after completing them and reloading.
4. Navigate to a nonexistent path (e.g. `/does-not-exist`). Expected: a plain 404 page, no "Admin Note" text.
5. In Settings, use "Delete Account". Expected: you're signed out and returned to `/login`; the `daily_logs` and `vents` tables no longer contain rows for that user (their `profiles` row and `auth.users` account still exist — this matches the app's existing behavior, which only ever wiped owned data and signed out, never truly deleted the account record).

- [ ] **Step 8: Commit**

```bash
git add src/api/vents.js src/pages/Vent.jsx src/pages/Settings.jsx src/components/AppLayout.jsx src/lib/PageNotFound.jsx
git commit -m "feat: move vent data and profile flows to Supabase"
```

---

## Task 6: Remove the Base44 SDK and all remaining references

**Files:**
- Delete: `src/api/base44Client.js`
- Delete: `src/lib/app-params.js` (moved here from Task 3 — see that task's Step 4 note; `base44Client.js` was its last remaining importer)
- Delete: `base44/` (entire directory: `config.jsonc`, `entities/DailyLog.jsonc`, `entities/User.jsonc`, `entities/Vent.jsonc`)
- Modify: `package.json`
- Modify: `vite.config.js`
- Modify: `.gitignore`
- Modify (unowned staleness discovered via Step 5's grep, fix in place rather than leave dangling): any `.claude/agents/*.md` persona file still mentioning Base44 — this repo has three (`software-engineer.md`, `qa-engineer.md`, `ui-ux-designer.md`) written before this migration started; update their Base44 mentions to describe Supabase instead, matching what Tasks 2/4/5 actually built. Leave unrelated staleness in those files alone (e.g. anything not matching the grep) — that's out of scope.

**Interfaces:** None — this task only removes dead code/config. No other task depends on anything produced here.

- [ ] **Step 1: Delete the Base44 client and platform directory**

```bash
rm src/api/base44Client.js src/lib/app-params.js
rm -rf base44
```

- [ ] **Step 2: Remove the Base44 packages and rename the app**

Open `package.json` and:
- Change `"name": "base44-app"` to `"name": "eir"`.
- Remove the `"@base44/sdk": "^0.8.48",` and `"@base44/vite-plugin": "^1.0.40",` lines from `dependencies`.

Then run:
```bash
npm install
```
Expected: `package-lock.json` updates to drop `@base44/sdk` and `@base44/vite-plugin` and their now-unused transitive dependencies; install succeeds with no errors.

- [ ] **Step 3: Simplify `vite.config.js`**

Replace the entire file with:

```js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
  ]
});
```

The `resolve.alias` is required, not optional: `@base44/vite-plugin` was silently providing the `@` → `src` bundle-time alias every `@/...` import in this codebase relies on. `jsconfig.json`'s `paths` only helps `tsc`/editor resolution — it does nothing for Vite/Rollup's actual bundling. Without this alias, `npm run dev` and `npm run typecheck` stay green (neither depends on it) but `npm run build` fails on every single `@/...` import. This is exactly why Step 6 below runs a real build, not just lint/typecheck.

- [ ] **Step 4: Clean up `.gitignore`**

Remove the line `base44/.app.jsonc` (the directory it referred to no longer exists).

- [ ] **Step 5: Full-repo Base44 reference check**

```bash
grep -ril "base44" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs
```

Expected at this point: exactly `README.md` and `CLAUDE.md` (both pre-date this migration and are fully rewritten with verbatim content in Task 8 — that task re-runs this same check and is where it must actually come back empty). Anything else showing up here — including any file under `.claude/agents/` — is unowned staleness this task should fix now rather than leave for someone else to trip over later (e.g. a persona doc that still points at `src/api/base44Client.js`, which this task just deleted).

- [ ] **Step 6: Build and typecheck**

```bash
npm run lint && npm run typecheck && npm run build
```

Expected: all three succeed. `npm run build` in particular confirms nothing still imports the removed `@base44/vite-plugin` or `@base44/sdk`.

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev
```
Sign in with your existing test account and click through Home, Vent, Journal History, Settings, Progress, Activities, Emergency Contacts. Expected: everything still works exactly as it did at the end of Task 5 (this task only removed now-unused code/config, it shouldn't change behavior).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove Base44 SDK, plugin, and platform config"
```

---

## Task 7: Dev-only seed script

**Files:**
- Create: `scripts/seed.js`
- Modify: `package.json` (add an `npm run seed` convenience script)

**Interfaces:** None — standalone dev tool, not imported by app code.

- [ ] **Step 1: Create `scripts/seed.js`**

```js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example) before running this script.');
  process.exit(1);
}

const targetEmail = process.argv[2];
if (!targetEmail) {
  console.error('Usage: node --env-file=.env scripts/seed.js <user-email>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MOODS = [10, 11, 13, 19, 5, 4, 8];
const ALTERNATIVES = ['Went for a walk', 'Deep breathing', 'Called a friend', 'Journaled'];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function findUserId(email) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user found with email ${email}. Sign up in the app first, then re-run this script.`);
  return user.id;
}

async function seed() {
  const userId = await findUserId(targetEmail);

  const dailyLogs = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return {
      user_id: userId,
      date: date.toISOString().slice(0, 10),
      moods: [randomFrom(MOODS)],
      self_harmed: Math.random() < 0.1,
      journal: i % 3 === 0 ? `Sample journal entry for day ${i}.` : null,
      alternatives_used: Math.random() < 0.4 ? [randomFrom(ALTERNATIVES)] : [],
    };
  });

  const vents = [
    { user_id: userId, content: 'Sample vent: today was a rough day.', anonymous_name: 'Anonymous' },
    { user_id: userId, content: 'Sample vent: feeling a bit better now.', anonymous_name: 'Anonymous' },
  ];

  const { error: logsError } = await supabase.from('daily_logs').insert(dailyLogs);
  if (logsError) throw logsError;

  const { error: ventsError } = await supabase.from('vents').insert(vents);
  if (ventsError) throw ventsError;

  console.log(`Seeded ${dailyLogs.length} daily logs and ${vents.length} vents for ${targetEmail}.`);
}

seed().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Add the convenience npm script**

In `package.json`'s `"scripts"` block, add:

```json
"seed": "node --env-file=.env scripts/seed.js"
```

(Requires Node 20.6+ for `--env-file`; this repo's `@types/node` devDependency is `^22`, so that's already assumed.)

- [ ] **Step 3: Run it against your test account**

```bash
npm run seed -- your-test-account@example.com
```

Expected: `Seeded 14 daily logs and 2 vents for your-test-account@example.com.` printed, and in the Supabase Table Editor those rows now exist for that user. Sign into the app as that user and confirm the calendar/journal/vent feed show the seeded data.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.js package.json
git commit -m "feat: add dev-only Supabase seed script"
```

---

## Task 8: Docs update + final verification

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:** None.

- [ ] **Step 1: Rewrite `README.md`**

Replace the entire file with:

```markdown
# Eir

A private wellness app for journaling, breathing, and getting through hard moments — crisis contacts, grounding activities, and a mood calendar, all in one place.

## Stack

React 18 + Vite, Tailwind CSS + Radix UI, Supabase (Postgres + Auth).

## Local development

1. Install dependencies: `npm install`
2. Create a Supabase project at https://supabase.com and run the migration in `supabase/migrations/0001_init.sql` against it (SQL Editor → paste → run).
3. Copy `.env.example` to `.env` and fill in your Supabase project's URL and keys.
4. Run the app: `npm run dev`

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run typecheck` — type-check with `tsc`
- `npm run seed -- <email>` — populate sample daily logs/vents for a test account (requires `SUPABASE_SECRET_KEY` in `.env`; never used client-side)

## Contact

Questions or feedback: Contact@eirselfhelp.com
```

- [ ] **Step 2: Update `CLAUDE.md`**

Open `CLAUDE.md` and replace the "Architecture" section's Base44-specific paragraphs (backend access, and the `base44/` directory mention) with:

```markdown
**Backend access**: `src/lib/supabaseClient.js` creates the single Supabase client (`supabase`) using `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Thin wrapper modules — `src/api/dailyLogs.js`, `src/api/vents.js` — are the only places that call `supabase.from(...)` directly; pages import from these rather than querying Supabase inline. `supabase/migrations/0001_init.sql` is the schema/RLS source of truth (tables: `profiles`, `daily_logs`, `vents`; every table scoped by row-level security to `auth.uid()`, with an admin-bypass policy gated by a `profiles.role` column — no admin UI exists yet, this is schema-level groundwork only). `scripts/seed.js` is a dev-only script (uses the secret key, never shipped to the client) that populates sample data for a test account: `npm run seed -- <email>`.

**Auth**: `src/lib/AuthContext.jsx` (`AuthProvider`/`useAuth`) wraps the whole app and exposes `user` (merged Supabase session + `profiles` row, or `null`), `isAuthenticated`, `isLoadingAuth`, `logout()`, and `updateProfile(fields)`. `App.jsx`'s `AuthenticatedApp` gates on these: unauthenticated users only reach `/login` (`src/pages/Login.jsx` — email/password plus Google/Apple OAuth via `supabase.auth.signInWithOAuth`); everyone else gets the full route tree under `AppLayout`.
```

Also update the "Commands" section's env var block to match the `README.md` instructions above (Supabase vars instead of `VITE_BASE44_*`), and remove the "There is no test runner..." caveat's implicit Base44 framing if present (it should stay — it's still true — just make sure nothing nearby still references Base44).

- [ ] **Step 3: Final full-repo verification**

```bash
grep -ril "base44" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs
npm run lint
npm run typecheck
npm run build
```

Expected: the `grep` prints nothing; lint, typecheck, and build all succeed.

- [ ] **Step 4: Full manual QA pass**

Using two separate test accounts (Account A, Account B):
1. Sign up Account A (email/password). Confirm the email via Supabase dashboard if confirmation is required, then sign in.
2. Create a daily log, post a vent, set a display name in Settings.
3. Sign out, sign up Account B, sign in.
4. Confirm Account B sees an empty calendar and empty vent feed (no data from Account A) — this is the RLS isolation check.
5. In the Supabase SQL editor, run `select id, role from profiles;` and confirm both accounts show `role = 'user'`.
6. Sign back into Account A, confirm its data is still there (reload the page too, to rule out anything cached only in memory).
7. Test "Delete Account" on Account B in Settings; confirm its `daily_logs`/`vents` rows are gone from the Supabase tables afterward and you're returned to `/login`.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update README and CLAUDE.md for the Supabase-based setup"
```
