-- Migration: Add dream column to sleep_logs
alter table public.sleep_logs add column if not exists dream text;
