import React, { useMemo } from 'react'
import type { NgontinhManga } from '../../types/manga'
import {
  fetchNgontinhList, fetchNgontinhHotData,
  getNgontinhFavorites, toggleNgontinhFavorite,
  getNgontinhHistory,
} from './ngontinhService'
import { hydrateMangadexManga } from './mangadexService'
import { NgontinhReaderModal } from './NgontinhReaderModal'
import { MangaLibraryPage, type MangaLibraryConfig } from './MangaLibraryPage'
import './ngontinhManga.css'

/** Thể loại hay gặp nhất trong kho, kèm số bộ, để làm hàng chip lọc. */
export function topGenres(list: Array<{ genres?: string[] }>, limit = 30) {
  const count = new Map<string, number>()
  for (const manga of list) {
    for (const genre of manga.genres ?? []) {
      const name = String(genre).trim()
      if (name) count.set(name, (count.get(name) ?? 0) + 1)
    }
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, total]) => ({ value: name, label: `${name} (${total})` }))
}

/** Chỉ những chỗ Ngôn tình khác hai loại kia: lọc thể loại, nạp chương MangaDex khi đọc. */
export const NgontinhMangaPage: React.FC = () => {
  const config = useMemo<MangaLibraryConfig<NgontinhManga>>(
    () => ({
      cssPrefix: 'ngontinh',
      kindLabel: 'Ngôn Tình',
      routeBase: '/ngontinh',
      scrollKey: 'ngontinh-list',
      recentTitle: 'Truyện Ngôn Tình đã cào gần đây',
      accentColor: '#e11d48',

      loadList: fetchNgontinhList,
      loadHot: fetchNgontinhHotData,
      getFavorites: getNgontinhFavorites,
      toggleFavorite: toggleNgontinhFavorite,
      getHistory: getNgontinhHistory,
      reloadMs: 5000,

      hasRanking: true,
      hotFallbackGenre: 'Ngôn Tình',

      filterLabel: 'Thể loại',
      filterOptions: (list) => topGenres(list),
      matchFilter: (manga, value) => (manga.genres ?? []).includes(value),

      recentCrawled: (list) => list,

      onRead: async (manga, chapterNum, ctx) => {
        // Truyện MangaDex chưa có chương trong file dữ liệu, lấy khi bấm đọc.
        const ready = await hydrateMangadexManga(manga)
        const chapters = ready.chapters ?? []
        // MangaDex gỡ chương của truyện đã mua bản quyền — không còn gì đọc thì mở link nguồn.
        if (chapters.length === 0 && ready.url) {
          window.open(ready.url, '_blank', 'noreferrer')
          return
        }
        const target = chapters.some((c) => c.number === chapterNum) ? chapterNum : chapters[0]?.number ?? chapterNum
        ctx.openReaderModal({ manga: ready, chapterNum: target })
      },
      ReaderModal: NgontinhReaderModal,
    }),
    [],
  )

  return <MangaLibraryPage config={config} />
}
