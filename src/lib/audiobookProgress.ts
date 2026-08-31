import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { AudiobookProgress } from '../types/audiobook'
import { updateMyShareProgress } from './watchTogether'

const PROGRESS_STORAGE_KEY = 'daily_audiobook_progress_map'
const PROGRESS_EVENT = 'daily_audiobook_progress_changed'

/** Đọc bản đồ tiến độ sách nói từ LocalStorage */
export function getLocalAudiobookProgress(): Record<string, AudiobookProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** Ghi bản đồ tiến độ sách nói vào LocalStorage và dispatch event */
export function saveLocalAudiobookProgress(map: Record<string, AudiobookProgress>): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: map }))
  } catch (err) {
    console.warn('[audiobookProgress] Không lưu được vào localStorage:', err)
  }
}

/** Lấy tiến độ của một cuốn sách nói cụ thể */
export function getAudiobookProgress(bookId: string): AudiobookProgress | null {
  const map = getLocalAudiobookProgress()
  return map[bookId] ?? null
}

/**
 * Cập nhật và lưu tiến độ sách nói:
 * 1. Lưu LocalStorage ngay lập tức
 * 2. Lưu lên Supabase (book_reading_logs & watch_shares)
 */
export async function updateAudiobookProgress(
  bookId: string,
  input: {
    trackIndex: number
    trackTitle?: string
    currentSeconds: number
    durationSeconds: number
    bookTitle?: string
    author?: string
    coverUrl?: string
  }
): Promise<AudiobookProgress> {
  const duration = Math.max(1, input.durationSeconds || 1)
  const current = Math.max(0, Math.min(input.currentSeconds, duration))
  const percent = Math.max(0, Math.min(100, Math.round((current / duration) * 100)))
  const completed = percent >= 92

  const record: AudiobookProgress = {
    bookId,
    trackIndex: input.trackIndex,
    trackTitle: input.trackTitle || `Phần ${input.trackIndex + 1}`,
    currentSeconds: current,
    durationSeconds: duration,
    percent,
    updatedAt: new Date().toISOString(),
    completed,
  }

  // 1. Lưu LocalStorage
  const map = getLocalAudiobookProgress()
  map[bookId] = record
  saveLocalAudiobookProgress(map)

  // 2. Đồng bộ lên Supabase nếu có kết nối
  if (supabase) {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user
      if (user) {
        // Cập nhật trạng thái trong media_items nếu có
        await supabase
          .from('media_items')
          .update({
            status: completed ? 'COMPLETED' : 'IN_PROGRESS',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookId)

        // Đồng bộ tiến độ Xem Chung
        void updateMyShareProgress(
          'OTHER',
          bookId,
          percent,
          completed ? 'Đã nghe xong' : `Đang nghe ${percent}% (Phần ${input.trackIndex + 1})`
        )
      }
    } catch (err) {
      console.warn('[audiobookProgress] Lỗi đồng bộ Supabase:', err)
    }
  }

  return record
}

/** Hook React lắng nghe tiến độ sách nói thay đổi theo thời gian thực */
export function useAudiobookProgressMap(): Record<string, AudiobookProgress> {
  const [map, setMap] = useState<Record<string, AudiobookProgress>>(() => getLocalAudiobookProgress())

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, AudiobookProgress>>
      setMap(customEvent.detail || getLocalAudiobookProgress())
    }

    window.addEventListener(PROGRESS_EVENT, handler)
    window.addEventListener('storage', () => setMap(getLocalAudiobookProgress()))

    return () => {
      window.removeEventListener(PROGRESS_EVENT, handler)
    }
  }, [])

  return map
}
