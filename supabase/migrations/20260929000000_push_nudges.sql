-- Nhắc người khác bật thông báo đẩy.
--
-- Không thể ĐẨY một thông báo tới người chưa bật thông báo đẩy — đó là vòng
-- luẩn quẩn. Nên lời nhắc phải chờ sẵn ở đây, và hiện ra ngay trong app lúc
-- người đó mở lên.
create table if not exists public.push_nudges (
  id         uuid primary key default gen_random_uuid(),
  from_email text not null,
  to_email   text not null check (position('@' in to_email) > 1),
  created_at timestamptz not null default now(),
  -- Đã xem thì thôi không hiện nữa; giữ lại để khỏi nhắc dồn dập.
  seen_at    timestamptz
);

create index if not exists push_nudges_to_idx
  on public.push_nudges (lower(to_email), created_at desc);

alter table public.push_nudges enable row level security;

do $$ begin
  -- Người nhận đọc lời nhắc của mình; người gửi xem lại cái mình đã gửi.
  create policy "read my nudges" on public.push_nudges for select to authenticated
    using (
      lower(to_email) = lower(auth.jwt() ->> 'email')
      or lower(from_email) = lower(auth.jwt() ->> 'email')
    );

  -- Chỉ nhắc dưới tên chính mình, không mạo danh người khác.
  create policy "send nudge as myself" on public.push_nudges for insert to authenticated
    with check (lower(from_email) = lower(auth.jwt() ->> 'email'));

  -- Chỉ người nhận mới đánh dấu đã xem.
  create policy "mark my nudge seen" on public.push_nudges for update to authenticated
    using (lower(to_email) = lower(auth.jwt() ->> 'email'))
    with check (lower(to_email) = lower(auth.jwt() ->> 'email'));
exception when duplicate_object then null; end $$;
