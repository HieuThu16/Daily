-- ============================================================================
-- MIGRATION: CẤP QUYỀN XÓA TỆP SUPABASE STORAGE & RPC XÓA AN TOÀN
-- Giải quyết triệt để lỗi bấm nút Xóa nhưng file không bị xóa trên Supabase Storage
-- ============================================================================

-- 1. Thêm Policy DELETE cho tất cả các buckets phổ biến (cả authenticated & anon)
do $$ begin
  create policy "public daily photos delete" on storage.objects
    for delete using (bucket_id = 'daily-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public media audio delete" on storage.objects
    for delete using (bucket_id = 'media-audio');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public person photos delete" on storage.objects
    for delete using (bucket_id = 'person-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public media covers delete" on storage.objects
    for delete using (bucket_id = 'media-covers');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public book covers delete" on storage.objects
    for delete using (bucket_id = 'book-covers');
exception when duplicate_object then null; end $$;

-- 2. Tạo hàm RPC delete_storage_object chạy dưới quyền security definer (Master)
-- Giúp xóa tệp ngay lập tức mà không bao giờ bị vướng rào cản phân quyền RLS
create or replace function public.delete_storage_object(p_bucket text, p_name text)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_count int;
begin
  delete from storage.objects
  where bucket_id = p_bucket and name = p_name;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- 3. Cấp quyền thực thi cho cả authenticated và anon
grant execute on function public.delete_storage_object(text, text) to authenticated, anon;
grant execute on function public.storage_usage() to authenticated, anon;
grant execute on function public.storage_details() to authenticated, anon;
grant execute on function public.database_table_usage() to authenticated, anon;
