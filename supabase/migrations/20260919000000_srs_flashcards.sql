-- Lap lai ngat quang (SM-2 rut gon) cho ca hai bo the: English va Kien thuc.
-- The cu chua tung on -> due_date = hom nay, nen se vao hang doi ngay lan mo dau tien.

ALTER TABLE public.english_items
  ADD COLUMN IF NOT EXISTS ease          real    NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS interval_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date      date    NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS reps          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapses        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS ease          real    NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS interval_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date      date    NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS reps          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapses        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;

-- Hang doi "the den han" duoc doc moi lan mo app va moi lan chuong dem so.
CREATE INDEX IF NOT EXISTS english_items_due_idx   ON public.english_items (due_date)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS knowledge_items_due_idx ON public.knowledge_items (due_date) WHERE deleted_at IS NULL;

-- Nhat ky moi luot on, de ve bieu do chuoi ngay hoc va so the da on.
CREATE TABLE IF NOT EXISTS public.study_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck       text NOT NULL CHECK (deck IN ('english', 'knowledge')),
  card_id    uuid NOT NULL,
  grade      text NOT NULL CHECK (grade IN ('AGAIN', 'HARD', 'GOOD', 'EASY')),
  log_date   date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_reviews_date_idx ON public.study_reviews (log_date DESC);

ALTER TABLE public.study_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public study_reviews access" ON public.study_reviews;
CREATE POLICY "Public study_reviews access"
  ON public.study_reviews FOR ALL USING (true) WITH CHECK (true);
