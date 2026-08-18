-- Đánh dấu thẻ kiến thức được sinh từ video nào, để biết video nào còn cần AI.
alter table public.knowledge_items add column if not exists source_video_id text;

create unique index if not exists knowledge_items_source_video_uidx
  on public.knowledge_items(user_id, source_video_id)
  where source_video_id is not null and deleted_at is null;
