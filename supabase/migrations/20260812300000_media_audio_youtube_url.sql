-- Migration: add youtube_url and audio_url to media_items
ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE public.media_items ADD COLUMN IF NOT EXISTS audio_url text;
