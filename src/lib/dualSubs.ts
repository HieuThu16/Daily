import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './apiFetch'

export type SubCue = { start: number; end: number; text: string; vi?: string }

const cache = new Map<string, SubCue[]>()

/** Tải phụ đề Anh–Việt của một video (có nhớ tạm trong phiên). */
export async function fetchDualSubs(videoId: string): Promise<SubCue[]> {
  const cached = cache.get(videoId)
  if (cached) return cached
  const res = await apiFetch(`/api/youtube-transcript?v=${encodeURIComponent(videoId)}&tl=vi`)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || 'Không lấy được phụ đề')
  const cues: SubCue[] = data?.cues || []
  cache.set(videoId, cues)
  return cues
}

/**
 * Tìm câu đang nói tại giây `t`. Tìm nhị phân vì hàm này chạy 4 lần/giây
 * suốt cả video. Trả về -1 khi đang ở đoạn không có lời.
 */
export function cueIndexAt(cues: SubCue[], t: number): number {
  let lo = 0
  let hi = cues.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (t < cues[mid].start) hi = mid - 1
    else if (t >= cues[mid].end) lo = mid + 1
    else return mid
  }
  return -1
}

/** Câu đang được nói, cập nhật 4 lần/giây theo đồng hồ của trình phát. */
export function useCurrentCue(player: any, cues: SubCue[], enabled: boolean): SubCue | null {
  const [cue, setCue] = useState<SubCue | null>(null)
  const lastRef = useRef(-2)

  useEffect(() => {
    if (!enabled || !player?.getCurrentTime || cues.length === 0) {
      setCue(null)
      lastRef.current = -2
      return
    }
    const tick = () => {
      const t = Number(player.getCurrentTime()) || 0
      const i = cueIndexAt(cues, t)
      if (i === lastRef.current) return // cùng một câu thì đừng vẽ lại
      lastRef.current = i
      setCue(i >= 0 ? cues[i] : null)
    }
    tick()
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [player, cues, enabled])

  return cue
}
