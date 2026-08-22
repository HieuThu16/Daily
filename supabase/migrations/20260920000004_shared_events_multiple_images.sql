alter table public.shared_events add column if not exists images text[];
alter table public.shared_events add column if not exists image_paths text[];
