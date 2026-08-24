-- Xem chung theo nhóm: nhóm + thành viên (theo email) + các mục đã gửi lên xem chung.

create table if not exists public.watch_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.watch_group_members (
  id       uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.watch_groups(id) on delete cascade,
  email    text not null,
  added_at timestamptz not null default now()
);
create unique index if not exists watch_group_members_uniq
  on public.watch_group_members(group_id, lower(email));

create table if not exists public.watch_shares (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.watch_groups(id) on delete cascade,
  sender_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_email  text,
  kind          text not null check (kind in ('VIDEO', 'MUSIC', 'MANGA', 'BOOK', 'OTHER')),
  ref_id        text not null,
  title         text not null,
  subtitle      text,
  thumbnail     text,
  url           text,
  percent       int not null default 0,
  progress_text text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists watch_shares_uniq
  on public.watch_shares(group_id, sender_id, kind, ref_id);
create index if not exists watch_shares_group_idx on public.watch_shares(group_id, updated_at desc);

-- SECURITY DEFINER: đọc thẳng bảng, tránh RLS tự gọi lại chính nó.
create or replace function public.is_watch_member(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from watch_groups g where g.id = gid and g.owner_id = auth.uid())
      or exists (
        select 1 from watch_group_members m
        where m.group_id = gid and lower(m.email) = lower(auth.jwt() ->> 'email')
      );
$$;

alter table public.watch_groups        enable row level security;
alter table public.watch_group_members enable row level security;
alter table public.watch_shares        enable row level security;

do $$ begin
  create policy "read groups i belong to" on public.watch_groups for select to authenticated
    using (public.is_watch_member(id));
  create policy "create own group" on public.watch_groups for insert to authenticated
    with check (owner_id = auth.uid());
  create policy "owner edits group" on public.watch_groups for update to authenticated
    using (owner_id = auth.uid());
  create policy "owner deletes group" on public.watch_groups for delete to authenticated
    using (owner_id = auth.uid());

  create policy "read members of my groups" on public.watch_group_members for select to authenticated
    using (public.is_watch_member(group_id));
  create policy "member manages members" on public.watch_group_members for all to authenticated
    using (public.is_watch_member(group_id)) with check (public.is_watch_member(group_id));

  create policy "read shares of my groups" on public.watch_shares for select to authenticated
    using (public.is_watch_member(group_id));
  create policy "send share to my groups" on public.watch_shares for insert to authenticated
    with check (sender_id = auth.uid() and public.is_watch_member(group_id));
  create policy "sender updates own share" on public.watch_shares for update to authenticated
    using (sender_id = auth.uid());
  create policy "sender deletes own share" on public.watch_shares for delete to authenticated
    using (sender_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Tiến độ người gửi chạy realtime cho cả nhóm.
do $$ begin
  alter publication supabase_realtime add table public.watch_shares;
exception when duplicate_object then null; end $$;
