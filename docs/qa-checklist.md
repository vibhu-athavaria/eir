# Manual QA checklist

No browser automation tool was available for any part of the Base44→Supabase migration or the follow-up hardening work — everything was verified via live REST/psql calls against the real database instead (which is how the RLS security guarantees actually got tested end-to-end), but the actual React UI has never been clicked through by a human or a tool. This checklist covers what that pass should check. Run it once against a deployed build (or `npm run dev`) with a real Supabase project wired up.

Use two separate accounts (A and B) for the isolation checks — two different email addresses, or one of each OAuth provider if configured.

## Auth

- [ ] **Sign up** with email/password. If email confirmation is on (default), check you receive a confirmation email and clicking it lets you sign in.
- [ ] **Sign in** with email/password.
- [ ] **Sign out**, then reload — confirm you land on `/login`, not the app.
- [ ] **Session persists**: sign in, reload the page — confirm you're still signed in (not bounced to `/login`).
- [ ] **Forgot password**: click "Forgot password?" on the login page, enter your email, check you receive a reset email, click the link, confirm it lands on a "Set a new password" form (not the main app), set a new password, confirm you can sign in with it afterward.
- [ ] **Expired/invalid reset link**: navigate directly to `/reset-password` without clicking a real email link — confirm you see a "Link expired" state with a way back to sign-in, not a crash or the main app.
- [ ] **Google sign-in** (once configured per the README) — confirm the button actually completes a sign-in.
- [ ] **Apple sign-in** (once configured per the README) — same.
- [ ] **404 page**: navigate to a nonexistent path (e.g. `/does-not-exist`) — confirm a plain 404 page, no crash, no stray admin/debug text.

## First-time onboarding (needs a brand-new account)

- [ ] On first sign-in, confirm the **tutorial overlay** appears, and dismissing it works.
- [ ] Confirm the **location-permission prompt** appears after the tutorial, and dismissing/answering it works.
- [ ] **Reload the page** — confirm neither overlay reappears (they should only ever show once per account).
- [ ] Confirm there's no flash of either overlay on a normal sign-in with an account that already completed onboarding (this was a real bug that got fixed — worth specifically checking it stayes fixed).

## Home (mood calendar)

- [ ] Tap **"Log Today"**, pick a mood (or several), optionally mark "self-harmed" and add a journal note, save.
- [ ] Confirm the calendar shows today marked, and the **"days clean" counter** updates correctly.
- [ ] **Edit the same day's log** (tap it again, change something, save) — confirm it updates the existing entry rather than creating a duplicate.
- [ ] Reload the page — confirm the calendar and clean-days counter still reflect the saved data (not just the optimistic UI from before reload).
- [ ] Try logging the **same day twice in quick succession** (e.g. two browser tabs, or fast double-save) — confirm you don't end up with two entries for one date (this is what the `(user_id, date)` uniqueness constraint + upsert should prevent).

## Journal History

- [ ] Confirm entries with journal text show up, most recent first, with correct dates.

## Vent

- [ ] Post a vent, confirm it appears immediately in the feed below.
- [ ] Confirm only your own vents show (not a public feed — vents are private per-account by design).

## Settings

- [ ] Change **"Your Name"**, save, reload — confirm it persists (this reads from your Supabase profile, not local browser state).
- [ ] Toggle the **daily reminder** on, set a time, confirm the browser asks for notification permission.
- [ ] Try each **color theme** — confirm the whole app's accent color updates.
- [ ] **Delete Account**: read the dialog copy carefully — it should say your journal data is deleted but your login/account isn't. Confirm it, then check: you're signed out to `/login`, and (if you have Supabase dashboard access) that your `daily_logs`/`vents` rows are actually gone but your `profiles` row and login still exist.

## Cross-account isolation (the actual security guarantee — do this one carefully)

- [ ] Sign in as **Account A**, log a mood entry and post a vent.
- [ ] Sign out, sign in as **Account B** (different account).
- [ ] Confirm Account B's calendar is **empty** and the vent feed is **empty** — no trace of Account A's data.
- [ ] Sign back into Account A — confirm its data is still there.
- [ ] On a **shared device**: sign out of A, immediately sign in as B (within a few seconds) — confirm B never briefly sees A's data on the very first render (this is the query-cache leak that got fixed — worth specifically re-checking).

## Other pages (smoke test — these weren't touched by the migration, but confirm nothing broke)

- [ ] **Activities** — each breathing/grounding exercise opens and runs.
- [ ] **Alternatives** ("Right Now") — loads and is usable.
- [ ] **Progress** ("Check-in") — mood trend chart and streak milestones render with your logged data.
- [ ] **Emergency Contacts** ("Help") — crisis contact list loads, location-based nearest-hotline lookup works if you granted location.

## Responsive / visual

- [ ] Check the app at phone width (~375-400px) — bottom nav, calendar, and forms should all be usable, not cut off or overlapping.
- [ ] Check both light and dark system theme (or the in-app theme toggle) — no illegible text or broken contrast.
