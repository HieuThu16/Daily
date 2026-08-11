alter table public.habits add column if not exists tracking_type text not null default 'CHECK' check (tracking_type in ('CHECK', 'COUNT'));
alter table public.habits add column if not exists daily_target integer not null default 1 check (daily_target > 0);
alter table public.habit_logs add column if not exists value integer not null default 0 check (value >= 0);
update public.habit_logs set value = case when completed then 1 else 0 end where value = 0;
