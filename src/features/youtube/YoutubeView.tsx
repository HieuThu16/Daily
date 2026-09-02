import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, CheckCircle2, Circle, 
  ExternalLink, Play, Search, Video, 
  Youtube, 
  Check, 
  Loader2, LayoutGrid, 
  Edit3, Globe, BookmarkPlus, PictureInPicture2,
  Plus, Trash2, ChevronLeft, ChevronRight, ChevronDown, Clock, Tag,
  Flame, ArrowUpDown, Zap, Headphones, Volume2, Sparkles, Calendar, History
} from 'lucide-react'
import { useOptionalAudioPlayer } from '../library/AudioPlayerContext'
import {
  useOfflineAudioState,
  playYoutubeAsAudio,
} from '../../lib/youtubeAudioCache'
import { supabase } from '../../lib/supabase'
import { youtubeVideoId } from '../../lib/youtubeMeta'
import { publishedLabel } from './YoutubeWatchPage'
import { formatViews, mergeSearchPages, searchYouTubePage, type SearchOrder, type YouTubeSearchResult } from '../../lib/youtubeSearch'
import { Modal, useIncrementalList } from '../shared'
import { DualSubtitles } from './DualSubtitles'
import { useHeaderActions, useHideHeader } from '../HeaderAction'
import { useToast } from '../ToastContext'
import { getRemoteAppSetting, saveAppSetting } from '../../lib/userAppSettings'
import {
  getVideoStatusSets,
  setVideoStatus as updateVideoStatusRecord,
  useVideoStatusListener,
  type VideoStatus
} from '../../lib/videoStatus'
import {
  percentOf,
  progressLabel,
  useVideoProgressMap,
  useYouTubeProgress,
  removeVideoProgress,
  syncVideoProgressFromSupabase,
} from '../../lib/videoProgress'
import { WatchTogetherButton } from '../watch/WatchTogetherButton'
import { AddYoutubeModal } from './AddYoutubeModal'
import { YoutubeCrawlModal, GlobalYoutubeCrawlerWatcher } from './YoutubeCrawlModal'
import { useVideoMiniPlayer } from './VideoMiniPlayer'
import '../tvshow/tvShow.css'


// Danh sách các hạng mục kênh mặc định ban đầu
export const INITIAL_YOUTUBE_CATEGORIES: CustomCategoryItem[] = [
  { id: 'cat_review', label: 'Review phim', icon: '🍿' },
  { id: 'cat_tvshow', label: 'TV Shows', icon: '📺' },
  { id: 'cat_study', label: 'Học tập & Tri thức', icon: '📚' },
  { id: 'cat_tech', label: 'Công nghệ & Khoa học', icon: '💡' },
  { id: 'cat_entertainment', label: 'Giải trí & Vlogs', icon: '🎭' },
  { id: 'cat_other', label: 'Khác', icon: '📦' },
]
export const DEFAULT_YOUTUBE_CATEGORIES = INITIAL_YOUTUBE_CATEGORIES

export type CustomCategoryItem = { id: string; label: string; icon: string; tags?: string[] }
export type ChannelCategoryMap = Record<string, string>
export type CategoryTagMap = Record<string, string[]>
export type ChannelTagMap = Record<string, string>
export type YoutubeSortMode = 'random' | 'date' | 'viewCount' | 'oldest'

export type ChannelItem = {
  id: string
  platform: string
  creator_url: string
  creator_name: string
  creator_id: string | null
  videoCount: number
  inProgressCount: number
  watchedCount: number
  cover: string | null
  lastSyncedAt: string | null
  category: string
  tag?: string
  sourceTable?: 'tvshow' | 'review'
}

export type VideoRow = {
  id: string
  video_id: string
  series_key: string | null
  creator_id: string | null
  creator_name: string | null
  title: string
  canonical_url: string
  embed_url: string
  thumbnail: string | null
  part_number: number | null
  published_at: string | null
  unavailable_at: string | null
  duration?: number | null
  channel_category?: string
  channel_tag?: string
  sourceType?: 'tvshow' | 'review'
}

export type ParsedVideo = { videoId: string; url: string }

export function parseVideoLinks(text: string) {
  const seen = new Set<string>()
  const valid: ParsedVideo[] = []
  const invalid: string[] = []

  for (const raw of text.split(/[\n,\s]+/)) {
    const line = raw.trim()
    if (!line) continue
    const videoId = youtubeVideoId(line)
    if (!videoId) {
      invalid.push(line)
      continue
    }
    if (seen.has(videoId)) continue
    seen.add(videoId)
    valid.push({ videoId, url: line })
  }
  return { valid, invalid }
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return arr
  const copy = [...arr]
  const [removed] = copy.splice(from, 1)
  copy.splice(to, 0, removed)
  return copy
}

/** Xáo trộn ngẫu nhiên danh sách dựa trên seed ngẫu nhiên */
export function shuffleArray<T>(arr: T[], seed: number): T[] {
  const copy = [...arr]
  let m = copy.length
  let t: T
  let i: number
  let s = Math.abs(Math.sin(seed) * 10000)
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  while (m) {
    i = Math.floor(rand() * m--)
    t = copy[m]
    copy[m] = copy[i]
    copy[i] = t
  }
  return copy
}

/** Chuẩn hóa tên kênh hoặc khóa tìm kiếm */
export function normalizeChannelKey(str?: string | null): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Tìm kênh phù hợp nhất cho video */
export function findMatchingChannel(
  v: { creator_id?: string | null; creator_name?: string | null; series_key?: string | null },
  channels: ChannelItem[]
): ChannelItem | undefined {
  if (!channels || channels.length === 0) return undefined

  // 1. Khớp theo creator_id trực tiếp
  if (v.creator_id) {
    const direct = channels.find((c) => (c.creator_id && c.creator_id === v.creator_id) || c.id === v.creator_id)
    if (direct) return direct
  }

  const vNameNorm = normalizeChannelKey(v.creator_name)
  const vKeyNorm = normalizeChannelKey(v.series_key)
  const vIdNorm = normalizeChannelKey(v.creator_id)

  // 2. Khớp theo tên kênh đã chuẩn hóa
  if (vNameNorm) {
    const byName = channels.find((c) => {
      const cNameNorm = normalizeChannelKey(c.creator_name)
      return cNameNorm && (cNameNorm === vNameNorm || cNameNorm.includes(vNameNorm) || vNameNorm.includes(cNameNorm))
    })
    if (byName) return byName
  }

  // 3. Khớp theo series_key hoặc ID kênh
  if (vKeyNorm || vIdNorm) {
    const byKey = channels.find((c) => {
      const cNameNorm = normalizeChannelKey(c.creator_name)
      const cIdNorm = normalizeChannelKey(c.creator_id)
      return (
        (vKeyNorm && cNameNorm && (cNameNorm === vKeyNorm || cNameNorm.includes(vKeyNorm) || vKeyNorm.includes(cNameNorm))) ||
        (vIdNorm && cIdNorm && cIdNorm === vIdNorm) ||
        (vIdNorm && cNameNorm && cNameNorm === vIdNorm)
      )
    })
    if (byKey) return byKey
  }

  return undefined
}

/** Tự động đoán thể loại ban đầu của kênh dựa vào tên kênh hoặc nguồn gốc */
export function guessChannelCategory(name: string, sourceTable?: 'tvshow' | 'review'): string {
  const lower = (name || '').toLowerCase()
  if (sourceTable === 'review' || lower.includes('review') || lower.includes('phim') || lower.includes('movie') || lower.includes('cinema')) {
    return 'Review phim'
  }
  if (lower.includes('học') || lower.includes('web5ngay') || lower.includes('kiến thức') || lower.includes('sách') || lower.includes('tri thức') || lower.includes('ted') || lower.includes('tư duy') || lower.includes('tiếng anh') || lower.includes('english')) {
    return 'Học tập & Tri thức'
  }
  if (lower.includes('công nghệ') || lower.includes('tech') || lower.includes('khoa học') || lower.includes('vật lý') || lower.includes('ai') || lower.includes('lập trình') || lower.includes('code')) {
    return 'Công nghệ & Khoa học'
  }
  if (lower.includes('show') || lower.includes('shark tank') || lower.includes('rap việt') || lower.includes('running man') || lower.includes('2 ngày 1 đêm') || lower.includes('truyền hình')) {
    return 'TV Shows'
  }
  if (lower.includes('hài') || lower.includes('vlog') || lower.includes('giải trí') || lower.includes('game') || lower.includes('nhạc') || lower.includes('music')) {
    return 'Giải trí & Vlogs'
  }
  return sourceTable === 'tvshow' ? 'TV Shows' : 'Review phim'
}

/** Kiểm tra video ngắn (< 5 phút = 300 giây) */
export const isShortVideo = (
  v: { duration?: number | null; title?: string | null; canonical_url?: string | null; video_id?: string | null },
  progressMap?: Record<string, { durationSeconds?: number | null }>
): boolean => {
  const url = (v.canonical_url || '').toLowerCase()
  const title = (v.title || '').toLowerCase()

  // 1. Nhận diện trực tiếp theo URL hoặc hashtag chính thức của Shorts
  if (
    url.includes('/shorts/') ||
    title.includes('#shorts') ||
    title.includes('#short') ||
    title.includes('[short') ||
    title.includes('(short') ||
    title.includes('#reels') ||
    title.includes('#tiktok')
  ) {
    return true
  }

  // 2. Video ngắn chuẩn YouTube Shorts (thời lượng <= 90s)
  const dur = typeof v.duration === 'number' && v.duration > 0
    ? v.duration
    : (v.video_id && progressMap?.[v.video_id]?.durationSeconds ? progressMap[v.video_id]?.durationSeconds : undefined)

  if (typeof dur === 'number' && dur > 0 && dur <= 90) {
    return true
  }

  return false
}

