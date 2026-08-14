-- Gắn mỗi kỷ niệm vào một người trong danh bạ, để mỗi người có tab Kỷ niệm riêng.
alter table public.shared_events
  add column if not exists person_id uuid references public.people(id) on delete cascade;

create index if not exists shared_events_person_idx
  on public.shared_events(person_id) where deleted_at is null;
