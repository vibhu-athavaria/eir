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
