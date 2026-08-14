-- Nút yêu thích cho từng kỷ niệm.
alter table public.shared_events add column if not exists is_favorite boolean not null default false;
