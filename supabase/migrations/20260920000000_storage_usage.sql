-- Dung lượng đang dùng trên Supabase, để tab Cài đặt hiện được phần trăm còn trống.
-- pg_database_size và storage.objects đều cần quyền cao hơn người dùng thường,
-- nên bọc trong security definer và chỉ trả về hai con số tổng.
create or replace function public.storage_usage()
returns table (db_bytes bigint, storage_bytes bigint)
language sql
security definer
set search_path = public, storage
as $$
  select
    pg_database_size(current_database())::bigint as db_bytes,
    coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0)::bigint as storage_bytes;
$$;

revoke all on function public.storage_usage() from public;
grant execute on function public.storage_usage() to authenticated;