export function YoutubeView({ isShorts = false }: { isShorts?: boolean } = {}) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const watchBasePath = isShorts ? '/youtubeshorts' : '/youtube'
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [allVideos, setAllVideos] = useState<VideoRow[]>([])
  const [watchedSet, setWatchedSet] = useState<Set<string>>(new Set())
  const [inProgressSet, setInProgressSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'channel' | 'video' | 'history'>('video')
  const [historyPeriod, setHistoryPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [watchFilter, setWatchFilter] = useState<'all' | 'unwatched' | 'in_progress' | 'watched'>('all')
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random())

  // Lắng nghe sự kiện đổi trạng thái xem video toàn app
  useVideoStatusListener(() => {
    const statusSets = getVideoStatusSets('tvshow')
    const revSets = getVideoStatusSets('review')
    setWatchedSet(new Set([...statusSets.watchedSet, ...revSets.watchedSet]))
    setInProgressSet(new Set([...statusSets.inProgressSet, ...revSets.inProgressSet]))
  })
  
  // Hạng mục đang chọn trên thanh tab trượt ngang (mặc định 'ALL')
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('ALL')
  // Tag đang chọn thuộc thể loại hiện tại (mặc định 'ALL')
  const [activeTagTab, setActiveTagTab] = useState<string>('ALL')
  // Bản đồ lưu Thể loại của từng Kênh (Lưu trên Supabase qua user_app_settings)
  const [channelCategoryMap, setChannelCategoryMap] = useState<ChannelCategoryMap>({})
  // Bản đồ lưu các Tag theo từng Thể loại (Lưu trên Supabase qua user_app_settings)
  const [categoryTagMap, setCategoryTagMap] = useState<CategoryTagMap>({})
  // Bản đồ lưu Tag gán cho từng Kênh (Lưu trên Supabase qua user_app_settings)
  const [channelTagMap, setChannelTagMap] = useState<ChannelTagMap>({})
  // Thể loại tùy chỉnh do người dùng thêm mới (Lưu trên Supabase qua user_app_settings)
  const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>([])
  // Modal thêm nhanh Tag cho thể loại đang chọn
  const [quickAddTagCategory, setQuickAddTagCategory] = useState<string | null>(null)
  // Modal cào video mới theo kênh và số phút
  const [crawlChannelsModalOpen, setCrawlChannelsModalOpen] = useState(false)

  // TÌM KIẾM YOUTUBE API (Tìm video đã có VÀ chưa có trong app)
  const [searchScope, setSearchScope] = useState<'all' | 'saved' | 'youtube'>('all')
  const [ytSearchResults, setYtSearchResults] = useState<YouTubeSearchResult[]>([])
  const [isSearchingYouTube, setIsSearchingYouTube] = useState(false)
  /** Token trang kế; null nghĩa là đã hết kết quả. */
  const [ytNextPage, setYtNextPage] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  /** Thứ tự kết quả; đổi là tìm lại vì YouTube xếp ở phía nó, không xếp tại chỗ. */
  const [ytOrder, setYtOrder] = useState<SearchOrder>('date')
  const [sortMode, setSortMode] = useState<YoutubeSortMode>('random')
  const [savingVideoId, setSavingVideoId] = useState<string | null>(null)

  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null)
  const [sharedUrl] = useState(() => new URLSearchParams(window.location.search).get('youtube') ?? '')
  const [addOpen, setAddOpen] = useState(Boolean(sharedUrl))
  const [editingChannelCategory, setEditingChannelCategory] = useState<ChannelItem | null>(null)
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  
  const progressMap = useVideoProgressMap()
  const { playInMini } = useVideoMiniPlayer()
  const audioPlayer = useOptionalAudioPlayer()
  const [, setStatusMap] = useState<Map<string, VideoStatus>>(new Map())

  /**
   * Bấm một kết quả tìm kiếm là vào thẳng trang xem, không chỉ thu nhỏ.
   * Gửi kèm tiêu đề/kênh/ảnh để trang bên kia hiện ngay, khỏi chờ gọi oEmbed —
   * video này thường chưa có trong kho nên không tra được từ database.
   */
  const openSearchResult = (item: YouTubeSearchResult) => {
    navigate(`${watchBasePath}/watch/${item.videoId}`, {
      state: {
        title: item.title,
        channelName: item.channelTitle,
        thumbnail: item.thumbnail,
        from: watchBasePath,
        fromLabel: isShorts ? 'YouTube Shorts' : 'YouTube',
      },
    })
  }

  // Quản lý cuộn và vuốt kéo danh sách tab thể loại trên Desktop
  const tabsScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const hasMovedRef = useRef(false)

  const checkScroll = useCallback(() => {
    const el = tabsScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 6)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6)
  }, [])

  useEffect(() => {
    const el = tabsScrollRef.current
    if (!el) return
    checkScroll()

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault()
        el.scrollLeft += e.deltaY * 0.9
        checkScroll()
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  const scrollTabs = (offset: number) => {
    const el = tabsScrollRef.current
    if (!el) return
    el.scrollBy({ left: offset, behavior: 'smooth' })
    setTimeout(checkScroll, 250)
  }

  const handleTabsMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = tabsScrollRef.current
    if (!el) return
    isDraggingRef.current = true
    startXRef.current = e.pageX - el.offsetLeft
    scrollLeftRef.current = el.scrollLeft
    hasMovedRef.current = false
  }

  const handleTabsMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const el = tabsScrollRef.current
    if (!el) return
    e.preventDefault()
    const x = e.pageX - el.offsetLeft
    const walk = (x - startXRef.current) * 1.3
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true
    }
    el.scrollLeft = scrollLeftRef.current - walk
    checkScroll()
  }

  const handleTabsMouseUpOrLeave = () => {
    isDraggingRef.current = false
  }

  // 1 nút thêm (tự phân biệt kênh / video lẻ) + 1 nút cào kênh theo thời gian & chọn kênh
  useHeaderActions([
    { label: 'Thêm kênh / video', icon: 'plus', onClick: () => setAddOpen(true) },
    { label: 'Cào video mới các kênh', icon: 'radio', onClick: () => setCrawlChannelsModalOpen(true) },
  ])

  useVideoStatusListener(() => {
    const tvSets = getVideoStatusSets('tvshow')
    const reviewSets = getVideoStatusSets('review')
    setWatchedSet(new Set([...tvSets.watchedSet, ...reviewSets.watchedSet]))
    setInProgressSet(new Set([...tvSets.inProgressSet, ...reviewSets.inProgressSet]))
  })

  // Tải bản đồ Thể loại kênh, Thể loại tùy chỉnh & Tags từ Supabase
  useEffect(() => {
    let alive = true
    void Promise.all([
      getRemoteAppSetting<ChannelCategoryMap>('youtube_channel_categories', {}),
      getRemoteAppSetting<CustomCategoryItem[]>('youtube_custom_categories', INITIAL_YOUTUBE_CATEGORIES),
      getRemoteAppSetting<CategoryTagMap>('youtube_category_tags', {}),
      getRemoteAppSetting<ChannelTagMap>('youtube_channel_tags', {}),
    ]).then(([map, customList, catTags, chTags]) => {
      if (alive) {
        if (map) setChannelCategoryMap(map)
        if (Array.isArray(customList) && customList.length > 0) {
          setCustomCategories(customList)
        } else {
          setCustomCategories(INITIAL_YOUTUBE_CATEGORIES)
        }
        if (catTags) setCategoryTagMap(catTags)
        if (chTags) setChannelTagMap(chTags)
      }
    })
    return () => { alive = false }
  }, [])

  // Thêm thể loại mới (Lưu ngay vào State, LocalStorage và Supabase)
  const handleAddCustomCategory = async (label: string, icon = '🏷️'): Promise<string | undefined> => {
    const trimmed = label.trim()
    if (!trimmed) return undefined
    const exists = customCategories.some((c) => c.label.toLowerCase() === trimmed.toLowerCase())
    if (exists) {
      showToast(`Thể loại "${trimmed}" đã có sẵn`, 'info')
      return trimmed
    }
    const newCat: CustomCategoryItem = {
      id: `cat_${Date.now()}`,
      label: trimmed,
      icon: icon || '🏷️',
      tags: [],
    }
    const updated = [...customCategories, newCat]
    setCustomCategories(updated)
    await saveAppSetting('youtube_custom_categories', updated)
    showToast(`Đã lưu thể loại "${trimmed}" lên Supabase`, 'success')
    return trimmed
  }

  // Sửa thể loại tùy chỉnh (Tên, icon) và cập nhật luôn các kênh đang dùng thể loại cũ
  const handleUpdateCustomCategory = async (catId: string, newLabel: string, newIcon = '🏷️'): Promise<string | undefined> => {
    const trimmed = newLabel.trim()
    if (!trimmed) return undefined
    const target = customCategories.find((c) => c.id === catId)
    if (!target) return undefined

    const oldLabel = target.label
    const updatedCategories = customCategories.map((c) => (c.id === catId ? { ...c, label: trimmed, icon: newIcon || '🏷️' } : c))
    setCustomCategories(updatedCategories)
    await saveAppSetting('youtube_custom_categories', updatedCategories)

    // Nếu tên thay đổi, cập nhật luôn các kênh đang dùng thể loại cũ sang tên mới
    if (oldLabel !== trimmed) {
      const updatedMap: ChannelCategoryMap = {}
      let hasChange = false
      Object.entries(channelCategoryMap).forEach(([key, val]) => {
        if (val === oldLabel) {
          updatedMap[key] = trimmed
          hasChange = true
        } else {
          updatedMap[key] = val
        }
      })

      // Đổi key trong categoryTagMap
      if (categoryTagMap[oldLabel]) {
        const updatedCatTags = { ...categoryTagMap }
        updatedCatTags[trimmed] = updatedCatTags[oldLabel]
        delete updatedCatTags[oldLabel]
        setCategoryTagMap(updatedCatTags)
        void saveAppSetting('youtube_category_tags', updatedCatTags)
      }

      if (hasChange) {
        setChannelCategoryMap(updatedMap)
        setChannels((prev) =>
          prev.map((c) => (c.category === oldLabel ? { ...c, category: trimmed } : c))
        )
        if (selectedChannel && selectedChannel.category === oldLabel) {
          setSelectedChannel({ ...selectedChannel, category: trimmed })
        }
        await saveAppSetting('youtube_channel_categories', updatedMap)
      }

      // Cập nhật tab đang chọn nếu trùng tên cũ
      if (activeCategoryTab === oldLabel) {
        setActiveCategoryTab(trimmed)
      }
    }

    showToast(`Đã cập nhật thể loại "${trimmed}"`, 'success')
    return trimmed
  }

  // Xóa thể loại tùy chỉnh
  const handleDeleteCustomCategory = async (catId: string) => {
    const target = customCategories.find((c) => c.id === catId)
    if (!target) return
    const deletedLabel = target.label
    const updated = customCategories.filter((c) => c.id !== catId)
    setCustomCategories(updated)
    await saveAppSetting('youtube_custom_categories', updated)

    // Xóa tags của thể loại này
    if (categoryTagMap[deletedLabel]) {
      const updatedCatTags = { ...categoryTagMap }
      delete updatedCatTags[deletedLabel]
      setCategoryTagMap(updatedCatTags)
      void saveAppSetting('youtube_category_tags', updatedCatTags)
    }

    // Remap các kênh đang gán thể loại bị xóa sang 'Khác'
    const updatedMap: ChannelCategoryMap = { ...channelCategoryMap }
    let hasMapChange = false
    Object.entries(updatedMap).forEach(([k, v]) => {
      if (v === deletedLabel) {
        updatedMap[k] = 'Khác'
        hasMapChange = true
      }
    })
    if (hasMapChange) {
      setChannelCategoryMap(updatedMap)
      await saveAppSetting('youtube_channel_categories', updatedMap)
    }

    // Cập nhật state channels & allVideos ngay lập tức
    setChannels((prev) =>
      prev.map((c) => (c.category === deletedLabel ? { ...c, category: 'Khác', tag: undefined } : c))
    )
    setAllVideos((prev) =>
      prev.map((v) => (v.channel_category === deletedLabel ? { ...v, channel_category: 'Khác', channel_tag: undefined } : v))
    )

    if (selectedChannel && selectedChannel.category === deletedLabel) {
      setSelectedChannel({ ...selectedChannel, category: 'Khác', tag: undefined })
    }

    if (activeCategoryTab === deletedLabel) {
      setActiveCategoryTab('ALL')
      setActiveTagTab('ALL')
    }

    showToast(`Đã xoá thể loại "${deletedLabel}"`, 'info')
  }

  // Xóa kênh (soft-delete bằng deleted_at trong Supabase)
  const handleDeleteChannel = async (channel: ChannelItem) => {
    const confirmed = window.confirm(`Bạn có chắc muốn xóa kênh "${channel.creator_name}"?\nTất cả video của kênh sẽ không còn hiển thị nữa.`)
    if (!confirmed) return

    if (!supabase) {
      showToast('Lỗi: Không kết nối được Supabase', 'error')
      return
    }

    const now = new Date().toISOString()
    const table = channel.sourceTable === 'review' ? 'review_creators' : 'tvshow_creators'

    // Soft-delete: set deleted_at
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: now })
      .eq('id', channel.id)

    if (error) {
      showToast(`Xóa kênh thất bại: ${error.message}`, 'error')
      return
    }

    // Cập nhật state ngay lập tức
    setChannels((prev) => prev.filter((c) => c.id !== channel.id))
    setAllVideos((prev) => prev.filter((v) => {
      if (channel.creator_id) return v.creator_id !== channel.creator_id
      return v.creator_name !== channel.creator_name
    }))

    if (selectedChannel && selectedChannel.id === channel.id) {
      setSelectedChannel(null)
    }

    // Xóa khỏi channelCategoryMap
    const newCatMap = { ...channelCategoryMap }
    const keysToDelete = Object.keys(newCatMap).filter((k) => {
      const norm = normalizeChannelKey(k)
      return norm === normalizeChannelKey(channel.creator_name) || norm === normalizeChannelKey(channel.creator_id)
    })
    keysToDelete.forEach((k) => delete newCatMap[k])
    if (keysToDelete.length > 0) {
      setChannelCategoryMap(newCatMap)
      void saveAppSetting('youtube_channel_categories', newCatMap)
    }

    showToast(`Đã xóa kênh "${channel.creator_name}"`, 'success')
  }

  // 1. Thêm Tag vào một thể loại
  const handleAddTagToCategory = async (category: string, tag: string): Promise<string | undefined> => {
    const trimmedTag = tag.trim().replace(/^#+/, '')
    if (!trimmedTag || !category) return undefined
    const currentTags = categoryTagMap[category] || []
    if (currentTags.some((t) => t.toLowerCase() === trimmedTag.toLowerCase())) {
      showToast(`Tag #${trimmedTag} đã có trong mục "${category}"`, 'info')
      return trimmedTag
    }
    const updatedTags = [...currentTags, trimmedTag]
    const updatedMap = { ...categoryTagMap, [category]: updatedTags }
    setCategoryTagMap(updatedMap)
    await saveAppSetting('youtube_category_tags', updatedMap)
    showToast(`Đã thêm tag #${trimmedTag} vào "${category}"`, 'success')
    return trimmedTag
  }

  // 2. Sửa tên Tag trong một thể loại
  const handleUpdateTagInCategory = async (category: string, oldTag: string, newTag: string): Promise<string | undefined> => {
    const trimmedNew = newTag.trim().replace(/^#+/, '')
    if (!trimmedNew || !category || oldTag === trimmedNew) return undefined
    const currentTags = categoryTagMap[category] || []
    const updatedTags = currentTags.map((t) => (t === oldTag ? trimmedNew : t))
    const updatedCatTags = { ...categoryTagMap, [category]: updatedTags }
    setCategoryTagMap(updatedCatTags)
    await saveAppSetting('youtube_category_tags', updatedCatTags)

    // Cập nhật tag ở các kênh đang dùng oldTag
    const updatedChTags: ChannelTagMap = {}
    let chChanged = false
    Object.entries(channelTagMap).forEach(([k, v]) => {
      if (v === oldTag) {
        updatedChTags[k] = trimmedNew
        chChanged = true
      } else {
        updatedChTags[k] = v
      }
    })
    if (chChanged) {
      setChannelTagMap(updatedChTags)
      setChannels((prev) => prev.map((c) => (c.tag === oldTag ? { ...c, tag: trimmedNew } : c)))
      setAllVideos((prev) => prev.map((v) => (v.channel_tag === oldTag ? { ...v, channel_tag: trimmedNew } : v)))
      if (selectedChannel && selectedChannel.tag === oldTag) {
        setSelectedChannel({ ...selectedChannel, tag: trimmedNew })
      }
      await saveAppSetting('youtube_channel_tags', updatedChTags)
    }

    if (activeTagTab === oldTag) {
      setActiveTagTab(trimmedNew)
    }

    showToast(`Đã đổi tên tag #${oldTag} thành #${trimmedNew}`, 'success')
    return trimmedNew
  }

  // 3. Xóa Tag khỏi một thể loại
  const handleDeleteTagFromCategory = async (category: string, tagToDelete: string) => {
    if (!category || !tagToDelete) return
    const currentTags = categoryTagMap[category] || []
    const updatedTags = currentTags.filter((t) => t !== tagToDelete)
    const updatedCatTags = { ...categoryTagMap, [category]: updatedTags }
    setCategoryTagMap(updatedCatTags)
    await saveAppSetting('youtube_category_tags', updatedCatTags)

    // Gỡ tag ở các kênh
    const updatedChTags: ChannelTagMap = {}
    let chChanged = false
    Object.entries(channelTagMap).forEach(([k, v]) => {
      if (v === tagToDelete) {
        chChanged = true
      } else {
        updatedChTags[k] = v
      }
    })
    if (chChanged) {
      setChannelTagMap(updatedChTags)
      setChannels((prev) => prev.map((c) => (c.tag === tagToDelete ? { ...c, tag: undefined } : c)))
      setAllVideos((prev) => prev.map((v) => (v.channel_tag === tagToDelete ? { ...v, channel_tag: undefined } : v)))
      if (selectedChannel && selectedChannel.tag === tagToDelete) {
        setSelectedChannel({ ...selectedChannel, tag: undefined })
      }
      await saveAppSetting('youtube_channel_tags', updatedChTags)
    }

    if (activeTagTab === tagToDelete) {
      setActiveTagTab('ALL')
    }

    showToast(`Đã xoá tag #${tagToDelete}`, 'info')
  }

  // 4. Đổi Thể loại & Tag của 1 Kênh (Lưu ngay vào state, local và Supabase)
  const handleChangeChannelCategoryAndTag = async (channelKey: string, newCategory: string, newTag?: string | null) => {
    const targetNorm = normalizeChannelKey(channelKey)
    const updatedCatMap = { ...channelCategoryMap, [channelKey]: newCategory }
    if (targetNorm) updatedCatMap[targetNorm] = newCategory
    setChannelCategoryMap(updatedCatMap)

    const updatedTagMap = { ...channelTagMap }
    if (newTag) {
      updatedTagMap[channelKey] = newTag
      if (targetNorm) updatedTagMap[targetNorm] = newTag
    } else {
      delete updatedTagMap[channelKey]
      if (targetNorm) delete updatedTagMap[targetNorm]
    }
    setChannelTagMap(updatedTagMap)

    setChannels((prev) =>
      prev.map((c) => {
        const cNorm = normalizeChannelKey(c.creator_name || c.creator_id || c.id)
        if (
          c.id === channelKey ||
          c.creator_id === channelKey ||
          c.creator_name === channelKey ||
          (targetNorm && cNorm && (cNorm === targetNorm || cNorm.includes(targetNorm) || targetNorm.includes(cNorm)))
        ) {
          return { ...c, category: newCategory, tag: newTag || undefined }
        }
        return c
      })
    )

    setAllVideos((prev) =>
      prev.map((v) => {
        const vNorm = normalizeChannelKey(v.creator_name || v.creator_id || v.series_key)
        if (
          v.creator_id === channelKey ||
          v.creator_name === channelKey ||
          (targetNorm && vNorm && (vNorm === targetNorm || vNorm.includes(targetNorm) || targetNorm.includes(vNorm)))
        ) {
          return { ...v, channel_category: newCategory, channel_tag: newTag || undefined }
        }
        return v
      })
    )

    if (selectedChannel) {
      const sNorm = normalizeChannelKey(selectedChannel.creator_name || selectedChannel.creator_id || selectedChannel.id)
      if (
        selectedChannel.id === channelKey ||
        selectedChannel.creator_id === channelKey ||
        selectedChannel.creator_name === channelKey ||
        (targetNorm && sNorm && (sNorm === targetNorm || sNorm.includes(targetNorm) || targetNorm.includes(sNorm)))
      ) {
        setSelectedChannel({ ...selectedChannel, category: newCategory, tag: newTag || undefined })
      }
    }

    await Promise.all([
      saveAppSetting('youtube_channel_categories', updatedCatMap),
      saveAppSetting('youtube_channel_tags', updatedTagMap),
    ])

    showToast(`Đã lưu thể loại "${newCategory}" cho kênh`, 'success')
    setEditingChannelCategory(null)
  }

  // Tải danh sách Kênh & Toàn bộ video từ CẢ 2 NGUỒN (TV Show & Review Phim) với phân trang đầy đủ không bị giới hạn 1000 dòng
  useEffect(() => {
    let alive = true
    setLoading(true)

    void (async () => {
      // Helper phân trang lấy toàn bộ dữ liệu từ Supabase (tránh bị PostgREST giới hạn 1000 dòng)
      async function fetchAllTableRows<T>(
        tableName: 'tvshow_videos' | 'review_videos' | 'tvshow_creators' | 'review_creators' | 'tvshow_watched' | 'review_watched',
        selectColumns = '*',
        filterUnavailable = false
      ): Promise<T[]> {
        if (!supabase) return []
        const all: T[] = []
        const PAGE_SIZE = 1000
        let page = 0

        while (true) {
          let q = supabase.from(tableName).select(selectColumns)
          if (filterUnavailable) {
            q = q.is('unavailable_at', null)
          }
          if (tableName.includes('creators')) {
            q = q.is('deleted_at', null)
          }
          const from = page * PAGE_SIZE
          const to = from + PAGE_SIZE - 1
          const { data, error } = await q.range(from, to)
          if (error || !data || data.length === 0) break
          all.push(...(data as T[]))
          if (data.length < PAGE_SIZE) break
          page++
        }
        return all
      }

      // 1. Tải creators & videos từ cả tvshow_videos và review_videos
      const [
        tvVideosRaw,
        revVideosRaw,
        tvCreatorsRaw,
        revCreatorsRaw,
        tvWatchedRaw,
        revWatchedRaw,
        catMapRemote,
        tagMapRemote,
      ] = await Promise.all([
        fetchAllTableRows<VideoRow>('tvshow_videos', 'id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at,duration', true),
        fetchAllTableRows<VideoRow>('review_videos', 'id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at,duration', true),
        fetchAllTableRows<any>('tvshow_creators', '*'),
        fetchAllTableRows<any>('review_creators', '*'),
        fetchAllTableRows<{ video_id: string }>('tvshow_watched', 'video_id'),
        fetchAllTableRows<{ video_id: string }>('review_watched', 'video_id'),
        getRemoteAppSetting<ChannelCategoryMap>('youtube_channel_categories', {}),
        getRemoteAppSetting<ChannelTagMap>('youtube_channel_tags', {}),
        syncVideoProgressFromSupabase(),
      ])

      const tvCreators = tvCreatorsRaw ?? []
      const revCreators = revCreatorsRaw ?? []
      const catMap = catMapRemote || channelCategoryMap
      const tagMap = tagMapRemote || channelTagMap

      const tvVideos = tvVideosRaw.map((v) => ({ ...v, sourceType: 'tvshow' as const }))
      const revVideos = revVideosRaw.map((v) => ({ ...v, sourceType: 'review' as const }))

      // Loại bỏ trùng lặp video_id giữa các bảng
      const seenVideoIds = new Set<string>()
      const rawCombinedVideos: VideoRow[] = []
      for (const v of [...tvVideos, ...revVideos]) {
        const vid = v.video_id || v.id
        if (vid && !seenVideoIds.has(vid)) {
          seenVideoIds.add(vid)
          rawCombinedVideos.push({
            ...v,
            duration: typeof v.duration === 'number' && v.duration > 0 ? v.duration : (progressMap[v.video_id]?.durationSeconds ?? v.duration),
          })
        }
      }

      const combinedVideos = isShorts
        ? rawCombinedVideos.filter((v) => isShortVideo(v, progressMap))
        : rawCombinedVideos.filter((v) => !isShortVideo(v, progressMap))

      const combinedWatchedIds = new Set([
        ...tvWatchedRaw.map((w) => w.video_id),
        ...revWatchedRaw.map((w) => w.video_id),
      ])

      const statusSets = getVideoStatusSets('tvshow', combinedWatchedIds)

      // Xây dựng danh sách Channel Cards tổng hợp từ cả 2 nguồn
      const channelCardsMap = new Map<string, ChannelItem>()

      const registerCreator = (c: any, defaultSource: 'tvshow' | 'review') => {
        const key = c.creator_id || c.creator_name || c.id
        const normName = normalizeChannelKey(c.creator_name)
        const normId = normalizeChannelKey(c.creator_id)
        const normKey = normalizeChannelKey(key)

        const assignedCat =
          catMap[key] ||
          catMap[c.creator_id] ||
          catMap[c.creator_name] ||
          catMap[normName] ||
          catMap[normId] ||
          catMap[normKey] ||
          c.category ||
          guessChannelCategory(c.creator_name, defaultSource)

        const assignedTag =
          tagMap[key] ||
          tagMap[c.creator_id] ||
          tagMap[c.creator_name] ||
          tagMap[normName] ||
          tagMap[normId] ||
          tagMap[normKey] ||
          undefined

        // Extract URL-based keys
        const urlKeys: string[] = []
        if (c.creator_url) {
          const parts = (c.creator_url as string).replace(/\/$/, '').split('/')
          const lastPart = parts[parts.length - 1]
          if (lastPart) {
            urlKeys.push(lastPart, normalizeChannelKey(lastPart))
            if (lastPart.startsWith('@')) urlKeys.push(lastPart.slice(1), normalizeChannelKey(lastPart.slice(1)))
          }
          const chIdx = parts.indexOf('channel')
          if (chIdx !== -1 && parts[chIdx + 1]) urlKeys.push(parts[chIdx + 1], normalizeChannelKey(parts[chIdx + 1]))
        }

        const channelItem: ChannelItem = {
          id: c.id,
          platform: c.platform || 'youtube',
          creator_url: c.creator_url || '',
          creator_name: c.creator_name || 'Kênh YouTube',
          creator_id: c.creator_id || null,
          videoCount: 0,
          inProgressCount: 0,
          watchedCount: 0,
          cover: null,
          lastSyncedAt: c.last_synced_at || null,
          category: assignedCat,
          tag: assignedTag,
          sourceTable: defaultSource,
        }

        // Đăng ký dưới TẤT CẢ key variant để reverse-index hoạt động đầy đủ
        const allKeys = [normName, normId, normKey, c.creator_name, c.creator_id, ...urlKeys].filter(Boolean)
        let registered = false
        for (const k of allKeys) {
          if (!k) continue
          if (!channelCardsMap.has(k)) {
            channelCardsMap.set(k, channelItem)
            registered = true
          }
        }
        // Nếu chưa đăng ký được key nào (tất cả đều bị trùng), vẫn đảm bảo ít nhất 1 key
        if (!registered) {
          const fallbackKey = normName || normKey || c.id
          if (fallbackKey && !channelCardsMap.has(fallbackKey)) {
            channelCardsMap.set(fallbackKey, channelItem)
          }
        }
      }

      for (const c of tvCreators) registerCreator(c, 'tvshow')
      for (const c of revCreators) registerCreator(c, 'review')

      // Tự động bổ sung các Channel từ danh sách Video nếu chưa có trong creators table
      for (const v of combinedVideos) {
        const cName = v.creator_name || v.creator_id
        if (cName) {
          const norm = normalizeChannelKey(cName)
          if (!channelCardsMap.has(cName) && (!norm || !channelCardsMap.has(norm))) {
            registerCreator({
              id: `auto_${v.creator_id || v.id}`,
              platform: 'youtube',
              creator_url: v.canonical_url ? v.canonical_url.split('/watch')[0] : '',
              creator_name: v.creator_name || 'Kênh YouTube',
              creator_id: v.creator_id || null,
              category: catMap[cName] || catMap[norm || ''] || guessChannelCategory(v.creator_name || '', v.sourceType || 'tvshow'),
              tag: tagMap[cName] || tagMap[norm || ''] || undefined,
            }, v.sourceType || 'tvshow')
          }
        }
      }

      // Deduplicate: vì cùng 1 ChannelItem có thể được đăng ký dưới nhiều key
      const channelListRaw = Array.from(new Set(channelCardsMap.values()))

      // ─── BUILD COMPREHENSIVE REVERSE INDEX: video key → ChannelItem ───────────
      const videoKeyToChannel = new Map<string, ChannelItem>()

      const registerChannelKeys = (ch: ChannelItem) => {
        const tryRegister = (k: string | null | undefined) => {
          if (!k) return
          if (!videoKeyToChannel.has(k)) videoKeyToChannel.set(k, ch)
          const lower = k.toLowerCase()
          if (!videoKeyToChannel.has(lower)) videoKeyToChannel.set(lower, ch)
          const norm = normalizeChannelKey(k)
          if (norm && !videoKeyToChannel.has(norm)) videoKeyToChannel.set(norm, ch)
        }

        tryRegister(ch.creator_id)
        tryRegister(ch.creator_name)

        if (ch.creator_url) {
          const parts = ch.creator_url.replace(/\/$/, '').split('/')
          const lastPart = parts[parts.length - 1]
          if (lastPart) {
            tryRegister(lastPart)
            if (lastPart.startsWith('@')) tryRegister(lastPart.slice(1))
          }
          const chIdx = parts.indexOf('channel')
          if (chIdx !== -1 && parts[chIdx + 1]) tryRegister(parts[chIdx + 1])
          const uIdx = parts.indexOf('user')
          if (uIdx !== -1 && parts[uIdx + 1]) tryRegister(parts[uIdx + 1])
        }
      }

      for (const ch of channelListRaw) registerChannelKeys(ch)

      // Fast O(1) lookup: video → ChannelItem using ALL possible video keys
      const getChannelForVideo = (v: VideoRow): ChannelItem | undefined => {
        const tryKeys = (...keys: (string | null | undefined)[]): ChannelItem | undefined => {
          for (const k of keys) {
            if (!k) continue
            const ch = videoKeyToChannel.get(k)
              || videoKeyToChannel.get(k.toLowerCase())
              || videoKeyToChannel.get(normalizeChannelKey(k))
            if (ch) return ch
          }
          return undefined
        }

        // Priority: creator_id > creator_name > series_key > URL-extracted ID
        return (
          tryKeys(v.creator_id) ||
          tryKeys(v.creator_name) ||
          tryKeys(v.series_key) ||
          (v.series_key ? tryKeys(v.series_key.replace(/^PL/i, '').split('_')[0]) : undefined) ||
          undefined
        )
      }

      // ─── THỐNG KÊ videoCount cho từng Channel Card ─────────────────────────────
      for (const v of combinedVideos) {
        const ch = getChannelForVideo(v)
        if (ch) {
          ch.videoCount += 1
          if (statusSets.watchedSet.has(v.video_id)) {
            ch.watchedCount += 1
          } else if (statusSets.inProgressSet.has(v.video_id)) {
            ch.inProgressCount += 1
          }
          if (!ch.cover && v.thumbnail) ch.cover = v.thumbnail
        }
      }

      // ─── GẮN channel_category & channel_tag vào từng Video ────────────────────
      const taggedVideos = combinedVideos.map((v) => {
        const ch = getChannelForVideo(v)

        let cat = ch?.category
        if (!cat) {
          const vKey = v.creator_id || v.creator_name || ''
          const vNorm = normalizeChannelKey(vKey)
          cat =
            catMap[vKey] ||
            catMap[v.creator_name || ''] ||
            catMap[vNorm] ||
            catMap[normalizeChannelKey(v.creator_id)] ||
            catMap[normalizeChannelKey(v.series_key)] ||
            guessChannelCategory(v.creator_name || v.series_key || v.title || '', v.sourceType)
        }

        let tag = ch?.tag
        if (!tag) {
          const vKey = v.creator_id || v.creator_name || ''
          const vNorm = normalizeChannelKey(vKey)
          tag =
            tagMap[vKey] ||
            tagMap[v.creator_name || ''] ||
            tagMap[vNorm] ||
            tagMap[normalizeChannelKey(v.creator_id)] ||
            tagMap[normalizeChannelKey(v.series_key)] ||
            undefined
        }

        return {
          ...v,
          creator_name: ch?.creator_name || v.creator_name,
          channel_category: cat,
          channel_tag: tag,
        }
      })

      if (alive) {
        setChannels(channelListRaw)
        setAllVideos(taggedVideos)
        setWatchedSet(statusSets.watchedSet)
        setInProgressSet(statusSets.inProgressSet)
        setStatusMap(statusSets.statusMap)
        setLoading(false)

        // Tự động kiểm tra và điền thời lượng cho các video chưa có thời lượng
        const missing = rawCombinedVideos.filter((v) => typeof v.duration !== 'number' || v.duration <= 0).map((v) => v.video_id)
        if (missing.length > 0) {
          void (async () => {
            try {
              const { data: sess } = await supabase!.auth.getSession()
              const token = sess.session?.access_token
              if (!token) return
              const r = await fetch('/api/video-durations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ videoIds: missing.slice(0, 100) }),
              })
              const resJson = await r.json().catch(() => ({}))
              if (resJson?.durations && Object.keys(resJson.durations).length > 0) {
                setReloadKey((k) => k + 1)
              }
            } catch {}
          })()
        }
      }
    })()

    return () => { alive = false }
  }, [reloadKey])

  // Tập hợp set các video_id đã lưu trong app
  const savedVideoIdSet = useMemo(() => {
    return new Set(allVideos.map((v) => v.video_id))
  }, [allVideos])

  // Tìm kiếm trực tuyến từ YouTube API khi người dùng kích hoạt
  const handlePerformYouTubeSearch = async (queryToSearch = search, order: SearchOrder = ytOrder) => {
    const q = queryToSearch.trim()
    if (!q) return
    setYtOrder(order)
    setIsSearchingYouTube(true)
    try {
      const page = await searchYouTubePage(q, null, order)
      setYtSearchResults(page.items)
      setYtNextPage(page.nextPageToken)
      if (page.items.length === 0) {
        showToast('Không tìm thấy kết quả từ YouTube API', 'info')
      }
    } catch {
      showToast('Không thể kết nối tìm kiếm YouTube', 'error')
    } finally {
      setIsSearchingYouTube(false)
    }
  }

  /**
   * Lấy thêm một trang kết quả. Không tự động cuộn-để-tải: mỗi lần gọi tốn 100
   * đơn vị quota YouTube (~100 lượt/ngày), nên để người dùng chủ động bấm.
   */
  const handleLoadMoreYouTube = async () => {
    const q = search.trim()
    if (!q || !ytNextPage || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const page = await searchYouTubePage(q, ytNextPage, ytOrder)
      setYtSearchResults((prev) => mergeSearchPages(prev, page.items))
      setYtNextPage(page.nextPageToken)
      if (page.items.length === 0) showToast('Hết kết quả rồi', 'info')
    } catch {
      showToast('Không tải thêm được kết quả', 'error')
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Tự động tìm kiếm YouTube khi người dùng gõ Enter hoặc chuyển sang tab Tìm YouTube
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      void handlePerformYouTubeSearch(search, sortMode === 'viewCount' ? 'viewCount' : 'date')
    }
  }

  // Đổi tiêu chí sắp xếp (Ngẫu nhiên / Mới đăng / Nhiều view / Cũ nhất)
  const handleSortChange = (newSort: YoutubeSortMode) => {
    if (newSort === 'random') {
      setShuffleSeed(Math.random())
    }
    setSortMode(newSort)
    const newYtOrder: SearchOrder = newSort === 'viewCount' ? 'viewCount' : 'date'
    setYtOrder(newYtOrder)
    if (search.trim()) {
      void handlePerformYouTubeSearch(search, newYtOrder)
    }
  }

  // Lưu nhanh một video từ kết quả tìm kiếm YouTube vào App
  const handleSaveVideoToApp = async (item: YouTubeSearchResult) => {
    setSavingVideoId(item.videoId)
    try {
      // 1. Kiểm tra hoặc tạo Creator trong tvshow_creators
      const creatorName = item.channelTitle || 'Kênh YouTube'
      const creatorId = item.channelId || null

      if (creatorName && creatorName !== 'Kênh YouTube') {
        await supabase?.from('tvshow_creators').upsert({
          platform: 'youtube',
          creator_url: `https://www.youtube.com/channel/${creatorId || ''}`,
          creator_id: creatorId,
          creator_name: creatorName,
        }, { onConflict: 'platform,creator_url' })
      }

      // 2. Thêm video vào tvshow_videos
      const newVideoRow = {
        platform: 'youtube',
        video_id: item.videoId,
        creator_id: creatorId,
        creator_name: creatorName,
        title: item.title,
        description: item.description,
        canonical_url: `https://www.youtube.com/watch?v=${item.videoId}`,
        embed_url: `https://www.youtube-nocookie.com/embed/${item.videoId}`,
        thumbnail: item.thumbnail,
        published_at: item.publishedAt || new Date().toISOString(),
      }

      const { error } = await supabase!.from('tvshow_videos').upsert(newVideoRow, { onConflict: 'platform,video_id' })
      if (error) throw error

      showToast(`Đã lưu "${item.title.slice(0, 30)}..." vào App!`, 'info')
      setReloadKey((k) => k + 1)
    } catch (err: any) {
      showToast(`Lỗi khi lưu video: ${err.message}`, 'error')
    } finally {
      setSavingVideoId(null)
    }
  }

  // Tập hợp các tên thể loại hợp lệ đang hoạt động
  const validCategoryLabels = useMemo(() => {
    return new Set(customCategories.map((c) => c.label))
  }, [customCategories])

  // Danh sách video thô trong Lịch sử xem (kết hợp videoProgress và videoStatus)
  const rawHistoryVideos = useMemo(() => {
    const videoLookup = new Map<string, VideoRow>()
    allVideos.forEach((v) => videoLookup.set(v.video_id, v))

    const historyItems: Array<{
      video: VideoRow
      seconds: number
      percent: number
      status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
      updatedAt: string
    }> = []

    // 1. Từ progressMap (lưu thời gian xem thực tế từng giây)
    Object.values(progressMap).forEach((p) => {
      if (!p || !p.videoId || p.percent <= 0) return
      let v = videoLookup.get(p.videoId)
      if (!v) {
        v = {
          id: `hist-${p.videoId}`,
          video_id: p.videoId,
          series_key: null,
          creator_id: null,
          creator_name: p.channelName || 'YouTube',
          title: p.title || 'Video YouTube',
          canonical_url: `https://www.youtube.com/watch?v=${p.videoId}`,
          embed_url: `https://www.youtube.com/embed/${p.videoId}`,
          thumbnail: p.thumbnail || `https://i.ytimg.com/vi/${p.videoId}/hqdefault.jpg`,
          part_number: null,
          published_at: null,
          unavailable_at: null,
          duration: p.durationSeconds,
        }
      }
      historyItems.push({
        video: v,
        seconds: p.seconds,
        percent: p.percent,
        status: p.status,
        updatedAt: p.updatedAt || new Date().toISOString(),
      })
    })

    // 2. Từ watchedSet nếu chưa có trong historyItems
    const existingIds = new Set(historyItems.map((h) => h.video.video_id))
    watchedSet.forEach((vid) => {
      if (!existingIds.has(vid)) {
        const v = videoLookup.get(vid)
        if (v) {
          historyItems.push({
            video: v,
            seconds: v.duration || 0,
            percent: 100,
            status: 'COMPLETED',
            updatedAt: new Date(0).toISOString(),
          })
        }
      }
    })

    return historyItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [allVideos, progressMap, watchedSet])

  // Đếm số video lịch sử theo từng thể loại cho thanh Tab phía trên
  const historyCategoryCounts = useMemo(() => {
    const validLabels = new Set(customCategories.map((c) => c.label))
    const counts: Record<string, number> = { ALL: rawHistoryVideos.length, Khác: 0 }
    customCategories.forEach((c) => {
      if (c.label !== 'Khác') counts[c.label] = 0
    })
    rawHistoryVideos.forEach((h) => {
      const cat = h.video.channel_category && validLabels.has(h.video.channel_category) ? h.video.channel_category : 'Khác'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [rawHistoryVideos, customCategories])

  // Đếm số video lịch sử theo các khoảng thời gian (Hôm nay, Tuần này, Tháng này)
  const historyPeriodCounts = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayMs = startOfToday.getTime()
    const sevenDaysAgoMs = Date.now() - 7 * 86400000
    const thirtyDaysAgoMs = Date.now() - 30 * 86400000

    let today = 0
    let week = 0
    let month = 0
    rawHistoryVideos.forEach((h) => {
      const t = new Date(h.updatedAt).getTime()
      if (t >= todayMs) today++
      if (t >= sevenDaysAgoMs) week++
      if (t >= thirtyDaysAgoMs) month++
    })
    return {
      all: rawHistoryVideos.length,
      today,
      week,
      month,
    }
  }, [rawHistoryVideos])

  // Tính số lượng video & kênh cho từng tab thể loại (Đo đạc 100% chuẩn xác theo dữ liệu thực tế)
  const categoryTabStats = useMemo(() => {
    const counts: Record<string, { channels: number; videos: number }> = {}

    // 1. Khởi tạo theo customCategories
    customCategories.forEach((cat) => {
      counts[cat.label] = { channels: 0, videos: 0 }
    })
    if (!counts['Khác']) {
      counts['Khác'] = { channels: 0, videos: 0 }
    }

    const validLabels = new Set(customCategories.map((c) => c.label))

    // 2. Đếm số kênh thuộc từng thể loại (nếu category không có trong customCategories thì gộp vào 'Khác')
    channels.forEach((c) => {
      const cat = c.category && validLabels.has(c.category) ? c.category : 'Khác'
      if (!counts[cat]) counts[cat] = { channels: 0, videos: 0 }
      counts[cat].channels += 1
    })

    // 3. Đếm số video TRỰC TIẾP từ allVideos (nếu channel_category không có trong customCategories thì gộp vào 'Khác')
    allVideos.forEach((v) => {
      const cat = v.channel_category && validLabels.has(v.channel_category) ? v.channel_category : 'Khác'
      if (!counts[cat]) counts[cat] = { channels: 0, videos: 0 }
      counts[cat].videos += 1
    })

    return counts
  }, [channels, allVideos, customCategories])

  // Danh sách các tab hiển thị trên thanh cuộn ngang: Tất cả + Các thể loại của người dùng + 1 Tab "Khác" cố định
  const dynamicCategoryTabs = useMemo(() => {
    const isChannelView = viewMode === 'channel'
    const isHistoryView = viewMode === 'history'

    const tabs = [
      {
        id: 'ALL',
        label: 'Tất cả',
        icon: isHistoryView ? '⏱️' : '🎬',
        count: isHistoryView
          ? (historyCategoryCounts['ALL'] || 0)
          : isChannelView
          ? channels.length
          : allVideos.length,
      },
    ]

    // 1. Chỉ hiển thị các thể loại do người dùng cấu hình (bỏ qua 'Khác' nếu có để xếp ở cuối)
    customCategories.forEach((c) => {
      if (c.label === 'Khác') return
      const stat = categoryTabStats[c.label] || { channels: 0, videos: 0 }
      tabs.push({
        id: c.label,
        label: c.label,
        icon: c.icon || '🏷️',
        count: isHistoryView
          ? (historyCategoryCounts[c.label] || 0)
          : isChannelView
          ? stat.channels
          : stat.videos,
      })
    })

    // 2. Tab 'Khác' cố định ở cuối cùng chứa toàn bộ kênh/video chưa phân loại hoặc thuộc thể loại đã xóa
    const otherStat = categoryTabStats['Khác'] || { channels: 0, videos: 0 }
    const customOther = customCategories.find((c) => c.label === 'Khác')
    tabs.push({
      id: 'Khác',
      label: 'Khác',
      icon: customOther?.icon || '📦',
      count: isHistoryView
        ? (historyCategoryCounts['Khác'] || 0)
        : isChannelView
        ? otherStat.channels
        : otherStat.videos,
    })

    return tabs
  }, [allVideos.length, channels.length, categoryTabStats, customCategories, viewMode, historyCategoryCounts])

  // Tính số lượng video cho từng Tag trong Thể loại hiện tại
  const tagCounts = useMemo(() => {
    if (activeCategoryTab === 'ALL') return {}
    const counts: Record<string, number> = {}
    const tags = categoryTagMap[activeCategoryTab] || []
    tags.forEach((t) => { counts[t] = 0 })
    const sourceList = viewMode === 'history' ? rawHistoryVideos.map((h) => h.video) : allVideos
    sourceList.forEach((v) => {
      const isMatch = activeCategoryTab === 'Khác'
        ? (!v.channel_category || v.channel_category === 'Khác' || !validCategoryLabels.has(v.channel_category))
        : (v.channel_category === activeCategoryTab)
      if (isMatch && v.channel_tag && counts[v.channel_tag] !== undefined) {
        counts[v.channel_tag]++
      }
    })
    return counts
  }, [allVideos, rawHistoryVideos, viewMode, activeCategoryTab, categoryTagMap, validCategoryLabels])

  // Lọc Kênh theo Tab Thể Loại, Tag con và Ô Tìm Kiếm
  const filteredChannels = useMemo(() => {
    let result = [...channels]

    // Lọc theo Tab thể loại đang chọn
    if (activeCategoryTab !== 'ALL') {
      if (activeCategoryTab === 'Khác') {
        result = result.filter((c) => !c.category || c.category === 'Khác' || !validCategoryLabels.has(c.category))
      } else {
        result = result.filter((c) => c.category === activeCategoryTab)
      }
      // Lọc theo Tag con nếu có chọn
      if (activeTagTab !== 'ALL') {
        result = result.filter((c) => c.tag === activeTagTab)
      }
    }

    // Lọc theo từ khóa tìm kiếm
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (c) =>
          c.creator_name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          (c.tag && c.tag.toLowerCase().includes(q))
      )
    }

    return result
  }, [channels, activeCategoryTab, activeTagTab, search, validCategoryLabels])

  // Tính số lượng video theo từng trạng thái xem trong tab hiện tại
  const watchStatusCounts = useMemo(() => {
    let base = activeCategoryTab === 'ALL'
      ? allVideos
      : activeCategoryTab === 'Khác'
        ? allVideos.filter((v) => !v.channel_category || v.channel_category === 'Khác' || !validCategoryLabels.has(v.channel_category))
        : allVideos.filter((v) => v.channel_category === activeCategoryTab)

    if (activeCategoryTab !== 'ALL' && activeTagTab !== 'ALL') {
      base = base.filter((v) => v.channel_tag === activeTagTab)
    }

    let inProgress = 0
    let watched = 0
    let unwatched = 0

    for (const v of base) {
      const isW = watchedSet.has(v.video_id) || progressMap[v.video_id]?.status === 'COMPLETED' || (progressMap[v.video_id]?.percent ?? 0) >= 90
      const isIP = !isW && (inProgressSet.has(v.video_id) || (progressMap[v.video_id]?.percent ?? 0) > 0)
      if (isW) {
        watched++
      } else if (isIP) {
        inProgress++
      } else {
        unwatched++
      }
    }

    return {
      all: base.length,
      in_progress: inProgress,
      watched,
      unwatched,
    }
  }, [allVideos, activeCategoryTab, activeTagTab, watchedSet, inProgressSet, progressMap, validCategoryLabels])

  // Lọc Video ĐÃ CÓ trong App theo Tab Thể Loại & Tag con của Kênh
  const filteredSavedVideos = useMemo(() => {
    let result = [...allVideos]

    // Lọc theo Tab thể loại của kênh
    if (activeCategoryTab !== 'ALL') {
      if (activeCategoryTab === 'Khác') {
        result = result.filter((v) => !v.channel_category || v.channel_category === 'Khác' || !validCategoryLabels.has(v.channel_category))
      } else {
        result = result.filter((v) => v.channel_category === activeCategoryTab)
      }
      // Lọc theo Tag con nếu có chọn
      if (activeTagTab !== 'ALL') {
        result = result.filter((v) => v.channel_tag === activeTagTab)
      }
    }

    // Lọc theo trạng thái xem
    if (watchFilter === 'unwatched') {
      result = result.filter((v) => {
        const isW = watchedSet.has(v.video_id) || progressMap[v.video_id]?.status === 'COMPLETED' || (progressMap[v.video_id]?.percent ?? 0) >= 90
        const isIP = !isW && (inProgressSet.has(v.video_id) || (progressMap[v.video_id]?.percent ?? 0) > 0)
        return !isW && !isIP
      })
    } else if (watchFilter === 'in_progress') {
      result = result.filter((v) => {
        const isW = watchedSet.has(v.video_id) || progressMap[v.video_id]?.status === 'COMPLETED' || (progressMap[v.video_id]?.percent ?? 0) >= 90
        return !isW && (inProgressSet.has(v.video_id) || (progressMap[v.video_id]?.percent ?? 0) > 0)
      })
    } else if (watchFilter === 'watched') {
      result = result.filter((v) => watchedSet.has(v.video_id) || progressMap[v.video_id]?.status === 'COMPLETED' || (progressMap[v.video_id]?.percent ?? 0) >= 90)
    }

    // Lọc theo tìm kiếm
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.creator_name && v.creator_name.toLowerCase().includes(q)) ||
          (v.channel_tag && v.channel_tag.toLowerCase().includes(q))
      )
    }

    // Sắp xếp video: Mặc định là Ngẫu nhiên ('random'), hoặc Mới đăng ('date'), hoặc Nhiều view ('viewCount'), hoặc Cũ nhất ('oldest')
    if (sortMode === 'random') {
      result = shuffleArray(result, shuffleSeed)
    } else if (sortMode === 'date') {
      result.sort((a, b) => {
        const tA = a.published_at ? new Date(a.published_at).getTime() : 0
        const tB = b.published_at ? new Date(b.published_at).getTime() : 0
        return tB - tA
      })
    } else if (sortMode === 'oldest') {
      result.sort((a, b) => {
        const tA = a.published_at ? new Date(a.published_at).getTime() : 0
        const tB = b.published_at ? new Date(b.published_at).getTime() : 0
        return tA - tB
      })
    } else if (sortMode === 'viewCount') {
      result.sort((a, b) => {
        const pA = progressMap[a.video_id]?.percent || 0
        const pB = progressMap[b.video_id]?.percent || 0
        if (pA !== pB) return pB - pA
        const tA = a.published_at ? new Date(a.published_at).getTime() : 0
        const tB = b.published_at ? new Date(b.published_at).getTime() : 0
        return tB - tA
      })
    }

    return result
  }, [allVideos, activeCategoryTab, activeTagTab, watchFilter, search, watchedSet, inProgressSet, shuffleSeed, sortMode, progressMap, validCategoryLabels])

  // Danh sách video trong Lịch sử xem (lọc theo Thể loại, Tag con, Khoảng thời gian và Tìm kiếm)
  const historyVideos = useMemo(() => {
    let result = [...rawHistoryVideos]

    // 1. Lọc theo Thể loại
    if (activeCategoryTab !== 'ALL') {
      if (activeCategoryTab === 'Khác') {
        result = result.filter((h) => !h.video.channel_category || h.video.channel_category === 'Khác' || !validCategoryLabels.has(h.video.channel_category))
      } else {
        result = result.filter((h) => h.video.channel_category === activeCategoryTab)
      }
      // Lọc theo Tag con
      if (activeTagTab !== 'ALL') {
        result = result.filter((h) => h.video.channel_tag === activeTagTab)
      }
    }

    // 2. Lọc theo Khoảng thời gian Lịch sử (Hôm nay, Tuần này, Tháng này, Tất cả)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayMs = startOfToday.getTime()
    const sevenDaysAgoMs = Date.now() - 7 * 86400000
    const thirtyDaysAgoMs = Date.now() - 30 * 86400000

    if (historyPeriod === 'today') {
      result = result.filter((h) => new Date(h.updatedAt).getTime() >= todayMs)
    } else if (historyPeriod === 'week') {
      result = result.filter((h) => new Date(h.updatedAt).getTime() >= sevenDaysAgoMs)
    } else if (historyPeriod === 'month') {
      result = result.filter((h) => new Date(h.updatedAt).getTime() >= thirtyDaysAgoMs)
    }

    // 3. Lọc theo tìm kiếm nếu có gõ
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (h) =>
          h.video.title.toLowerCase().includes(q) ||
          (h.video.creator_name && h.video.creator_name.toLowerCase().includes(q))
      )
    }

    // Sắp xếp xem gần nhất lên đầu
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [rawHistoryVideos, activeCategoryTab, activeTagTab, historyPeriod, search, validCategoryLabels])

  // Tải từng mẻ nhỏ 12 video/kênh giúp trang nhẹ mượt, không giật lag
  const videoList = useIncrementalList(filteredSavedVideos.length, 12, `${search}|${watchFilter}|${activeCategoryTab}|${shuffleSeed}|${sortMode}`)
  const channelList = useIncrementalList(filteredChannels.length, 12, `${search}|${watchFilter}|${activeCategoryTab}`)
  const historyList = useIncrementalList(historyVideos.length, 12, `${search}|${historyVideos.length}`)

  /** Nút "Đã xem": bật/tắt trạng thái xem hết của đúng video đó. */
  const handleToggleWatched = async (video: VideoRow) => {
    const isW = watchedSet.has(video.video_id) || progressMap[video.video_id]?.status === 'COMPLETED' || (progressMap[video.video_id]?.percent ?? 0) >= 90
    const next: VideoStatus = isW ? 'UNWATCHED' : 'COMPLETED'

    // Cập nhật UI ngay lập tức
    setWatchedSet((prev) => {
      const nextSet = new Set(prev)
      if (next === 'COMPLETED') nextSet.add(video.video_id)
      else nextSet.delete(video.video_id)
      return nextSet
    })
    setInProgressSet((prev) => {
      const nextSet = new Set(prev)
      nextSet.delete(video.video_id)
      return nextSet
    })

    await updateVideoStatusRecord(video.video_id, video.sourceType || 'tvshow', next, {
      title: video.title,
      channel_name: video.creator_name || undefined,
      series_key: video.series_key,
    })
    showToast(next === 'COMPLETED' ? 'Đã đánh dấu xem xong' : 'Bỏ đánh dấu đã xem', 'info')
  }


  // Nếu đang xem chi tiết 1 kênh
  if (selectedChannel) {
    return (
      <ChannelDetailView
        channel={selectedChannel}
        isShorts={isShorts}
        onBack={() => setSelectedChannel(null)}
        onChangeCategoryAndTag={(newCat, newTag) => {
          const key = selectedChannel.creator_id || selectedChannel.creator_name || selectedChannel.id
          void handleChangeChannelCategoryAndTag(key, newCat, newTag)
          setSelectedChannel((prev) => (prev ? { ...prev, category: newCat, tag: newTag || undefined } : null))
        }}
        customCategories={customCategories}
        categoryTagMap={categoryTagMap}
        onAddCustomCategory={handleAddCustomCategory}
        onUpdateCustomCategory={handleUpdateCustomCategory}
        onDeleteCustomCategory={handleDeleteCustomCategory}
        onAddTagToCategory={handleAddTagToCategory}
        onUpdateTagInCategory={handleUpdateTagInCategory}
        onDeleteTagFromCategory={handleDeleteTagFromCategory}
      />
    )
  }

  return (
    <section className="tv-page">
      {/* 1. THANH TAB HẠNG MỤC TRƯỢT NGANG (Kéo từ trái qua phải & vuốt chuột trên desktop) */}
      <div className="yt-category-tabs-container">
        {canScrollLeft && (
          <button
            type="button"
            className="yt-category-scroll-btn left"
            onClick={() => scrollTabs(-220)}
            aria-label="Cuộn sang trái"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        <div
          className="yt-category-tabs-track"
          ref={tabsScrollRef}
          onMouseDown={handleTabsMouseDown}
          onMouseMove={handleTabsMouseMove}
          onMouseUp={handleTabsMouseUpOrLeave}
          onMouseLeave={handleTabsMouseUpOrLeave}
        >
          {dynamicCategoryTabs.map((tab) => {
            const isActive = activeCategoryTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                className={`yt-category-tab ${isActive ? 'active' : ''}`}
                onClick={(e) => {
                  if (hasMovedRef.current) return
                  setActiveCategoryTab(tab.id)
                  setActiveTagTab('ALL')
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
                }}
              >
                <span className="yt-tab-icon">{tab.icon}</span>
                <span className="yt-tab-label">{tab.label}</span>
                <span className="yt-tab-count">{tab.count}</span>
              </button>
            )
          })}

          {/* NÚT THÊM THỂ LOẠI MỚI TRỰC TIẾP TRÊN THANH TAB */}
          <button
            type="button"
            className="yt-category-tab"
            onClick={() => {
              if (hasMovedRef.current) return
              setShowAddCategoryModal(true)
            }}
            title="Thêm thể loại mới cho YouTube"
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              borderColor: 'rgba(59, 130, 246, 0.35)',
              color: 'var(--primary)',
              borderStyle: 'dashed',
            }}
          >
            <Plus size={15} />
            <span className="yt-tab-label">Thêm thể loại</span>
          </button>
        </div>

        {canScrollRight && (
          <button
            type="button"
            className="yt-category-scroll-btn right"
            onClick={() => scrollTabs(220)}
            aria-label="Cuộn sang phải"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* 1.5. THANH TAG CON THUỘC THỂ LOẠI ĐANG CHỌN */}
      {activeCategoryTab !== 'ALL' && (
        <div
          className="chip-scroll-row"
          style={{
            margin: '4px 0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 0',
          }}
        >
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, paddingRight: 2 }}>
            <Tag size={13} /> Tags:
          </span>

          <button
            type="button"
            className={`tv-filter-pill ${activeTagTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveTagTab('ALL')}
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              borderRadius: 8,
              border: `1px solid ${activeTagTab === 'ALL' ? 'var(--primary)' : 'var(--card-border)'}`,
              background: activeTagTab === 'ALL' ? 'var(--primary)' : 'var(--card-bg)',
              color: activeTagTab === 'ALL' ? '#ffffff' : 'var(--text-main)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: activeTagTab === 'ALL' ? 700 : 500,
            }}
          >
            Tất cả (#{categoryTabStats[activeCategoryTab]?.videos || 0})
          </button>

          {(categoryTagMap[activeCategoryTab] || []).map((tag) => {
            const isActive = activeTagTab === tag
            const count = tagCounts[tag] || 0
            return (
              <button
                key={tag}
                type="button"
                className={`tv-filter-pill ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTagTab(tag)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  borderRadius: 8,
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--card-border)'}`,
                  background: isActive ? 'var(--primary)' : 'var(--card-bg)',
                  color: isActive ? '#ffffff' : 'var(--text-main)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: isActive ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>#{tag}</span>
                <span style={{ opacity: 0.75, fontSize: '0.7rem' }}>({count})</span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setQuickAddTagCategory(activeCategoryTab)}
            style={{
              padding: '4px 8px',
              fontSize: '0.72rem',
              borderRadius: 8,
              border: '1px dashed var(--primary)',
              background: 'rgba(59, 130, 246, 0.08)',
              color: 'var(--primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
            title={`Thêm tag mới vào mục "${activeCategoryTab}"`}
          >
            <Plus size={12} /> Thêm tag
          </button>
        </div>
      )}

      {/* 2. THANH TÌM KIẾM THÔNG MINH (TÌM VIDEO ĐÃ CÓ & CHƯA CÓ TRÊN YOUTUBE) */}
      <form onSubmit={handleSearchSubmit} className="tv-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div className="tv-search-box" style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="tv-search"
            placeholder="Tìm video, kênh đã có hoặc tìm mới từ YouTube API (Enter)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setYtSearchResults([])
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}
            >
              ✕
            </button>
          )}
          {/* Nút kích hoạt tìm kiếm từ YouTube API */}
          <button
            type="button"
            className="tv-btn primary"
            disabled={!search.trim() || isSearchingYouTube}
            onClick={() => void handlePerformYouTubeSearch(search)}
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              borderRadius: 8,
              height: 28,
              marginLeft: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {isSearchingYouTube ? <Loader2 size={13} className="tv-spin" /> : <Globe size={13} />}
            <span>Tìm YouTube</span>
          </button>
        </div>

        {/* Phạm vi tìm kiếm khi đang có từ khóa hoặc xem danh mục */}
        {search.trim() ? (
          <div style={{ display: 'inline-flex', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 3 }}>
            <button
              type="button"
              className={`tv-btn ${searchScope === 'all' ? 'primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', border: 'none', borderRadius: 9 }}
              onClick={() => setSearchScope('all')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`tv-btn ${searchScope === 'saved' ? 'primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', border: 'none', borderRadius: 9 }}
              onClick={() => setSearchScope('saved')}
            >
              Trong App ({filteredSavedVideos.length})
            </button>
            <button
              type="button"
              className={`tv-btn ${searchScope === 'youtube' ? 'primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', border: 'none', borderRadius: 9 }}
              onClick={() => {
                setSearchScope('youtube')
                if (ytSearchResults.length === 0 && search.trim()) {
                  void handlePerformYouTubeSearch(search)
                }
              }}
            >
              YouTube ({ytSearchResults.length})
            </button>
          </div>
        ) : (
          <div style={{ display: 'inline-flex', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 3, gap: 2 }}>
            <button
              type="button"
              className={`tv-btn ${viewMode === 'video' ? 'primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', border: 'none', borderRadius: 9 }}
              onClick={() => setViewMode('video')}
            >
              <Video size={14} /> Video ({filteredSavedVideos.length})
            </button>
            <button
              type="button"
              className={`tv-btn ${viewMode === 'channel' ? 'primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', border: 'none', borderRadius: 9 }}
              onClick={() => setViewMode('channel')}
            >
              <LayoutGrid size={14} /> Kênh ({filteredChannels.length})
            </button>
            <button
              type="button"
              className={`tv-btn ${viewMode === 'history' ? 'primary' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.78rem', border: 'none', borderRadius: 9 }}
              onClick={() => setViewMode('history')}
            >
              <Clock size={14} /> Lịch sử ({historyVideos.length})
            </button>
          </div>
        )}
      </form>

      {/* 2.5. BỘ LỌC TRẠNG THÁI XEM HOẶC BỘ LỌC THỜI GIAN LỊCH SỬ */}
      {viewMode === 'history' ? (
        /* Khi xem LỊCH SỬ: Tắt bộ lọc Tất cả / Đang xem / Đã xem, thay bằng các mốc thời gian Hôm nay / Tuần / Tháng / Tất cả */
        <div className="chip-scroll-row" style={{ margin: '8px 0 14px' }}>
          {([
            { id: 'all', label: 'Tất cả lịch sử', icon: Clock, count: historyPeriodCounts.all },
            { id: 'today', label: 'Hôm nay', icon: Sparkles, count: historyPeriodCounts.today },
            { id: 'week', label: 'Tuần này', icon: Calendar, count: historyPeriodCounts.week },
            { id: 'month', label: 'Tháng này', icon: History, count: historyPeriodCounts.month },
          ] as const).map((p) => {
            const isActive = historyPeriod === p.id
            const Icon = p.icon
            return (
              <button
                key={p.id}
                type="button"
                className={`tv-filter-pill ${isActive ? 'active' : ''}`}
                onClick={() => setHistoryPeriod(p.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 10,
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--card-border)'}`,
                  background: isActive ? 'var(--primary)' : 'var(--card-bg)',
                  color: isActive ? '#ffffff' : 'var(--text-main)',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={12} />
                <span>{p.label}</span>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: 99,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-main)',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                  }}
                >
                  {p.count}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        /* Khi xem Video / Kênh bình thường */
        <div className="chip-scroll-row" style={{ margin: '8px 0 14px' }}>
          {([
              { id: 'all', label: 'Tất cả video', icon: null, count: watchStatusCounts.all },
              { id: 'in_progress', label: 'Đang xem', icon: Clock, count: watchStatusCounts.in_progress },
              { id: 'watched', label: 'Đã xem', icon: CheckCircle2, count: watchStatusCounts.watched },
              { id: 'unwatched', label: 'Chưa xem', icon: Circle, count: watchStatusCounts.unwatched },
          ] as const).map((filter) => {
              const isActive = watchFilter === filter.id
              const Icon = filter.icon
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={`tv-filter-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setWatchFilter(filter.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 12px',
                    borderRadius: 10,
                    border: `1px solid ${isActive ? 'var(--primary)' : 'var(--card-border)'}`,
                    background: isActive ? 'var(--primary)' : 'var(--card-bg)',
                    color: isActive ? '#ffffff' : 'var(--text-main)',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {Icon && <Icon size={12} />}
                  <span>{filter.label}</span>
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: 99,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-main)',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                    }}
                  >
                    {filter.count}
                  </span>
                </button>
              )
          })}

          <div style={{ width: 1, height: 18, background: 'var(--card-border)', margin: '0 4px', flexShrink: 0 }} />

          {/* BỘ LỌC SẮP XẾP: NGẪU NHIÊN (MẶC ĐỊNH KHI MỞ TAB) & MỚI ĐĂNG & NHIỀU VIEW & CŨ NHẤT */}
          {([
            { id: 'random', label: 'Ngẫu nhiên', icon: Sparkles, title: 'Hiển thị video xáo trộn ngẫu nhiên mỗi lần mở (Mặc định)' },
            { id: 'date', label: 'Mới đăng', icon: Zap, title: 'Ưu tiên hiển thị video mới đăng gần nhất' },
            { id: 'viewCount', label: 'Nhiều view', icon: Flame, title: 'Ưu tiên hiển thị video có nhiều lượt xem' },
            { id: 'oldest', label: 'Cũ nhất', icon: ArrowUpDown, title: 'Hiển thị video từ cũ nhất đến mới nhất' },
          ] as const).map((s) => {
            const isActive = sortMode === s.id
            const Icon = s.icon
            return (
              <button
                key={s.id}
                type="button"
                className={`tv-filter-pill ${isActive ? 'active' : ''}`}
                onClick={() => handleSortChange(s.id)}
                title={s.title}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 10,
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--card-border)'}`,
                  background: isActive ? 'var(--primary)' : 'var(--card-bg)',
                  color: isActive ? '#ffffff' : 'var(--text-main)',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={12} />
                <span>{s.label}</span>
                {s.id === 'random' && (
                  <span
                    style={{
                      padding: '1px 5px',
                      borderRadius: 99,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      background: isActive ? 'rgba(255, 255, 255, 0.3)' : 'rgba(59, 130, 246, 0.15)',
                      color: isActive ? '#ffffff' : 'var(--primary)',
                    }}
                  >
                    Mặc định
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* 3. PHẦN HIỂN THỊ KẾT QUẢ TÌM KIẾM YOUTUBE TRỰC TUYẾN (NẾU ĐANG TÌM KIẾM) */}
      {search.trim() && (searchScope === 'all' || searchScope === 'youtube') && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '16px', marginBottom: 16, boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'inline-flex', padding: 6, borderRadius: 8, background: 'rgba(244, 63, 94, 0.12)', color: 'var(--rose)' }}>
                <Globe size={16} />
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Kết quả tìm kiếm trực tiếp trên YouTube {ytSearchResults.length > 0 && `(${ytSearchResults.length})`}
              </h3>
            </div>
            {isSearchingYouTube && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={13} className="tv-spin" /> Đang tìm kiếm...
              </span>
            )}
          </div>

          {ytSearchResults.length > 0 ? (
            <>
              {/* Đổi thứ tự là tìm lại từ YouTube, không xếp lại 50 cái đang có —
                  "nhiều view nhất" phải xét cả kho chứ không phải trong 50 này. */}
              <div className="yt-order-row">
                {([
                  ['relevance', 'Liên quan'],
                  ['viewCount', 'Nhiều view'],
                  ['date', 'Mới nhất'],
                ] as [SearchOrder, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`yt-order-chip${ytOrder === value ? ' on' : ''}`}
                    disabled={isSearchingYouTube}
                    onClick={() => void handlePerformYouTubeSearch(search, value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {ytSearchResults.map((item) => {
                const isAlreadySaved = savedVideoIdSet.has(item.videoId)
                const isSaving = savingVideoId === item.videoId

                return (
                  <div
                    key={item.videoId}
                    style={{
                      background: 'var(--bg-main)',
                      border: `1px solid ${isAlreadySaved ? 'rgba(16, 185, 129, 0.3)' : 'var(--card-border)'}`,
                      borderRadius: 14,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    {/* Thumbnail video & Badge trạng thái */}
                    <div
                      role="button"
                      tabIndex={0}
                      title="Mở trang xem"
                      onClick={() => openSearchResult(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openSearchResult(item)
                        }
                      }}
                      style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', overflow: 'hidden', cursor: 'pointer' }}
                    >
                      <img src={item.thumbnail} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      <Play size={34} color="#fff" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))', pointerEvents: 'none' }} />
                      
                      {isAlreadySaved ? (
                        <span
                          style={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#10b981',
                            color: '#fff',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Check size={11} /> Đã có trong App
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void handleSaveVideoToApp(item)}
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: 'rgba(244, 63, 94, 0.9)',
                            border: 'none',
                            color: '#fff',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            backdropFilter: 'blur(6px)',
                          }}
                          title="Lưu video này vào cơ sở dữ liệu của bạn"
                        >
                          {isSaving ? <Loader2 size={12} className="tv-spin" /> : <BookmarkPlus size={12} />}
                          <span>Lưu vào App</span>
                        </button>
                      )}
                    </div>

                    <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openSearchResult(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openSearchResult(item)
                          }
                        }}
                        style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'pointer' }}
                      >
                        {item.title}
                      </div>
                      {(item.viewCount || item.publishedAt) && (
                        <div className="yt-card-stats">
                          {formatViews(item.viewCount)}
                          {item.viewCount && item.publishedAt ? ' · ' : ''}
                          {item.publishedAt ? publishedLabel(item.publishedAt) : ''}
                        </div>
                      )}
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>{item.channelTitle}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => openSearchResult(item)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          >
                            <Play size={10} /> Mở chi tiết
                          </button>
                          <button
                            type="button"
                            title="Chuyển video thành Audio & Nghe"
                            aria-label="Nghe Audio"
                            onClick={() => {
                              if (audioPlayer) {
                                void playYoutubeAsAudio(
                                  {
                                    videoId: item.videoId,
                                    title: item.title,
                                    channelName: item.channelTitle,
                                    thumbnail: item.thumbnail,
                                  },
                                  audioPlayer,
                                  { showToast }
                                )
                              }
                            }}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--cyan, #06b6d4)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          >
                            <Headphones size={11} /> Audio
                          </button>
                          <button
                            type="button"
                            title="Phát ở khung nhỏ, không rời trang"
                            aria-label="Phát ở khung nhỏ"
                            onClick={() => playInMini({ videoId: item.videoId, title: item.title, channelName: item.channelTitle, thumbnail: item.thumbnail })}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex' }}
                          >
                            <PictureInPicture2 size={11} />
                          </button>
                          <a href={`https://www.youtube.com/watch?v=${item.videoId}`} target="_blank" rel="noopener noreferrer" title="Mở trên YouTube" style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
                            <ExternalLink size={10} />
                          </a>
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>

              {ytNextPage ? (
                <button
                  type="button"
                  onClick={() => void handleLoadMoreYouTube()}
                  disabled={isLoadingMore}
                  className="yt-load-more"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={14} className="tv-spin" /> Đang tải thêm…
                    </>
                  ) : (
                    <>
                      <Globe size={14} /> Xem thêm kết quả
                    </>
                  )}
                </button>
              ) : (
                ytSearchResults.length > 0 && (
                  <p className="yt-load-more-end">Đã hiện hết kết quả tìm được.</p>
                )
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {isSearchingYouTube ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={18} className="tv-spin" /> Đang tra cứu kết quả từ YouTube API...
                </div>
              ) : (
                <div>
                  Nhấn nút <strong>"Tìm YouTube"</strong> ở trên để tìm tất cả các video mới nhất trực tiếp từ YouTube.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. NỘI DUNG VIDEO / KÊNH ĐÃ CÓ TRONG APP */}
      {searchScope !== 'youtube' && (
        <>
          {search.trim() && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 10px' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Video đã lưu trong App ({filteredSavedVideos.length})
              </h3>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 10, color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="tv-spin" /> Đang tải kho video YouTube...
            </div>
          ) : viewMode === 'history' ? (
            /* CHẾ ĐỘ XEM LỊCH SỬ VIDEO */
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 16px', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Lịch sử xem ({historyVideos.length})
                  </h3>
                </div>
              </div>

              {historyVideos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                  <Clock size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '0.92rem' }}>Chưa có lịch sử xem video nào</p>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>Khi bạn xem video hoặc đánh dấu đã xem, video sẽ xuất hiện ở đây.</p>
                </div>
              ) : (
                <div className="yt-grid">
                  {historyVideos.slice(0, historyList.visibleCount).map((item) => (
                    <HistoryVideoCard
                      key={item.video.video_id}
                      item={item}
                      onOpen={() => navigate(`${watchBasePath}/watch/${item.video.video_id}`, { state: { from: watchBasePath, fromLabel: isShorts ? 'YouTube Shorts' : 'YouTube' } })}
                      onPlayMini={() =>
                        playInMini({
                          videoId: item.video.video_id,
                          title: item.video.title,
                          channelName: item.video.creator_name,
                          thumbnail: item.video.thumbnail,
                          startSeconds: item.seconds,
                        })
                      }
                      onRemove={() => {
                        removeVideoProgress(item.video.video_id)
                        showToast('🗑️ Đã xóa khỏi lịch sử', 'info')
                      }}
                    />
                  ))}
                </div>
              )}

              {historyList.hasMore && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '24px 0 16px' }}>
                  <button
                    type="button"
                    className="tv-btn primary"
                    onClick={historyList.showMore}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 24px',
                      borderRadius: 14,
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronDown size={17} />
                    <span>Tải thêm ({historyList.remaining > 12 ? '+12 video' : `còn ${historyList.remaining}`})</span>
                  </button>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Đang hiển thị {Math.min(historyList.visibleCount, historyVideos.length)} trên tổng số {historyVideos.length} video
                  </span>
                </div>
              )}
              <div ref={historyList.sentinel} style={{ height: 20 }} />
            </>
          ) : viewMode === 'channel' && !search.trim() ? (
            /* CHẾ ĐỘ XEM THEO KÊNH */
            <>
              <div className="tv-creators-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {filteredChannels.slice(0, channelList.visibleCount).map((channel) => {
                  const watchedPct = channel.videoCount > 0 ? Math.round((channel.watchedCount / channel.videoCount) * 100) : 0

                  return (
                    <div
                      key={channel.id}
                      className="tv-creator-card channel-card-deletable"
                      onClick={() => setSelectedChannel(channel)}
                      style={{
                        position: 'relative',
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 16,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Ảnh bìa kênh */}
                      <div style={{ position: 'relative', height: 120, background: 'var(--border)', overflow: 'hidden' }}>
                        {channel.cover ? (
                          <img src={channel.cover} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(168, 85, 247, 0.15))' }}>
                            <Youtube size={36} color="var(--rose, #f43f5e)" />
                          </div>
                        )}
                        {/* Badge Thể loại của Kênh (Bấm vào để đổi thể loại) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingChannelCategory(channel)
                          }}
                          title="Nhấn để đổi thể loại cho kênh này"
                          style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            padding: '4px 10px',
                            borderRadius: 99,
                            background: 'rgba(0, 0, 0, 0.72)',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            zIndex: 2,
                          }}
                        >
                          <span>{channel.category || 'Khác'}</span>
                          <Edit3 size={10} style={{ opacity: 0.8 }} />
                        </button>

                        {/* Nút xóa kênh */}
                        <button
                          type="button"
                          className="channel-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDeleteChannel(channel)
                          }}
                          title="Xóa kênh này"
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: 'rgba(220, 38, 38, 0.85)',
                            color: '#ffffff',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 3,
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>

                        <div
                          style={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            padding: '3px 8px',
                            borderRadius: 8,
                            background: 'rgba(0, 0, 0, 0.75)',
                            color: '#fff',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          {channel.videoCount} video
                        </div>
                      </div>

                      {/* Thông tin kênh */}
                      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px', lineHeight: 1.3 }}>
                            {channel.creator_name}
                          </h3>
                        </div>

                        {/* Tiến độ đã xem */}
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: 4, color: 'var(--text-muted)' }}>
                            <span>Đã xem {channel.watchedCount}/{channel.videoCount}</span>
                            <span style={{ fontWeight: 800, color: watchedPct >= 100 ? 'var(--emerald)' : 'var(--primary)' }}>{watchedPct}%</span>
                          </div>
                          <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${watchedPct}%`, height: '100%', background: watchedPct >= 100 ? 'var(--emerald)' : 'linear-gradient(90deg, #f43f5e, #be123c)', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Nút tải thêm kênh */}
              {channelList.hasMore && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '24px 0 16px' }}>
                  <button
                    type="button"
                    className="tv-btn primary"
                    onClick={channelList.showMore}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 22px',
                      borderRadius: 14,
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronDown size={17} />
                    <span>Tải thêm kênh ({channelList.remaining > 12 ? '+12 kênh' : `còn ${channelList.remaining}`})</span>
                  </button>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Đang hiển thị {Math.min(channelList.visibleCount, filteredChannels.length)} trên tổng số {filteredChannels.length} kênh
                  </span>
                </div>
              )}
              <div ref={channelList.sentinel} style={{ height: 20 }} />
            </>
          ) : (
            /* CHẾ ĐỘ XEM THEO DANH SÁCH VIDEO */
            <>
              <div className="yt-grid">
                {filteredSavedVideos.slice(0, videoList.visibleCount).map((video) => (
                  <YoutubeVideoCard
                    key={video.id}
                    video={video}
                    watched={watchedSet.has(video.video_id)}
                    inProgress={inProgressSet.has(video.video_id)}
                    progress={progressMap[video.video_id]}
                    onToggleWatched={() => void handleToggleWatched(video)}
                    onOpen={() => navigate(`${watchBasePath}/watch/${video.video_id}`, { state: { from: watchBasePath, fromLabel: isShorts ? 'YouTube Shorts' : 'YouTube' } })}
                    onPlayMini={() =>
                      playInMini({
                        videoId: video.video_id,
                        title: video.title,
                        channelName: video.creator_name,
                        thumbnail: video.thumbnail,
                        startSeconds: progressMap[video.video_id]?.seconds,
                      })
                    }
                  />
                ))}
              </div>

              {/* NÚT TẢI THÊM VIDEO */}
              {videoList.hasMore ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '24px 0 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="tv-btn primary"
                      onClick={videoList.showMore}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 24px',
                        borderRadius: 14,
                        fontSize: '0.86rem',
                        fontWeight: 700,
                        boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)',
                        cursor: 'pointer',
                      }}
                    >
                      <ChevronDown size={17} />
                      <span>Tải thêm video ({videoList.remaining > 12 ? '+12 video' : `còn ${videoList.remaining}`})</span>
                    </button>

                    {videoList.remaining > 12 && (
                      <button
                        type="button"
                        className="tv-btn"
                        onClick={videoList.showAll}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 14,
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          background: 'var(--card-bg)',
                          border: '1px solid var(--card-border)',
                          cursor: 'pointer',
                        }}
                      >
                        Hiện tất cả ({filteredSavedVideos.length})
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Đang hiển thị {Math.min(videoList.visibleCount, filteredSavedVideos.length)} trên tổng số {filteredSavedVideos.length} video
                  </span>
                </div>
              ) : (
                filteredSavedVideos.length > 12 && (
                  <div style={{ textAlign: 'center', margin: '24px 0 16px', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                    Đã hiển thị toàn bộ {filteredSavedVideos.length} video.
                  </div>
                )
              )}
              <div ref={videoList.sentinel} style={{ height: 20 }} />
            </>
          )}
        </>
      )}

      {/* MODAL THÊM KÊNH / VIDEO (tự phân biệt link) */}
      {addOpen && (
        <AddYoutubeModal
          initialUrl={sharedUrl}
          customCategories={customCategories}
          categoryTagMap={categoryTagMap}
          onClose={() => setAddOpen(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
          onAddCustomCategory={handleAddCustomCategory}
          onAddTagToCategory={handleAddTagToCategory}
        />
      )}

      {/* MODAL CÀO KÊNH THEO THỜI GIAN & CHỌN KÊNH */}
      {crawlChannelsModalOpen && (
        <YoutubeCrawlModal
          isOpen={crawlChannelsModalOpen}
          onClose={() => setCrawlChannelsModalOpen(false)}
          channels={channels}
        />
      )}

      {/* TIẾN TRÌNH NỀN VÀ BÁO CÁO CÀO YOUTUBE */}
      <GlobalYoutubeCrawlerWatcher onFinished={() => setReloadKey((k) => k + 1)} />

      {/* MODAL ĐỔI THỂ LOẠI & TAG CHO KÊNH */}
      {editingChannelCategory && (
        <ChannelCategoryModal
          channelName={editingChannelCategory.creator_name}
          currentCategory={editingChannelCategory.category}
          currentTag={editingChannelCategory.tag}
          customCategories={customCategories}
          categoryTagMap={categoryTagMap}
          onSaveCategoryAndTag={(newCat, newTag) => {
            const key = editingChannelCategory.creator_id || editingChannelCategory.creator_name || editingChannelCategory.id
            void handleChangeChannelCategoryAndTag(key, newCat, newTag)
          }}
          onAddCustomCategory={handleAddCustomCategory}
          onUpdateCustomCategory={handleUpdateCustomCategory}
          onDeleteCustomCategory={handleDeleteCustomCategory}
          onAddTagToCategory={handleAddTagToCategory}
          onUpdateTagInCategory={handleUpdateTagInCategory}
          onDeleteTagFromCategory={handleDeleteTagFromCategory}
          onClose={() => setEditingChannelCategory(null)}
        />
      )}

      {/* MODAL TẠO THỂ LOẠI MỚI TỪ THANH TAB */}
      {showAddCategoryModal && (
        <QuickAddCategoryModal
          customCategories={customCategories}
          categoryTagMap={categoryTagMap}
          categoryStats={categoryTabStats}
          onAddCustomCategory={async (name, icon) => {
            const created = await handleAddCustomCategory(name, icon)
            if (created) {
              setActiveCategoryTab(created)
              setShowAddCategoryModal(false)
            }
          }}
          onUpdateCustomCategory={handleUpdateCustomCategory}
          onDeleteCustomCategory={handleDeleteCustomCategory}
          onAddTagToCategory={handleAddTagToCategory}
          onUpdateTagInCategory={handleUpdateTagInCategory}
          onDeleteTagFromCategory={handleDeleteTagFromCategory}
          onClose={() => setShowAddCategoryModal(false)}
        />
      )}

      {/* MODAL QUẢN LÝ & THÊM TAG NHANH CHO THỂ LOẠI ĐANG MỞ */}
      {quickAddTagCategory && (
        <QuickAddTagModal
          category={quickAddTagCategory}
          tags={categoryTagMap[quickAddTagCategory] || []}
          onAddTag={handleAddTagToCategory}
          onUpdateTag={handleUpdateTagInCategory}
          onDeleteTag={handleDeleteTagFromCategory}
          onClose={() => setQuickAddTagCategory(null)}
        />
      )}
    </section>
  )
}

const QUICK_EMOJIS = ['🏷️', '🎧', '🎵', '🎮', '🍲', '✈️', '💄', '⚽', '📚', '💡', '🎬', '💼', '🚗', '🎨', '🐾', '📻', '💪', '🔥']

/** Modal quản lý & thêm tag nhanh cho thể loại đang chọn */
function QuickAddTagModal({
  category,
  tags = [],
  onAddTag,
  onUpdateTag,
  onDeleteTag,
  onClose,
}: {
  category: string
  tags: string[]
  onAddTag: (category: string, tag: string) => Promise<string | undefined>
  onUpdateTag: (category: string, oldTag: string, newTag: string) => Promise<string | undefined>
  onDeleteTag: (category: string, tag: string) => Promise<void>
  onClose: () => void
}) {
  const [newTagInput, setNewTagInput] = useState('')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editingTagInput, setEditingTagInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagInput.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onAddTag(category, newTagInput.trim())
      setNewTagInput('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveEdit = async (oldTag: string) => {
    if (!editingTagInput.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onUpdateTag(category, oldTag, editingTagInput.trim())
      setEditingTag(null)
      setEditingTagInput('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal title={`🏷️ Quản lý Tags cho mục "${category}"`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
          Thêm hoặc quản lý các tag con riêng cho thể loại <strong>{category}</strong> (ví dụ: Naruto, Luffy, Lập trình...):
        </p>

        {/* Form thêm tag mới */}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>#</span>
            <input
              type="text"
              placeholder="Nhập tên tag mới (vd: Naruto, Luffy)..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '9px 12px 9px 24px',
                borderRadius: 10,
                border: '1px solid var(--card-border)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.86rem',
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!newTagInput.trim() || isSubmitting}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              background: newTagInput.trim() ? 'var(--primary)' : 'var(--card-border)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: newTagInput.trim() ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={14} /> Thêm tag
          </button>
        </form>

        {/* Danh sách các tag hiện có */}
        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 10 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
            Danh sách tags hiện có ({tags.length}):
          </div>
          {tags.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0', textAlign: 'center' }}>
              Chưa có tag nào trong thể loại này. Hãy nhập tag mới ở trên!
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {tags.map((tag) => {
                const isEditing = editingTag === tag
                if (isEditing) {
                  return (
                    <div key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(168, 85, 247, 0.15)', border: '1px solid #a855f7', padding: '4px 6px', borderRadius: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a855f7' }}>#</span>
                      <input
                        type="text"
                        value={editingTagInput}
                        onChange={(e) => setEditingTagInput(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSaveEdit(tag)
                          if (e.key === 'Escape') setEditingTag(null)
                        }}
                        style={{
                          padding: '3px 6px',
                          borderRadius: 6,
                          border: '1px solid var(--card-border)',
                          background: 'var(--card-bg)',
                          color: 'var(--text-main)',
                          fontSize: '0.78rem',
                          outline: 'none',
                          width: 100,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(tag)}
                        style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 2 }}
                        title="Lưu"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTag(null)}
                        style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                        title="Hủy"
                      >
                        ✕
                      </button>
                    </div>
                  )
                }

                return (
                  <div
                    key={tag}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      borderRadius: 8,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                    }}
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTag(tag)
                        setEditingTagInput(tag)
                      }}
                      style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 1, opacity: 0.7 }}
                      title="Sửa tên tag"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteTag(category, tag)}
                      style={{ border: 'none', background: 'none', color: 'var(--rose, #ef4444)', cursor: 'pointer', padding: 1, opacity: 0.7 }}
                      title="Xóa tag"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            type="button"
            className="tv-btn primary"
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 10, fontSize: '0.82rem' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Modal đổi thể loại & Tag cho kênh hoặc tạo mới thể loại lưu Supabase */
function ChannelCategoryModal({
  channelName,
  currentCategory,
  currentTag,
  customCategories,
  categoryTagMap,
  onSaveCategoryAndTag,
  onAddCustomCategory,
  onUpdateCustomCategory,
  onDeleteCustomCategory,
  onAddTagToCategory,
  onUpdateTagInCategory: _onUpdateTagInCategory,
  onDeleteTagFromCategory,
  onClose,
}: {
  channelName: string
  currentCategory: string
  currentTag?: string
  customCategories: CustomCategoryItem[]
  categoryTagMap: CategoryTagMap
  onSaveCategoryAndTag: (category: string, tag?: string | null) => void
  onAddCustomCategory: (label: string, icon?: string) => Promise<string | undefined>
  onUpdateCustomCategory: (catId: string, newLabel: string, icon?: string) => Promise<string | undefined>
  onDeleteCustomCategory: (id: string) => Promise<void>
  onAddTagToCategory: (category: string, tag: string) => Promise<string | undefined>
  onUpdateTagInCategory: (category: string, oldTag: string, newTag: string) => Promise<string | undefined>
  onDeleteTagFromCategory: (category: string, tag: string) => Promise<void>
  onClose: () => void
}) {
  const [selectedCat, setSelectedCat] = useState(currentCategory || 'Review phim')
  const [selectedTag, setSelectedTag] = useState<string | null>(currentTag || null)
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [editingCat, setEditingCat] = useState<CustomCategoryItem | null>(null)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('🏷️')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentCategoryTags = categoryTagMap[selectedCat] || []

  const startEdit = (cat: CustomCategoryItem) => {
    setEditingCat(cat)
    setNewCategoryInput(cat.label)
    setSelectedEmoji(cat.icon || '🏷️')
  }

  const cancelEdit = () => {
    setEditingCat(null)
    setNewCategoryInput('')
    setSelectedEmoji('🏷️')
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryInput.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      if (editingCat) {
        const updated = await onUpdateCustomCategory(editingCat.id, newCategoryInput.trim(), selectedEmoji)
        if (updated) {
          if (selectedCat === editingCat.label) {
            setSelectedCat(updated)
          }
          cancelEdit()
        }
      } else {
        const created = await onAddCustomCategory(newCategoryInput.trim(), selectedEmoji)
        if (created) {
          setSelectedCat(created)
          setNewCategoryInput('')
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagInput.trim() || !selectedCat) return
    const created = await onAddTagToCategory(selectedCat, newTagInput.trim())
    if (created) {
      setSelectedTag(created)
      setNewTagInput('')
      setIsAddingTag(false)
    }
  }

  const allItems = customCategories.map((c) => ({ ...c, isCustom: true }))

  return (
    <Modal title={`🏷️ Thể loại & Tag cho: ${channelName}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* KHU VỰC TẠO HOẶC SỬA THỂ LOẠI */}
        <div style={{
          background: editingCat ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-subtle, rgba(59, 130, 246, 0.05))',
          padding: '12px 14px',
          borderRadius: 14,
          border: `1px solid ${editingCat ? 'rgba(168, 85, 247, 0.35)' : 'rgba(59, 130, 246, 0.2)'}`,
          transition: 'all 0.2s ease',
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {editingCat ? (
                <>
                  <Edit3 size={15} style={{ color: 'var(--purple, #a855f7)' }} />
                  <span>✏️ Chỉnh sửa thể loại: <strong>{editingCat.label}</strong></span>
                </>
              ) : (
                <>
                  <Plus size={15} style={{ color: 'var(--primary)' }} />
                  <span>➕ Tạo thể loại mới:</span>
                </>
              )}
            </div>
            {editingCat && (
              <button
                type="button"
                onClick={cancelEdit}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 6,
                }}
              >
                ✕ Hủy sửa
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6 }}>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedEmoji(emoji)}
                style={{
                  padding: '4px 7px',
                  borderRadius: 8,
                  border: `1px solid ${selectedEmoji === emoji ? (editingCat ? '#a855f7' : 'var(--primary)') : 'var(--card-border)'}`,
                  background: selectedEmoji === emoji ? (editingCat ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.18)') : 'var(--card-bg)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              type="text"
              placeholder="Nhập tên thể loại (vd: Anime, Sách nói, Nấu ăn...)"
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--card-border)',
                background: 'var(--card-bg)',
                color: 'var(--text-main)',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!newCategoryInput.trim() || isSubmitting}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background: newCategoryInput.trim() ? (editingCat ? '#9333ea' : 'var(--primary)') : 'var(--card-border)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: newCategoryInput.trim() ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap',
              }}
            >
              {editingCat ? (
                <>
                  <Edit3 size={14} /> Lưu thay đổi
                </>
              ) : (
                <>
                  <Plus size={14} /> Thêm & Chọn
                </>
              )}
            </button>
          </form>
        </div>

        {/* BƯỚC 1: CHỌN THỂ LOẠI */}
        <div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 8px', fontWeight: 700 }}>
            1. Chọn thể loại chính cho kênh:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, maxHeight: 180, overflowY: 'auto', padding: 2 }}>
            {allItems.map((cat) => {
              const isSelected = selectedCat === cat.label
              const isBeingEdited = editingCat?.id === cat.id
              return (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 10,
                    border: `1px solid ${isBeingEdited ? '#a855f7' : isSelected ? 'var(--primary)' : 'var(--card-border)'}`,
                    background: isBeingEdited ? 'rgba(168, 85, 247, 0.12)' : isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg)',
                    transition: 'all 0.15s ease',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCat(cat.label)
                      // Reset tag nếu tag cũ không thuộc cat mới
                      const newCatTags = categoryTagMap[cat.label] || []
                      if (selectedTag && !newCatTags.includes(selectedTag)) {
                        setSelectedTag(null)
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      textAlign: 'left',
                      minWidth: 0,
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
                    {isSelected && <Check size={13} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  </button>

                  {cat.isCustom && (
                    <div style={{ display: 'flex', alignItems: 'center', paddingRight: 4 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEdit(cat as CustomCategoryItem)
                        }}
                        title="Sửa thể loại này"
                        style={{ padding: '4px', border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer' }}
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (editingCat?.id === cat.id) cancelEdit()
                          void onDeleteCustomCategory(cat.id)
                        }}
                        title="Xoá thể loại này"
                        style={{ padding: '4px', border: 'none', background: 'transparent', color: 'var(--rose, #ef4444)', cursor: 'pointer' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* BƯỚC 2: CHỌN HOẶC THÊM TAG CON THUỘC THỂ LOẠI ĐÃ CHỌN */}
        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, fontWeight: 700 }}>
              2. Chọn Tag con thuộc "{selectedCat}" (tùy chọn):
            </p>
            <button
              type="button"
              onClick={() => setIsAddingTag(!isAddingTag)}
              style={{
                border: 'none',
                background: 'none',
                color: 'var(--primary)',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Plus size={13} /> Thêm tag mới
            </button>
          </div>

          {/* Ô nhập tạo tag mới */}
          {isAddingTag && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem' }}>#</span>
                <input
                  type="text"
                  placeholder={`Nhập tag mới cho "${selectedCat}" (vd: Naruto, Luffy)...`}
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleCreateTag()
                    }
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 22px',
                    borderRadius: 8,
                    border: '1px solid var(--card-border)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCreateTag()}
                disabled={!newTagInput.trim()}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Lưu tag
              </button>
            </div>
          )}

          {/* Danh sách các tag con */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                border: `1px solid ${selectedTag === null ? 'var(--primary)' : 'var(--card-border)'}`,
                background: selectedTag === null ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg)',
                color: selectedTag === null ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: selectedTag === null ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              (Không gắn tag)
            </button>

            {currentCategoryTags.map((tag) => {
              const isTagSelected = selectedTag === tag
              return (
                <div
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: 8,
                    border: `1px solid ${isTagSelected ? 'var(--primary)' : 'var(--card-border)'}`,
                    background: isTagSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--card-bg)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTag(isTagSelected ? null : tag)}
                    style={{
                      padding: '5px 8px',
                      border: 'none',
                      background: 'transparent',
                      color: isTagSelected ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '0.78rem',
                      fontWeight: isTagSelected ? 800 : 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>#{tag}</span>
                    {isTagSelected && <Check size={12} />}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void onDeleteTagFromCategory(selectedCat, tag)
                      if (selectedTag === tag) setSelectedTag(null)
                    }}
                    style={{
                      padding: '4px 6px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      opacity: 0.6,
                    }}
                    title="Xóa tag này"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* NÚT LƯU THỂ LOẠI & TAG */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6, borderTop: '1px solid var(--card-border)', paddingTop: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: '1px solid var(--card-border)',
              background: 'var(--card-bg)',
              color: 'var(--text-main)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={() => onSaveCategoryAndTag(selectedCat, selectedTag)}
            style={{
              padding: '9px 22px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontSize: '0.84rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Check size={15} /> Lưu Thể loại & Tag
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Modal thêm & quản lý thể loại + tags từ thanh Tab */
function QuickAddCategoryModal({
  customCategories = [],
  categoryTagMap = {},
  categoryStats = {},
  onAddCustomCategory,
  onUpdateCustomCategory,
  onDeleteCustomCategory,
  onAddTagToCategory,
  onUpdateTagInCategory,
  onDeleteTagFromCategory,
  onClose,
}: {
  customCategories?: CustomCategoryItem[]
  categoryTagMap?: CategoryTagMap
  categoryStats?: Record<string, { channels: number; videos: number }>
  onAddCustomCategory: (label: string, icon?: string) => Promise<void>
  onUpdateCustomCategory?: (catId: string, newLabel: string, icon?: string) => Promise<string | undefined>
  onDeleteCustomCategory?: (id: string) => Promise<void>
  onAddTagToCategory?: (category: string, tag: string) => Promise<string | undefined>
  onUpdateTagInCategory?: (category: string, oldTag: string, newTag: string) => Promise<string | undefined>
  onDeleteTagFromCategory?: (category: string, tag: string) => Promise<void>
  onClose: () => void
}) {
  const [editingCat, setEditingCat] = useState<CustomCategoryItem | null>(null)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('🏷️')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [managingTagsForCat, setManagingTagsForCat] = useState<string | null>(null)

  const startEdit = (cat: CustomCategoryItem) => {
    setEditingCat(cat)
    setNewCategoryInput(cat.label)
    setSelectedEmoji(cat.icon || '🏷️')
  }

  const cancelEdit = () => {
    setEditingCat(null)
    setNewCategoryInput('')
    setSelectedEmoji('🏷️')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryInput.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      if (editingCat && onUpdateCustomCategory) {
        await onUpdateCustomCategory(editingCat.id, newCategoryInput.trim(), selectedEmoji)
        cancelEdit()
      } else {
        await onAddCustomCategory(newCategoryInput.trim(), selectedEmoji)
        setNewCategoryInput('')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal title={editingCat ? `✏️ Sửa thể loại: ${editingCat.label}` : "✨ Quản lý Thể loại & Tags"} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
          {editingCat
            ? 'Thay đổi biểu tượng hoặc đổi tên thể loại. Dữ liệu sẽ được tự động đồng bộ lên Supabase:'
            : 'Tạo thể loại mới để phân nhóm video và kênh YouTube. Mỗi thể loại có thể tạo thêm nhiều Tag con:'}
        </p>

        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
            1. Chọn biểu tượng Emoji:
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 90, overflowY: 'auto' }}>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedEmoji(emoji)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${selectedEmoji === emoji ? (editingCat ? '#a855f7' : 'var(--primary)') : 'var(--card-border)'}`,
                  background: selectedEmoji === emoji ? (editingCat ? 'rgba(168, 85, 247, 0.18)' : 'rgba(59, 130, 246, 0.18)') : 'var(--card-bg)',
                  fontSize: '1.05rem',
                  cursor: 'pointer',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
              2. Tên thể loại:
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>{selectedEmoji}</span>
              <input
                type="text"
                placeholder="Ví dụ: Anime, Sách nói, Âm nhạc, Nấu ăn, Du lịch..."
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                autoFocus
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--card-border)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            {editingCat ? (
              <button
                type="button"
                onClick={cancelEdit}
                style={{
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✕ Hủy sửa
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            )}
            <button
              type="submit"
              disabled={!newCategoryInput.trim() || isSubmitting}
              style={{
                padding: '9px 20px',
                borderRadius: 10,
                border: 'none',
                background: newCategoryInput.trim() ? (editingCat ? '#9333ea' : 'var(--primary)') : 'var(--card-border)',
                color: '#fff',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: newCategoryInput.trim() ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {editingCat ? (
                <>
                  <Edit3 size={15} /> Lưu sửa đổi
                </>
              ) : (
                <>
                  <Plus size={15} /> Tạo thể loại
                </>
              )}
            </button>
          </div>
        </form>

        {/* DANH SÁCH CÁC THỂ LOẠI (KÈM NÚT QUẢN LÝ TAGS) */}
        {customCategories.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
              Danh sách thể loại ({customCategories.length}) & Quản lý Tags con:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {customCategories.map((cat) => {
                const tags = categoryTagMap[cat.label] || []
                const stat = categoryStats[cat.label]
                const videoCount = stat?.videos ?? 0
                return (
                  <div
                    key={cat.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: editingCat?.id === cat.id ? 'rgba(168, 85, 247, 0.15)' : 'var(--card-bg)',
                      border: `1px solid ${editingCat?.id === cat.id ? '#a855f7' : 'var(--card-border)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', minWidth: 0 }}>
                      <span>{cat.icon}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.label}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        ({videoCount} video)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setManagingTagsForCat(cat.label)}
                        title={`Quản lý Tags con (${tags.length})`}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 6,
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--primary)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <Tag size={12} />
                        <span>({tags.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        title="Sửa thể loại này"
                        style={{
                          padding: '5px 7px',
                          borderRadius: 6,
                          border: '1px solid var(--card-border)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Edit3 size={13} />
                      </button>

                      {onDeleteCustomCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            if (editingCat?.id === cat.id) cancelEdit()
                            void onDeleteCustomCategory(cat.id)
                          }}
                          title="Xoá thể loại này"
                          style={{
                            padding: '5px 7px',
                            borderRadius: 6,
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            background: 'rgba(244, 63, 94, 0.1)',
                            color: 'var(--rose, #f43f5e)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal quản lý tags cho thể loại cụ thể */}
      {managingTagsForCat && onAddTagToCategory && onUpdateTagInCategory && onDeleteTagFromCategory && (
        <QuickAddTagModal
          category={managingTagsForCat}
          tags={categoryTagMap[managingTagsForCat] || []}
          onAddTag={onAddTagToCategory}
          onUpdateTag={onUpdateTagInCategory}
          onDeleteTag={onDeleteTagFromCategory}
          onClose={() => setManagingTagsForCat(null)}
        />
      )}
    </Modal>
  )
}

/** Màn hình xem chi tiết 1 Kênh */
function ChannelDetailView({
  channel,
  isShorts = false,
  onBack,
  onChangeCategoryAndTag,
  customCategories,
  categoryTagMap,
  onAddCustomCategory,
  onUpdateCustomCategory,
  onDeleteCustomCategory,
  onAddTagToCategory,
  onUpdateTagInCategory,
  onDeleteTagFromCategory,
}: {
  channel: ChannelItem
  isShorts?: boolean
  onBack: () => void
  onChangeCategoryAndTag: (cat: string, tag?: string | null) => void
  customCategories: CustomCategoryItem[]
  categoryTagMap: CategoryTagMap
  onAddCustomCategory: (label: string, icon?: string) => Promise<string | undefined>
  onUpdateCustomCategory: (catId: string, newLabel: string, icon?: string) => Promise<string | undefined>
  onDeleteCustomCategory: (id: string) => Promise<void>
  onAddTagToCategory: (category: string, tag: string) => Promise<string | undefined>
  onUpdateTagInCategory: (category: string, oldTag: string, newTag: string) => Promise<string | undefined>
  onDeleteTagFromCategory: (category: string, tag: string) => Promise<void>
}) {
  useHideHeader(true)
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [inProgress, setInProgress] = useState<Set<string>>(new Set())
  const [, setStatusMap] = useState<Map<string, VideoStatus>>(new Map())
  const [, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [search] = useState('')
  const [filterMode, _setFilterMode] = useState<'all' | 'unwatched' | 'in_progress' | 'watched'>('all')
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const initialStartRef = useRef<Record<string, number>>({})
  const progressMap = useVideoProgressMap()
  const { playInMini } = useVideoMiniPlayer()

  useVideoStatusListener(() => {
    const sourceType: 'tvshow' | 'review' = channel.sourceTable === 'review' ? 'review' : 'tvshow'
    const sets = getVideoStatusSets(sourceType)
    setWatched(sets.watchedSet)
    setInProgress(sets.inProgressSet)
    setStatusMap(sets.statusMap)
  })

  useEffect(() => {
    void (async () => {
      const table = channel.sourceTable === 'review' ? 'review_videos' : 'tvshow_videos'
      const watchedTable = channel.sourceTable === 'review' ? 'review_watched' : 'tvshow_watched'
      const sourceType: 'tvshow' | 'review' = channel.sourceTable === 'review' ? 'review' : 'tvshow'

      let query = supabase
        ?.from(table)
        .select('id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at,duration')
        .is('unavailable_at', null)

      if (channel.id === 'manual') {
        query = query?.eq('creator_id', 'manual')
      } else if (channel.creator_id) {
        query = query?.or(`creator_id.eq.${channel.creator_id},creator_name.eq.${channel.creator_name}`)
      } else {
        query = query?.eq('creator_name', channel.creator_name)
      }

      const watchedRes = await supabase?.from(watchedTable).select('video_id')
      const watchedIds = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((r) => r.video_id))
      const sets = getVideoStatusSets(sourceType, watchedIds)

      const videoRes = await query?.order('part_number', { ascending: true, nullsFirst: false }).order('published_at', { ascending: false })
      const rawRows = ((videoRes?.data ?? []) as VideoRow[]).map(v => ({
        ...v,
        sourceType,
        duration: typeof v.duration === 'number' && v.duration > 0 ? v.duration : (progressMap[v.video_id]?.durationSeconds ?? v.duration),
      }))
      const rows = isShorts
        ? rawRows.filter((r) => isShortVideo(r, progressMap))
        : rawRows.filter((r) => !isShortVideo(r, progressMap))

      setVideos(rows)
      setWatched(sets.watchedSet)
      setInProgress(sets.inProgressSet)
      setStatusMap(sets.statusMap)

      const firstUnwatched = rows.find((r) => !sets.watchedSet.has(r.video_id))
      setPlayingId(firstUnwatched ? firstUnwatched.video_id : (rows[0]?.video_id ?? null))
      setLoading(false)
    })()
  }, [channel, isShorts])

  const filteredVideos = useMemo(() => {
    let res = [...videos]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      res = res.filter((v) => v.title.toLowerCase().includes(q))
    }
    if (filterMode === 'unwatched') {
      res = res.filter((v) => !watched.has(v.video_id) && !inProgress.has(v.video_id))
    } else if (filterMode === 'in_progress') {
      res = res.filter((v) => inProgress.has(v.video_id))
    } else if (filterMode === 'watched') {
      res = res.filter((v) => watched.has(v.video_id))
    }
    return res
  }, [videos, search, filterMode, watched, inProgress])

  const channelVideoList = useIncrementalList(filteredVideos.length, 20, `${search}|${filterMode}`)

  const currentVideo = videos.find((v) => v.video_id === playingId) || videos[0]
  // Tự ghi "đang xem" + % đã xem; lưu ngay khi thu nhỏ hoặc tắt app.
  const player = useYouTubeProgress(iframeRef, {
    videoId: currentVideo?.video_id ?? null,
    title: currentVideo?.title,
    channelName: currentVideo?.creator_name ?? undefined,
    thumbnail: currentVideo?.thumbnail,
  })
  // Chỉ lấy start time 1 lần khi bắt đầu phát video (không phụ thuộc vào progressMap thay đổi liên tục)
  const vId = currentVideo?.video_id
  if (vId && initialStartRef.current[vId] === undefined) {
    initialStartRef.current[vId] = Math.floor(progressMap[vId]?.seconds ?? 0)
  }
  const start = vId ? (initialStartRef.current[vId] ?? 0) : 0

  const embedSrc = useMemo(() => {
    if (!currentVideo) return ''
    const embedBase = currentVideo.embed_url || (currentVideo.video_id ? `https://www.youtube.com/embed/${currentVideo.video_id}` : '')
    return embedBase
      ? `${embedBase}${embedBase.includes('?') ? '&' : '?'}autoplay=1&rel=0&enablejsapi=1&playsinline=1${
          start > 3 ? `&start=${start}` : ''
        }`
      : ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.video_id, currentVideo?.embed_url])

  return (
    <div className="tv-detail">
      {/* Header Top Bar */}
      <div className="tv-detail-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="tv-back-circle-btn" onClick={onBack} aria-label="Quay lại">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>{channel.creator_name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                style={{
                  padding: '3px 9px',
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>🏷️ {channel.category || 'Khác'}</span>
                {channel.tag && (
                  <span style={{ background: 'rgba(59, 130, 246, 0.25)', padding: '1px 6px', borderRadius: 6, fontSize: '0.72rem' }}>
                    #{channel.tag}
                  </span>
                )}
                <Edit3 size={11} />
              </button>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{videos.length} video</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="tv-btn"
          onClick={() => {
            if (!currentVideo) return
            playInMini({
              videoId: currentVideo.video_id,
              title: currentVideo.title,
              channelName: currentVideo.creator_name,
              thumbnail: currentVideo.thumbnail,
              startSeconds: progressMap[currentVideo.video_id]?.seconds,
            })
          }}
          disabled={!currentVideo}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 700 }}
          title="Phát ở khung nhỏ, đi tab khác vẫn chạy"
        >
          <PictureInPicture2 size={14} /> Phát nền
        </button>
        {currentVideo && (
          <WatchTogetherButton
            className="tv-btn"
            size={14}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 700 }}
            item={{
              kind: 'VIDEO',
              refId: currentVideo.video_id,
              title: currentVideo.title,
              subtitle: currentVideo.creator_name ?? undefined,
              thumbnail: currentVideo.thumbnail,
              url: currentVideo.canonical_url,
            }}
          />
        )}
      </div>

      {/* Trình phát Video */}
      {currentVideo && (
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' }}>
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title={currentVideo.title}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <DualSubtitles player={player} videoId={currentVideo.video_id} />
        </div>
      )}

      {/* Danh sách video trong kênh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>Danh sách video ({filteredVideos.length})</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
        {filteredVideos.slice(0, channelVideoList.visibleCount).map((v) => {
          const isPlaying = v.video_id === playingId
          const isWatched = watched.has(v.video_id)
          return (
            <div
              key={v.id || v.video_id}
              onClick={() => setPlayingId(v.video_id)}
              style={{
                padding: 10,
                borderRadius: 12,
                border: `1px solid ${isPlaying ? 'var(--primary)' : 'var(--card-border)'}`,
                background: isPlaying ? 'rgba(59, 130, 246, 0.08)' : 'var(--card-bg)',
                cursor: 'pointer',
                display: 'flex',
                gap: 10,
              }}
            >
              <div style={{ position: 'relative', width: 90, height: 56, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {v.title}
                </div>
                {(() => {
                  const p = progressMap[v.video_id]
                  if (p) {
                    return (
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: p.status === 'COMPLETED' ? '#10b981' : '#f59e0b' }}>
                        {progressLabel(p)}
                      </span>
                    )
                  }
                  return isWatched ? <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 800 }}>✓ Đã xem hết</span> : null
                })()}
              </div>
            </div>
          )
        })}
        {channelVideoList.hasMore && (
          <button
            type="button"
            className="tv-btn"
            onClick={channelVideoList.showMore}
            style={{ padding: '8px 12px', fontSize: '0.76rem', fontWeight: 700, margin: '4px 0' }}
          >
            Tải thêm ({channelVideoList.remaining > 20 ? '+20 video' : `còn ${channelVideoList.remaining}`})
          </button>
        )}
        <div ref={channelVideoList.sentinel} style={{ height: 10 }} />
      </div>

      {showCategoryPicker && (
        <ChannelCategoryModal
          channelName={channel.creator_name}
          currentCategory={channel.category}
          currentTag={channel.tag}
          customCategories={customCategories}
          categoryTagMap={categoryTagMap}
          onSaveCategoryAndTag={(newCat, newTag) => {
            onChangeCategoryAndTag(newCat, newTag)
            setShowCategoryPicker(false)
          }}
          onAddCustomCategory={onAddCustomCategory}
          onUpdateCustomCategory={onUpdateCustomCategory}
          onDeleteCustomCategory={onDeleteCustomCategory}
          onAddTagToCategory={onAddTagToCategory}
          onUpdateTagInCategory={onUpdateTagInCategory}
          onDeleteTagFromCategory={onDeleteTagFromCategory}
          onClose={() => setShowCategoryPicker(false)}
        />
      )}
    </div>
  )
}


/** Thời lượng kiểu YouTube: 12:34 hoặc 1:02:03. */
export function formatVideoDuration(sec: number | null | undefined): string {
  if (!sec || isNaN(Number(sec))) return ''
  const total = Math.floor(Number(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

/** "3 ngày trước" — dòng phụ dưới tên kênh cho giống YouTube. */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ''
  const days = Math.floor((now.getTime() - then) / 86400000)
  if (days < 1) return 'Hôm nay'
  if (days < 7) return `${days} ngày trước`
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`
  return `${Math.floor(days / 365)} năm trước`
}

function YoutubeVideoCard({
  video,
  watched,
  inProgress,
  progress,
  onToggleWatched,
  onPlayMini,
  onOpen,
}: {
  video: VideoRow
  watched: boolean
  inProgress: boolean
  progress?: { percent: number; status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'; seconds?: number }
  onToggleWatched: () => void
  onPlayMini: () => void
  onOpen: () => void
}) {
  const percent = progress?.percent ?? (watched ? 100 : 0)
  const meta = [video.creator_name || 'Kênh YouTube', timeAgo(video.published_at)].filter(Boolean).join(' · ')
  const audioPlayer = useOptionalAudioPlayer()
  const { isSaved: isAudioSaved, sizeLabel: audioSizeLabel } = useOfflineAudioState(video.video_id)
  const [audioLoading, setAudioLoading] = useState(false)
  const { showToast } = useToast()

  const handleAudioAction = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!audioPlayer) return
    setAudioLoading(true)
    try {
      await playYoutubeAsAudio(
        {
          videoId: video.video_id,
          title: video.title,
          channelName: video.creator_name,
          thumbnail: video.thumbnail,
          duration: video.duration,
        },
        audioPlayer,
        {
          showToast: (msg, type) => showToast(msg, type),
        }
      )
    } finally {
      setAudioLoading(false)
    }
  }

  return (
    <article className="yt-card">
      <div
        className="yt-thumb"
        role="button"
        tabIndex={0}
        aria-label={`Xem ${video.title}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
      >
        {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" />}
        <span className="yt-play" title="Xem video">
          <Play size={24} fill="#fff" />
        </span>
        {video.duration ? <span className="yt-duration">{formatVideoDuration(video.duration)}</span> : null}

        {/* Badge tiến độ % nổi bật */}
        {(percent > 0 || watched) && (
          <div className={`yt-progress-badge ${percent >= 90 || watched ? 'completed' : 'in-progress'}`}>
            {percent >= 90 || watched ? '✅ Đã xem' : `⏱️ ${percent}%`}
          </div>
        )}

        {percent > 0 && <span className="yt-seen-bar"><i style={{ width: `${Math.min(100, Math.max(5, percent))}%` }} /></span>}
      </div>

      <div className="yt-body">
        <span className="yt-avatar" aria-hidden>{(video.creator_name || 'Y').trim().charAt(0).toUpperCase()}</span>
        <div className="yt-text">
          <h3 className="yt-title" title={video.title} onClick={onOpen} style={{ cursor: 'pointer' }}>
            {video.title}
          </h3>
          <p className="yt-meta">{meta}</p>
          {(watched || inProgress || (progress && progress.percent > 0)) && (
            <div className="yt-card-progress-row">
              <div className="yt-card-progress-track">
                <div
                  className={`yt-card-progress-bar ${percent >= 90 || watched ? 'is-complete' : ''}`}
                  style={{ width: `${Math.min(100, Math.max(5, percent))}%` }}
                />
              </div>
              <span className={`yt-card-progress-text ${percent >= 90 || watched ? 'is-complete' : ''}`}>
                {percent >= 90 || watched ? 'Đã xem 100%' : `Đang xem ${percent}%`}
              </span>
            </div>
          )}
          <div className="yt-actions">
            <button
              type="button"
              className={`yt-action ${isAudioSaved ? 'on' : ''}`}
              onClick={handleAudioAction}
              disabled={audioLoading}
              title={isAudioSaved ? `Phát Audio (${audioSizeLabel})` : 'Chuyển thành Audio & Nghe'}
              style={isAudioSaved ? { background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', borderColor: 'rgba(6, 182, 212, 0.4)' } : undefined}
            >
              {isAudioSaved ? <Volume2 size={13} /> : <Headphones size={13} />}
              <span>{audioLoading ? 'Đang tải...' : isAudioSaved ? 'Audio' : 'Nghe Audio'}</span>
            </button>
            <button
              type="button"
              className="yt-action yt-action-pip"
              onClick={onPlayMini}
              title="Phát ở khung nhỏ, đi tab khác vẫn chạy"
            >
              <PictureInPicture2 size={13} className="yt-action-icon-pip" />
              <span>Phát nền</span>
            </button>
            <button
              type="button"
              className={`yt-action yt-action-watched ${watched ? 'on' : ''}`}
              onClick={onToggleWatched}
              title={watched ? 'Đánh dấu chưa xem' : 'Đánh dấu đã xem'}
            >
              {watched ? (
                <CheckCircle2 size={13} className="yt-action-icon-watched" />
              ) : (
                <Circle size={13} className="yt-action-icon-unwatched" />
              )}
              <span>{watched ? 'Đã xem' : 'Đánh dấu đã xem'}</span>
            </button>
            <WatchTogetherButton
              className="yt-action yt-action-together"
              size={13}
              item={{
                kind: 'VIDEO',
                refId: video.video_id,
                title: video.title,
                subtitle: video.creator_name ?? undefined,
                thumbnail: video.thumbnail,
                url: video.canonical_url,
              }}
            />
            <a
              className="yt-action yt-action-yt"
              href={video.canonical_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Mở trên YouTube"
            >
              <ExternalLink size={12} className="yt-action-icon-yt" />
              <span>YouTube</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

/** Thẻ Video hiển thị trong Tab Lịch Sử */
function HistoryVideoCard({
  item,
  onOpen,
  onPlayMini,
  onRemove,
}: {
  item: {
    video: VideoRow
    seconds: number
    percent: number
    status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
    updatedAt: string
  }
  onOpen: () => void
  onPlayMini: () => void
  onRemove: () => void
}) {
  const { video, updatedAt } = item
  const percent = item.percent > 0 ? item.percent : percentOf(item.seconds, video.duration)
  const isComplete = percent >= 90 || item.status === 'COMPLETED'
  const meta = [video.creator_name || 'YouTube', timeAgo(updatedAt)].filter(Boolean).join(' · ')
  const audioPlayer = useOptionalAudioPlayer()
  const { isSaved: isAudioSaved, sizeLabel: audioSizeLabel } = useOfflineAudioState(video.video_id)
  const [audioLoading, setAudioLoading] = useState(false)
  const { showToast } = useToast()

  const handleAudioAction = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!audioPlayer) return
    setAudioLoading(true)
    try {
      await playYoutubeAsAudio(
        {
          videoId: video.video_id,
          title: video.title,
          channelName: video.creator_name,
          thumbnail: video.thumbnail,
          duration: video.duration,
        },
        audioPlayer,
        {
          showToast: (msg, type) => showToast(msg, type),
        }
      )
    } finally {
      setAudioLoading(false)
    }
  }

  return (
    <article className="yt-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 10, overflow: 'hidden' }}>
      <div
        className="yt-thumb"
        role="button"
        tabIndex={0}
        aria-label={`Xem ${video.title}`}
        onClick={onOpen}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
      >
        {video.thumbnail ? (
          <img src={video.thumbnail} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="yt-thumb-placeholder">
            <Youtube size={36} />
          </div>
        )}

        <button
          type="button"
          className="yt-play-overlay"
          aria-label="Xem video"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          <Play size={26} fill="#fff" />
        </button>

        {/* Nút xóa khỏi lịch sử */}
        <button
          type="button"
          title="Xóa khỏi lịch sử"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'rgba(0, 0, 0, 0.75)',
            color: '#fff',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            zIndex: 3,
            transition: 'all 0.15s ease',
          }}
        >
          <Trash2 size={13} />
        </button>

        {/* Badge tiến độ % nổi bật */}
        <div className={`yt-progress-badge ${isComplete ? 'completed' : 'in-progress'}`}>
          {isComplete ? '✅ Đã xem' : `⏱️ Đang xem ${percent}%`}
        </div>

        {/* Thời lượng video */}
        {video.duration ? <span className="yt-duration">{formatVideoDuration(video.duration)}</span> : null}

        {/* Thanh tiến độ chân ảnh */}
        <div className="yt-progress-bar">
          <div
            className={`yt-progress-fill ${isComplete ? 'completed' : ''}`}
            style={{ width: `${Math.min(100, Math.max(percent > 0 ? 5 : 0, percent))}%` }}
          />
        </div>
      </div>

      <div className="yt-info" style={{ marginTop: 8 }}>
        <h3
          className="yt-title"
          title={video.title}
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}
          style={{ cursor: 'pointer' }}
        >
          {video.title}
        </h3>
        <p className="yt-meta">{meta}</p>

        {/* Hàng thanh tiến độ % chi tiết */}
        <div className="yt-card-progress-row">
          <div className="yt-card-progress-track">
            <div
              className={`yt-card-progress-bar ${isComplete ? 'is-complete' : ''}`}
              style={{ width: `${Math.min(100, Math.max(percent > 0 ? 5 : 0, percent))}%` }}
            />
          </div>
          <span className={`yt-card-progress-text ${isComplete ? 'is-complete' : ''}`}>
            {isComplete ? '100%' : `${percent}%`}
          </span>
        </div>

        <div className="yt-card-actions" style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="yt-card-btn primary"
            onClick={onOpen}
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <Play size={13} fill="#fff" /> Xem tiếp
          </button>

          <button
            type="button"
            className="yt-card-btn audio"
            disabled={audioLoading}
            onClick={handleAudioAction}
            title={isAudioSaved ? `Phát audio offline (${audioSizeLabel})` : 'Tải & Nghe YouTube Audio'}
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              background: isAudioSaved ? 'rgba(6, 182, 212, 0.15)' : 'var(--card-bg)',
              color: isAudioSaved ? '#06b6d4' : 'var(--text-main)',
              border: isAudioSaved ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid var(--card-border)',
              fontWeight: 600,
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            {audioLoading ? (
              <Loader2 size={13} className="tv-spin" />
            ) : isAudioSaved ? (
              <Volume2 size={13} />
            ) : (
              <Headphones size={13} />
            )}
            <span>{isAudioSaved ? 'Audio' : 'Nghe Audio'}</span>
          </button>

          <button
            type="button"
            className="yt-card-btn pip"
            onClick={onPlayMini}
            title="Phát ở khung nhỏ, không rời trang"
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              background: 'var(--card-bg)',
              color: 'var(--text-muted)',
              border: '1px solid var(--card-border)',
              fontWeight: 600,
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <PictureInPicture2 size={13} />
            <span>Phát nền</span>
          </button>
        </div>
      </div>
    </article>
  )
}
