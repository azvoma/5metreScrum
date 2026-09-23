-- ================================================================
-- 5 METRE SCRUM — DATABASE SCHEMA
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- Safe to run more than once.
-- ================================================================

-- ── PLAYERS TABLE ────────────────────────────────────────────────
create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  email         text,
  first_name    text not null,
  last_name     text not null,
  dob           date,
  country       text,
  city          text,
  position      text,
  height_cm     numeric,
  weight_kg     numeric,
  reach_cm      numeric,
  wingspan_cm   numeric,
  bronco        text,          -- stored as entered, e.g. "4:41"
  sprint_10     numeric,       -- seconds
  sprint_40     numeric,       -- seconds
  vo2max        numeric,
  deadlift_kg   numeric,
  squat_kg      numeric,
  bench_kg      numeric,
  vjump_cm      numeric,
  clubs         jsonb default '[]'::jsonb,   -- [{name, from, to, apps}]
  passports     text[] default '{}',         -- e.g. {EU, UK}
  video_url     text,
  video_title   text,
  video_file_url text,
  headshot_url  text,
  plan          text,
  published     boolean not null default true
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────
alter table public.players enable row level security;

-- Anyone can read published profiles (this powers the Scout Board)
drop policy if exists "Public can read published players" on public.players;
create policy "Public can read published players"
  on public.players for select
  using (published = true);

-- Anyone can register a profile (MVP — tighten to authenticated
-- users once Netlify Identity / Supabase Auth is linked up)
drop policy if exists "Public can register a profile" on public.players;
create policy "Public can register a profile"
  on public.players for insert
  with check (true);

-- No public update/delete policies: profiles cannot be edited or
-- removed from the browser. Manage rows in the Supabase dashboard.

-- ── FILE STORAGE BUCKETS ─────────────────────────────────────────
-- Headshots capped at 5MB, videos at 200MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('headshots', 'headshots', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('highlight-videos', 'highlight-videos', true, 209715200, array['video/mp4','video/quicktime','video/x-msvideo'])
on conflict (id) do nothing;

drop policy if exists "Public can upload headshots" on storage.objects;
create policy "Public can upload headshots"
  on storage.objects for insert
  with check (bucket_id = 'headshots');

drop policy if exists "Public can read headshots" on storage.objects;
create policy "Public can read headshots"
  on storage.objects for select
  using (bucket_id = 'headshots');

drop policy if exists "Public can upload highlight videos" on storage.objects;
create policy "Public can upload highlight videos"
  on storage.objects for insert
  with check (bucket_id = 'highlight-videos');

drop policy if exists "Public can read highlight videos" on storage.objects;
create policy "Public can read highlight videos"
  on storage.objects for select
  using (bucket_id = 'highlight-videos');

-- ================================================================
-- VACANCY BOARD (added Sept 2026)
-- Clubs post roles; players are ranked against each role by a
-- 0–100 Fit Score (see js/fit-score.js). Safe to run more than once.
-- ================================================================

-- ── PLAYERS: playing level (needed for Fit Score) ────────────────
alter table public.players
  add column if not exists playing_level text
  check (playing_level in ('Professional', 'Semi-Pro', 'Amateur'));

-- ── CLUBS TABLE ──────────────────────────────────────────────────
create table if not exists public.clubs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  league        text,
  country       text,
  contact_name  text,
  contact_email text
);

alter table public.clubs enable row level security;

drop policy if exists "Public can read clubs" on public.clubs;
create policy "Public can read clubs"
  on public.clubs for select
  using (true);

-- MVP: anyone can register a club. Tighten to authenticated scouts
-- once Netlify Identity / Supabase Auth is live.
drop policy if exists "Public can register a club" on public.clubs;
create policy "Public can register a club"
  on public.clubs for insert
  with check (true);

-- ── VACANCIES TABLE ──────────────────────────────────────────────
create table if not exists public.vacancies (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  title              text,
  primary_position   text not null,
  secondary_position text,
  required_passport  text not null default 'ANY'
                     check (required_passport in ('ANY', 'EU', 'UK', 'IRE', 'AUS')),
  minimum_level      text not null default 'Amateur'
                     check (minimum_level in ('Professional', 'Semi-Pro', 'Amateur')),
  stipend_offered    numeric,                 -- per month, in stipend_currency
  stipend_currency   text not null default 'GBP'
                     check (stipend_currency in ('GBP', 'EUR', 'USD', 'AUD', 'NZD', 'ZAR')),
  notes              text,
  status             text not null default 'open'
                     check (status in ('open', 'closed'))
);

create index if not exists vacancies_club_id_idx on public.vacancies (club_id);
create index if not exists vacancies_status_idx on public.vacancies (status);

alter table public.vacancies enable row level security;

