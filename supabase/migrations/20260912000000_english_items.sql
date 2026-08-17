-- Thẻ học tiếng Anh: từ vựng hoặc câu, kèm nghĩa, ví dụ và tag.
create table if not exists public.english_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  kind       text not null default 'WORD' check (kind in ('WORD', 'SENTENCE')),
  term       text not null check (length(trim(term)) > 0),
  meaning    text not null default '',
  example    text,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists english_items_user_idx
  on public.english_items(user_id, created_at desc) where deleted_at is null;

alter table public.english_items enable row level security;
do $$ begin
  create policy "own english items" on public.english_items for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
