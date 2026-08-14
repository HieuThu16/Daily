-- Ảnh đính kèm cho một dòng nhật ký (mỗi dòng tối đa 1 ảnh).
alter table public.daily_entries
  add column if not exists image_url text,
  add column if not exists image_path text;

-- Bucket ảnh nhật ký: public read, chỉ người đã đăng nhập ghi/xoá (giống media-covers).
insert into storage.buckets (id, name, public)
values ('daily-photos', 'daily-photos', true) on conflict (id) do nothing;

do $$ begin
  create policy "public daily photos read" on storage.objects
    for select using (bucket_id = 'daily-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own daily photos write" on storage.objects
    for insert to authenticated with check (bucket_id = 'daily-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own daily photos delete" on storage.objects
    for delete to authenticated using (bucket_id = 'daily-photos');
exception when duplicate_object then null; end $$;
