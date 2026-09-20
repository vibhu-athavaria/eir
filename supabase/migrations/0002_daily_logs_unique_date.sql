-- Prevent duplicate daily_logs rows for the same user+date. Home.jsx previously decided
-- insert-vs-update by searching the React Query cache rather than the database, which
-- could create two rows for one date (two tabs, a save inside the optimistic-update
-- window, or a stale cache — scripts/seed.js run twice reproduces it trivially). This
-- constraint makes (user_id, date) atomic at the database layer so the app can switch to
-- an upsert-based save instead of a client-side existence check.

alter table public.daily_logs add constraint daily_logs_user_id_date_key unique (user_id, date);
