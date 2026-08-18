-- Một video sinh ra nhiều thẻ hỏi-đáp, nên bỏ ràng buộc duy nhất theo video.
drop index if exists public.knowledge_items_source_video_uidx;

create index if not exists knowledge_items_source_video_idx
  on public.knowledge_items(user_id, source_video_id)
  where source_video_id is not null and deleted_at is null;
