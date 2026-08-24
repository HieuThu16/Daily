CREATE TABLE IF NOT EXISTS public.video_watch_progress (
  id text NOT NULL PRIMARY KEY,
  user_id text,
  user_email text,
  video_id text NOT NULL,
  title text,
  channel_name text,
  thumbnail text,
  seconds numeric NOT NULL DEFAULT 0,
  duration_seconds numeric,
  percent numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'IN_PROGRESS',
  log_date text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.video_watch_progress IS 'Tien do xem video YouTube, doc chung de hien o tab Xem chung. RLS mo nhu manga_reading_logs.';

COMMENT ON COLUMN public.video_watch_progress.id IS 'user_id:video_id';

COMMENT ON COLUMN public.video_watch_progress.status IS 'PLANNED, IN_PROGRESS hoac COMPLETED';

CREATE INDEX IF NOT EXISTS idx_video_watch_progress_video ON public.video_watch_progress (video_id);

CREATE INDEX IF NOT EXISTS idx_video_watch_progress_date ON public.video_watch_progress (log_date);

ALTER TABLE public.video_watch_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public video_watch_progress access" ON public.video_watch_progress;

CREATE POLICY "Public video_watch_progress access" ON public.video_watch_progress FOR ALL USING (true) WITH CHECK (true);
