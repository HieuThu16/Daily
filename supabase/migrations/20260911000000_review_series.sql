-- Migration: thu thập series review phim từ YouTube / TikTok
-- Created: 2026-08-17
-- Chỉ lưu metadata + link nhúng, không lưu file video.

CREATE TABLE IF NOT EXISTS public.review_creators (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform       text NOT NULL CHECK (platform IN ('youtube', 'tiktok')),
  creator_url    text NOT NULL,
  creator_id     text,
  creator_name   text,
  last_synced_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  UNIQUE (platform, creator_url)
);

CREATE TABLE IF NOT EXISTS public.review_series (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_key       text NOT NULL UNIQUE,   -- "<platform>:<creatorId>:<pl|mv>:<id>"
  platform         text NOT NULL,
  creator_id       text NOT NULL,
  creator_name     text,
  playlist_id      text,
  title            text NOT NULL,
  movie_id         text,
  movie_title      text,
  movie_confidence real,
  movie_evidence   text[] NOT NULL DEFAULT '{}',
  -- Kết quả CompletionEngine. UNKNOWN là mặc định an toàn: web chỉ được hiện
  -- "đã đủ phần" khi status = COMPLETE.
  status           text NOT NULL DEFAULT 'UNKNOWN'
                   CHECK (status IN ('COMPLETE','INCOMPLETE','POSSIBLY_COMPLETE','STALLED','UNKNOWN','ERROR')),
  expected_parts   int,
  found_parts      int NOT NULL DEFAULT 0,
  missing_parts    int[] NOT NULL DEFAULT '{}',
  confidence       real NOT NULL DEFAULT 0,
  evidence         text[] NOT NULL DEFAULT '{}',
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE TABLE IF NOT EXISTS public.review_videos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        text NOT NULL,
  video_id        text NOT NULL,
  series_key      text REFERENCES public.review_series(series_key) ON DELETE SET NULL,
  creator_id      text NOT NULL,
  creator_name    text,
  title           text NOT NULL,
  description     text,
  canonical_url   text NOT NULL,
  embed_url       text NOT NULL,
  thumbnail       text,
  duration        int,
  published_at    timestamptz,
  playlist_id     text,
  playlist_name   text,
  position        int,
  part_number     int,
  total_parts     int,
  is_final        boolean NOT NULL DEFAULT false,
  part_confidence real,
  -- Video biến mất khỏi kênh (xoá / để riêng tư): giữ bản ghi và đánh dấu, để
  -- lần sync sau biết series bị hụt chứ không âm thầm "đủ trở lại".
  unavailable_at  timestamptz,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, video_id)
);

CREATE INDEX IF NOT EXISTS review_videos_series_idx ON public.review_videos (series_key);

CREATE TABLE IF NOT EXISTS public.review_sync_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform     text NOT NULL,
  creator_url  text NOT NULL,
  found_count  int NOT NULL DEFAULT 0,
  series_count int NOT NULL DEFAULT 0,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_creators  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_series    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_videos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_sync_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['review_creators','review_series','review_videos','review_sync_runs'] LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "Public %1$s access" ON public.%1$s FOR ALL USING (true) WITH CHECK (true)', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
