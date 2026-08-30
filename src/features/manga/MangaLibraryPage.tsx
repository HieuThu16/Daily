import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Bookmark, Calendar, ChevronRight, Clock, ExternalLink, Flame, Heart,
  Layers, Loader2, Play, Search, Sparkles, Trophy, X, Zap,
} from 'lucide-react'
import type { HotMangaData } from '../../types/manga'
import { RecentCrawledModal } from './RecentCrawledModal'
import { CrawlChaptersModal } from './CrawlChaptersModal'
import { useScrollRestore } from '../shared'

/** Ba loại truyện (BL, Ngôn tình, Truyện H) dùng chung trang này. */
export type MangaLike = {
  slug: string
  title: string
  cover?: string | null
  author?: string | null
  genres?: string[]
  chapters?: Array<{ number?: number | null; images?: unknown[] | null }>
  totalChapters?: number | null
  url?: string | null
  isHot?: boolean | null
  hotRank?: number | null
  topDayRank?: number | null
  topWeekRank?: number | null
  topMonthRank?: number | null
  updatedAt?: string | null
  source?: string | null
  sourceName?: string | null
}

export type ReadingTarget<T extends MangaLike> = { manga: T; chapterNum: number }

/** Những gì chỗ gọi cần để tự xử phần riêng của mình. */
export type MangaLibraryCtx<T extends MangaLike> = {
  list: T[]
  history: Record<string, { chapterNumber: number; chapterName?: string; readAt?: string }>
  reload: () => void
  refreshHistory: () => void
  navigate: ReturnType<typeof useNavigate>
  openReaderModal: (target: ReadingTarget<T>) => void
}

export type MangaLibraryConfig<T extends MangaLike> = {
  /** 'bl' hay 'ngontinh' — quyết định bộ CSS đang có sẵn, không đụng tới style. */
  cssPrefix: 'bl' | 'ngontinh'
  /** Chữ trong ô tìm kiếm: "… bộ truyện BL". */
  kindLabel: string
  /** '/bl' | '/ngontinh' | '/truyenh' */
  routeBase: string
  scrollKey: string
  recentTitle: string
  accentColor: string

  loadList: () => Promise<T[]>
  loadHot?: () => Promise<HotMangaData | null>
  getFavorites: () => string[]
  toggleFavorite: (slug: string) => void
  getHistory: () => Record<string, any>

  /** Tự tải lại danh sách sau mỗi ngần này mili giây (BL đang cào thì cần). */
  reloadMs?: number
  /** Tên sự kiện window báo lịch sử đọc đổi (Truyện H bắn ra khi đọc xong). */
  historyEvent?: string

  /** Truyện chưa cào được chương thì không cho bấm "Đọc ngay". */
  hasData?: (manga: T) => boolean
  /** Ảnh bìa thay thế (Truyện H lấy trang đầu chương 1 khi bìa hỏng). */
  coverOf?: (manga: T) => string
  /** Huy hiệu riêng trên ảnh bìa: nguồn Sany Team, nhãn 18+… */
  cardBadge?: (manga: T) => React.ReactNode

  /** Hàng lọc phụ: nguồn (BL) hay thể loại (Ngôn tình). */
  filterLabel?: string
  filterOptions?: (list: T[]) => Array<{ value: string; label: string }>
  matchFilter?: (manga: T, value: string) => boolean

  /** Bảng xếp hạng + carousel thịnh hành chỉ có ở loại nào có dữ liệu hot. */
  hasRanking?: boolean
  hotFallbackGenre?: string

  /** Danh sách "vừa cào gần đây"; không truyền thì giấu nút. */
  recentCrawled?: (list: T[]) => T[]

  /** Phân loại truyện để hỗ trợ tính năng Cào thêm chapter ('h' | 'bl' | 'ngontinh') */
  mangaCategory?: 'h' | 'bl' | 'ngontinh'

  /** Bấm Đọc: BL/Ngôn tình mở modal, Truyện H chuyển trang. */
  onRead: (manga: T, chapterNum: number, ctx: MangaLibraryCtx<T>) => void | Promise<void>
  /** Trình đọc dạng modal, dùng khi onRead gọi ctx.openReaderModal. */
  ReaderModal?: React.ComponentType<any>
  /** Nút thêm trên thanh tab (đọc CBZ, cào truyện, kho ảnh chụp…). */
  navExtras?: (ctx: MangaLibraryCtx<T>) => React.ReactNode
  /** Modal / lớp phủ riêng của từng loại. */
  extras?: (ctx: MangaLibraryCtx<T>) => React.ReactNode
}

