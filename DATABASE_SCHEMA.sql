-- =============================================================================
--  DAILY APP — FULL DATABASE SCHEMA (tổng hợp tất cả migrations)
--  Cập nhật lần cuối: 2026-08-12
--
--  Chạy file này trên Supabase SQL Editor để khởi tạo toàn bộ database từ đầu.
--  Tất cả câu lệnh đều idempotent (có thể chạy lại nhiều lần không bị lỗi).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS & ENUMS
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

do $$ begin create type media_type as enum ('BOOK','MOVIE','YOUTUBE','MUSIC','STORY'); exception when duplicate_object then null; end $$;
do $$ begin create type media_status as enum ('PLANNED','IN_PROGRESS','COMPLETED');   exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 1. SHARED TRIGGER FUNCTION (auto-update updated_at)
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;


-- ===========================================================================
-- SECTION A: DAILY JOURNAL
-- ===========================================================================

-- migration: 20260811000000_initial_schema + 20260811020000_daily_entry_types
create table if not exists public.daily_entries (
  id         uuid       primary key default gen_random_uuid(),
  user_id    uuid       not null default auth.uid() references auth.users(id),
  entry_date date       not null,
  entry_type text       not null default 'FEELING'
             check (entry_type in ('FEELING','NEW_THING','SAD_THING','SMALL_WIN')),
  content    text       not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists daily_entries_user_date_idx
  on public.daily_entries(user_id, entry_date) where deleted_at is null;
create index if not exists daily_entries_user_date_type_idx
  on public.daily_entries(user_id, entry_date, entry_type) where deleted_at is null;

alter table public.daily_entries enable row level security;
do $$ begin
  create policy "own daily" on public.daily_entries
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger daily_updated before update on public.daily_entries
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- ===========================================================================
-- SECTION B: HABITS
-- ===========================================================================

-- migration: 20260811010000_habit_categories
create table if not exists public.habit_categories (
  id         uuid       primary key default gen_random_uuid(),
  user_id    uuid       not null default auth.uid() references auth.users(id),
  name       text       not null check (length(trim(name)) > 0),
  color      text       not null default '#466147',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

alter table public.habit_categories enable row level security;
do $$ begin
  create policy "own habit categories" on public.habit_categories
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger habit_categories_updated before update on public.habit_categories
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- migration: 20260811000000 + 010000 + 030000 + 090000 + 093000 + 130000
create table if not exists public.habits (
  id            uuid    primary key default gen_random_uuid(),
  user_id       uuid    not null default auth.uid() references auth.users(id),
  name          text    not null check (length(trim(name)) > 0),
  is_active     boolean not null default true,
  category_id   uuid    references public.habit_categories(id) on delete set null,
  tracking_type text    not null default 'CHECK'   check (tracking_type in ('CHECK','COUNT')),
  daily_target  integer not null default 1          check (daily_target > 0),
  habit_type    text    not null default 'GOOD'     check (habit_type in ('GOOD','BAD')),
  routine       text             default 'MORNING'  check (routine in ('MORNING','AFTERNOON','EVENING')),
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists habits_user_idx          on public.habits(user_id)              where deleted_at is null;
create index if not exists habits_user_category_idx on public.habits(user_id, category_id) where deleted_at is null;

alter table public.habits enable row level security;
do $$ begin
  create policy "own habits" on public.habits
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger habits_updated before update on public.habits
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- Backfill routine for existing rows
update public.habits set routine = 'MORNING' where routine is null;


-- migration: 20260811000000 + 030000
create table if not exists public.habit_logs (
  id         uuid    primary key default gen_random_uuid(),
  habit_id   uuid    not null references public.habits(id),
  user_id    uuid    not null default auth.uid() references auth.users(id),
  date       date    not null,
  completed  boolean not null default false,
  value      integer not null default 0 check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, date)
);

alter table public.habit_logs enable row level security;
do $$ begin
  create policy "own habit logs" on public.habit_logs
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger habit_logs_updated before update on public.habit_logs
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- ===========================================================================
-- SECTION C: TODOS & IDEAS
-- ===========================================================================

-- migration: 20260811000000 + 040000 + 053000 + 060000 + 20260812000000 + 20260814000000
create table if not exists public.todos (
  id               uuid    primary key default gen_random_uuid(),
  user_id          uuid    not null default auth.uid() references auth.users(id),
  title            text    not null check (length(trim(title)) > 0),
  completed        boolean not null default false,
  due_date         date    default current_date,
  due_time         text,   -- 'HH:MM' giờ hạn chót; null = cả ngày
  difficulty       text    not null default 'EASY' check (difficulty in ('EASY','NORMAL','HARD')),
  priority         text    not null default 'NORMAL' check (priority in ('NORMAL','URGENT')),
  postpone_count   integer not null default 0,
  postpone_minutes integer not null default 0,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists todos_user_idx on public.todos(user_id) where deleted_at is null;

alter table public.todos enable row level security;
do $$ begin
  create policy "own todos" on public.todos
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger todos_updated before update on public.todos
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- Alter table & Backfill for existing installations
alter table public.todos add column if not exists difficulty text not null default 'EASY' check (difficulty in ('EASY','NORMAL','HARD'));
alter table public.todos add column if not exists priority text not null default 'NORMAL' check (priority in ('NORMAL','URGENT'));
alter table public.todos add column if not exists due_time text;
alter table public.todos add column if not exists postpone_count integer not null default 0;
alter table public.todos add column if not exists postpone_minutes integer not null default 0;
update public.todos set difficulty = 'EASY' where difficulty is null;
update public.todos set priority = 'NORMAL' where priority is null;


-- migration: 20260814000000 — lịch sử từng lần trì hoãn công việc
create table if not exists public.task_postpones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id),
  todo_id       uuid not null references public.todos(id) on delete cascade,
  minutes       integer not null check (minutes > 0),
  reason        text,
  prev_due_date date,
  prev_due_time text,
  new_due_date  date,
  new_due_time  text,
  created_at    timestamptz not null default now()
);

create index if not exists task_postpones_todo_idx on public.task_postpones(todo_id);
create index if not exists task_postpones_user_created_idx on public.task_postpones(user_id, created_at desc);

alter table public.task_postpones enable row level security;
do $$ begin
  create policy "own task postpones" on public.task_postpones
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;


-- migration: 20260811000000
create table if not exists public.ideas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  title      text not null check (length(trim(title)) > 0),
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ideas_user_idx on public.ideas(user_id) where deleted_at is null;

alter table public.ideas enable row level security;
do $$ begin
  create policy "own ideas" on public.ideas
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger ideas_updated before update on public.ideas
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- ===========================================================================
-- SECTION D: LIBRARY (MEDIA ITEMS + LOOKUP TABLES)
-- ===========================================================================

-- migration: 20260811000000 + 033000 + 060000 + 070000 + 080000 + 100000
create table if not exists public.media_items (
  id             uuid          primary key default gen_random_uuid(),
  user_id        uuid          not null default auth.uid() references auth.users(id),
  type           media_type    not null,
  name           text          not null check (length(trim(name)) > 0),
  description    text,
  status         media_status  not null default 'PLANNED',
  is_favorite    boolean       not null default false,
  -- relationship metadata
  channel        text,   -- YouTube channel name
  artist         text,   -- Music artist name
  author         text,   -- Book author name
  actor          text,   -- Movie actor name
  genre          text,   -- Genre (free-text)
  movie_genre_id uuid,   -- FK to movie_genres (structured)
  -- watch/read log
  log_date       text,
  log_time       text,
  -- book-specific: format READ or LISTEN
  book_format    text        check (book_format in ('READ', 'LISTEN')),
  -- migration: 20260815000000_person_occasions_media_cover — URL ảnh bìa,
  -- file nằm trong bucket book-covers (20260818000000_book_covers_storage)
  cover_url      text,
  -- migration: 20260816000000_add_is_public_column — công khai hay riêng tư
  is_public      boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- migration: 20260812100000_book_reading_logs
-- Book reading/listening progress log (one row per day per book)
create table if not exists public.book_reading_logs (
  id             uuid        primary key default gen_random_uuid(),
  media_item_id  uuid        not null references public.media_items(id) on delete cascade,
  user_id        uuid        not null default auth.uid() references auth.users(id),
  log_date       date        not null default current_date,
  page           integer     check (page is null or page >= 0),
  listen_hours   integer     not null default 0 check (listen_hours >= 0),
  listen_minutes integer     not null default 0 check (listen_minutes >= 0 and listen_minutes < 60),
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

-- Backfill: existing BOOK items default to READ format
alter table public.media_items
  add column if not exists book_format text check (book_format in ('READ', 'LISTEN'));
update public.media_items set book_format = 'READ' where type = 'BOOK' and book_format is null;

create index if not exists media_items_user_type_status_idx
  on public.media_items(user_id, type, status) where deleted_at is null;
create index if not exists media_items_movie_genre_idx
  on public.media_items(user_id, movie_genre_id) where deleted_at is null;
create index if not exists media_items_is_public_idx
  on public.media_items(is_public) where deleted_at is null;

alter table public.media_items enable row level security;
do $$ begin
  create policy "view own and public media" on public.media_items
    for select using (user_id = auth.uid() or is_public = true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "manage own media" on public.media_items
    for insert with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "update own media" on public.media_items
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "delete own media" on public.media_items
    for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger media_updated before update on public.media_items
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- migration: 20260811050000_library_stories_movie_genres
create table if not exists public.movie_genres (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

alter table public.media_items
  add column if not exists movie_genre_id uuid references public.movie_genres(id) on delete set null;

alter table public.movie_genres enable row level security;
do $$ begin
  create policy "own movie genres" on public.movie_genres
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger movie_genres_updated before update on public.movie_genres
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- migration: 20260811080000_movie_actors
create table if not exists public.movie_actors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

alter table public.movie_actors enable row level security;
do $$ begin
  create policy "own movie actors" on public.movie_actors
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger movie_actors_updated before update on public.movie_actors
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;


-- migration: 20260811110000_library_management_tables
create table if not exists public.book_authors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.book_genres (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.youtube_channels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.music_artists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.book_authors    enable row level security;
alter table public.book_genres     enable row level security;
alter table public.youtube_channels enable row level security;
alter table public.music_artists   enable row level security;

do $$ begin create policy "Public book_authors access"     on public.book_authors     for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "Public book_genres access"      on public.book_genres      for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "Public youtube_channels access" on public.youtube_channels for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "Public music_artists access"    on public.music_artists    for all using (true) with check (true); exception when duplicate_object then null; end $$;


-- ===========================================================================
-- SECTION E: PLAY TOGETHER (Game tracker)
-- ===========================================================================

-- migration: 20260811083000_playtogether_tables
create table if not exists public.playtogether_accounts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.playtogether_logs (
  id           uuid    primary key default gen_random_uuid(),
  account_name text    not null,
  log_date     text    not null,
  time_slot    text    not null,
  coupons      integer default 0,
  gems         integer default 0,
  cards        integer default 0,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

alter table public.playtogether_accounts enable row level security;
alter table public.playtogether_logs     enable row level security;

do $$ begin create policy "Public playtogether_accounts access" on public.playtogether_accounts for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "Public playtogether_logs access"     on public.playtogether_logs     for all using (true) with check (true); exception when duplicate_object then null; end $$;


-- ===========================================================================
-- SECTION F: DINH DƯỠNG (Nutrition + Sleep tracker)
-- ===========================================================================

-- migration: 20260811120000_nutrition_logs
create table if not exists public.nutrition_logs (
  id         uuid    primary key default gen_random_uuid(),
  meal_slot  text    not null check (meal_slot in ('MORNING','LUNCH','AFTERNOON','EVENING')),
  food_name  text    not null check (length(trim(food_name)) > 0),
  price      numeric not null default 0,
  log_date   date    not null default current_date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.nutrition_logs enable row level security;
do $$ begin
  create policy "Public nutrition_logs access" on public.nutrition_logs
    for all using (true) with check (true);
exception when duplicate_object then null; end $$;


-- migration: 20260811140000_sleep_logs
create table if not exists public.sleep_logs (
  id                uuid    primary key default gen_random_uuid(),
  sleep_start       text    not null,   -- "HH:MM"
  sleep_end         text    not null,   -- "HH:MM"
  duration_minutes  integer not null default 0,
  log_date          date    not null default current_date,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

alter table public.sleep_logs enable row level security;
do $$ begin
  create policy "Public sleep_logs access" on public.sleep_logs
    for all using (true) with check (true);
exception when duplicate_object then null; end $$;


-- migration: 20260813020000_book_documents
-- Sách nhập từ PDF/EPUB. Hai bảng này cố tình KHÔNG có deleted_at: nội dung là dẫn
-- xuất từ file gốc, luôn nhập lại được, và soft-delete sẽ khiến unique(media_item_id)
-- chặn lần nhập lại kế tiếp.
create table if not exists public.book_documents (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null default auth.uid() references auth.users(id),
  media_item_id     uuid        not null unique references public.media_items(id) on delete cascade,
  source_format     text        not null check (source_format in ('PDF', 'EPUB')),
  source_filename   text,
  total_chars       integer     not null default 0,
  page_count        integer,    -- số trang thật của PDF, null với EPUB
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
  idx          integer     not null,   -- thứ tự chương, đếm từ 0
  title        text        not null,
  content      text        not null,   -- văn bản thuần, đoạn cách nhau bằng \n\n
  char_count   integer     not null default 0,
  char_offset  integer     not null default 0,  -- tổng ký tự của các chương trước
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


-- Storage bucket book-covers (public): ảnh bìa sách, đường dẫn <user_id>/<media_item_id>.jpg.
-- Trình duyệt upload trực tiếp nên bucket này có đủ policy insert/update/delete
-- giới hạn theo (storage.foldername(name))[1] = auth.uid()::text.

-- =============================================================================
-- END OF SCHEMA — Daily App
-- =============================================================================
-- Dịp lặp theo âm lịch: occasion_date vẫn là ngày dương gốc,
-- calendar='LUNAR' nghĩa là lặp theo ngày âm tương ứng.
alter table public.person_occasions add column if not exists calendar text not null default 'SOLAR';
alter table public.person_occasions add column if not exists is_shared boolean not null default true;
do $$ begin
  alter table public.person_occasions add constraint person_occasions_calendar_check
    check (calendar in ('SOLAR', 'LUNAR'));
exception when duplicate_object then null; end $$;

-- Ảnh đính kèm nhật ký, khoá theo (person_id, log_date) nên thêm được cả khi chưa có chữ.
create table if not exists public.person_daily_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  person_id uuid not null references public.people(id) on delete cascade,
  log_date date not null,
  url text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists person_daily_photos_person_date_idx
  on public.person_daily_photos (user_id, person_id, log_date);

alter table public.person_daily_photos enable row level security;

do $$ begin
  create policy "own person photos" on public.person_daily_photos
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public)
values ('person-photos', 'person-photos', true) on conflict (id) do nothing;

do $$ begin
  create policy "public person photos read" on storage.objects
    for select using (bucket_id = 'person-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own person photos write" on storage.objects
    for insert to authenticated with check (bucket_id = 'person-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own person photos delete" on storage.objects
    for delete to authenticated using (bucket_id = 'person-photos');
exception when duplicate_object then null; end $$;
-- Nhóm quan hệ của người, hiện thành chip trên thẻ ở trang Người.
alter table public.people add column if not exists group_key text;
do $$ begin
  alter table public.people add constraint people_group_key_check
    check (group_key is null or group_key in ('FAMILY', 'FRIEND', 'COLLEAGUE', 'OTHER'));
exception when duplicate_object then null; end $$;

-- Lưu các đoạn chữ highlight trong sách.
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

-- Thêm cột dream cho giấc ngủ để ghi chép giấc mơ.
alter table public.sleep_logs add column if not exists dream text;

-- Bảng partner_invitations để mời và nhận lời mời kết nối kỷ niệm 2 chiều.
create table if not exists public.partner_invitations (
  id             uuid primary key default gen_random_uuid(),
  sender_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_email   text not null,
  receiver_email text not null check (position('@' in receiver_email) > 1),
  status         text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index if not exists partner_invitations_receiver_idx
  on public.partner_invitations(lower(receiver_email), status) where deleted_at is null;

alter table public.partner_invitations enable row level security;

do $$ begin
  create policy "read own or received invitations" on public.partner_invitations for select to authenticated
    using (
      sender_id = auth.uid()
      or lower(receiver_email) = lower(auth.jwt() ->> 'email')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insert own invitations" on public.partner_invitations for insert to authenticated
    with check (sender_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "update received invitations" on public.partner_invitations for update to authenticated
    using (
      sender_id = auth.uid()
      or lower(receiver_email) = lower(auth.jwt() ->> 'email')
    );
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- SECTION T: MUSIC MP3 SHARING
-- ===========================================================================

-- migration: 20260909000000_share_music_with_mp3_to_all
-- Chia sẻ toàn bộ bài nhạc có MP3 cho tất cả người dùng trong hệ thống (tiến độ mặc định PLANNED)
create or replace function public.share_music_to_all(p_media_item_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  src      public.media_items;
  me_name  text;
  target   record;
  sent     integer := 0;
begin
  select * into src from public.media_items
   where id = p_media_item_id and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'Không tìm thấy bài nhạc của bạn.'; end if;

  if src.type != 'MUSIC' or src.audio_url is null or trim(src.audio_url) = '' then
    raise exception 'Bài hát không có file MP3/Audio để chia sẻ.';
  end if;

  select coalesce(name, email, 'một người dùng') into me_name from public.profiles where id = auth.uid();

  for target in select id from public.profiles where id != auth.uid() loop
    if not exists (
      select 1 from public.media_items
       where user_id = target.id
         and type = 'MUSIC'
         and deleted_at is null
         and (
           (audio_url is not null and audio_url = src.audio_url)
           or (lower(name) = lower(src.name) and coalesce(lower(artist), '') = coalesce(lower(src.artist), ''))
         )
    ) then
      insert into public.media_items (
        user_id, type, name, description, status, artist, music_genre,
        audio_url, youtube_url, cover_url, is_favorite, shared_by
      ) values (
        target.id, 'MUSIC', src.name, src.description, 'PLANNED', src.artist, src.music_genre,
        src.audio_url, src.youtube_url, src.cover_url, false, me_name
      );
      sent := sent + 1;
    end if;
  end loop;

  return sent;
end $$;

revoke all on function public.share_music_to_all(uuid) from public;
grant execute on function public.share_music_to_all(uuid) to authenticated;




