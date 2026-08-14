-- Tự động nối cặp đôi: khi một trong hai email đăng nhập lần đầu, tạo sẵn
-- người yêu chung trong danh bạ và bật chia sẻ sự kiện sang người kia.
-- Mapping cứng cho đúng 2 tài khoản này (app riêng của 2 người).

create or replace function public.handle_couple_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  partner_email text;
  partner_name  text;
begin
  if new.email = 'truongnguyenminhhieu100@gmail.com' then
    partner_email := 'nguyenkimy1302.gr@gmail.com';
    partner_name  := 'vợ';
  elsif new.email = 'nguyenkimy1302.gr@gmail.com' then
    partner_email := 'truongnguyenminhhieu100@gmail.com';
    partner_name  := 'chồng';
  else
    return new;
  end if;

  begin
    -- Người yêu chung trong danh bạ của tài khoản vừa tạo.
    insert into public.people (user_id, name, group_key, is_partner)
    select new.id, partner_name, 'FRIEND', true
    where not exists (
      select 1 from public.people p
      where p.user_id = new.id and p.is_partner and p.deleted_at is null
    );

    -- Cho người kia xem sự kiện của mình (chiều còn lại họ tự thêm khi đăng nhập).
    insert into public.shared_partners (user_id, partner_email)
    values (new.id, partner_email)
    on conflict (user_id, partner_email) do nothing;
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
