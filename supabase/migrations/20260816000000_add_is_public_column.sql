-- Migration: Add is_public column to media_items
-- Cho phép đánh dấu sách/mục thư viện là công khai (mọi người đều xem được)
-- hoặc riêng tư (chỉ mình xem)

alter table public.media_items 
  add column if not exists is_public boolean not null default true;

-- Tạo index để tăng tốc query sách công khai
create index if not exists media_items_is_public_idx 
  on public.media_items(is_public) 
  where deleted_at is null;

-- Comment
comment on column public.media_items.is_public is 
  'true = công khai cho mọi người, false = riêng tư cá nhân';
