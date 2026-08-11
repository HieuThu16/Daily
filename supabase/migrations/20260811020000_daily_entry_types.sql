alter table public.daily_entries
  add column if not exists entry_type text not null default 'FEELING'
  check (entry_type in ('FEELING', 'NEW_THING', 'SAD_THING', 'SMALL_WIN'));
create index if not exists daily_entries_user_date_type_idx on public.daily_entries(user_id, entry_date, entry_type) where deleted_at is null;
