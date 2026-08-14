-- Migration: Create book_highlights table for storing book text highlights
create table if not exists public.book_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  book_name text not null,
  author text,
  chapter_title text,
  highlight text not null,
  color text default 'yellow',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists book_highlights_user_book_idx
  on public.book_highlights (user_id, media_item_id);

alter table public.book_highlights enable row level security;

do $$ begin
  create policy "own book_highlights" on public.book_highlights
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
