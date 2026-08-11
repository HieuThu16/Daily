create table if not exists public.habit_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(trim(name)) > 0),
  color text not null default '#466147',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(user_id, name)
);

alter table public.habits add column if not exists category_id uuid references public.habit_categories(id) on delete set null;
create index if not exists habits_user_category_idx on public.habits(user_id, category_id) where deleted_at is null;
alter table public.habit_categories enable row level security;
do $$ begin create policy "own habit categories" on public.habit_categories for all using (user_id=auth.uid()) with check (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create trigger habit_categories_updated before update on public.habit_categories for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;
