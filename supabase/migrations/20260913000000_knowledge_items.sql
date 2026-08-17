-- Thẻ kiến thức: một câu hỏi, một câu trả lời, một thể loại.
create table if not exists public.knowledge_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  question   text not null check (length(trim(question)) > 0),
  answer     text not null default '',
  category   text not null default 'Chung',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists knowledge_items_user_idx
  on public.knowledge_items(user_id, created_at desc) where deleted_at is null;

alter table public.knowledge_items enable row level security;
do $$ begin
  create policy "own knowledge items" on public.knowledge_items for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
