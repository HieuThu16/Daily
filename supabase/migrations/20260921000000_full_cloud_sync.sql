-- Migration: Full Cloud Sync for Manga, Food Suggestions, and User App Settings

-- 1. Bảng lưu tương tác truyện tranh (Theo dõi, Yêu thích, Lịch sử đọc dở)
CREATE TABLE IF NOT EXISTS public.manga_interactions (
  id text NOT NULL PRIMARY KEY,
  user_id text,
  manga_type text NOT NULL, -- 'BL', 'H_MANGA', 'NGONTINH'
  slug text NOT NULL,
  title text,
  cover_url text,
  is_favorite boolean NOT NULL DEFAULT false,
  is_following boolean NOT NULL DEFAULT false,
  last_chapter numeric DEFAULT 1,
  last_chapter_name text,
  last_read_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manga_interactions_slug ON public.manga_interactions (slug, manga_type);
CREATE INDEX IF NOT EXISTS idx_manga_interactions_user ON public.manga_interactions (user_id);

ALTER TABLE public.manga_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public manga_interactions access" ON public.manga_interactions;
CREATE POLICY "Public manga_interactions access" ON public.manga_interactions FOR ALL USING (true) WITH CHECK (true);

-- 2. Bảng lưu nhật ký phiên đọc truyện chi tiết
CREATE TABLE IF NOT EXISTS public.manga_reading_logs (
  id text NOT NULL PRIMARY KEY,
  user_id text,
  manga_type text NOT NULL DEFAULT 'NGONTINH',
  manga_slug text NOT NULL,
  manga_title text NOT NULL,
  chapter_number numeric NOT NULL DEFAULT 1,
  chapter_name text,
  duration_minutes numeric NOT NULL DEFAULT 1,
  log_date text NOT NULL,
  log_time text,
  status text NOT NULL DEFAULT 'READING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manga_reading_logs_date ON public.manga_reading_logs (log_date);
CREATE INDEX IF NOT EXISTS idx_manga_reading_logs_slug ON public.manga_reading_logs (manga_slug);

ALTER TABLE public.manga_reading_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public manga_reading_logs access" ON public.manga_reading_logs;
CREATE POLICY "Public manga_reading_logs access" ON public.manga_reading_logs FOR ALL USING (true) WITH CHECK (true);

-- 3. Bảng lưu truyện tranh tự thêm thủ công
CREATE TABLE IF NOT EXISTS public.custom_manga (
  id text NOT NULL PRIMARY KEY,
  user_id text,
  manga_type text NOT NULL DEFAULT 'H_MANGA',
  slug text NOT NULL,
  title text NOT NULL,
  cover text,
  author text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_manga ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public custom_manga access" ON public.custom_manga;
CREATE POLICY "Public custom_manga access" ON public.custom_manga FOR ALL USING (true) WITH CHECK (true);

-- 4. Bảng lưu từ điển món ăn gợi ý tự động (Food Suggestions)
CREATE TABLE IF NOT EXISTS public.food_suggestions (
  id text NOT NULL PRIMARY KEY,
  user_id text,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  meal_type text,
  count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.food_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public food_suggestions access" ON public.food_suggestions;
CREATE POLICY "Public food_suggestions access" ON public.food_suggestions FOR ALL USING (true) WITH CHECK (true);

-- 5. Bảng lưu cài đặt người dùng chung (User App Settings)
-- Bao gồm: habit_custom_order, daily_quick_phrases, book_reader_settings, book_reading_goal,
-- last_read_book, tiktok_watched, pinned_tabs, theme, mini_player_position, v.v.
CREATE TABLE IF NOT EXISTS public.user_app_settings (
  setting_key text NOT NULL PRIMARY KEY,
  user_id text,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public user_app_settings access" ON public.user_app_settings;
CREATE POLICY "Public user_app_settings access" ON public.user_app_settings FOR ALL USING (true) WITH CHECK (true);
