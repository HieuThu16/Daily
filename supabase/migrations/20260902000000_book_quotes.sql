-- Trích dẫn / highlight khi đọc sách; lưu kèm tựa sách và tác giả để đọc lại độc lập.
create table if not exists public.book_quotes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id),
  media_item_id uuid references public.media_items(id) on delete set null,
  book_name     text not null default '',
  author        text,
  quote         text not null check (length(trim(quote)) > 0),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists book_quotes_user_idx
  on public.book_quotes(user_id, media_item_id) where deleted_at is null;

alter table public.book_quotes enable row level security;
do $$ begin
  create policy "own book quotes" on public.book_quotes for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
