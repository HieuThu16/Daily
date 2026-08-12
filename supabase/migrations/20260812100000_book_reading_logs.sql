-- Migration: 20260812100000_book_reading_logs
-- Thêm book_format cho media_items (READ / LISTEN)
-- Tạo bảng book_reading_logs để lưu lịch sử đọc/nghe sách theo ngày

-- 1. Thêm cột book_format vào media_items
alter table public.media_items
  add column if not exists book_format text
    check (book_format in ('READ', 'LISTEN'));

-- 2. Default existing BOOK items to READ
update public.media_items
  set book_format = 'READ'
  where type = 'BOOK' and book_format is null;

-- 3. Tạo bảng book_reading_logs
create table if not exists public.book_reading_logs (
  id             uuid        primary key default gen_random_uuid(),
  media_item_id  uuid        not null references public.media_items(id) on delete cascade,
  user_id        uuid        not null default auth.uid() references auth.users(id),
  log_date       date        not null default current_date,
  -- Cho sách đọc
  page           integer     check (page is null or page >= 0),
  -- Cho sách nghe
  listen_hours   integer     not null default 0 check (listen_hours >= 0),
  listen_minutes integer     not null default 0 check (listen_minutes >= 0 and listen_minutes < 60),
  -- Ghi chú tuỳ ý
  note           text,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index if not exists book_reading_logs_item_date_idx
  on public.book_reading_logs(media_item_id, log_date) where deleted_at is null;

create index if not exists book_reading_logs_user_idx
  on public.book_reading_logs(user_id) where deleted_at is null;

alter table public.book_reading_logs enable row level security;

do $$ begin
  create policy "own book reading logs" on public.book_reading_logs
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
