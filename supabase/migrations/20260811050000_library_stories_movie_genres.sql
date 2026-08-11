alter type public.media_type add value if not exists 'STORY';

create table if not exists public.movie_genres (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

alter table public.media_items
  add column if not exists movie_genre_id uuid references public.movie_genres(id) on delete set null;

create index if not exists media_items_movie_genre_idx
  on public.media_items(user_id, movie_genre_id) where deleted_at is null;

drop trigger if exists movie_genres_updated on public.movie_genres;
create trigger movie_genres_updated before update on public.movie_genres
  for each row execute function public.set_updated_at();

alter table public.movie_genres enable row level security;
drop policy if exists "own movie genres" on public.movie_genres;
create policy "own movie genres" on public.movie_genres
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
