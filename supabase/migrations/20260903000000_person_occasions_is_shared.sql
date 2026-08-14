-- Migration: Add is_shared column to person_occasions
alter table public.person_occasions add column if not exists is_shared boolean not null default true;
