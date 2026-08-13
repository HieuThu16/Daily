-- Ảnh bìa tải lên từ máy cho Sách / Truyện / Phim / YouTube.
-- Dùng chung kiểu với bucket person-photos: public read, chỉ người đã đăng nhập ghi/xoá.
insert into storage.buckets (id, name, public)
values ('media-covers', 'media-covers', true) on conflict (id) do nothing;

do $$ begin
  create policy "public media covers read" on storage.objects
    for select using (bucket_id = 'media-covers');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own media covers write" on storage.objects
    for insert to authenticated with check (bucket_id = 'media-covers');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own media covers delete" on storage.objects
    for delete to authenticated using (bucket_id = 'media-covers');
exception when duplicate_object then null; end $$;
