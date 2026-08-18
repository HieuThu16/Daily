-- Cho phép sửa tay thể loại của từng video (ghi đè kết quả tự động từ tiêu đề).
-- category_ids rỗng = ép video về "Tổng hợp & Khác".
CREATE TABLE IF NOT EXISTS public.video_category_overrides (
  video_id     text NOT NULL,
  type         text NOT NULL CHECK (type IN ('tvshow', 'review')),
  category_ids text[] NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, type)
);

ALTER TABLE public.video_category_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public video_category_overrides access" ON public.video_category_overrides;
CREATE POLICY "Public video_category_overrides access"
  ON public.video_category_overrides FOR ALL USING (true) WITH CHECK (true);
