-- Migration: 20260813020000_book_documents
-- Sách nhập từ PDF/EPUB: nội dung đã bóc tách + tiến độ đọc
-- Hai bảng này KHÔNG có deleted_at: nội dung là dẫn xuất từ file gốc, luôn nhập lại
-- được, và soft-delete sẽ khiến unique(media_item_id) chặn lần nhập lại kế tiếp.

create table if not exists public.book_documents (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null default auth.uid() references auth.users(id),
  media_item_id     uuid        not null unique references public.media_items(id) on delete cascade,
  source_format     text        not null check (source_format in ('PDF', 'EPUB')),
  source_filename   text,
  total_chars       integer     not null default 0,
  page_count        integer,
  est_pages         integer     not null default 1,
  chapter_count     integer     not null default 0,
  -- tiến độ đọc (gộp vào đây vì quan hệ với media_items là 1:1)
  last_chapter_idx  integer     not null default 0,
  last_scroll_ratio real        not null default 0 check (last_scroll_ratio >= 0 and last_scroll_ratio <= 1),
  last_char_offset  integer     not null default 0,
  percent           real        not null default 0 check (percent >= 0 and percent <= 100),
  last_read_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.book_chapters (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid() references auth.users(id),
  document_id  uuid        not null references public.book_documents(id) on delete cascade,
  idx          integer     not null,
  title        text        not null,
  content      text        not null,
  char_count   integer     not null default 0,
  char_offset  integer     not null default 0,
  created_at   timestamptz not null default now(),
  unique (document_id, idx)
);

create index if not exists book_documents_user_idx on public.book_documents(user_id);
create index if not exists book_chapters_document_idx on public.book_chapters(document_id, idx);

alter table public.book_documents enable row level security;
alter table public.book_chapters  enable row level security;

do $$ begin
  create policy "own book documents" on public.book_documents
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own book chapters" on public.book_chapters
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
