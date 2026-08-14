-- Đánh dấu một người là "người yêu chung": chỉ người này mới có tab Sự kiện chung.
alter table public.people add column if not exists is_partner boolean not null default false;
