import { useCallback, useEffect, useRef } from 'react'
import { estimatePage, reportPagesRead, saveProgress } from '../../lib/book/repository'

const SAVE_DEBOUNCE_MS = 2000
const MIN_SAVE_INTERVAL_MS = 10_000
const READING_TICK_MS = 5000
const MIN_SECONDS_BEFORE_LOG = 60

export type ReadingPosition = {
  chapterIdx: number
  charOffset: number
  charCount: number
  ratio: number
}

type Options = {
  documentId: string | null
  mediaItemId: string
  totalChars: number
  pageCount: number | null
  enabled?: boolean
}

const absoluteOffset = (spot: ReadingPosition) => spot.charOffset + spot.ratio * spot.charCount

/**
 * Giữ vị trí đọc mới nhất, ghi xuống Supabase khi người dùng ngừng cuộn hoặc rời màn
 * hình, và tự ghi nhật ký đọc của hôm nay sau khi đã đọc đủ 60 giây.
 * Lỗi khi lưu không bao giờ chặn việc đọc.
 */
export function useBookReadingProgress({ documentId, mediaItemId, totalChars, pageCount, enabled = true }: Options) {
  const position = useRef<ReadingPosition | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedAt = useRef(0)
  const secondsRead = useRef(0)
  const loggedToday = useRef(false)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    enabledRef.current = enabled
    if (!enabled && debounce.current) {
      clearTimeout(debounce.current)
      debounce.current = null
    }
  }, [enabled])

  const flush = useCallback(async () => {
    if (!enabledRef.current) return
    const spot = position.current
    if (!documentId || !spot) return

    if (debounce.current) {
      clearTimeout(debounce.current)
      debounce.current = null
    }
    lastSavedAt.current = Date.now()

    const offset = absoluteOffset(spot)
    const percent = totalChars > 0 ? Math.min(100, Math.max(0, (offset / totalChars) * 100)) : 0

    try {
      await saveProgress(documentId, {
        last_chapter_idx: spot.chapterIdx,
        last_scroll_ratio: Math.min(1, Math.max(0, spot.ratio)),
        last_char_offset: Math.round(offset),
        percent,
      })
      if (loggedToday.current) {
        await reportPagesRead(mediaItemId, estimatePage(offset, totalChars, pageCount))
      }
    } catch (error) {
      // Không chặn việc đọc; lần lưu kế tiếp sẽ thử lại.
      console.warn('Không lưu được tiến độ đọc', error)
    }
  }, [documentId, mediaItemId, pageCount, totalChars])

  const report = useCallback(
    (spot: ReadingPosition) => {
      if (!enabledRef.current) return
      position.current = spot
      if (!documentId) return

      if (debounce.current) clearTimeout(debounce.current)
      const sinceLastSave = Date.now() - lastSavedAt.current
      const delay = Math.max(SAVE_DEBOUNCE_MS, MIN_SAVE_INTERVAL_MS - sinceLastSave)
      debounce.current = setTimeout(() => void flush(), delay)
    },
    [documentId, flush],
  )

  // Đếm thời gian đọc thực tế, chỉ tính khi tab đang hiển thị.
  useEffect(() => {
    if (!documentId || !enabled) return

    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !enabledRef.current) return
      secondsRead.current += READING_TICK_MS / 1000
      if (loggedToday.current || secondsRead.current < MIN_SECONDS_BEFORE_LOG) return

      loggedToday.current = true
      const spot = position.current
      const offset = spot ? absoluteOffset(spot) : 0
      void reportPagesRead(mediaItemId, estimatePage(offset, totalChars, pageCount)).catch((error) => {
        loggedToday.current = false
        console.warn('Không ghi được nhật ký đọc', error)
      })
    }, READING_TICK_MS)

    return () => clearInterval(timer)
  }, [documentId, mediaItemId, pageCount, totalChars, enabled])

  // Ghi ngay khi ẩn tab, và một lần cuối khi rời màn hình.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void flush()
    }
  }, [flush])

  return { report, flush }
}
