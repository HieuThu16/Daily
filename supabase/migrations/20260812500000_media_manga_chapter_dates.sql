-- Migration: add MANGA enum value to media_type, add current_chapter, start_date, end_date to media_items
ALTER TYPE public.media_type ADD VALUE IF NOT EXISTS 'MANGA';

ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS current_chapter integer;
ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS start_date text;
ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS end_date text;
