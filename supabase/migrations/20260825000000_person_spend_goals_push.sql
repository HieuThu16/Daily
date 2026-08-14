-- Ba việc: gắn khoản chi vào một người, thêm mục tiêu cho công việc, và lưu
-- đăng ký Web Push để nhắc được cả khi app đã đóng.

-- 1. Khoản thu/chi có thể gắn cho một người (quà, mời ăn, cho mượn…).
alter table public.transactions add column if not exists person_id uuid references public.people(id) on delete set null;
create index if not exists transactions_person_idx on public.transactions(person_id) where deleted_at is null;

-- 2. Mục tiêu. Task trỏ vào mục tiêu; tiến độ = số task đã xong trên tổng.
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  name       text not null check (length(trim(name)) > 0),
  note       text,
  due_date   date,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists goals_user_idx on public.goals(user_id) where deleted_at is null;

alter table public.goals enable row level security;

do $$ begin
  create policy "own goals" on public.goals for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Khoá ngoại thật (khác `category` lưu bằng tên): mục tiêu là thực thể có vòng đời riêng,
-- đổi tên không được làm task mồ côi. Xoá mục tiêu thì task chỉ rụng liên kết.
alter table public.todos add column if not exists goal_id uuid references public.goals(id) on delete set null;
create index if not exists todos_goal_idx on public.todos(goal_id) where deleted_at is null;

-- 3. Web Push. Mỗi trình duyệt một endpoint; cùng một người có thể có nhiều thiết bị.
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

do $$ begin
  create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Sau khi deploy edge function `send-reminders`, hẹn giờ chạy 5 phút một lần bằng pg_cron.
-- Chạy tay đoạn dưới trong SQL editor (cần bật extension pg_cron + pg_net và điền URL/khoá):
--
--   select cron.schedule('send-reminders', '*/5 * * * *', $$
--     select net.http_post(
--       url     := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
--       headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>', 'Content-Type', 'application/json')
--     );
--   $$);
