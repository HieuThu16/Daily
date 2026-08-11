-- Comprehensive migration to ensure all favorite, channel, artist, due_date and completed_at columns exist in Supabase DB

-- media_items columns
alter table public.media_items add column if not exists is_favorite boolean not null default false;
alter table public.media_items add column if not exists channel text;
alter table public.media_items add column if not exists artist text;

-- todos columns
alter table public.todos add column if not exists due_date date default CURRENT_DATE;
alter table public.todos add column if not exists completed_at timestamptz;
