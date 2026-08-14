-- Ví tiền: tiền mặt hoặc tài khoản ngân hàng nhập tay (không liên kết ngân hàng thật).
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'CASH' check (kind in ('CASH', 'BANK')),
  bank_name text,
  account_number text,
  opening_balance bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Một khoản thu (IN) hoặc chi (OUT). amount luôn dương, dấu nằm ở direction.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  account_id uuid not null references public.accounts(id) on delete cascade,
  direction text not null check (direction in ('IN', 'OUT')),
  amount bigint not null check (amount > 0),
  category text not null default 'OTHER',
  note text,
  log_date date not null,
  log_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists accounts_user_idx on public.accounts(user_id) where deleted_at is null;
create index if not exists transactions_user_date_idx on public.transactions(user_id, log_date) where deleted_at is null;
create index if not exists transactions_account_idx on public.transactions(account_id) where deleted_at is null;

do $$ begin create trigger accounts_updated before update on public.accounts for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;
do $$ begin create trigger transactions_updated before update on public.transactions for each row execute function public.set_updated_at(); exception when duplicate_object then null; end $$;

alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

do $$ begin create policy "own accounts" on public.accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "own transactions" on public.transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
