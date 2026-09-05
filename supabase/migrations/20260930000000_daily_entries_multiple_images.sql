-- Hỗ trợ lưu nhiều ảnh và video cho mỗi dòng nhật ký daily_entries
alter table public.daily_entries add column if not exists images text[];
alter table public.daily_entries add column if not exists image_paths text[];
