-- =====================================================================
-- CHẠY SCRIPT NÀY TRÊN SUPABASE SQL EDITOR
-- Thứ tự: Thêm cột is_public → Sửa RLS policy
-- =====================================================================

-- =====================================================================
-- BƯỚC 1: Thêm cột is_public vào bảng media_items
-- =====================================================================

-- Thêm cột is_public (mặc định = true = công khai)
ALTER TABLE public.media_items 
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Tạo index để tăng tốc query
CREATE INDEX IF NOT EXISTS media_items_is_public_idx 
  ON public.media_items(is_public) 
  WHERE deleted_at IS NULL;

-- =====================================================================
-- BƯỚC 2: Xóa policy cũ và tạo policy mới
-- =====================================================================

-- Xóa TẤT CẢ policies cũ
DROP POLICY IF EXISTS "own media" ON public.media_items;
DROP POLICY IF EXISTS "view own and public media" ON public.media_items;
DROP POLICY IF EXISTS "manage own media" ON public.media_items;
DROP POLICY IF EXISTS "update own media" ON public.media_items;
DROP POLICY IF EXISTS "delete own media" ON public.media_items;

-- Policy mới cho SELECT: xem sách của mình + sách công khai
CREATE POLICY "view own and public media" ON public.media_items
  FOR SELECT 
  USING (
    user_id = auth.uid()        -- Sách của mình
    OR is_public = true         -- Hoặc sách công khai
  );

-- Policy cho INSERT: chỉ tạo sách cho mình
CREATE POLICY "manage own media" ON public.media_items
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Policy cho UPDATE: chỉ sửa sách của mình
CREATE POLICY "update own media" ON public.media_items
  FOR UPDATE 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

-- Policy cho DELETE: chỉ xóa sách của mình
CREATE POLICY "delete own media" ON public.media_items
  FOR DELETE 
  USING (user_id = auth.uid());

-- =====================================================================
-- BƯỚC 3: Kiểm tra kết quả
-- =====================================================================

-- Xem số lượng sách theo is_public
SELECT 
  is_public,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as users
FROM public.media_items 
WHERE type = 'BOOK' 
  AND deleted_at IS NULL
GROUP BY is_public;

-- Xem tổng số sách bạn có thể thấy
SELECT 
  COUNT(*) as visible_books,
  COUNT(CASE WHEN user_id = auth.uid() THEN 1 END) as my_books,
  COUNT(CASE WHEN is_public = true AND user_id != auth.uid() THEN 1 END) as public_books_from_others
FROM public.media_items
WHERE type = 'BOOK' 
  AND deleted_at IS NULL
  AND (user_id = auth.uid() OR is_public = true);

-- =====================================================================
-- BƯỚC 4: Thêm cột position vào bảng habits để lưu thứ tự ưu tiên
-- =====================================================================
ALTER TABLE public.habits 
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS habits_user_position_idx 
  ON public.habits(user_id, position) 
  WHERE deleted_at IS NULL;

-- =====================================================================
-- BƯỚC 5: Thêm cột đánh dấu đã học (is_learned), màu thẻ (color), ảnh cover (cover_url)
-- =====================================================================
ALTER TABLE public.english_items
  ADD COLUMN IF NOT EXISTS is_learned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS cover_url text;

CREATE INDEX IF NOT EXISTS english_items_user_learned_idx
  on public.english_items(user_id, is_learned, created_at desc) 
  WHERE deleted_at IS NULL;

