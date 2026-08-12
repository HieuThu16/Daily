-- Migration: music_genres table and music_genre column on media_items
-- Created: 2026-08-12

-- 1. Create music_genres table (mirrors movie_genres, book_authors, etc.)
CREATE TABLE IF NOT EXISTS public.music_genres (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Enable RLS
ALTER TABLE public.music_genres ENABLE ROW LEVEL SECURITY;

-- RLS policy: authenticated users can see all non-deleted genres
do $$ begin
  CREATE POLICY "Music genres: auth read"
    ON public.music_genres FOR SELECT
    USING (auth.role() = 'authenticated' AND deleted_at IS NULL);
exception when duplicate_object then null; end $$;

do $$ begin
  CREATE POLICY "Music genres: auth insert"
    ON public.music_genres FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  CREATE POLICY "Music genres: auth update"
    ON public.music_genres FOR UPDATE
    USING (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- 2. Add music_genre column to media_items (nullable text)
ALTER TABLE public.media_items
  ADD COLUMN IF NOT EXISTS music_genre text;

-- Done
