-- FSRS thay SM-2: mỗi thẻ giữ thêm độ bền (stability) và độ khó (difficulty).
-- Thẻ cũ để 0/5, app tự suy ra từ interval_days và ease lần chấm kế tiếp.
ALTER TABLE public.english_items
  ADD COLUMN IF NOT EXISTS stability  real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty real NOT NULL DEFAULT 5;

ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS stability  real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difficulty real NOT NULL DEFAULT 5;
