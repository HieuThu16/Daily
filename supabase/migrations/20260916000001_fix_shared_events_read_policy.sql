-- Policy đọc kỷ niệm có nhánh truy vấn thẳng auth.users, mà role `authenticated`
-- không có quyền đọc bảng đó -> mọi select shared_events báo
-- "permission denied for table users" và app hiện danh sách rỗng.
-- Bỏ nhánh đó; room_code + shared_partners đã đủ để hai vợ chồng thấy nhau.
drop policy if exists "read shared events" on public.shared_events;
create policy "read shared events" on public.shared_events for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      room_code is not null
      and exists (
        select 1 from public.people p
        where p.user_id = auth.uid()
          and p.room_code = shared_events.room_code
          and p.deleted_at is null
      )
    )
    or exists (
      select 1 from public.shared_partners p
      where p.user_id = shared_events.owner_id
        and lower(trim(p.partner_email)) = lower(trim(auth.jwt() ->> 'email'))
        and p.deleted_at is null
    )
  );
