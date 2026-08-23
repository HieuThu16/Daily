-- Migration: Tạo bảng định vị và nhật ký hành trình cho cặp đôi (Partner Locations & Logs)

-- 1. Bảng lưu tọa độ vị trí hiện tại mới nhất của từng người
CREATE TABLE IF NOT EXISTS public.partner_locations (
  user_id text NOT NULL PRIMARY KEY,
  user_name text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  address_name text,
  current_place text,
  battery_level integer,
  is_charging boolean DEFAULT false,
  speed double precision,
  is_sharing boolean DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_locations_updated_at ON public.partner_locations (updated_at DESC);

ALTER TABLE public.partner_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public partner_locations access" ON public.partner_locations;
CREATE POLICY "Public partner_locations access" ON public.partner_locations FOR ALL USING (true) WITH CHECK (true);

-- Bật Realtime cho partner_locations để đồng bộ tức thì vị trí giữa 2 người
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'partner_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_locations;
  END IF;
END $$;


-- 2. Bảng lưu lịch sử di chuyển & timeline theo ngày
CREATE TABLE IF NOT EXISTS public.partner_location_logs (
  id text NOT NULL PRIMARY KEY,
  user_id text NOT NULL,
  user_name text NOT NULL,
  place_name text NOT NULL,
  event_type text NOT NULL, -- 'STAY', 'DEPARTURE', 'ARRIVAL', 'MOVE'
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  log_date text NOT NULL, -- YYYY-MM-DD
  start_time text NOT NULL, -- HH:mm
  end_time text,
  duration_minutes integer,
  distance_km double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_location_logs_date ON public.partner_location_logs (log_date);
CREATE INDEX IF NOT EXISTS idx_partner_location_logs_user ON public.partner_location_logs (user_id);

ALTER TABLE public.partner_location_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public partner_location_logs access" ON public.partner_location_logs;
CREATE POLICY "Public partner_location_logs access" ON public.partner_location_logs FOR ALL USING (true) WITH CHECK (true);
