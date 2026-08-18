import { useCallback, useEffect, useState } from 'react'
import { fetchDuaLeoMangaList, getFollows } from './mangaService'
import { fetchNgontinhList, getNgontinhFollows } from './ngontinhService'
import {
  findNewChapters,
  getSeenChapters,
  markSeen,
  saveSeenChapters,
  seenKey,
  type MangaUpdate,
} from './followUpdates'

/** Sự kiện phát ra khi người dùng bấm theo dõi / bỏ theo dõi một truyện. */
export const FOLLOWS_UPDATED_EVENT = 'daily-manga-follows-updated'

export function notifyFollowsChanged() {
  window.dispatchEvent(new CustomEvent(FOLLOWS_UPDATED_EVENT))
}

/** Theo dõi các truyện BL / Ngôn Tình có chương mới. Tự kiểm tra lại khi cửa sổ được focus. */
export function useMangaUpdates() {
  const [updates, setUpdates] = useState<MangaUpdate[]>([])

  const check = useCallback(async () => {
    const blFollows = getFollows()
    const ntFollows = getNgontinhFollows()
    if (blFollows.length === 0 && ntFollows.length === 0) {
      setUpdates([])
      return
    }

    const seen = getSeenChapters()
    const [bl, nt] = await Promise.all([
      blFollows.length > 0 ? fetchDuaLeoMangaList() : Promise.resolve([]),
      ntFollows.length > 0 ? fetchNgontinhList() : Promise.resolve([]),
    ])

    setUpdates([
      ...findNewChapters(bl, blFollows, 'BL', seen),
      ...findNewChapters(nt, ntFollows, 'NGONTINH', seen),
    ])

    // Truyện vừa theo dõi chưa có mốc: ghi mốc ngay, lần crawl sau mới tính là chương mới.
    const freshBL = bl.filter((m) => seen[seenKey('BL', m.slug)] === undefined)
    const freshNT = nt.filter((m) => seen[seenKey('NGONTINH', m.slug)] === undefined)
    if (freshBL.length > 0 || freshNT.length > 0) {
      let next = markSeen(freshBL, blFollows, 'BL', seen)
      next = markSeen(freshNT, ntFollows, 'NGONTINH', next)
      saveSeenChapters(next)
    }
  }, [])

  useEffect(() => {
    void check()
    const onChange = () => void check()
    window.addEventListener(FOLLOWS_UPDATED_EVENT, onChange)
    window.addEventListener('focus', onChange)
    return () => {
      window.removeEventListener(FOLLOWS_UPDATED_EVENT, onChange)
      window.removeEventListener('focus', onChange)
    }
  }, [check])

  /** Đánh dấu đã xem một truyện (khi bấm mở) và bỏ khỏi danh sách. */
  const dismiss = useCallback((update: MangaUpdate) => {
    saveSeenChapters({ ...getSeenChapters(), [update.key]: update.chapterCount })
    setUpdates((prev) => prev.filter((u) => u.key !== update.key))
  }, [])

  const dismissAll = useCallback(() => {
    setUpdates((prev) => {
      const next = { ...getSeenChapters() }
      for (const u of prev) next[u.key] = u.chapterCount
      saveSeenChapters(next)
      return []
    })
  }, [])

  return { updates, dismiss, dismissAll, reload: check }
}

/** Đường dẫn tới trang truyện tương ứng. */
export function mangaPath(update: MangaUpdate): string {
  return update.kind === 'BL' ? `/bl/${update.slug}` : `/ngontinh/${update.slug}`
}
