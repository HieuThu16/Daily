-- Cài đặt người dùng đang bị DÙNG CHUNG giữa mọi tài khoản.
--
-- Bảng để `setting_key` một mình làm khoá chính, nên mỗi cài đặt chỉ có đúng
-- MỘT dòng cho cả app: Hiếu đổi giao diện tối thì Kim Ý cũng thành tối, ai lưu
-- sau đè lên người trước. Chính sách RLS lại là `using (true)` nên ai cũng đọc
-- và ghi được cài đặt của người khác.
--
-- Sửa thành mỗi (người, khoá) một dòng. Lúc viết migration này bảng chỉ có 1
-- dòng và đã có user_id, nên không mất gì.

alter table public.user_app_settings drop constraint if exists user_app_settings_pkey;

-- Dòng mới tự gắn chủ, khỏi phụ thuộc phía client nhớ truyền.
alter table public.user_app_settings alter column user_id set default auth.uid()::text;

-- `nulls not distinct` để dòng cũ chưa có chủ vẫn không nhân đôi.
create unique index if not exists user_app_settings_user_key_uniq
  on public.user_app_settings (user_id, setting_key) nulls not distinct;

drop policy if exists "Public user_app_settings access" on public.user_app_settings;
do $$ begin
  create policy "own app settings" on public.user_app_settings for all to authenticated
    using (user_id = auth.uid()::text)
    with check (user_id = auth.uid()::text);
exception when duplicate_object then null; end $$;
