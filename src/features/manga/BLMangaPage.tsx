import React, { useMemo, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import type { BLManga } from '../../types/manga'
import {
  fetchBLMangaList, fetchHotMangaData,
  getFavorites, toggleFavorite,
  getReadingHistory, hasMangaData,
  getCustomBLMangaList,
} from './mangaService'
import { BLReaderModal } from './BLReaderModal'
import { LocalCbzReader } from './LocalCbzReader'
import { MangaLibraryPage, type MangaLibraryConfig } from './MangaLibraryPage'
import './blManga.css'

const isSany = (manga: BLManga) => manga.source === 'teamsany' || manga.sourceName === 'Sany Team'

/** Chỉ những chỗ BL khác hai loại kia: nguồn Sany/Dưa Leo, nút đọc CBZ, huy hiệu nguồn. */
export const BLMangaPage: React.FC = () => {
  const [localReaderOpen, setLocalReaderOpen] = useState(false)

  const config = useMemo<MangaLibraryConfig<BLManga>>(
    () => ({
      cssPrefix: 'bl',
      kindLabel: 'BL',
      routeBase: '/bl',
      scrollKey: 'bl-list',
      recentTitle: 'Truyện Boylove đã cào gần đây',
      accentColor: '#3b82f6',

      loadList: fetchBLMangaList,
      loadHot: fetchHotMangaData,
      getFavorites,
      toggleFavorite,
      getHistory: getReadingHistory,
      reloadMs: 5000,

      hasRanking: true,
      hotFallbackGenre: 'BoyLove',
      hasData: hasMangaData,

      cardBadge: (manga) =>
        isSany(manga) ? (
          <div className="bl-sany-source-tag" title="Truyện từ nhóm Sany Team">✨ Sany Team</div>
        ) : null,

      filterLabel: 'Nguồn',
      filterOptions: (list) => [
        { value: 'teamsany', label: `✨ Sany Team (${list.filter(isSany).length})` },
        { value: 'dualeo', label: `Dưa Leo (${list.filter((m) => !isSany(m)).length})` },
      ],
      matchFilter: (manga, value) => (value === 'teamsany' ? isSany(manga) : !isSany(manga)),

      recentCrawled: (list) => {
        const map = new Map<string, BLManga>()
        for (const m of getCustomBLMangaList()) map.set(m.slug, m)
        for (const m of list) if (m.updatedAt && !map.has(m.slug)) map.set(m.slug, m)
        return [...map.values()]
      },

      onRead: (manga, chapterNum, ctx) => ctx.openReaderModal({ manga, chapterNum }),
      ReaderModal: BLReaderModal,

      navExtras: () => (
        <button
          type="button"
          className="bl-nav-tab-btn"
          onClick={() => setLocalReaderOpen(true)}
          title="Mở file .cbz trên máy"
        >
          <FolderOpen size={16} /> Đọc file CBZ
        </button>
      ),
    }),
    [],
  )

  if (localReaderOpen) return <LocalCbzReader onClose={() => setLocalReaderOpen(false)} />

  return <MangaLibraryPage config={config} />
}
