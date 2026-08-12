-- Dịp đáng nhớ: sinh nhật và kỉ niệm, quản lý ở tab Người, hiển thị đếm ngược ở Home.
create table if not exists public.person_occasions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  person_id uuid references public.people(id) on delete cascade,
  kind text not null default 'BIRTHDAY' check (kind in ('BIRTHDAY', 'ANNIVERSARY')),
  title text not null default '',
  occasion_date date not null,
  is_yearly boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists person_occasions_user_date_idx
  on public.person_occasions (user_id, occasion_date);

alter table public.person_occasions enable row level security;

do $$ begin
  create policy "own occasions" on public.person_occasions
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Ảnh bìa cho mục thư viện, dùng ở thẻ "Đang đọc" trên Home.
alter table public.media_items add column if not exists cover_url text;
