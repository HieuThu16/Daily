create table if not exists public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  meal_slot text not null check (meal_slot in ('MORNING', 'LUNCH', 'AFTERNOON', 'EVENING')),
  food_name text not null check (length(trim(food_name)) > 0),
  price numeric not null default 0,
  log_date date not null default current_date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.nutrition_logs enable row level security;
do $$ begin
  create policy "Public nutrition_logs access" on public.nutrition_logs for all using (true) with check (true);
exception when duplicate_object then null; end $$;
