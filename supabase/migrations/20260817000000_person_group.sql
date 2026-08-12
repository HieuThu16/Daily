-- Nhóm quan hệ của người, hiện thành chip trên thẻ ở trang Người.
alter table public.people add column if not exists group_key text;
do $$ begin
  alter table public.people add constraint people_group_key_check
    check (group_key is null or group_key in ('FAMILY', 'FRIEND', 'COLLEAGUE', 'OTHER'));
exception when duplicate_object then null; end $$;
