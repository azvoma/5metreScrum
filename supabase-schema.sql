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
