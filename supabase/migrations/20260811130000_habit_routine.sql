-- Add routine column to habits table
alter table public.habits
  add column if not exists routine text check (routine in ('MORNING', 'AFTERNOON', 'EVENING')) default 'MORNING';

-- Backfill existing habits to MORNING routine
update public.habits set routine = 'MORNING' where routine is null;