type MainTab = 'all' | 'ranking' | 'history' | 'favorites'
type RankingType = 'hot' | 'top_day' | 'top_week' | 'top_month'

const BATCH_SIZE = 36

const RANKING_TABS: Array<{ key: RankingType; label: string; icon: typeof Flame }> = [
  { key: 'hot', label: 'Hot Nhất', icon: Flame },
  { key: 'top_day', label: 'Top Hôm Nay', icon: Zap },
  { key: 'top_week', label: 'Top Tuần Này', icon: Calendar },
  { key: 'top_month', label: 'Top Tháng Này', icon: Trophy },
]

const RANK_FIELD: Record<RankingType, 'hotRank' | 'topDayRank' | 'topWeekRank' | 'topMonthRank'> = {
  hot: 'hotRank',
  top_day: 'topDayRank',
  top_week: 'topWeekRank',
  top_month: 'topMonthRank',
}

function rankBadgeText(rank: number): string {
  return rank === 1 ? '🥇 #1' : rank === 2 ? '🥈 #2' : rank === 3 ? '🥉 #3' : `#${rank}`
}

type CardProps<T extends MangaLike> = {
  manga: T
  rank?: number
  isFav: boolean
  userProgress?: { chapterNumber: number }
  cssPrefix: string
  coverSrc: string
  badge?: React.ReactNode
  hasData: boolean
  onToggleFav: (e: React.MouseEvent, slug: string) => void
  onRead: () => void
  onClick: () => void
}

