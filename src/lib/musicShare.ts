import { supabase } from './supabase'

function client() {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  return supabase
}

/**
 * Chia sẻ một bài nhạc có file MP3 cho tất cả người dùng trong hệ thống.
 * Tiến độ của bài nhạc với các người dùng khác mặc định là PLANNED ('Sẽ nghe' / Chưa nghe).
 * Trả về số lượng người dùng được nhận bài hát mới.
 */
export async function shareMusicToAll(mediaItemId: string): Promise<number> {
  const db = client()
  const { data, error } = await db.rpc('share_music_to_all', {
    p_media_item_id: mediaItemId,
  })
  if (error) {
    console.warn('[shareMusicToAll error]', error)
    throw new Error(error.message)
  }
  return (data as number | null) ?? 0
}
