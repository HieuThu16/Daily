-- Chia sẻ sách giữa các tài khoản: danh bạ người dùng + hàm chép thẳng nội dung.
-- Không có bước đồng ý: gửi xong là sách nằm sẵn trong thư viện người nhận.

-- 1. Danh bạ: auth.users không đọc được từ client, nên soi gương sang public.profiles.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$ begin
  -- Ai đã đăng nhập cũng thấy danh bạ — đó chính là màn hình "chọn người để share".
  create policy "read all profiles" on public.profiles for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "write own profile" on public.profiles for update to authenticated
    using (id = auth.uid()) with check (id = auth.uid());
exception when duplicate_object then null; end $$;

create or replace function public.sync_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url;
  return new;
end $$;

drop trigger if exists profiles_sync on auth.users;
create trigger profiles_sync after insert or update on auth.users
  for each row execute function public.sync_profile();

-- Backfill người đã đăng ký trước migration này.
insert into public.profiles (id, email, name, avatar_url)
select id, email,
       coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
       raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

-- 2. Dấu vết "sách này do ai đó chia sẻ". Lưu tên chứ không phải id: thư viện chỉ cần
-- hiện một dòng chữ, lưu tên thì khỏi join profiles ở mọi màn hình.
alter table public.media_items add column if not exists shared_by text;

-- 3. Gửi sách cho nhiều người cùng lúc, chép luôn không cần đồng ý.
-- security definer vì phải ghi vào tài khoản người khác, mà RLS chỉ cho ghi của mình.
-- Chỉ chép nội dung — tiến độ đọc và nhật ký thì không.
create or replace function public.share_book_to(p_media_item_id uuid, p_to_users uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  src      public.media_items;
  src_doc  public.book_documents;
  me_name  text;
  target   uuid;
  new_item uuid;
  new_doc  uuid;
  sent     integer := 0;
begin
  -- Chỉ được chia sẻ sách của chính mình.
  select * into src from public.media_items
   where id = p_media_item_id and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'Không tìm thấy sách của bạn.'; end if;

  select coalesce(name, email, 'một người dùng') into me_name from public.profiles where id = auth.uid();
  select * into src_doc from public.book_documents where media_item_id = p_media_item_id;

  foreach target in array p_to_users loop
    continue when target = auth.uid();
    -- Người nhận phải là tài khoản có thật; id rác thì bỏ qua thay vì làm hỏng cả lượt gửi.
    continue when not exists (select 1 from public.profiles where id = target);

    insert into public.media_items
      (user_id, type, name, description, status, author, genre, cover_url, book_format, shared_by)
    values
      (target, src.type, src.name, src.description, 'PLANNED', src.author, src.genre,
       src.cover_url, src.book_format, me_name)
    returning id into new_item;

    if src_doc.id is not null then
      insert into public.book_documents
        (user_id, media_item_id, source_format, source_filename, total_chars, page_count, est_pages, chapter_count)
      values
        (target, new_item, src_doc.source_format, src_doc.source_filename, src_doc.total_chars,
         src_doc.page_count, src_doc.est_pages, src_doc.chapter_count)
      returning id into new_doc;

      insert into public.book_chapters (user_id, document_id, idx, title, content, char_count, char_offset)
      select target, new_doc, idx, title, content, char_count, char_offset
        from public.book_chapters where document_id = src_doc.id;
    end if;

    sent := sent + 1;
  end loop;

  return sent;
end $$;

revoke all on function public.share_book_to(uuid, uuid[]) from public;
grant execute on function public.share_book_to(uuid, uuid[]) to authenticated;
