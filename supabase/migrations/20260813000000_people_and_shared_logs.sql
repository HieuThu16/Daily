create table if not exists public.people (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(trim(name)) > 0), avatar_url text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.person_interests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id),
  person_id uuid not null references public.people(id) on delete cascade, label text not null check (length(trim(label)) > 0), created_at timestamptz not null default now()
);
create table if not exists public.person_daily_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id),
  person_id uuid not null references public.people(id) on delete cascade, log_date date not null, content text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, person_id, log_date)
);
alter table public.people enable row level security;
alter table public.person_interests enable row level security;
alter table public.person_daily_logs enable row level security;
do $$ begin create policy "own people" on public.people for all using (user_id=auth.uid()) with check (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "own interests" on public.person_interests for all using (user_id=auth.uid()) with check (user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "own person logs" on public.person_daily_logs for all using (user_id=auth.uid()) with check (user_id=auth.uid()); exception when duplicate_object then null; end $$;
