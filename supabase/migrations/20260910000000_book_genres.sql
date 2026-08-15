-- Migration: book_genres table and management
-- Created: 2026-08-16

CREATE TABLE IF NOT EXISTS public.book_genres (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (name)
);

ALTER TABLE public.book_genres ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public book_genres access"
    ON public.book_genres FOR ALL
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
