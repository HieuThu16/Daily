-- Tự động & trực tiếp nối 2 chiều kỉ niệm vợ chồng cho 2 tài khoản:
-- 1. truongnguyenminhhieu1000@gmail.com (chồng -> xem 'vợ')
-- 2. nguyenkimy1302.gr@gmail.com (vợ -> xem 'chồng')

create or replace function public.link_couple_accounts(
  user_a_email text,
  user_a_partner_name text,
  user_b_email text,
  user_b_partner_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  user_a_id uuid;
  user_b_id uuid;
  real_a_email text;
  real_b_email text;
begin
  select id, email into user_a_id, real_a_email from auth.users where lower(email) ilike lower(user_a_email) || '%' order by created_at desc limit 1;
  select id, email into user_b_id, real_b_email from auth.users where lower(email) ilike lower(user_b_email) || '%' order by created_at desc limit 1;

  -- Nối cho User A nếu đã có tài khoản
  if user_a_id is not null and real_b_email is not null then
    if not exists (select 1 from public.people where user_id = user_a_id and name = user_a_partner_name and deleted_at is null) then
      insert into public.people (user_id, name, group_key, is_partner)
      values (user_a_id, user_a_partner_name, 'FRIEND', true);
    else
      update public.people set is_partner = true where user_id = user_a_id and name = user_a_partner_name and deleted_at is null;
    end if;

    insert into public.shared_partners (user_id, partner_email)
    values (user_a_id, real_b_email)
    on conflict (user_id, partner_email) do nothing;
  end if;

  -- Nối cho User B nếu đã có tài khoản
  if user_b_id is not null and real_a_email is not null then
    if not exists (select 1 from public.people where user_id = user_b_id and name = user_b_partner_name and deleted_at is null) then
      insert into public.people (user_id, name, group_key, is_partner)
      values (user_b_id, user_b_partner_name, 'FRIEND', true);
    else
      update public.people set is_partner = true where user_id = user_b_id and name = user_b_partner_name and deleted_at is null;
    end if;

    insert into public.shared_partners (user_id, partner_email)
    values (user_b_id, real_a_email)
    on conflict (user_id, partner_email) do nothing;
  end if;
end;
$$;

-- Thực thi ngay cho 2 tài khoản nếu đã tồn tại trong database
select public.link_couple_accounts(
  'truongnguyenminhhieu1000@gmail.com', 'vợ',
  'nguyenkimy1302.gr@gmail.com', 'chồng'
);

-- Trigger tự động nối cho tài khoản mới đăng nhập lần đầu
create or replace function public.handle_couple_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.link_couple_accounts(
      'truongnguyenminhhieu1000@gmail.com', 'vợ',
      'nguyenkimy1302.gr@gmail.com', 'chồng'
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists on_couple_signup on auth.users;
create trigger on_couple_signup
  after insert on auth.users
  for each row execute function public.handle_couple_signup();



