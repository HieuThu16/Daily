alter table public.media_items add column if not exists actor text;

create table if not exists public.movie_actors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

drop trigger if exists movie_actors_updated on public.movie_actors;
create trigger movie_actors_updated before update on public.movie_actors
  for each row execute function public.set_updated_at();

alter table public.movie_actors enable row level security;
drop policy if exists "own movie actors" on public.movie_actors;
create policy "own movie actors" on public.movie_actors
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
