alter table public.habits
  add column if not exists habit_type text not null default 'GOOD'
  check (habit_type in ('GOOD', 'BAD'));

update public.habits set habit_type = 'GOOD' where habit_type is null;
