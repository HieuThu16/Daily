-- Nhạc bị nhân bản: mỗi lần lấy lại MP3 sinh audio_url mới nên phép chống trùng
-- theo audio_url không bắt được, người nhận lãnh cả chục bản y hệt.
-- 1) Dọn bản trùng đang có, 2) khoá bằng unique index, 3) chia sẻ thì bỏ qua bản trùng.

-- 1. Giữ lại một bản cho mỗi (người dùng, tên, ca sĩ): ưu tiên bản có MP3, rồi bản của chính mình.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lower(name), lower(coalesce(artist, ''))
           order by (audio_url is not null and trim(audio_url) <> '') desc,
                    (shared_by is null) desc,
                    created_at
         ) as rn
    from public.media_items
   where type = 'MUSIC' and deleted_at is null
)
update public.media_items m
   set deleted_at = now()
  from ranked r
 where m.id = r.id and r.rn > 1;

-- 2. Từ nay một người chỉ giữ được một bản của mỗi bài.
create unique index if not exists media_items_music_unique
  on public.media_items (user_id, lower(name), lower(coalesce(artist, '')))
  where type = 'MUSIC' and deleted_at is null;

-- 3. Hàm chia sẻ: thêm on conflict do nothing để không văng lỗi khi người nhận đã có bài.
create or replace function public.share_music_to_all(p_media_item_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  src      public.media_items;
  me_name  text;
  target   record;
  sent     integer := 0;
begin
  select * into src from public.media_items
   where id = p_media_item_id and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'Không tìm thấy bài nhạc của bạn.'; end if;

  if src.type != 'MUSIC' or src.audio_url is null or trim(src.audio_url) = '' then
    raise exception 'Bài hát không có file MP3/Audio để chia sẻ.';
  end if;

  select coalesce(name, email, 'một người dùng') into me_name from public.profiles where id = auth.uid();

  for target in select id from public.profiles where id != auth.uid() loop
    if not exists (
      select 1 from public.media_items
       where user_id = target.id
         and type = 'MUSIC'
         and deleted_at is null
         and lower(name) = lower(src.name)
         and coalesce(lower(artist), '') = coalesce(lower(src.artist), '')
    ) then
      insert into public.media_items (
        user_id, type, name, description, status, artist, music_genre,
        audio_url, youtube_url, cover_url, is_favorite, shared_by
      ) values (
        target.id, 'MUSIC', src.name, src.description, 'PLANNED', src.artist, src.music_genre,
        src.audio_url, src.youtube_url, src.cover_url, false, me_name
      )
      on conflict do nothing;
      sent := sent + 1;
    end if;
  end loop;

  return sent;
end $$;

revoke all on function public.share_music_to_all(uuid) from public;
grant execute on function public.share_music_to_all(uuid) to authenticated;
