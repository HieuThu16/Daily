-- Migration: add log_time to nutrition_logs table
ALTER TABLE public.nutrition_logs ADD COLUMN IF NOT EXISTS log_time text;
