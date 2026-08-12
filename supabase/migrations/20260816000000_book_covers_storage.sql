-- migration: 20260816000000_book_covers_storage
-- Bucket chứa ảnh bìa sách do trình duyệt upload trực tiếp.
-- Cột media_items.cover_url đã được thêm ở 20260815000000; dòng dưới chỉ để migration
-- này chạy được độc lập trên một database chưa có nó.

alter table public.media_items add column if not exists cover_url text;

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', true)
on conflict (id) do nothing;

-- Đọc công khai để thẻ <img> tải được mà không cần signed URL.
do $$ begin
  create policy "public book covers read" on storage.objects
    for select using (bucket_id = 'book-covers');
exception when duplicate_object then null; end $$;

-- Ghi giới hạn trong thư mục mang tên user id. Khác bucket media-audio: bucket đó do
-- Edge Function ghi bằng service role nên không cần policy ghi, còn ảnh bìa thì
-- trình duyệt của chính người dùng upload lên.
do $$ begin
  create policy "own book covers insert" on storage.objects
    for insert with check (
      bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own book covers update" on storage.objects
    for update using (
      bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own book covers delete" on storage.objects
    for delete using (
      bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;
