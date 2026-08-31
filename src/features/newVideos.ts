import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Mốc "đã xem tới đâu" — mọi video có first_seen_at sau mốc này là mới. */
const SEEN_KEY = 'daily-new-videos-seen-at'

export type VideoRow = {
  video_id: string
  creator_name: string | null
  title: string
  thumbnail: string | null
  first_seen_at: string
}

export type ChannelUpdate = {
  key: string
  kind: 'reviews' | 'tvshow'
  creatorName: string
  count: number
  latestTitle: string
  thumbnail: string | null
}

/** Gộp video mới theo kênh: mỗi kênh một dòng, kèm tên video mới nhất. */
export function groupByChannel(rows: VideoRow[], kind: ChannelUpdate['kind']): ChannelUpdate[] {
  const byChannel = new Map<string, ChannelUpdate>()
  for (const row of rows) {
    const creatorName = row.creator_name || 'Kênh không tên'
    const found = byChannel.get(creatorName)
    if (found) {
      found.count += 1
      // Hàng đã sắp mới nhất trước, nên chỉ giữ tiêu đề đầu tiên gặp.
      continue
    }
    byChannel.set(creatorName, {
      key: `${kind}:${creatorName}`,
      kind,
      creatorName,
      count: 1,
      latestTitle: row.title,
      thumbnail: row.thumbnail,
    })
  }
  return [...byChannel.values()]
}

export function markManualCrawlSeen() {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
    window.dispatchEvent(new CustomEvent('daily_new_videos_cleared'))
  } catch {}
}

const getSeenAt = () =>
  localStorage.getItem(SEEN_KEY) ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

/** Video mới cron kéo về từ lần xem trước tới giờ, gộp theo kênh. */
export function useNewVideos() {
  const [updates, setUpdates] = useState<ChannelUpdate[]>([])

  const check = useCallback(async () => {
    if (!supabase) return
    const since = getSeenAt()
    const query = (table: string) =>
      supabase!
        .from(table)
        .select('video_id,creator_name,title,thumbnail,first_seen_at')
        .gt('first_seen_at', since)
        .order('first_seen_at', { ascending: false })
        .limit(200)

    // Mất mạng hay bảng chưa có thì im lặng bỏ qua — chuông không được vỡ vì chuyện này.
    try {
      const [reviews, tv] = await Promise.all([query('review_videos'), query('tvshow_videos')])
      setUpdates([
        ...groupByChannel((reviews.data ?? []) as VideoRow[], 'reviews'),
        ...groupByChannel((tv.data ?? []) as VideoRow[], 'tvshow'),
      ])
    } catch {
      setUpdates([])
    }
  }, [])

  useEffect(() => {
    void check()
    const onFocus = () => void check()
    const onCleared = () => setUpdates([])
    window.addEventListener('focus', onFocus)
    window.addEventListener('daily_new_videos_cleared', onCleared)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('daily_new_videos_cleared', onCleared)
    }
  }, [check])

  const dismissAll = useCallback(() => {
    markManualCrawlSeen()
    setUpdates([])
  }, [])

  return { updates, dismissAll }
}
