-- Migration: Fix RLS policy to allow viewing public books
-- Người dùng có thể xem:
-- 1. Sách của chính họ (is_public = true/false đều được)
-- 2. Sách công khai của người khác (is_public = true)

-- Xóa policy cũ chỉ cho xem sách của mình
drop policy if exists "own media" on public.media_items;

-- Tạo policy mới cho phép xem sách công khai
do $$ begin
  create policy "view own and public media" on public.media_items
    for select 
    using (
      user_id = auth.uid()                    -- Sách của mình
      or is_public = true                     -- Hoặc sách công khai của người khác
    );
exception when duplicate_object then null; end $$;

-- Policy cho insert/update/delete: chỉ được thao tác với sách của mình
do $$ begin
  create policy "manage own media" on public.media_items
    for insert
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "update own media" on public.media_items
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "delete own media" on public.media_items
    for delete
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
