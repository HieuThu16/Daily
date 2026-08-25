-- Xem tài khoản nào đã bật thông báo đẩy.
--
-- RLS của push_subscriptions chỉ cho mỗi người thấy đăng ký của chính mình, nên
-- không thể biết người kia đã bật chưa — đúng lúc cần nhất: gửi "Xem chung" mà
-- họ không nhận được gì thì chịu, không đoán nổi vì sao.
--
-- Hàm này CHỈ trả về email và một cờ true/false. Không lộ endpoint hay khoá mã
-- hoá của bất kỳ ai, nên bật cho người đã đăng nhập xem là đủ an toàn.
create or replace function public.push_status()
returns table (email text, has_push boolean)
language sql
security definer
stable
set search_path = public
as $$
  select p.email,
         exists (select 1 from push_subscriptions s where s.user_id = p.id) as has_push
  from profiles p
  where p.email is not null
  order by p.email;
$$;

revoke all on function public.push_status() from public;
grant execute on function public.push_status() to authenticated;
