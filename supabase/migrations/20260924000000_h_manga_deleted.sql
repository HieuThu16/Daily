CREATE TABLE IF NOT EXISTS public.h_manga_deleted (
  slug text NOT NULL PRIMARY KEY,
  title text,
  deleted_by text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.h_manga_deleted IS 'Truyen H da xoa vinh vien. Moi may deu loc theo danh sach nay.';

ALTER TABLE public.h_manga_deleted ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "h_manga_deleted read" ON public.h_manga_deleted;

CREATE POLICY "h_manga_deleted read" ON public.h_manga_deleted FOR SELECT USING (true);

DROP POLICY IF EXISTS "h_manga_deleted write by owner" ON public.h_manga_deleted;

CREATE POLICY "h_manga_deleted write by owner" ON public.h_manga_deleted FOR ALL
  USING (auth.jwt() ->> 'email' = 'truongnguyenminhhieu100@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'truongnguyenminhhieu100@gmail.com');
