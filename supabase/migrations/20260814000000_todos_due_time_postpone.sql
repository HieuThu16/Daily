-- migration: 20260814000000_todos_due_time_postpone
-- Giờ hạn chót cho công việc + theo dõi trì hoãn (số lần & tổng số phút)

alter table public.todos
  add column if not exists due_time text,
  add column if not exists postpone_count integer not null default 0,
  add column if not exists postpone_minutes integer not null default 0;

update public.todos set postpone_count = 0 where postpone_count is null;
update public.todos set postpone_minutes = 0 where postpone_minutes is null;

-- Lịch sử từng lần trì hoãn (nguồn sự thật chi tiết; 2 cột trên todos là số tổng hợp)
create table if not exists public.task_postpones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id),
  todo_id       uuid not null references public.todos(id) on delete cascade,
  minutes       integer not null check (minutes > 0),
  reason        text,
  prev_due_date date,
  prev_due_time text,
  new_due_date  date,
  new_due_time  text,
  created_at    timestamptz not null default now()
);

create index if not exists task_postpones_todo_idx on public.task_postpones(todo_id);
create index if not exists task_postpones_user_created_idx on public.task_postpones(user_id, created_at desc);

alter table public.task_postpones enable row level security;
do $$ begin
  create policy "own task postpones" on public.task_postpones
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
