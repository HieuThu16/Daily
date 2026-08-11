alter table public.daily_entries
  add column entry_type text not null default 'FEELING'
  check (entry_type in ('FEELING', 'NEW_THING', 'SAD_THING', 'SMALL_WIN'));
create index on public.daily_entries(user_id, entry_date, entry_type) where deleted_at is null;