drop policy if exists "Public can read open vacancies" on public.vacancies;
create policy "Public can read open vacancies"
  on public.vacancies for select
  using (status = 'open');

-- MVP: anyone can post a vacancy. Tighten to the club's own scouts
-- once logins are live.
drop policy if exists "Public can post a vacancy" on public.vacancies;
create policy "Public can post a vacancy"
  on public.vacancies for insert
  with check (true);

-- No public update/delete policies: vacancies are closed in the
-- Supabase Table Editor (set status to 'closed') until club logins
-- exist, so one visitor can't close another club's roles.

-- ================================================================
-- ACCOUNTS, AGENT ROSTERS & STAFF PROFILES (added Sept 2026)
-- Uses Supabase Auth (Authentication → Users). Safe to run more
-- than once.
-- ================================================================

-- ── ACCOUNTS: one row per signed-up user ─────────────────────────
create table if not exists public.accounts (
  id            uuid primary key references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  account_type  text not null default 'player'
                check (account_type in ('agent', 'staff', 'player', 'club')),
  display_name  text,
  agency_name   text,
  email         text
);

alter table public.accounts enable row level security;

drop policy if exists "Users can read their own account" on public.accounts;
create policy "Users can read their own account"
  on public.accounts for select
  using (id = auth.uid());

-- Users may edit their name/agency, but never their account type
drop policy if exists "Users can update their own account" on public.accounts;
create policy "Users can update their own account"
  on public.accounts for update
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.accounts from anon, authenticated;
grant update (display_name, agency_name) on public.accounts to authenticated;

-- Create the account row automatically when someone signs up.
-- The sign-up form passes account_type, display_name and
-- agency_name as user metadata. Only agent/staff/player are
-- accepted from the browser; 'club' is set by an admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'account_type', 'player');
begin
  if requested not in ('agent', 'staff', 'player') then
    requested := 'player';
  end if;
  insert into public.accounts (id, account_type, display_name, agency_name, email)
  values (
    new.id,
    requested,
    left(new.raw_user_meta_data ->> 'display_name', 120),
    left(new.raw_user_meta_data ->> 'agency_name', 120),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_account_type(t text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.accounts
    where id = auth.uid() and account_type = t
  );
$$;

-- ── PLAYERS: agent ownership ─────────────────────────────────────
alter table public.players
  add column if not exists agent_id uuid references public.accounts(id) on delete set null,
  add column if not exists updated_at timestamptz;

create index if not exists players_agent_id_idx on public.players (agent_id);

-- Public sign-ups can no longer attach themselves to an agent
drop policy if exists "Public can register a profile" on public.players;
create policy "Public can register a profile"
  on public.players for insert
  with check (agent_id is null);

drop policy if exists "Agents can read their roster" on public.players;
create policy "Agents can read their roster"
  on public.players for select
  using (agent_id = auth.uid());

drop policy if exists "Agents can add players to their roster" on public.players;
create policy "Agents can add players to their roster"
  on public.players for insert
  to authenticated
  with check (agent_id = auth.uid() and public.is_account_type('agent'));

drop policy if exists "Agents can edit their roster" on public.players;
create policy "Agents can edit their roster"
  on public.players for update
  to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- (Clubs and scouts keep reading published profiles through the
-- existing "Public can read published players" policy.)

-- ── STAFF PROFILES ───────────────────────────────────────────────
create table if not exists public.staff_profiles (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz,
  account_id        uuid not null unique references public.accounts(id) on delete cascade,
  first_name        text not null,
  last_name         text not null,
  country           text,
  city              text,
  role              text not null
                    check (role in ('Head Coach', 'Assistant Coach', 'S&C Coach', 'Physio', 'Analyst')),
  qualifications    text[] not null default '{}',
  years_experience  integer check (years_experience between 0 and 60),
  previous_clubs    jsonb not null default '[]'::jsonb,   -- [{name, role, from, to}]
  bio               text,
  published         boolean not null default true
);

create index if not exists staff_profiles_role_idx on public.staff_profiles (role);

alter table public.staff_profiles enable row level security;

drop policy if exists "Public can read published staff" on public.staff_profiles;
create policy "Public can read published staff"
  on public.staff_profiles for select
  using (published = true);

drop policy if exists "Staff can read their own profile" on public.staff_profiles;
create policy "Staff can read their own profile"
  on public.staff_profiles for select
  using (account_id = auth.uid());

drop policy if exists "Staff can create their profile" on public.staff_profiles;
create policy "Staff can create their profile"
  on public.staff_profiles for insert
  to authenticated
  with check (account_id = auth.uid() and public.is_account_type('staff'));

drop policy if exists "Staff can edit their profile" on public.staff_profiles;
create policy "Staff can edit their profile"
  on public.staff_profiles for update
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());
