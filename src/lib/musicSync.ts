import { supabase } from './supabase'
import { localDate } from './date'
import type { Media } from '../types'
import { updateMyShareProgress } from './watchTogether'

export function getCurrentTimeString(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Ghi nhận hành động nghe nhạc trên Web và đồng bộ ngay lập tức lên Supabase (bảng media_items).
 * Cập nhật log_date, log_time, status, channel='Hiếu'/'Kim Ý' và updated_at để hiển thị ngay tức thì bên tab Xem chung.
 */
export async function recordMusicListening(track: Media): Promise<void> {
  void updateMyShareProgress('MUSIC', track.id, 100, `Đang nghe · ${track.name}`)
  if (!track || !track.name) return

  const nowIso = new Date().toISOString()
  const today = localDate()
  const nowTime = getCurrentTimeString()

  let userEmail = ''
  let userId: string | null = null

  if (supabase?.auth) {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user) {
        userId = userData.user.id
        userEmail = userData.user.email?.toLowerCase() || ''
      }
    } catch {}
  }

  const isKimY = userEmail.includes('kimy') || userEmail.includes('nguyenkimy') || userEmail.includes('ý')
  const userName = isKimY ? 'Kim Ý' : 'Hiếu'

  // Bắn CustomEvent trên client để các component đang mở cập nhật tức thì
  try {
    window.dispatchEvent(
      new CustomEvent('daily_music_listening_updated', {
        detail: { trackId: track.id, title: track.name, userName, log_date: today, log_time: nowTime },
      }),
    )
  } catch {}

  if (!supabase) return

  try {
    // 1. Thử cập nhật bài hát có sẵn nếu track.id tồn tại
    if (track.id) {
      const { data: updated } = await supabase
        .from('media_items')
        .update({
          user_id: userId,
          channel: userName,
          description: `Nghe bởi ${userName}`,
          log_date: today,
          log_time: nowTime,
          status: 'COMPLETED',
          updated_at: nowIso,
        })
        .eq('id', track.id)
        .select('id')

      if (updated && updated.length > 0) return
    }

    // 2. Tìm theo audio_url hoặc name
    const { data: existing } = await supabase
      .from('media_items')
      .select('id')
      .eq('type', 'MUSIC')
      .eq('name', track.name)
      .limit(1)

    if (existing && existing.length > 0) {
      await supabase
        .from('media_items')
        .update({
          user_id: userId,
          channel: userName,
          description: `Nghe bởi ${userName}`,
          log_date: today,
          log_time: nowTime,
          status: 'COMPLETED',
          updated_at: nowIso,
        })
        .eq('id', existing[0].id)
    } else {
      // 3. Nếu chưa có, insert bản ghi mới
      await supabase.from('media_items').insert({
        user_id: userId,
        type: 'MUSIC',
        name: track.name,
        artist: track.artist || 'Nghệ sĩ',
        audio_url: track.audio_url || null,
        cover_url: track.cover_url || null,
        channel: userName,
        description: `Nghe bởi ${userName}`,
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
