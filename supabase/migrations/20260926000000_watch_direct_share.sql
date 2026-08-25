-- Xem chung không cần nhóm: gửi thẳng cho một Gmail trong danh bạ app (public.profiles),
-- kèm sổ địa chỉ riêng để mỗi người tự đặt tên cho Gmail của người kia.

-- 1. watch_shares nhận thêm người nhận trực tiếp.
--    group_id nới lỏng thành nullable: dòng cũ (gửi theo nhóm) vẫn còn nguyên,
--    dòng mới thì group_id null và recipient_id có giá trị.
alter table public.watch_shares alter column group_id drop not null;
alter table public.watch_shares add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table public.watch_shares add column if not exists recipient_email text;

-- Một mục chỉ tồn tại một dòng cho mỗi cặp (người gửi → người nhận),
-- để gửi lại lần nữa là cập nhật chứ không đẻ bản sao.
create unique index if not exists watch_shares_direct_uniq
  on public.watch_shares(sender_id, recipient_id, kind, ref_id);

create index if not exists watch_shares_recipient_idx
  on public.watch_shares(recipient_id, updated_at desc)
  where recipient_id is not null;

-- Mỗi dòng phải thuộc về một trong hai kiểu, không được lửng lơ cả hai.
do $$ begin
  alter table public.watch_shares
    add constraint watch_shares_target_chk check (group_id is not null or recipient_id is not null);
exception when duplicate_object then null; end $$;

-- 2. Sổ địa chỉ RIÊNG của từng người: tôi đặt tên gì cho Gmail đó thì chỉ tôi thấy.
create table if not exists public.watch_contacts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Luôn lưu chữ thường: dùng lower(email) trong unique index thì PostgREST
  -- không suy ra được cho ON CONFLICT, nên chuẩn hoá ngay từ lúc ghi.
  email        text not null check (email = lower(email) and position('@' in email) > 1),
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- useQuery của app lọc `deleted_at is null`, giữ cột cho đồng bộ.
  deleted_at   timestamptz
);
create unique index if not exists watch_contacts_uniq
  on public.watch_contacts(owner_id, email);

alter table public.watch_contacts enable row level security;
do $$ begin
  create policy "own contacts" on public.watch_contacts for all to authenticated
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 3. RLS cho đường gửi thẳng: người gửi và người nhận đều đọc được.
do $$ begin
  create policy "read shares sent to or by me" on public.watch_shares for select to authenticated
    using (sender_id = auth.uid() or recipient_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "send share to a person" on public.watch_shares for insert to authenticated
    with check (sender_id = auth.uid() and recipient_id is not null);
exception when duplicate_object then null; end $$;

-- 4. Người nhận cũng cần realtime để thấy tiến độ người gửi chạy.
do $$ begin
  alter publication supabase_realtime add table public.watch_shares;
exception when duplicate_object then null; end $$;
