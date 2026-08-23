import { supabase } from './supabase'
import { localDate } from './date'
import type { Media } from '../types'

export function getCurrentTimeString(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Ghi nhận hành động nghe nhạc trên Web và đồng bộ ngay lập tức lên Supabase (bảng media_items).
 * Cập nhật log_date, log_time, status và updated_at để hiển thị ngay tức thì bên tab Xem chung.
 */
export async function recordMusicListening(track: Media): Promise<void> {
  if (!track) return

  const nowIso = new Date().toISOString()
  const today = localDate()
  const nowTime = getCurrentTimeString()

  // Bắn CustomEvent trên client để các component đang mở cập nhật tức thì
  try {
    window.dispatchEvent(
      new CustomEvent('daily_music_listening_updated', {
        detail: { trackId: track.id, title: track.name, log_date: today, log_time: nowTime },
      }),
    )
  } catch {}

  if (!supabase) return

  try {
    const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    const userId = userData?.user?.id || null

    if (track.id) {
      // 1. Cố gắng update dòng media_items có id tương ứng
      const { error, data } = await supabase
        .from('media_items')
        .update({
          user_id: userId,
          log_date: today,
          log_time: nowTime,
          status: 'COMPLETED',
          updated_at: nowIso,
        })
        .eq('id', track.id)
        .select('id')

      if (!error && data && data.length > 0) return
    }

    // 2. Nếu track chưa có id hoặc update không khớp (ví dụ bài hát từ URL ngoài), tìm theo audio_url hoặc name
    const { data: existing } = await supabase
      .from('media_items')
      .select('id')
      .eq('type', 'MUSIC')
      .or(`audio_url.eq.${track.audio_url || ''},name.eq.${track.name || ''}`)
      .limit(1)

    if (existing && existing.length > 0) {
      await supabase
        .from('media_items')
        .update({
          user_id: userId,
          log_date: today,
          log_time: nowTime,
          status: 'COMPLETED',
          updated_at: nowIso,
        })
        .eq('id', existing[0].id)
    } else {
      // 3. Nếu chưa có trong bảng, thêm mới bản ghi nghe nhạc
      await supabase.from('media_items').insert({
        user_id: userId,
        type: 'MUSIC',
        name: track.name || 'Bài hát',
        artist: track.artist || null,
        audio_url: track.audio_url || null,
        cover_url: track.cover_url || null,
        status: 'COMPLETED',
        log_date: today,
        log_time: nowTime,
        updated_at: nowIso,
      })
    }
  } catch (err) {
    console.warn('[recordMusicListening] Lỗi đồng bộ nghe nhạc:', err)
  }
}
