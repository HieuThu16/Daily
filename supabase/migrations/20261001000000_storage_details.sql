-- Thống kê chi tiết dung lượng lưu trữ: danh sách tệp lớn, phân loại theo thư mục và bảng dữ liệu
-- Giúp người dùng biết video/ảnh nào hoặc nơi nào đang chiếm nhiều dung lượng nhất.

create or replace function public.storage_details()
returns table (
  id uuid,
  bucket_id text,
  name text,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, storage
as $$
  select
    o.id,
    o.bucket_id,
    o.name,
    coalesce((o.metadata->>'size')::bigint, 0) as size_bytes,
    coalesce(o.metadata->>'mimetype', '') as mime_type,
    o.created_at,
    o.updated_at
  from storage.objects o
  order by coalesce((o.metadata->>'size')::bigint, 0) desc
  limit 1000;
$$;

create or replace function public.database_table_usage()
returns table (
  table_name text,
  row_count bigint,
  total_bytes bigint,
  index_bytes bigint
)
language sql
security definer
set search_path = public
as $$
  select
    c.relname::text as table_name,
    coalesce(s.n_live_tup, 0)::bigint as row_count,
    pg_total_relation_size(c.oid)::bigint as total_bytes,
    pg_indexes_size(c.oid)::bigint as index_bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc;
$$;

revoke all on function public.storage_details() from public;
grant execute on function public.storage_details() to authenticated;

revoke all on function public.database_table_usage() from public;
grant execute on function public.database_table_usage() to authenticated;
