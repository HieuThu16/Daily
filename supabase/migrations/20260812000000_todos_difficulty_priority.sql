-- migration: 20260812000000_todos_difficulty_priority
alter table public.todos
  add column if not exists difficulty text not null default 'EASY' check (difficulty in ('EASY','NORMAL','HARD')),
  add column if not exists priority text not null default 'NORMAL' check (priority in ('NORMAL','URGENT'));

update public.todos set difficulty = 'EASY' where difficulty is null;
update public.todos set priority = 'NORMAL' where priority is null;
