-- Đánh dấu "Lần đầu" và "Đặc biệt" cho nhật ký để đưa vào tab Sưu tập thẻ 3D.
alter table public.daily_entries add column if not exists is_first_time boolean not null default false;
alter table public.daily_entries add column if not exists is_special boolean not null default false;
alter table public.daily_entries add column if not exists tags text[] default '{}';

create index if not exists daily_entries_collection_idx
  on public.daily_entries(user_id, is_first_time, is_special)
  where deleted_at is null and (is_first_time = true or is_special = true);
