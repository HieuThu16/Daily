alter table public.habits
  add column tracking_type text not null default 'CHECK'
    check (tracking_type in ('CHECK', 'COUNT')),
  add column daily_target integer not null default 1
    check (daily_target > 0);
alter table public.habit_logs
  add column value integer not null default 0
    check (value >= 0);
update public.habit_logs set value = case when completed then 1 else 0 end where value = 0;
