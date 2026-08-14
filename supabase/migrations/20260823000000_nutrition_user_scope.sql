-- Tab Dưỡng đang dùng chung dữ liệu cho mọi tài khoản: hai bảng này không có user_id
-- và policy là `using (true)`. Thêm chủ sở hữu, dồn dữ liệu cũ về acc truongnguyenminhhieu100,
-- rồi khoá lại theo auth.uid().

do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users
   where email ilike 'truongnguyenminhhieu100%' order by created_at limit 1;
  if owner_id is null then
    raise exception 'Không tìm thấy tài khoản truongnguyenminhhieu100 trong auth.users.';
  end if;

  alter table public.nutrition_logs add column if not exists user_id uuid references auth.users(id);
  alter table public.sleep_logs     add column if not exists user_id uuid references auth.users(id);

  -- Dữ liệu cũ không biết của ai, theo yêu cầu thì về hết một tài khoản.
  update public.nutrition_logs set user_id = owner_id where user_id is null;
  update public.sleep_logs     set user_id = owner_id where user_id is null;
end $$;

alter table public.nutrition_logs alter column user_id set default auth.uid();
alter table public.sleep_logs     alter column user_id set default auth.uid();
alter table public.nutrition_logs alter column user_id set not null;
alter table public.sleep_logs     alter column user_id set not null;

create index if not exists nutrition_logs_user_date_idx on public.nutrition_logs(user_id, log_date);
create index if not exists sleep_logs_user_idx on public.sleep_logs(user_id);

-- Policy cũ cho phép mọi người đọc/ghi mọi dòng — phải bỏ, không thì thêm policy mới cũng vô nghĩa.
drop policy if exists "Public nutrition_logs access" on public.nutrition_logs;
drop policy if exists "Public sleep_logs access"     on public.sleep_logs;

do $$ begin
  create policy "own nutrition logs" on public.nutrition_logs for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own sleep logs" on public.sleep_logs for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
