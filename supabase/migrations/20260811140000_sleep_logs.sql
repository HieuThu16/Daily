-- Create sleep_logs table for sleep tracking
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  sleep_start text not null,
  sleep_end text not null,
  duration_minutes integer not null default 0,
  log_date date not null default current_date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.sleep_logs enable row level security;

do $$ begin
  create policy "Public sleep_logs access" on public.sleep_logs for all using (true) with check (true);
exception when duplicate_object then null; end $$;
