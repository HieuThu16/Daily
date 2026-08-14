-- Migration: Hỗ trợ tương tác kỷ niệm chung 2 chiều (Xem, Thêm, Sửa, Xoá, Thích, Đổi ảnh) cho cặp đôi

-- 1. Trigger tự động liên kết 2 chiều khi lời mời được chấp nhận
create or replace function public.handle_partner_invitation_accepted()
returns trigger
language plpgsql
security definer
as $$
declare
  v_receiver_id uuid;
begin
  if new.status = 'ACCEPTED' and (old.status is null or old.status <> 'ACCEPTED') then
    -- Tìm user_id của người nhận
    select id into v_receiver_id
    from auth.users
    where lower(email) = lower(trim(new.receiver_email));

    -- Thêm shared_partners cho người gửi
    insert into public.shared_partners (user_id, partner_email)
    values (new.sender_id, lower(trim(new.receiver_email)))
    on conflict (user_id, partner_email) do update set deleted_at = null;

    -- Thêm shared_partners cho người nhận (nếu tài khoản đã tồn tại)
    if v_receiver_id is not null then
      insert into public.shared_partners (user_id, partner_email)
      values (v_receiver_id, lower(trim(new.sender_email)))
      on conflict (user_id, partner_email) do update set deleted_at = null;

      -- Cập nhật is_partner = true cho cả 2 bên
      update public.people set is_partner = true
      where user_id = v_receiver_id and deleted_at is null;
    end if;

    update public.people set is_partner = true
    where user_id = new.sender_id and deleted_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_partner_invitation_accepted on public.partner_invitations;
create trigger on_partner_invitation_accepted
  after insert or update of status on public.partner_invitations
  for each row execute function public.handle_partner_invitation_accepted();

-- 2. Cập nhật RLS cho shared_events: Cho phép đối tác xem, sửa, xoá, thích kỷ niệm của nhau
drop policy if exists "read shared events" on public.shared_events;
create policy "read shared events" on public.shared_events for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.shared_partners p
      where p.user_id = shared_events.owner_id
        and lower(trim(p.partner_email)) = lower(trim(auth.jwt() ->> 'email'))
        and p.deleted_at is null
    )
    or exists (
      select 1 from public.shared_partners p
      where p.user_id = auth.uid()
        and lower(trim(p.partner_email)) = (
          select lower(trim(email)) from auth.users where id = shared_events.owner_id
        )
        and p.deleted_at is null
    )
  );

drop policy if exists "update own shared events" on public.shared_events;
drop policy if exists "update shared events" on public.shared_events;
create policy "update shared events" on public.shared_events for update to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.shared_partners p
      where p.user_id = shared_events.owner_id
        and lower(trim(p.partner_email)) = lower(trim(auth.jwt() ->> 'email'))
        and p.deleted_at is null
    )
  )
  with check (
    owner_id = auth.uid()
    or exists (
      select 1 from public.shared_partners p
      where p.user_id = shared_events.owner_id
        and lower(trim(p.partner_email)) = lower(trim(auth.jwt() ->> 'email'))
        and p.deleted_at is null
    )
  );

drop policy if exists "delete own shared events" on public.shared_events;
drop policy if exists "delete shared events" on public.shared_events;
create policy "delete shared events" on public.shared_events for delete to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.shared_partners p
      where p.user_id = shared_events.owner_id
        and lower(trim(p.partner_email)) = lower(trim(auth.jwt() ->> 'email'))
        and p.deleted_at is null
    )
  );

-- 3. Đảm bảo liên kết 2 chiều ngay lập tức cho 2 tài khoản Hiếu & Kim Ý
do $$
declare
  v_hieu_id uuid;
  v_y_id uuid;
begin
  select id into v_hieu_id from auth.users where lower(trim(email)) ILIKE 'truongnguyenminhhieu%' limit 1;
  select id into v_y_id from auth.users where lower(trim(email)) = 'nguyenkimy1302.gr@gmail.com' limit 1;

  if v_hieu_id is not null then
    insert into public.shared_partners (user_id, partner_email)
    values (v_hieu_id, 'nguyenkimy1302.gr@gmail.com')
    on conflict (user_id, partner_email) do update set deleted_at = null;

    update public.people set is_partner = true where user_id = v_hieu_id and deleted_at is null;
  end if;

  if v_y_id is not null then
    insert into public.shared_partners (user_id, partner_email)
    values (v_y_id, 'truongnguyenminhhieu1000@gmail.com')
    on conflict (user_id, partner_email) do update set deleted_at = null;

    update public.people set is_partner = true where user_id = v_y_id and deleted_at is null;
  end if;
end $$;
