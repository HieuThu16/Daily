-- Chia sẻ toàn bộ bài nhạc có MP3 cho tất cả người dùng trong hệ thống.
-- Tiến độ của bài nhạc được chia sẻ cho người nhận mặc định là 'PLANNED' (Chưa nghe).

create or replace function public.share_music_to_all(p_media_item_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  src      public.media_items;
  me_name  text;
  target   record;
  sent     integer := 0;
begin
  -- Chỉ chia sẻ nhạc của chính mình và có audio_url (file/link MP3)
  select * into src from public.media_items
   where id = p_media_item_id and user_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'Không tìm thấy bài nhạc của bạn.'; end if;

  if src.type != 'MUSIC' or src.audio_url is null or trim(src.audio_url) = '' then
    raise exception 'Bài hát không có file MP3/Audio để chia sẻ.';
  end if;

  select coalesce(name, email, 'một người dùng') into me_name from public.profiles where id = auth.uid();

  for target in select id from public.profiles where id != auth.uid() loop
    -- Tránh tạo trùng lặp nếu người nhận đã có bài hát này (theo audio_url hoặc theo tên + nghệ sĩ)
    if not exists (
      select 1 from public.media_items
       where user_id = target.id
         and type = 'MUSIC'
         and deleted_at is null
         and (
           (audio_url is not null and audio_url = src.audio_url)
           or (lower(name) = lower(src.name) and coalesce(lower(artist), '') = coalesce(lower(src.artist), ''))
         )
    ) then
      insert into public.media_items (
        user_id,
        type,
        name,
        description,
        status,
        artist,
        music_genre,
        audio_url,
        youtube_url,
        cover_url,
        is_favorite,
        shared_by
      ) values (
        target.id,
        'MUSIC',
        src.name,
        src.description,
        'PLANNED',
        src.artist,
        src.music_genre,
        src.audio_url,
        src.youtube_url,
        src.cover_url,
        false,
        me_name
      );
      sent := sent + 1;
    end if;
  end loop;

  return sent;
end $$;

revoke all on function public.share_music_to_all(uuid) from public;
grant execute on function public.share_music_to_all(uuid) to authenticated;

-- Backfill: Chia sẻ các bài nhạc đã có MP3 hiện tại cho toàn bộ các người dùng khác (với tiến độ mặc định PLANNED)
do $$
declare
  song record;
  target record;
  sharer_name text;
begin
  for song in
    select m.*, p.name as owner_name, p.email as owner_email
    from public.media_items m
    left join public.profiles p on p.id = m.user_id
    where m.type = 'MUSIC'
      and m.audio_url is not null
      and trim(m.audio_url) != ''
      and m.deleted_at is null
  loop
    sharer_name := coalesce(song.owner_name, song.owner_email, 'Người dùng');
    for target in select id from public.profiles where id != song.user_id loop
      if not exists (
        select 1 from public.media_items
        where user_id = target.id
          and type = 'MUSIC'
          and deleted_at is null
          and (
            (audio_url is not null and audio_url = song.audio_url)
            or (lower(name) = lower(song.name) and coalesce(lower(artist), '') = coalesce(lower(song.artist), ''))
          )
      ) then
        insert into public.media_items (
          user_id,
          type,
          name,
          description,
          status,
          artist,
          music_genre,
          audio_url,
          youtube_url,
          cover_url,
          is_favorite,
          shared_by
        ) values (
          target.id,
          'MUSIC',
          song.name,
          song.description,
          'PLANNED',
          song.artist,
          song.music_genre,
          song.audio_url,
          song.youtube_url,
          song.cover_url,
          false,
          sharer_name
        );
      end if;
    end loop;
  end loop;
end $$;
