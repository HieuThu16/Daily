-- Giờ viết nhật ký, để dựng được dòng thời gian review cả ngày.
alter table public.daily_entries add column if not exists entry_time text; -- "HH:MM"
