-- 1. Table for Book Authors
create table if not exists public.book_authors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2. Table for YouTube Channels
create table if not exists public.youtube_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3. Table for Music Artists
create table if not exists public.music_artists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Enable RLS and public access
alter table public.book_authors enable row level security;
alter table public.youtube_channels enable row level security;
alter table public.music_artists enable row level security;

do $$ begin
  create policy "Public book_authors access" on public.book_authors for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Public youtube_channels access" on public.youtube_channels for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Public music_artists access" on public.music_artists for all using (true) with check (true);
exception when duplicate_object then null; end $$;