/** Một thẻ truyện — giống hệt nhau ở cả ba loại, chỉ khác huy hiệu và ảnh bìa. */
function MangaCard<T extends MangaLike>({
  manga, rank, isFav, userProgress, cssPrefix, coverSrc, badge, hasData, onToggleFav, onRead, onClick,
}: CardProps<T>) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const p = cssPrefix

  return (
    <div
      className={`${p}-manga-card`}
      role="button"
      tabIndex={0}
      aria-label={manga.title || 'Mở truyện'}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className={`${p}-cover-wrap`}>
        {!imgLoaded && !imgError && <div className={`${p}-cover-skeleton`} />}

        {coverSrc && !imgError ? (
          <img
            src={coverSrc}
            alt={manga.title}
            className={`${p}-cover-img ${imgLoaded ? 'loaded' : 'loading'}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError(true)
              setImgLoaded(true)
            }}
          />
        ) : (
          <div className={`${p}-cover-placeholder`}>
            <BookOpen size={32} />
          </div>
        )}

        {rank != null && (
          <div className={`${p}-rank-badge rank-${rank <= 3 ? rank : 'other'}`}>{rankBadgeText(rank)}</div>
        )}
        {rank == null && manga.isHot && <div className={`${p}-hot-tag`}>🔥 HOT</div>}
        {badge}

        <button
          className={`${p}-card-fav-btn ${isFav ? 'favorited' : ''}`}
          onClick={(e) => onToggleFav(e, manga.slug)}
          title={isFav ? 'Bỏ yêu thích' : 'Yêu thích'}
        >
          <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
        </button>

        {hasData ? (
          <div className={`${p}-card-chapter-badge`}>{manga.totalChapters || manga.chapters?.length || 0} Ch</div>
        ) : (
          <div className={`${p}-card-nodata-badge`}>Chưa có dữ liệu</div>
        )}

        {userProgress && <div className={`${p}-reading-ribbon`}>Đang đọc #{userProgress.chapterNumber}</div>}
      </div>

      <div className={`${p}-card-details`}>
        <h3 className={`${p}-card-title`} title={manga.title || ''}>{manga.title}</h3>
        {manga.author && <div className={`${p}-card-author`} title={manga.author}>{manga.author}</div>}

        <div className={`${p}-card-actions`}>
          {hasData ? (
            <button
              className={`${p}-btn-read-primary`}
              onClick={(e) => {
                e.stopPropagation()
                onRead()
              }}
            >
              <Play size={13} fill="currentColor" />
              {userProgress ? `Đọc tiếp #${userProgress.chapterNumber}` : 'Đọc ngay'}
            </button>
          ) : manga.url ? (
            <a
              className={`${p}-nodata-label ${p}-btn-external`}
              href={manga.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={13} /> Đọc ở nguồn gốc
            </a>
          ) : (
            <span className={`${p}-nodata-label`}>Chưa có dữ liệu</span>
          )}
        </div>
      </div>
    </div>
  )
}

const MemoCard = React.memo(MangaCard) as typeof MangaCard

/**
 * Trang kho truyện dùng chung cho BL / Ngôn tình / Truyện H.
 * Mọi thứ giống nhau nằm ở đây; khác nhau thì truyền qua `config`.
 */
export function MangaLibraryPage<T extends MangaLike>({ config }: { config: MangaLibraryConfig<T> }) {
  const navigate = useNavigate()
  const p = config.cssPrefix

  const [mangaList, setMangaList] = useState<T[]>([])
  const [hotData, setHotData] = useState<HotMangaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<MainTab>('all')
  const [rankingType, setRankingType] = useState<RankingType>('hot')
  const [extraFilter, setExtraFilter] = useState('')
  const [favorites, setFavorites] = useState<string[]>([])
  const [history, setHistory] = useState<Record<string, any>>({})
  const [readingState, setReadingState] = useState<ReadingTarget<T> | null>(null)
  const [showRecentModal, setShowRecentModal] = useState(false)
  const [showCrawlChaptersModal, setShowCrawlChaptersModal] = useState(false)

  // Số thẻ đã mở giữ theo phiên: quay lại từ trang chi tiết không phải cuộn lại từ đầu.
  const countKey = `daily_count_${config.scrollKey}`
  const [visibleCount, setVisibleCount] = useState<number>(
    () => Number(sessionStorage.getItem(countKey) ?? BATCH_SIZE) || BATCH_SIZE,
  )
  useEffect(() => {
    sessionStorage.setItem(countKey, String(visibleCount))
  }, [countKey, visibleCount])

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const refreshHistory = () => setHistory(config.getHistory())

  const loadData = async () => {
    try {
      const [list, hot] = await Promise.all([config.loadList(), config.loadHot?.() ?? Promise.resolve(null)])
      if (list && list.length > 0) setMangaList(list)
      if (hot) setHotData(hot)
      setFavorites(config.getFavorites())
      refreshHistory()
    } catch (err) {
      console.error(`Không tải được danh sách truyện ${config.kindLabel}`, err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()

    const timer = config.reloadMs ? setInterval(() => void loadData(), config.reloadMs) : null
    const onHistoryUpdate = (e: any) => setHistory(e?.detail || config.getHistory())
    if (config.historyEvent) window.addEventListener(config.historyEvent, onHistoryUpdate)

    return () => {
      if (timer) clearInterval(timer)
      if (config.historyEvent) window.removeEventListener(config.historyEvent, onHistoryUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useScrollRestore(config.scrollKey, mangaList.length > 0)

  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [activeTab, rankingType, searchQuery, extraFilter])

  const mangaMap = useMemo(() => new Map(mangaList.map((m) => [m.slug, m])), [mangaList])

  const ctx: MangaLibraryCtx<T> = {
    list: mangaList,
    history,
    reload: () => void loadData(),
    refreshHistory,
    navigate,
    openReaderModal: (target) => {
      setReadingState(target)
      refreshHistory()
    },
  }

  const filterOptions = useMemo(
    () => (config.filterOptions ? config.filterOptions(mangaList) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mangaList],
  )

  const recentCrawledStories = useMemo(
    () => (config.recentCrawled ? config.recentCrawled(mangaList) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mangaList],
  )

  /** Thẻ hạng lấy từ file hot, thiếu thì suy ra từ chính danh sách. */
  const rankedItems = (type: RankingType): Array<{ manga: T; rank?: number }> => {
    const field = RANK_FIELD[type]
    const fromHot = hotData?.[type as keyof HotMangaData] as
      | Array<{ slug: string; title: string; cover?: string; url?: string; rank: number }>
      | undefined

    if (fromHot && fromHot.length > 0) {
      return fromHot.map((h) => ({
        manga:
          mangaMap.get(h.slug) ??
          ({
            slug: h.slug,
            title: h.title,
            cover: h.cover,
            description: '',
            genres: config.hotFallbackGenre ? [config.hotFallbackGenre] : [],
            url: h.url,
            chapters: [],
            totalChapters: 0,
            [field]: h.rank,
            ...(type === 'hot' ? { isHot: true } : {}),
          } as unknown as T),
        rank: h.rank,
      }))
    }

    return mangaList
      .filter((m) => m[field] != null || (type === 'hot' && m.isHot))
      .sort((a, b) => ((a[field] as number) ?? 999) - ((b[field] as number) ?? 999))
      .map((m) => ({ manga: m, rank: (m[field] as number) ?? undefined }))
  }

  const filteredList = useMemo(() => {
    let result: Array<{ manga: T; rank?: number }>

    if (activeTab === 'ranking') {
      result = rankedItems(rankingType)
    } else if (activeTab === 'favorites') {
      result = mangaList.filter((m) => favorites.includes(m.slug)).map((m) => ({ manga: m }))
    } else if (activeTab === 'history') {
      result = mangaList
        .filter((m) => history[m.slug])
        .sort((a, b) => (history[b.slug]?.readAt ?? '').localeCompare(history[a.slug]?.readAt ?? ''))
        .map((m) => ({ manga: m }))
    } else {
      result = mangaList.map((m) => ({ manga: m }))
    }

    if (extraFilter && config.matchFilter) {
      result = result.filter((item) => config.matchFilter!(item.manga, extraFilter))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(({ manga }) =>
        (manga.title ?? '').toLowerCase().includes(q) ||
        (manga.author ?? '').toLowerCase().includes(q) ||
        (manga.genres ?? []).some((g) => (g ?? '').toLowerCase().includes(q)),
      )
    }

    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mangaList, mangaMap, hotData, activeTab, rankingType, favorites, history, searchQuery, extraFilter])

  const visibleItems = useMemo(() => filteredList.slice(0, visibleCount), [filteredList, visibleCount])

  useEffect(() => {
    if (!sentinelRef.current || visibleCount >= filteredList.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredList.length))
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [visibleCount, filteredList.length])

  const handleToggleFav = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation()
    config.toggleFavorite(slug)
    setFavorites(config.getFavorites())
  }

  const read = (manga: T, chapterNum: number) => void config.onRead(manga, chapterNum, ctx)

  /** Truyện đang đọc dở gần nhất — thẻ "Đọc tiếp" ở đầu trang. */
  const continueReading = useMemo(() => {
    const entries = Object.values(history) as Array<{ slug: string; chapterNumber: number; chapterName?: string; readAt?: string }>
    const latest = entries
      .filter((h) => h?.slug && mangaMap.has(h.slug))
      .sort((a, b) => (b.readAt ?? '').localeCompare(a.readAt ?? ''))[0]
    return latest ? { progress: latest, manga: mangaMap.get(latest.slug)! } : null
  }, [history, mangaMap])

  const spotlightItems = useMemo(
    () => (config.hasRanking ? rankedItems('hot').slice(0, 6).map((i) => i.manga) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hotData, mangaMap, mangaList],
  )

  const coverOf = (manga: T) => config.coverOf?.(manga) ?? manga.cover ?? ''
  const hasData = (manga: T) => (config.hasData ? config.hasData(manga) : true)
  const ReaderModal = config.ReaderModal

  return (
    <div className={`${p}-page-container`}>
      {config.recentCrawled && (
        <RecentCrawledModal
          isOpen={showRecentModal}
          onClose={() => setShowRecentModal(false)}
          title={config.recentTitle}
          items={recentCrawledStories as any}
          onSelectStory={(story: { slug: string }) => navigate(`${config.routeBase}/${story.slug}`)}
          accentColor={config.accentColor}
        />
      )}

      {config.mangaCategory && (
        <CrawlChaptersModal
          isOpen={showCrawlChaptersModal}
          onClose={() => setShowCrawlChaptersModal(false)}
          category={config.mangaCategory}
          totalItemsCount={mangaList.length}
        />
      )}

      {config.extras?.(ctx)}

      {continueReading && (
        <button
          type="button"
          className="continue-reading"
          onClick={() => read(continueReading.manga, continueReading.progress.chapterNumber)}
        >
          {coverOf(continueReading.manga) && (
            <img
              className="continue-reading-cover"
              src={coverOf(continueReading.manga)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="continue-reading-body">
            <span className="continue-reading-label">▶ Đọc tiếp</span>
            <span className="continue-reading-title">{continueReading.manga.title}</span>
            <span className="continue-reading-sub">
              {continueReading.progress.chapterName || `Chương ${continueReading.progress.chapterNumber}`}
            </span>
          </span>
        </button>
      )}

      <div className={`${p}-top-nav-bar`}>
        <div className={`${p}-nav-tabs`}>
          <button
            className={`${p}-nav-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <BookOpen size={16} /> Tất cả <span className={`${p}-count-pill`}>{mangaList.length}</span>
          </button>

          {config.hasRanking && (
            <button
              className={`${p}-nav-tab-btn ${activeTab === 'ranking' ? 'active' : ''}`}
              onClick={() => setActiveTab('ranking')}
              style={activeTab === 'ranking' ? { color: '#ef4444' } : {}}
            >
              <Flame size={16} color={activeTab === 'ranking' ? '#ef4444' : 'currentColor'} /> Bảng Xếp Hạng
            </button>
          )}

          <button
            className={`${p}-nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={16} /> Đang đọc <span className={`${p}-count-pill`}>{Object.keys(history).length}</span>
          </button>

          <button
            className={`${p}-nav-tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >
            <Heart size={16} /> Yêu thích <span className={`${p}-count-pill`}>{favorites.length}</span>
          </button>

          {config.recentCrawled && (
            <button
              type="button"
              className={`${p}-nav-tab-btn`}
              onClick={() => setShowRecentModal(true)}
              style={{
                background: `${config.accentColor}26`,
                color: config.accentColor,
                border: `1px solid ${config.accentColor}4d`,
                fontWeight: 600,
              }}
              title="Xem danh sách truyện đã cào gần đây"
            >
              <Zap size={15} /> Vừa cào gần đây
              {recentCrawledStories.length > 0 && (
                <span className={`${p}-count-pill`}>{recentCrawledStories.length}</span>
              )}
            </button>
          )}

          {config.mangaCategory && (
            <button
              type="button"
              className={`${p}-nav-tab-btn`}
              onClick={() => setShowCrawlChaptersModal(true)}
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Cào thêm chapter cho các bộ truyện đã có"
            >
              <Sparkles size={15} /> Cào thêm chapter
            </button>
          )}

          {config.navExtras?.(ctx)}
        </div>

        <div className={`${p}-search-wrapper`}>
          <Search size={16} className={`${p}-search-icon`} />
          <input
            type="text"
            placeholder={`Tìm kiếm trong ${mangaList.length || 'kho'} bộ truyện ${config.kindLabel}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${p}-search-input`}
          />
          {searchQuery && (
            <button className={`${p}-search-clear`} onClick={() => setSearchQuery('')}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {filterOptions.length > 0 && (
        <div className={`${p}-source-filter-bar`} role="group" aria-label={config.filterLabel ?? 'Lọc'}>
          {config.filterLabel && (
            <span className={`${p}-source-filter-label`}>
              <Layers size={14} /> {config.filterLabel}:
            </span>
          )}
          <button
            className={`${p}-source-pill ${extraFilter === '' ? 'active' : ''}`}
            onClick={() => setExtraFilter('')}
          >
            Tất cả ({mangaList.length})
          </button>
          {filterOptions.map((option) => (
            <button
              key={option.value}
              className={`${p}-source-pill ${extraFilter === option.value ? 'active' : ''}`}
              onClick={() => setExtraFilter(extraFilter === option.value ? '' : option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {config.hasRanking && activeTab === 'ranking' && (
        <div className={`${p}-ranking-subtabs`}>
          {RANKING_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`${p}-ranking-chip ${rankingType === key ? 'active' : ''}`}
              onClick={() => setRankingType(key)}
            >
              <Icon size={14} /> {label} ({(hotData?.[key as keyof HotMangaData] as unknown[] | undefined)?.length ?? 0})
            </button>
          ))}
        </div>
      )}

      {config.hasRanking && activeTab === 'all' && !searchQuery && !extraFilter && spotlightItems.length > 0 && (
        <div className={`${p}-spotlight-section`}>
          <div className={`${p}-spotlight-head`}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} color="#f59e0b" /> Thịnh hành nhất tuần qua
            </span>
            <button
              className={`${p}-spotlight-more`}
              onClick={() => {
                setActiveTab('ranking')
                setRankingType('hot')
              }}
            >
              Xem bảng xếp hạng <ChevronRight size={14} />
            </button>
          </div>
          <div className={`${p}-spotlight-list`}>
            {spotlightItems.map((manga, idx) => (
              <div
                key={`spotlight-${manga.slug}`}
                className={`${p}-spotlight-card`}
                onClick={() => navigate(`${config.routeBase}/${manga.slug}`)}
              >
                <div className={`${p}-rank-badge rank-${idx + 1 <= 3 ? idx + 1 : 'other'}`}>{rankBadgeText(idx + 1)}</div>
                {coverOf(manga) ? (
                  <img src={coverOf(manga)} alt={manga.title} className={`${p}-spotlight-cover`} loading="lazy" decoding="async" />
                ) : (
                  <div className={`${p}-cover-placeholder`} style={{ height: 200 }}>
                    <BookOpen size={24} />
                  </div>
                )}
                <div className={`${p}-spotlight-info`}>
                  <span className={`${p}-spotlight-title`}>{manga.title}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {manga.totalChapters || manga.chapters?.length || 0} chapters
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && mangaList.length === 0 ? (
        <div className={`${p}-loading-box`}>
          <div className={`${p}-spinner`} />
          <p>Đang tải danh sách truyện {config.kindLabel}...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className={`${p}-empty-state`}>
          <Bookmark size={40} className={`${p}-empty-icon`} />
          <h3>Không tìm thấy truyện phù hợp</h3>
          <p>Thử tìm kiếm với từ khóa khác hoặc đổi bộ lọc.</p>
        </div>
      ) : (
        <>
          <div className={`${p}-manga-grid`}>
            {visibleItems.map(({ manga, rank }) => {
              const userProgress = history[manga.slug]
              const firstCh = [...(manga.chapters ?? [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))[0]?.number ?? 1
              return (
                <MemoCard
                  key={manga.slug}
                  manga={manga}
                  rank={rank}
                  isFav={favorites.includes(manga.slug)}
                  userProgress={userProgress}
                  cssPrefix={p}
                  coverSrc={coverOf(manga)}
                  badge={config.cardBadge?.(manga)}
                  hasData={hasData(manga)}
                  onToggleFav={handleToggleFav}
                  onRead={() => read(manga, userProgress?.chapterNumber ?? firstCh)}
                  onClick={() => navigate(`${config.routeBase}/${manga.slug}`)}
                />
              )
            })}
          </div>

          {visibleCount < filteredList.length && (
            <div className={`${p}-pagination-footer`}>
              <div ref={sentinelRef} style={{ height: 10 }} />
              <button
                className={`${p}-btn-load-more`}
                onClick={() => setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredList.length))}
              >
                <Loader2 size={16} className={`${p}-spin-icon`} />
                <span>
                  Hiển thị thêm (+{Math.min(BATCH_SIZE, filteredList.length - visibleCount)}) · Còn lại{' '}
                  {filteredList.length - visibleCount} truyện
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {readingState && ReaderModal && (
        <ReaderModal
          manga={readingState.manga}
          initialChapterNum={readingState.chapterNum}
          onClose={() => {
            setReadingState(null)
            refreshHistory()
          }}
        />
      )}
    </div>
  )
}
