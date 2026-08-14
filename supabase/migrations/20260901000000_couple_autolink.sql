-- Tạm thời gỡ bỏ trigger tự động nối cặp đôi trên auth.users để tạo tài khoản bình thường.

drop trigger if exists on_couple_signup on auth.users;
drop function if exists public.handle_couple_signup();

