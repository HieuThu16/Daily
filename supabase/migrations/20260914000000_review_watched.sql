-- Tiến độ xem review phim: mỗi dòng là "user này đã xem video này".
-- Chưa xem thì không có dòng — khỏi phải sinh sẵn bản ghi cho cả kho video.
--
-- Khác các bảng review_* còn lại (dữ liệu chung, RLS mở): đây là dữ liệu riêng
-- của từng người nên khoá chặt theo auth.uid().
create table if not exists public.review_watched (
  user_id    uuid not null default auth.uid() references auth.users(id),
  platform   text not null,
  video_id   text not null,
  -- Nhân bản series_key để đếm "đã xem mấy phần" của một phim bằng đúng một
  -- truy vấn, không phải join ngược qua review_videos.
  series_key text,
  watched_at timestamptz not null default now(),
  primary key (user_id, platform, video_id)
);

create index if not exists review_watched_series_idx
  on public.review_watched (user_id, series_key);

alter table public.review_watched enable row level security;
do $$ begin
  create policy "own review watched" on public.review_watched for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
