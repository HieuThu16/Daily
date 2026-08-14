-- Đánh dấu yêu thích cho một dòng nhật ký, để lọc lại những ngày đáng nhớ.
alter table public.daily_entries add column if not exists is_favorite boolean not null default false;
