-- Bảng Bộ sưu tập tổng hợp đa năng: Sách, Truyện H, Truyện Manga, YouTube, Nhạc, Nhật ký
create table if not exists public.user_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  item_type text not null, -- 'DIARY' | 'BOOK' | 'TRUYEN_H' | 'MANGA' | 'YOUTUBE' | 'MUSIC'
  item_id text not null,
  title text not null,
  subtitle text,
  image_url text,
  url text,
  category text,
  metadata jsonb default '{}'::jsonb,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists user_collections_user_type_idx
  on public.user_collections(user_id, item_type) where deleted_at is null;

create unique index if not exists user_collections_unique_idx
  on public.user_collections(user_id, item_type, item_id) where deleted_at is null;

alter table public.user_collections enable row level security;

do $$ begin
  create policy "own collections" on public.user_collections for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
