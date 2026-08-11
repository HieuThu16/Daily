-- 1. Tạo bảng playtogether_accounts
create table if not exists public.playtogether_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2. Tạo bảng playtogether_logs
create table if not exists public.playtogether_logs (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  log_date text not null,
  time_slot text not null,
  coupons integer default 0,
  gems integer default 0,
  cards integer default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 3. Bật RLS và cấp quyền truy cập toàn bộ cho ứng dụng
alter table public.playtogether_accounts enable row level security;
alter table public.playtogether_logs enable row level security;

do $$ begin
  create policy "Public playtogether_accounts access" on public.playtogether_accounts for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Public playtogether_logs access" on public.playtogether_logs for all using (true) with check (true);
exception when duplicate_object then null; end $$;
