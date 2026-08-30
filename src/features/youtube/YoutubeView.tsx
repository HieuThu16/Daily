import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, CheckCircle2, Circle, 
  ExternalLink, Play, Search, Video, 
  Youtube, 
  Check, 
  Loader2, LayoutGrid, 
  Edit3, Globe, BookmarkPlus, PictureInPicture2,
  Plus, Trash2, ChevronLeft, ChevronRight, ChevronDown, Shuffle, Clock, Tag,
  Flame, ArrowUpDown, Zap, Headphones, Volume2
} from 'lucide-react'
import { useOptionalAudioPlayer } from '../library/AudioPlayerContext'
import {
  useOfflineAudioState,
  downloadAndSaveYoutubeAudio,
  getOfflineAudioPlayUrl,
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
  progressLabel,
  useVideoProgressMap,
  useYouTubeProgress,
} from '../../lib/videoProgress'
import { WatchTogetherButton } from '../watch/WatchTogetherButton'
import { AddYoutubeModal } from './AddYoutubeModal'
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
export type YoutubeSortMode = 'date' | 'viewCount' | 'oldest'

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

/** Tự động đoán thể loại ban đầu của kênh dựa vào tên kênh hoặc nguồn gốc */
export function guessChannelCategory(name: string, sourceTable?: 'tvshow' | 'review'): string {
  const lower = (name || '').toLowerCase()
  if (sourceTable === 'review' || lower.includes('review') || lower.includes('phim') || lower.includes('movie') || lower.includes('cinema')) {
    return 'Review phim'
  }
  if (lower.includes('học') || lower.includes('web5ngay') || lower.includes('sách') || lower.includes('tri thức') || lower.includes('ted') || lower.includes('tư duy') || lower.includes('tiếng anh') || lower.includes('english')) {
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
  const dur = typeof v.duration === 'number' && v.duration > 0
    ? v.duration
    : (v.video_id && progressMap?.[v.video_id]?.durationSeconds ? progressMap[v.video_id]?.durationSeconds : undefined)

  if (typeof dur === 'number' && dur > 0) {
    return dur < 300
  }

  const title = (v.title || '').toLowerCase()
  const url = (v.canonical_url || '').toLowerCase()
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
  const [viewMode, setViewMode] = useState<'channel' | 'video'>('video')
  const [watchFilter, setWatchFilter] = useState<'all' | 'unwatched' | 'in_progress' | 'watched'>('all')
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random())
  
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

  // TÌM KIẾM YOUTUBE API (Tìm video đã có VÀ chưa có trong app)
  const [searchScope, setSearchScope] = useState<'all' | 'saved' | 'youtube'>('all')
  const [ytSearchResults, setYtSearchResults] = useState<YouTubeSearchResult[]>([])
  const [isSearchingYouTube, setIsSearchingYouTube] = useState(false)
  /** Token trang kế; null nghĩa là đã hết kết quả. */
  const [ytNextPage, setYtNextPage] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  /** Thứ tự kết quả; đổi là tìm lại vì YouTube xếp ở phía nó, không xếp tại chỗ. */
  const [ytOrder, setYtOrder] = useState<SearchOrder>('date')
  const [sortMode, setSortMode] = useState<YoutubeSortMode>('date')
  const [savingVideoId, setSavingVideoId] = useState<string | null>(null)

  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null)
  const [sharedUrl] = useState(() => new URLSearchParams(window.location.search).get('youtube') ?? '')
  const [addOpen, setAddOpen] = useState(Boolean(sharedUrl))
  const [syncingAll, setSyncingAll] = useState(false)
  const [editingChannelCategory, setEditingChannelCategory] = useState<ChannelItem | null>(null)
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  
  const progressMap = useVideoProgressMap()
  const { playInMini } = useVideoMiniPlayer()
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

  /** Cào video chưa có ở TẤT CẢ kênh đã thêm, rồi đưa video mới sang Xem chung. */
  const handleSyncAllChannels = async () => {
    if (syncingAll) return
    setSyncingAll(true)
    showToast('Đang cào video mới ở tất cả kênh…', 'info')
    try {
      const { data } = await supabase!.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Cần đăng nhập')
      // Cào cả chục kênh mất hơn chục giây; 3G/4G chập chờn là fetch ném
      // "Failed to fetch" trống trơn. Đặt hạn rõ ràng và dịch ra tiếng người.
      let res: Response
      try {
        res = await fetch('/api/cron-sync?scope=youtube', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(120_000),
        })
      } catch {
        throw new Error('Mất kết nối giữa chừng — kiểm tra mạng rồi thử lại')
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      const saved = (json.report ?? []).reduce((sum: number, r: any) => sum + (Number(r.saved) || 0), 0)
      showToast(saved > 0 ? `Đã thêm ${saved} video mới` : 'Không có video mới', saved > 0 ? 'success' : 'info')
      setReloadKey((k) => k + 1)
    } catch (err: any) {
      showToast(`Cào thất bại: ${err?.message ?? err}`, 'error')
    } finally {
      setSyncingAll(false)
    }
  }

  // 1 nút thêm (tự phân biệt kênh / video lẻ) + 1 nút cào toàn bộ kênh
  useHeaderActions([
    { label: 'Thêm kênh / video', icon: 'plus', onClick: () => setAddOpen(true) },
    { label: syncingAll ? 'Đang cào…' : 'Cào video mới tất cả kênh', icon: 'radio', onClick: () => void handleSyncAllChannels() },
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
    const updated = customCategories.filter((c) => c.id !== catId)
    setCustomCategories(updated)
    await saveAppSetting('youtube_custom_categories', updated)

    // Xóa tags của thể loại này
    if (categoryTagMap[target.label]) {
      const updatedCatTags = { ...categoryTagMap }
      delete updatedCatTags[target.label]
      setCategoryTagMap(updatedCatTags)
      void saveAppSetting('youtube_category_tags', updatedCatTags)
    }

    showToast(`Đã xoá thể loại "${target.label}"`, 'info')
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
    const updatedCatMap = { ...channelCategoryMap, [channelKey]: newCategory }
    setChannelCategoryMap(updatedCatMap)

    const updatedTagMap = { ...channelTagMap }
    if (newTag) {
      updatedTagMap[channelKey] = newTag
    } else {
      delete updatedTagMap[channelKey]
    }
    setChannelTagMap(updatedTagMap)

    setChannels((prev) =>
      prev.map((c) => {
        const key = c.creator_id || c.creator_name || c.id
        if (key === channelKey || c.creator_name === channelKey || c.id === channelKey) {
          return { ...c, category: newCategory, tag: newTag || undefined }
        }
        return c
      })
    )

    setAllVideos((prev) =>
      prev.map((v) => {
        const key = v.creator_id || v.creator_name || 'manual'
        if (key === channelKey || v.creator_name === channelKey) {
          return { ...v, channel_category: newCategory, channel_tag: newTag || undefined }
        }
        return v
      })
    )

    if (selectedChannel) {
      const sKey = selectedChannel.creator_id || selectedChannel.creator_name || selectedChannel.id
      if (sKey === channelKey || selectedChannel.creator_name === channelKey) {
        setSelectedChannel({ ...selectedChannel, category: newCategory, tag: newTag || undefined })
      }
    }

    await Promise.all([
      saveAppSetting('youtube_channel_categories', updatedCatMap),
      saveAppSetting('youtube_channel_tags', updatedTagMap),
    ])

    showToast(`Đã lưu thể loại & tag cho kênh`, 'success')
    setEditingChannelCategory(null)
  }

  // Tải danh sách Kênh & Toàn bộ video từ CẢ 2 NGUỒN (TV Show & Review Phim)
  useEffect(() => {
    let alive = true
    setLoading(true)

    void (async () => {
      // 1. Tải creators từ cả tvshow_creators và review_creators
      const [tvCreatorsRes, revCreatorsRes, catMapRemote, tagMapRemote] = await Promise.all([
        supabase?.from('tvshow_creators').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase?.from('review_creators').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        getRemoteAppSetting<ChannelCategoryMap>('youtube_channel_categories', {}),
        getRemoteAppSetting<ChannelTagMap>('youtube_channel_tags', {}),
      ])

      const tvCreators = (tvCreatorsRes?.data ?? []) as any[]
      const revCreators = (revCreatorsRes?.data ?? []) as any[]
      const catMap = catMapRemote || channelCategoryMap
      const tagMap = tagMapRemote || channelTagMap

      // 2. Video tải theo trang từ cả 2 bảng
      const [tvVideosRes, revVideosRes, tvWatchedRes, revWatchedRes] = await Promise.all([
        supabase?.from('tvshow_videos').select('id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at,duration').is('unavailable_at', null).order('published_at', { ascending: false }).limit(3000),
        supabase?.from('review_videos').select('id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at,duration').is('unavailable_at', null).order('published_at', { ascending: false }).limit(3000),
        supabase?.from('tvshow_watched').select('video_id'),
        supabase?.from('review_watched').select('video_id'),
      ])

      const tvVideos = ((tvVideosRes?.data ?? []) as VideoRow[]).map(v => ({ ...v, sourceType: 'tvshow' as const }))
      const revVideos = ((revVideosRes?.data ?? []) as VideoRow[]).map(v => ({ ...v, sourceType: 'review' as const }))

      const rawCombinedVideos = [...tvVideos, ...revVideos].map((v) => ({
        ...v,
        duration: typeof v.duration === 'number' && v.duration > 0 ? v.duration : (progressMap[v.video_id]?.durationSeconds ?? v.duration),
      }))

      const combinedVideos = isShorts
        ? rawCombinedVideos.filter((v) => isShortVideo(v, progressMap))
        : rawCombinedVideos.filter((v) => !isShortVideo(v, progressMap))

      const combinedWatchedIds = new Set([
        ...(((tvWatchedRes?.data ?? []) as { video_id: string }[]).map(w => w.video_id)),
        ...(((revWatchedRes?.data ?? []) as { video_id: string }[]).map(w => w.video_id)),
      ])

      const statusSets = getVideoStatusSets('tvshow', combinedWatchedIds)

      // Thống kê video theo creator
      const statsByCreator = new Map<string, { total: number; inProgress: number; watched: number; cover: string | null }>()

      for (const v of combinedVideos) {
        const key = v.creator_id || v.creator_name || 'manual'
        const stat = statsByCreator.get(key) ?? { total: 0, inProgress: 0, watched: 0, cover: null }
        stat.total += 1
        if (statusSets.watchedSet.has(v.video_id)) {
          stat.watched += 1
        } else if (statusSets.inProgressSet.has(v.video_id)) {
          stat.inProgress += 1
        }
        if (!stat.cover && v.thumbnail) stat.cover = v.thumbnail
        statsByCreator.set(key, stat)
      }

      // Xây dựng danh sách Channel Cards tổng hợp
      const channelCardsMap = new Map<string, ChannelItem>()

      // Kênh TV Show
      for (const c of tvCreators) {
        const key = c.creator_id || c.creator_name || c.id
        const stat = statsByCreator.get(key) || statsByCreator.get(c.creator_name) || { total: 0, inProgress: 0, watched: 0, cover: null }
        if (isShorts && stat.total === 0) continue
        const assignedCat = catMap[key] || catMap[c.creator_name] || c.category || guessChannelCategory(c.creator_name, 'tvshow')
        const assignedTag = tagMap[key] || tagMap[c.creator_name] || undefined
        channelCardsMap.set(key, {
          id: c.id,
          platform: c.platform,
          creator_url: c.creator_url,
          creator_name: c.creator_name || 'Kênh YouTube',
          creator_id: c.creator_id,
          videoCount: stat.total,
          inProgressCount: stat.inProgress,
          watchedCount: stat.watched,
          cover: stat.cover,
          lastSyncedAt: c.last_synced_at,
          category: assignedCat,
          tag: assignedTag,
          sourceTable: 'tvshow',
        })
      }

      // Kênh Review Phim
      for (const c of revCreators) {
        const key = c.creator_id || c.creator_name || c.id
        const stat = statsByCreator.get(key) || statsByCreator.get(c.creator_name) || { total: 0, inProgress: 0, watched: 0, cover: null }
        if (isShorts && stat.total === 0) continue
        const assignedCat = catMap[key] || catMap[c.creator_name] || c.category || guessChannelCategory(c.creator_name, 'review')
        const assignedTag = tagMap[key] || tagMap[c.creator_name] || undefined
        if (channelCardsMap.has(key)) {
          const existing = channelCardsMap.get(key)!
          existing.videoCount += stat.total
          existing.inProgressCount += stat.inProgress
          existing.watchedCount += stat.watched
          if (!existing.cover) existing.cover = stat.cover
          if (!existing.tag && assignedTag) existing.tag = assignedTag
        } else {
          channelCardsMap.set(key, {
            id: c.id,
            platform: c.platform,
            creator_url: c.creator_url,
            creator_name: c.creator_name || 'Kênh Review Phim',
            creator_id: c.creator_id,
            videoCount: stat.total,
            inProgressCount: stat.inProgress,
            watchedCount: stat.watched,
            cover: stat.cover,
            lastSyncedAt: c.last_synced_at,
            category: assignedCat,
            tag: assignedTag,
            sourceTable: 'review',
          })
        }
      }

      // Video tự thêm
      const manualStat = statsByCreator.get('manual')
      if (manualStat && manualStat.total > 0 && !channelCardsMap.has('manual')) {
        const assignedCat = catMap['manual'] || 'Khác'
        const assignedTag = tagMap['manual'] || undefined
        channelCardsMap.set('manual', {
          id: 'manual',
          platform: 'youtube',
          creator_url: '',
          creator_name: 'Video tự thêm',
          creator_id: 'manual',
          videoCount: manualStat.total,
          inProgressCount: manualStat.inProgress,
          watchedCount: manualStat.watched,
          cover: manualStat.cover,
          lastSyncedAt: null,
          category: assignedCat,
          tag: assignedTag,
        })
      }

      // Gắn category & tag của Kênh vào từng Video tương ứng
      const channelsList = Array.from(channelCardsMap.values())
      const channelCatLookup = new Map<string, string>()
      const channelTagLookup = new Map<string, string>()
      channelsList.forEach((c) => {
        const cat = c.category
        const tag = c.tag
        if (c.creator_id) {
          channelCatLookup.set(c.creator_id, cat)
          if (tag) channelTagLookup.set(c.creator_id, tag)
        }
        if (c.creator_name) {
          channelCatLookup.set(c.creator_name, cat)
          if (tag) channelTagLookup.set(c.creator_name, tag)
        }
        channelCatLookup.set(c.id, cat)
        if (tag) channelTagLookup.set(c.id, tag)
      })

      const taggedVideos = combinedVideos.map((v) => {
        const key = v.creator_id || v.creator_name || 'manual'
        const cat = channelCatLookup.get(key) || channelCatLookup.get(v.creator_name || '') || 'Khác'
        const tag = channelTagLookup.get(key) || channelTagLookup.get(v.creator_name || '') || undefined
        return { ...v, channel_category: cat, channel_tag: tag }
      })

      if (alive) {
        setChannels(channelsList)
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

  // Đổi tiêu chí sắp xếp (Mới đăng / Nhiều view / Cũ nhất)
  const handleSortChange = (newSort: YoutubeSortMode) => {
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

  // Tính số lượng video / kênh cho từng tab thể loại
  const categoryTabStats = useMemo(() => {
    const counts: Record<string, { channels: number; videos: number }> = {}
    
    customCategories.forEach((cat) => {
      counts[cat.label] = { channels: 0, videos: 0 }
    })

    channels.forEach((c) => {
      const cat = c.category || 'Khác'
      if (!counts[cat]) counts[cat] = { channels: 0, videos: 0 }
      counts[cat].channels += 1
      counts[cat].videos += c.videoCount
    })

    return counts
  }, [channels, customCategories])

  // Danh sách các tab hiển thị trên thanh cuộn ngang
  const dynamicCategoryTabs = useMemo(() => {
    const tabs = [
      {
        id: 'ALL',
        label: 'Tất cả',
        icon: '🎬',
        count: allVideos.length,
      },
    ]

    customCategories.forEach((c) => {
      const stat = categoryTabStats[c.label] || { channels: 0, videos: 0 }
      tabs.push({
        id: c.label,
        label: c.label,
        icon: c.icon || '🏷️',
        count: stat.videos || stat.channels,
      })
    })

    // Các thể loại khác đã gán vào kênh nhưng chưa có trong danh mục (nếu có)
    Object.keys(categoryTabStats).forEach((catName) => {
      if (
        !customCategories.some((c) => c.label === catName) &&
        catName !== 'ALL'
      ) {
        tabs.push({
          id: catName,
          label: catName,
          icon: '🏷️',
          count: categoryTabStats[catName].videos || categoryTabStats[catName].channels,
        })
      }
    })

    return tabs
  }, [allVideos.length, categoryTabStats, customCategories])

  // Tính số lượng video cho từng Tag trong Thể loại hiện tại
  const tagCounts = useMemo(() => {
    if (activeCategoryTab === 'ALL') return {}
    const counts: Record<string, number> = {}
    const tags = categoryTagMap[activeCategoryTab] || []
    tags.forEach((t) => { counts[t] = 0 })
    allVideos.forEach((v) => {
      if (v.channel_category === activeCategoryTab && v.channel_tag && counts[v.channel_tag] !== undefined) {
        counts[v.channel_tag]++
      }
    })
    return counts
  }, [allVideos, activeCategoryTab, categoryTagMap])

  // Lọc Kênh theo Tab Thể Loại, Tag con và Ô Tìm Kiếm
  const filteredChannels = useMemo(() => {
    let result = [...channels]

    // Lọc theo Tab thể loại đang chọn
    if (activeCategoryTab !== 'ALL') {
      result = result.filter((c) => c.category === activeCategoryTab)
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
  }, [channels, activeCategoryTab, activeTagTab, search])

  // Tính số lượng video theo từng trạng thái xem trong tab hiện tại
  const watchStatusCounts = useMemo(() => {
    let base = activeCategoryTab === 'ALL'
      ? allVideos
      : allVideos.filter((v) => v.channel_category === activeCategoryTab)

    if (activeCategoryTab !== 'ALL' && activeTagTab !== 'ALL') {
      base = base.filter((v) => v.channel_tag === activeTagTab)
    }

    let inProgress = 0
    let watched = 0
    let unwatched = 0

    for (const v of base) {
      if (watchedSet.has(v.video_id)) {
        watched++
      } else if (inProgressSet.has(v.video_id)) {
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
  }, [allVideos, activeCategoryTab, activeTagTab, watchedSet, inProgressSet])

  // Lọc Video ĐÃ CÓ trong App theo Tab Thể Loại & Tag con của Kênh
  const filteredSavedVideos = useMemo(() => {
    let result = [...allVideos]

    // Lọc theo Tab thể loại của kênh
    if (activeCategoryTab !== 'ALL') {
      result = result.filter((v) => v.channel_category === activeCategoryTab)
      // Lọc theo Tag con nếu có chọn
      if (activeTagTab !== 'ALL') {
        result = result.filter((v) => v.channel_tag === activeTagTab)
      }
    }

    // Lọc theo trạng thái xem
    if (watchFilter === 'unwatched') {
      result = result.filter((v) => !watchedSet.has(v.video_id) && !inProgressSet.has(v.video_id))
    } else if (watchFilter === 'in_progress') {
      result = result.filter((v) => inProgressSet.has(v.video_id))
    } else if (watchFilter === 'watched') {
      result = result.filter((v) => watchedSet.has(v.video_id))
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

    // Sắp xếp video: Mặc định là Mới đăng ưu tiên ('date'), hoặc Nhiều view ('viewCount'), hoặc Cũ nhất ('oldest')
    result.sort((a, b) => {
      if (sortMode === 'date') {
        const tA = a.published_at ? new Date(a.published_at).getTime() : 0
        const tB = b.published_at ? new Date(b.published_at).getTime() : 0
        return tB - tA
      }
      if (sortMode === 'oldest') {
        const tA = a.published_at ? new Date(a.published_at).getTime() : 0
        const tB = b.published_at ? new Date(b.published_at).getTime() : 0
        return tA - tB
      }
      if (sortMode === 'viewCount') {
        const pA = progressMap[a.video_id]?.percent || 0
        const pB = progressMap[b.video_id]?.percent || 0
        if (pA !== pB) return pB - pA
        const tA = a.published_at ? new Date(a.published_at).getTime() : 0
        const tB = b.published_at ? new Date(b.published_at).getTime() : 0
        return tB - tA
      }
      return 0
    })

    return result
  }, [allVideos, activeCategoryTab, activeTagTab, watchFilter, search, watchedSet, inProgressSet, shuffleSeed, sortMode, progressMap])

  // Tải từng mẻ nhỏ 12 video/kênh giúp trang nhẹ mượt, không giật lag
  const videoList = useIncrementalList(filteredSavedVideos.length, 12, `${search}|${watchFilter}|${activeCategoryTab}|${shuffleSeed}|${sortMode}`)
  const channelList = useIncrementalList(filteredChannels.length, 12, `${search}|${watchFilter}|${activeCategoryTab}`)

  /** Nút "Đã xem": bật/tắt trạng thái xem hết của đúng video đó. */
  const handleToggleWatched = async (video: VideoRow) => {
    const next: VideoStatus = watchedSet.has(video.video_id) ? 'UNWATCHED' : 'COMPLETED'
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
          /* Xem theo Video (mặc định, giống YouTube) hay gom theo Kênh */
          <div style={{ display: 'inline-flex', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 3 }}>
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
          </div>
        )}
      </form>

      {/* 2.5. BỘ LỌC TRẠNG THÁI XEM (ĐANG XEM, ĐÃ XEM, CHƯA XEM) & NÚT XÁO TRỘN NGẪU NHIÊN */}
      {/* Một dòng lướt ngang: 4 bộ lọc + nút xáo trộn mà xuống dòng thì ăn mất
          3 dòng màn hình điện thoại, đẩy video xuống quá sâu. */}
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

        {/* BỘ LỌC SẮP XẾP: MỚI ĐĂNG (ƯU TIÊN MẶC ĐỊNH) & NHIỀU VIEW & CŨ NHẤT */}
        {([
          { id: 'date', label: 'Mới đăng', icon: Zap, title: 'Ưu tiên hiển thị video mới đăng gần nhất (Mặc định)' },
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
              {s.id === 'date' && (
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
                  Ưu tiên
                </span>
              )}
            </button>
          )
        })}

        {/* Nút Xáo trộn ngẫu nhiên khi ở tab Tất cả */}
        {activeCategoryTab === 'ALL' && viewMode === 'video' && !search.trim() && (
          <button
            type="button"
            onClick={() => {
              setShuffleSeed(Math.random())
              showToast('Đã xáo trộn ngẫu nhiên danh sách video', 'info')
            }}
            title="Xáo trộn ngẫu nhiên danh sách video"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 10,
              border: '1px solid var(--card-border)',
              background: 'var(--card-bg)',
              color: 'var(--text-main)',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Shuffle size={13} color="var(--primary)" />
            <span>Đổi ngẫu nhiên</span>
          </button>
        )}
      </div>

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
          ) : viewMode === 'channel' && !search.trim() ? (
            /* CHẾ ĐỘ XEM THEO KÊNH */
            <>
              <div className="tv-creators-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {filteredChannels.slice(0, channelList.visibleCount).map((channel) => {
                  const watchedPct = channel.videoCount > 0 ? Math.round((channel.watchedCount / channel.videoCount) * 100) : 0

                  return (
                    <div
                      key={channel.id}
                      className="tv-creator-card"
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
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>({tags.length} tags)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setManagingTagsForCat(cat.label)}
                        style={{
                          padding: '4px 8px',
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
                        <Tag size={11} /> Tags ({tags.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        title="Sửa thể loại này"
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--card-border)',
                          background: 'var(--bg-main)',
                          color: 'var(--text-main)',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <Edit3 size={11} /> Sửa
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
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            background: 'rgba(244, 63, 94, 0.1)',
                            color: 'var(--rose, #f43f5e)',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Trash2 size={11} />
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
  const progressMap = useVideoProgressMap()
  const { playInMini } = useVideoMiniPlayer()

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
  const initialStartRef = useRef<Record<string, number>>({})
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
    try {
      setAudioLoading(true)
      let playUrl: string | null = null

      if (isAudioSaved) {
        playUrl = await getOfflineAudioPlayUrl(video.video_id)
      } else {
        showToast('⏳ Đang tải và chuyển video thành Audio...', 'info')
        await downloadAndSaveYoutubeAudio(video.video_id, {
          title: video.title,
          channelName: video.creator_name || undefined,
          thumbnail: video.thumbnail || undefined,
          durationSeconds: video.duration || undefined,
        })
        playUrl = await getOfflineAudioPlayUrl(video.video_id)
        showToast(`🎉 Đã lưu Audio (${audioSizeLabel || 'đã nén'}) vào máy!`)
      }

      if (playUrl && audioPlayer) {
        audioPlayer.playTrack({
          id: `yt-${video.video_id}`,
          type: 'MUSIC',
          name: video.title,
          audio_url: playUrl,
          cover_url: video.thumbnail,
          artist: video.creator_name || 'YouTube Audio',
          status: 'IN_PROGRESS',
          is_favorite: false,
          description: null,
        })
        showToast('🎧 Đang phát Audio trên toàn hệ thống!')
      }
    } catch (err: any) {
      console.warn('Chuyển sang phát audio nền:', err)
      showToast('🎧 Đang phát chế độ Audio chạy nền...', 'info')
      onPlayMini()
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
        {percent > 0 && <span className="yt-seen-bar"><i style={{ width: `${Math.min(100, percent)}%` }} /></span>}
      </div>

      <div className="yt-body">
        <span className="yt-avatar" aria-hidden>{(video.creator_name || 'Y').trim().charAt(0).toUpperCase()}</span>
        <div className="yt-text">
          <h3 className="yt-title" title={video.title} onClick={onOpen} style={{ cursor: 'pointer' }}>
            {video.title}
          </h3>
          <p className="yt-meta">{meta}</p>
          {(watched || inProgress || (progress && progress.percent > 0)) && (
            <p className={`yt-status ${watched || progress?.status === 'COMPLETED' ? 'done' : ''}`}>
              {progress ? progressLabel(progress) : watched ? 'Đã xem hết' : 'Đang xem'}
            </p>
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
