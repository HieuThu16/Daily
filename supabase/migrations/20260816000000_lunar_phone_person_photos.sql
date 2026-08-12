-- Dịp lặp theo âm lịch: occasion_date vẫn là ngày dương gốc,
-- calendar='LUNAR' nghĩa là lặp theo ngày âm tương ứng.
alter table public.person_occasions add column if not exists calendar text not null default 'SOLAR';
do $$ begin
  alter table public.person_occasions add constraint person_occasions_calendar_check
    check (calendar in ('SOLAR', 'LUNAR'));
exception when duplicate_object then null; end $$;

-- Số điện thoại của người.
alter table public.people add column if not exists phone text;

-- Ảnh đính kèm nhật ký, khoá theo (person_id, log_date) nên thêm được cả khi chưa có chữ.
create table if not exists public.person_daily_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  person_id uuid not null references public.people(id) on delete cascade,
  log_date date not null,
  url text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists person_daily_photos_person_date_idx
  on public.person_daily_photos (user_id, person_id, log_date);

alter table public.person_daily_photos enable row level security;

do $$ begin
  create policy "own person photos" on public.person_daily_photos
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public)
values ('person-photos', 'person-photos', true) on conflict (id) do nothing;

do $$ begin
  create policy "public person photos read" on storage.objects
    for select using (bucket_id = 'person-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own person photos write" on storage.objects
    for insert to authenticated with check (bucket_id = 'person-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own person photos delete" on storage.objects
    for delete to authenticated using (bucket_id = 'person-photos');
exception when duplicate_object then null; end $$;
