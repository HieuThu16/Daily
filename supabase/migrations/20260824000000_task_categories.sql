-- Thể loại công việc. Mỗi người một danh sách riêng (khác các bảng danh mục cũ của
-- Library đang dùng chung cho mọi tài khoản).

create table if not exists public.task_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists task_categories_user_idx on public.task_categories(user_id) where deleted_at is null;

alter table public.task_categories enable row level security;

do $$ begin
  create policy "own task categories" on public.task_categories for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Lưu tên thể loại thẳng trên todo (giống author/genre của media_items): danh sách ngắn,
-- đổi tên thì cập nhật kèm, khỏi join ở mọi màn hình.
alter table public.todos add column if not exists category text;
