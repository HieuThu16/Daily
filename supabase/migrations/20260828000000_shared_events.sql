-- Nhật ký chung: mời nhau bằng Gmail, rồi cùng nhìn thấy các "sự kiện".
-- Chỉ sự kiện là chung; daily_entries vẫn hoàn toàn riêng tư.

-- Mỗi dòng = "tôi cho email này xem sự kiện của tôi".
-- Muốn thấy của nhau thì cả hai cùng thêm email đối phương (đối xứng, không cần bảng lời mời).
create table if not exists public.shared_partners (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  partner_email text not null check (position('@' in partner_email) > 1),
  created_at    timestamptz not null default now(),
  -- Cột này để dùng chung được useQuery (vốn lọc `deleted_at is null`); gỡ partner là xoá cứng.
  deleted_at    timestamptz,
  unique (user_id, partner_email)
);

alter table public.shared_partners enable row level security;
do $$ begin
  create policy "own partners" on public.shared_partners for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create table if not exists public.shared_events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id),
  title       text not null check (length(trim(title)) > 0),
  note        text,
  event_date  date not null default current_date,
  event_time  text,              -- "HH:MM", để trống = cả ngày
  location    text,
  image_url   text,
  image_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists shared_events_date_idx
  on public.shared_events(event_date) where deleted_at is null;

alter table public.shared_events enable row level security;

-- Đọc: sự kiện của tôi, hoặc của người đã thêm email tôi vào danh sách partner.
do $$ begin
  create policy "read shared events" on public.shared_events for select to authenticated
    using (
      owner_id = auth.uid()
      or exists (
        select 1 from public.shared_partners p
        where p.user_id = shared_events.owner_id
          and lower(p.partner_email) = lower(auth.jwt() ->> 'email')
      )
    );
exception when duplicate_object then null; end $$;

-- Ghi/sửa/xoá: chỉ chủ sự kiện. Người kia xem được nhưng không sửa của nhau.
do $$ begin
  create policy "write own shared events" on public.shared_events for insert to authenticated
    with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "update own shared events" on public.shared_events for update to authenticated
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "delete own shared events" on public.shared_events for delete to authenticated
    using (owner_id = auth.uid());
exception when duplicate_object then null; end $$;
