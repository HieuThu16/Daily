-- Migration: Kênh YouTube / TV Show & video gom từ YouTube
-- Created: 2026-08-17
-- Chỉ lưu metadata + link nhúng, không lưu file video.

CREATE TABLE IF NOT EXISTS public.tvshow_creators (
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

CREATE TABLE IF NOT EXISTS public.tvshow_series (
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

CREATE TABLE IF NOT EXISTS public.tvshow_videos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform        text NOT NULL,
  video_id        text NOT NULL,
  series_key      text REFERENCES public.tvshow_series(series_key) ON DELETE SET NULL,
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
  unavailable_at  timestamptz,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, video_id)
);

CREATE INDEX IF NOT EXISTS tvshow_videos_series_idx ON public.tvshow_videos (series_key);

CREATE TABLE IF NOT EXISTS public.tvshow_sync_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform     text NOT NULL,
  creator_url  text NOT NULL,
  found_count  int NOT NULL DEFAULT 0,
  series_count int NOT NULL DEFAULT 0,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tvshow_watched (
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  platform   text NOT NULL,
  video_id   text NOT NULL,
  series_key text,
  watched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, platform, video_id)
);

CREATE INDEX IF NOT EXISTS tvshow_watched_series_idx ON public.tvshow_watched (user_id, series_key);

ALTER TABLE public.tvshow_creators  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tvshow_series    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tvshow_videos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tvshow_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tvshow_watched   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tvshow_creators','tvshow_series','tvshow_videos','tvshow_sync_runs'] LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "Public %1$s access" ON public.%1$s FOR ALL USING (true) WITH CHECK (true)', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

DO $$ BEGIN
  CREATE POLICY "own tvshow watched" ON public.tvshow_watched FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Chuyển dữ liệu Web5ngay / Tri Kỷ Cảm Xúc sang tvshow_*
INSERT INTO public.tvshow_creators (id, platform, creator_url, creator_id, creator_name, last_synced_at, created_at, deleted_at)
SELECT id, platform, creator_url, creator_id, creator_name, last_synced_at, created_at, deleted_at
FROM public.review_creators
WHERE creator_name ILIKE '%Tri Kỷ Cảm Xúc%' OR creator_url ILIKE '%tri_ky_cam_xuc%' OR creator_name ILIKE '%web5%' OR creator_url ILIKE '%web5%'
ON CONFLICT (platform, creator_url) DO NOTHING;

INSERT INTO public.tvshow_series (id, series_key, platform, creator_id, creator_name, playlist_id, title, movie_id, movie_title, movie_confidence, movie_evidence, status, expected_parts, found_parts, missing_parts, confidence, evidence, updated_at, created_at, deleted_at)
SELECT s.id, s.series_key, s.platform, s.creator_id, s.creator_name, s.playlist_id, s.title, s.movie_id, s.movie_title, s.movie_confidence, s.movie_evidence, s.status, s.expected_parts, s.found_parts, s.missing_parts, s.confidence, s.evidence, s.updated_at, s.created_at, s.deleted_at
FROM public.review_series s
WHERE s.creator_name ILIKE '%Tri Kỷ Cảm Xúc%' OR s.creator_id IN (SELECT creator_id FROM public.tvshow_creators WHERE creator_id IS NOT NULL)
ON CONFLICT (series_key) DO NOTHING;

INSERT INTO public.tvshow_videos (id, platform, video_id, series_key, creator_id, creator_name, title, description, canonical_url, embed_url, thumbnail, duration, published_at, playlist_id, playlist_name, position, part_number, total_parts, is_final, part_confidence, unavailable_at, first_seen_at, last_seen_at)
SELECT v.id, v.platform, v.video_id, v.series_key, v.creator_id, v.creator_name, v.title, v.description, v.canonical_url, v.embed_url, v.thumbnail, v.duration, v.published_at, v.playlist_id, v.playlist_name, v.position, v.part_number, v.total_parts, v.is_final, v.part_confidence, v.unavailable_at, v.first_seen_at, v.last_seen_at
FROM public.review_videos v
WHERE v.creator_name ILIKE '%Tri Kỷ Cảm Xúc%' OR v.creator_id IN (SELECT creator_id FROM public.tvshow_creators WHERE creator_id IS NOT NULL)
ON CONFLICT (platform, video_id) DO NOTHING;

INSERT INTO public.tvshow_watched (user_id, platform, video_id, series_key, watched_at)
SELECT w.user_id, w.platform, w.video_id, w.series_key, w.watched_at
FROM public.review_watched w
JOIN public.tvshow_videos v ON w.video_id = v.video_id
ON CONFLICT (user_id, platform, video_id) DO NOTHING;

-- Dọn sạch Web5ngay khỏi review_*
DELETE FROM public.review_watched WHERE video_id IN (SELECT video_id FROM public.tvshow_videos);
DELETE FROM public.review_videos WHERE creator_name ILIKE '%Tri Kỷ Cảm Xúc%' OR creator_id IN (SELECT creator_id FROM public.tvshow_creators WHERE creator_id IS NOT NULL);
DELETE FROM public.review_series WHERE creator_name ILIKE '%Tri Kỷ Cảm Xúc%' OR creator_id IN (SELECT creator_id FROM public.tvshow_creators WHERE creator_id IS NOT NULL);
DELETE FROM public.review_creators WHERE creator_name ILIKE '%Tri Kỷ Cảm Xúc%' OR creator_url ILIKE '%tri_ky_cam_xuc%' OR creator_name ILIKE '%web5%' OR creator_url ILIKE '%web5%';
