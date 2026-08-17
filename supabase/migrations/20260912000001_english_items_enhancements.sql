-- Thêm cột đánh dấu đã học (is_learned), màu sắc thẻ (color) và cover ảnh (cover_url) cho english_items
alter table public.english_items
  add column if not exists is_learned boolean not null default false,
  add column if not exists color text,
  add column if not exists cover_url text;

create index if not exists english_items_user_learned_idx
  on public.english_items(user_id, is_learned, created_at desc) where deleted_at is null;
