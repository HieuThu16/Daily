import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { 
  ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Circle, CornerDownLeft, 
  ExternalLink, Film, Pause, Play, Plus, Radio, Search, Trash2, Tv, Video, 
  Youtube, Clock, Settings, Gauge, Zap, Sliders, MoreVertical, 
  Copy, Check, ChevronRight, Tag, ArrowUpDown, SlidersHorizontal, Moon, RefreshCw,
  Download, Loader2, Sparkles, AlertCircle, Save, LayoutGrid, Layers, BookOpen, Bookmark,
  Edit3, FolderPlus, Compass, Globe, BookmarkPlus, Users, PictureInPicture2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { mapWithProgress } from '../../lib/mapWithProgress'
import { fetchYouTubeMeta, youtubeVideoId } from '../../lib/youtubeMeta'
import { searchYouTubeVideos, type YouTubeSearchResult } from '../../lib/youtubeSearch'
import { Modal, useIncrementalList } from '../shared'
import { DualSubtitles } from './DualSubtitles'
import { publishedGroupLabel } from '../../lib/videoGrouping'
import { useHeaderActions, useHideHeader } from '../HeaderAction'
import { useToast } from '../ToastContext'
import { getRemoteAppSetting, saveAppSetting } from '../../lib/userAppSettings'
import {
  autoMarkVideoWatching,
  cycleNextVideoStatus,
  getVideoStatusSets,
  setVideoStatus as updateVideoStatusRecord,
  useVideoStatusListener,
  type VideoStatus
} from '../../lib/videoStatus'
import { summarizeVideo, toKnowledgeRows } from '../../lib/videoLesson'
import {
  progressLabel,
  shareVideosToWatchTogether,
  useVideoProgressMap,
  useYouTubeProgress,
} from '../../lib/videoProgress'
import { AddYoutubeModal } from './AddYoutubeModal'
import { useVideoMiniPlayer } from './VideoMiniPlayer'
import { OfflineVideoModal } from './OfflineVideoModal'
import '../tvshow/tvShow.css'

/** Mỗi lượt kéo bấy nhiêu video; trang đầu về là hiện được ngay. */
const VIDEO_PAGE_SIZE = 300
const MISSING_TABLE_CODES = ['42P01', 'PGRST205']

// Danh sách các hạng mục kênh mặc định
export const DEFAULT_YOUTUBE_CATEGORIES = [
  { id: 'ALL', label: 'Tất cả', icon: '🎬' },
  { id: 'REVIEW', label: 'Review phim', icon: '🍿' },
  { id: 'TVSHOW', label: 'TV Shows', icon: '📺' },
  { id: 'STUDY', label: 'Học tập & Tri thức', icon: '📚' },
  { id: 'TECH', label: 'Công nghệ & Khoa học', icon: '💡' },
  { id: 'ENTERTAINMENT', label: 'Giải trí & Vlogs', icon: '🎭' },
  { id: 'OTHER', label: 'Khác', icon: '📦' },
]

export type ChannelCategoryMap = Record<string, string>

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

/** Tự động đoán thể loại ban đầu của kênh dựa vào tên kênh hoặc nguồn gốc */
function guessChannelCategory(name: string, sourceTable?: 'tvshow' | 'review'): string {
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

export function YoutubeView() {
  const { showToast } = useToast()
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [allVideos, setAllVideos] = useState<VideoRow[]>([])
  const [watchedSet, setWatchedSet] = useState<Set<string>>(new Set())
  const [inProgressSet, setInProgressSet] = useState<Set<string>>(new Set())
  const [statusMap, setStatusMap] = useState<Map<string, VideoStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'channel' | 'video'>('video')
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)
  const [selectedVideoForMenu, setSelectedVideoForMenu] = useState<VideoRow | null>(null)
  const [watchFilter, setWatchFilter] = useState<'all' | 'unwatched' | 'in_progress' | 'watched'>('all')
  const [sortMode, setSortMode] = useState<'default' | 'newest' | 'channel' | 'unwatched'>('default')
  
  // Hạng mục đang chọn trên thanh tab trượt ngang (mặc định 'ALL')
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('ALL')
  // Bản đồ lưu Thể loại của từng Kênh (Lưu trên Supabase qua user_app_settings)
  const [channelCategoryMap, setChannelCategoryMap] = useState<ChannelCategoryMap>({})

  // TÌM KIẾM YOUTUBE API (Tìm video đã có VÀ chưa có trong app)
  const [searchScope, setSearchScope] = useState<'all' | 'saved' | 'youtube'>('all')
  const [ytSearchResults, setYtSearchResults] = useState<YouTubeSearchResult[]>([])
  const [isSearchingYouTube, setIsSearchingYouTube] = useState(false)
  const [savingVideoId, setSavingVideoId] = useState<string | null>(null)

  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null)
  const [sharedUrl] = useState(() => new URLSearchParams(window.location.search).get('youtube') ?? '')
  const [addOpen, setAddOpen] = useState(Boolean(sharedUrl))
  const [syncingAll, setSyncingAll] = useState(false)
  const [offlineOpen, setOfflineOpen] = useState(false)
  const [editingChannelCategory, setEditingChannelCategory] = useState<ChannelItem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  
  const progressMap = useVideoProgressMap()
  const { playInMini } = useVideoMiniPlayer()
  const savedScroll = useRef(0)
  const tabsScrollRef = useRef<HTMLDivElement>(null)

  /** Cào video chưa có ở TẤT CẢ kênh đã thêm, rồi đưa video mới sang Xem chung. */
  const handleSyncAllChannels = async () => {
    if (syncingAll) return
    setSyncingAll(true)
    showToast('Đang cào video mới ở tất cả kênh…', 'info')
    try {
      const { data } = await supabase!.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Cần đăng nhập')
      const res = await fetch('/api/cron-sync?scope=youtube', { headers: { Authorization: `Bearer ${token}` } })
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
    { label: 'Video trong máy', icon: 'download', onClick: () => setOfflineOpen(true) },
  ])

  useVideoStatusListener(() => {
    setReloadKey((k) => k + 1)
  })

  // Tải bản đồ Thể loại kênh từ Supabase
  useEffect(() => {
    let alive = true
    void getRemoteAppSetting<ChannelCategoryMap>('youtube_channel_categories', {}).then((map) => {
      if (alive && map) {
        setChannelCategoryMap(map)
      }
    })
    return () => { alive = false }
  }, [])

  // Đổi thể loại của 1 Kênh (Lưu ngay vào state, local và Supabase)
  const handleChangeChannelCategory = async (channelKey: string, newCategory: string) => {
    const updated = { ...channelCategoryMap, [channelKey]: newCategory }
    setChannelCategoryMap(updated)
    setChannels((prev) =>
      prev.map((c) => {
        const key = c.creator_id || c.creator_name || c.id
        if (key === channelKey || c.creator_name === channelKey || c.id === channelKey) {
          return { ...c, category: newCategory }
        }
        return c
      })
    )
    if (selectedChannel) {
      const sKey = selectedChannel.creator_id || selectedChannel.creator_name || selectedChannel.id
      if (sKey === channelKey || selectedChannel.creator_name === channelKey) {
        setSelectedChannel({ ...selectedChannel, category: newCategory })
      }
    }
    await saveAppSetting('youtube_channel_categories', updated)
    showToast(`Đã chuyển kênh sang mục "${newCategory}"`, 'info')
    setEditingChannelCategory(null)
  }

  // Tải danh sách Kênh & Toàn bộ video từ CẢ 2 NGUỒN (TV Show & Review Phim)
  useEffect(() => {
    let alive = true
    setLoading(true)

    void (async () => {
      // 1. Tải creators từ cả tvshow_creators và review_creators
      const [tvCreatorsRes, revCreatorsRes, catMapRemote] = await Promise.all([
        supabase?.from('tvshow_creators').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase?.from('review_creators').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        getRemoteAppSetting<ChannelCategoryMap>('youtube_channel_categories', {}),
      ])

      const tvCreators = (tvCreatorsRes?.data ?? []) as any[]
      const revCreators = (revCreatorsRes?.data ?? []) as any[]
      const catMap = catMapRemote || channelCategoryMap

      // 2. Video tải theo trang từ cả 2 bảng
      const [tvVideosRes, revVideosRes, tvWatchedRes, revWatchedRes] = await Promise.all([
        supabase?.from('tvshow_videos').select('id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at,duration').is('unavailable_at', null).order('published_at', { ascending: false }).limit(600),
        supabase?.from('review_videos').select('id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at,duration').is('unavailable_at', null).order('published_at', { ascending: false }).limit(600),
        supabase?.from('tvshow_watched').select('video_id'),
        supabase?.from('review_watched').select('video_id'),
      ])

      const tvVideos = ((tvVideosRes?.data ?? []) as VideoRow[]).map(v => ({ ...v, sourceType: 'tvshow' as const }))
      const revVideos = ((revVideosRes?.data ?? []) as VideoRow[]).map(v => ({ ...v, sourceType: 'review' as const }))

      const combinedVideos = [...tvVideos, ...revVideos]

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
        const assignedCat = catMap[key] || catMap[c.creator_name] || c.category || guessChannelCategory(c.creator_name, 'tvshow')
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
          sourceTable: 'tvshow',
        })
      }

      // Kênh Review Phim
      for (const c of revCreators) {
        const key = c.creator_id || c.creator_name || c.id
        const stat = statsByCreator.get(key) || statsByCreator.get(c.creator_name) || { total: 0, inProgress: 0, watched: 0, cover: null }
        const assignedCat = catMap[key] || catMap[c.creator_name] || c.category || guessChannelCategory(c.creator_name, 'review')
        if (channelCardsMap.has(key)) {
          const existing = channelCardsMap.get(key)!
          existing.videoCount += stat.total
          existing.inProgressCount += stat.inProgress
          existing.watchedCount += stat.watched
          if (!existing.cover) existing.cover = stat.cover
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
            sourceTable: 'review',
          })
        }
      }

      // Video tự thêm
      const manualStat = statsByCreator.get('manual')
      if (manualStat && manualStat.total > 0 && !channelCardsMap.has('manual')) {
        const assignedCat = catMap['manual'] || 'Khác'
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
        })
      }

      // Gắn category của Kênh vào từng Video tương ứng
      const channelsList = Array.from(channelCardsMap.values())
      const channelCatLookup = new Map<string, string>()
      channelsList.forEach((c) => {
        const cat = c.category
        if (c.creator_id) channelCatLookup.set(c.creator_id, cat)
        if (c.creator_name) channelCatLookup.set(c.creator_name, cat)
        channelCatLookup.set(c.id, cat)
      })

      const taggedVideos = combinedVideos.map((v) => {
        const key = v.creator_id || v.creator_name || 'manual'
        const cat = channelCatLookup.get(key) || channelCatLookup.get(v.creator_name || '') || 'Khác'
        return { ...v, channel_category: cat }
      })

      if (alive) {
        setChannels(channelsList)
        setAllVideos(taggedVideos)
        setWatchedSet(statusSets.watchedSet)
        setInProgressSet(statusSets.inProgressSet)
        setStatusMap(statusSets.statusMap)
        setLoading(false)
      }
    })()

    return () => { alive = false }
  }, [reloadKey])

  // Tập hợp set các video_id đã lưu trong app
  const savedVideoIdSet = useMemo(() => {
    return new Set(allVideos.map((v) => v.video_id))
  }, [allVideos])

  // Tìm kiếm trực tuyến từ YouTube API khi người dùng kích hoạt
  const handlePerformYouTubeSearch = async (queryToSearch = search) => {
    const q = queryToSearch.trim()
    if (!q) return
    setIsSearchingYouTube(true)
    try {
      const results = await searchYouTubeVideos(q)
      setYtSearchResults(results)
      if (results.length === 0) {
        showToast('Không tìm thấy kết quả từ YouTube API', 'info')
      }
    } catch {
      showToast('Không thể kết nối tìm kiếm YouTube', 'error')
    } finally {
      setIsSearchingYouTube(false)
    }
  }

  // Tự động tìm kiếm YouTube khi người dùng gõ Enter hoặc chuyển sang tab Tìm YouTube
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      void handlePerformYouTubeSearch(search)
    }
  }

  // Lưu nhanh một video từ kết quả tìm kiếm YouTube vào App
  const handleSaveVideoToApp = async (item: YouTubeSearchResult) => {
    setSavingVideoId(item.videoId)
    try {
      // 1. Kiểm tra hoặc tạo Creator trong tvshow_creators
      const creatorName = item.channelTitle || 'Kênh YouTube'
      const creatorId = item.channelId || null
      const cat = guessChannelCategory(creatorName, 'tvshow')

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
    
    DEFAULT_YOUTUBE_CATEGORIES.forEach((cat) => {
      counts[cat.label] = { channels: 0, videos: 0 }
    })

    channels.forEach((c) => {
      const cat = c.category || 'Khác'
      if (!counts[cat]) counts[cat] = { channels: 0, videos: 0 }
      counts[cat].channels += 1
      counts[cat].videos += c.videoCount
    })

    return counts
  }, [channels])

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

    DEFAULT_YOUTUBE_CATEGORIES.filter((c) => c.id !== 'ALL').forEach((c) => {
      const stat = categoryTabStats[c.label] || { channels: 0, videos: 0 }
      tabs.push({
        id: c.label,
        label: c.label,
        icon: c.icon,
        count: stat.videos || stat.channels,
      })
    })

    // Các thể loại tùy chỉnh khác nếu có
    Object.keys(categoryTabStats).forEach((catName) => {
      if (!DEFAULT_YOUTUBE_CATEGORIES.some((c) => c.label === catName) && catName !== 'ALL') {
        tabs.push({
          id: catName,
          label: catName,
          icon: '🏷️',
          count: categoryTabStats[catName].videos || categoryTabStats[catName].channels,
        })
      }
    })

    return tabs
  }, [allVideos.length, categoryTabStats])

  // Lọc Kênh theo Tab Thể Loại và Ô Tìm Kiếm
  const filteredChannels = useMemo(() => {
    let result = [...channels]

    // Lọc theo Tab thể loại đang chọn
    if (activeCategoryTab !== 'ALL') {
      result = result.filter((c) => c.category === activeCategoryTab)
    }

    // Lọc theo từ khóa tìm kiếm
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (c) =>
          c.creator_name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      )
    }

    return result
  }, [channels, activeCategoryTab, search])

  // Lọc Video ĐÃ CÓ trong App theo Tab Thể Loại của Kênh
  const filteredSavedVideos = useMemo(() => {
    let result = [...allVideos]

    // Lọc theo Tab thể loại của kênh
    if (activeCategoryTab !== 'ALL') {
      result = result.filter((v) => v.channel_category === activeCategoryTab)
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
          (v.creator_name && v.creator_name.toLowerCase().includes(q))
      )
    }

    return result
  }, [allVideos, activeCategoryTab, watchFilter, search, watchedSet, inProgressSet])

  const videoList = useIncrementalList(filteredSavedVideos.length, 36, `${search}|${watchFilter}|${activeCategoryTab}`)

  // Đổi trạng thái xem video
  const handleSetStatus = async (videoId: string, status: VideoStatus, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const targetVideo = allVideos.find((v) => v.video_id === videoId)
    const type = targetVideo?.sourceType || 'tvshow'
    await updateVideoStatusRecord(videoId, type, status, {
      title: targetVideo?.title,
      channel_name: targetVideo?.creator_name || undefined,
      series_key: targetVideo?.series_key,
    })
  }

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

  const handleCycleStatus = async (videoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const currentSt = statusMap.get(videoId) || (watchedSet.has(videoId) ? 'COMPLETED' : (inProgressSet.has(videoId) ? 'IN_PROGRESS' : 'UNWATCHED'))
    const targetVideo = allVideos.find((v) => v.video_id === videoId)
    const type = targetVideo?.sourceType || 'tvshow'
    await cycleNextVideoStatus(videoId, type, currentSt, {
      title: targetVideo?.title,
      channel_name: targetVideo?.creator_name || undefined,
      series_key: targetVideo?.series_key,
    })
  }

  // Nếu đang xem chi tiết 1 kênh
  if (selectedChannel) {
    return (
      <ChannelDetailView
        channel={selectedChannel}
        onBack={() => setSelectedChannel(null)}
        onChangeCategory={(newCat) => {
          const key = selectedChannel.creator_id || selectedChannel.creator_name || selectedChannel.id
          void handleChangeChannelCategory(key, newCat)
        }}
      />
    )
  }

  return (
    <section className="tv-page">
      {/* 1. THANH TAB HẠNG MỤC TRƯỢT NGANG (Kéo từ trái qua phải) */}
      <div className="yt-category-tabs-container">
        <div className="yt-category-tabs-track" ref={tabsScrollRef}>
          {dynamicCategoryTabs.map((tab) => {
            const isActive = activeCategoryTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                className={`yt-category-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategoryTab(tab.id)}
              >
                <span className="yt-tab-icon">{tab.icon}</span>
                <span className="yt-tab-label">{tab.label}</span>
                <span className="yt-tab-count">{tab.count}</span>
              </button>
            )
          })}
        </div>
      </div>

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
                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', overflow: 'hidden' }}>
                      <img src={item.thumbnail} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      
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
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>{item.channelTitle}</span>
                        <a href={`https://www.youtube.com/watch?v=${item.videoId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          Xem <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
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
            <div className="tv-creators-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filteredChannels.map((channel) => {
                const watchedPct = channel.videoCount > 0 ? Math.round((channel.watchedCount / channel.videoCount) * 100) : 0
                const key = channel.creator_id || channel.creator_name || channel.id

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
                        <img src={channel.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          ) : (
            /* CHẾ ĐỘ XEM THEO DANH SÁCH VIDEO */
            <div className="yt-grid">
              {filteredSavedVideos.slice(0, videoList.visibleCount).map((video) => (
                <YoutubeVideoCard
                  key={video.id}
                  video={video}
                  watched={watchedSet.has(video.video_id)}
                  inProgress={inProgressSet.has(video.video_id)}
                  progress={progressMap[video.video_id]}
                  playing={playingVideoId === video.video_id}
                  onPlay={() => setPlayingVideoId(video.video_id)}
                  onToggleWatched={() => void handleToggleWatched(video)}
                  onPlayMini={() =>
                    playInMini({
                      videoId: video.video_id,
                      title: video.title,
                      channelName: video.creator_name,
                      thumbnail: video.thumbnail,
                      startSeconds: progressMap[video.video_id]?.seconds,
                    })
                  }
                  onShare={() => {
                    void shareVideosToWatchTogether([
                      { videoId: video.video_id, title: video.title, channelName: video.creator_name || undefined, thumbnail: video.thumbnail },
                    ]).then(() => showToast('Đã đưa sang Xem chung', 'success'))
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {offlineOpen && <OfflineVideoModal onClose={() => setOfflineOpen(false)} />}

      {/* MODAL THÊM KÊNH / VIDEO (tự phân biệt link) */}
      {addOpen && (
        <AddYoutubeModal
          initialUrl={sharedUrl}
          onClose={() => setAddOpen(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}

      {/* MODAL ĐỔI THỂ LOẠI CHO KÊNH */}
      {editingChannelCategory && (
        <Modal
          title={`🏷️ Thể loại cho kênh: ${editingChannelCategory.creator_name}`}
          onClose={() => setEditingChannelCategory(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
              Chọn thể loại phù hợp cho kênh này. Tất cả video của kênh sẽ tự động được hiển thị trong tab tương ứng:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {DEFAULT_YOUTUBE_CATEGORIES.filter((c) => c.id !== 'ALL').map((cat) => {
                const isSelected = editingChannelCategory.category === cat.label
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      const key = editingChannelCategory.creator_id || editingChannelCategory.creator_name || editingChannelCategory.id
                      void handleChangeChannelCategory(key, cat.label)
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--card-border)'}`,
                      background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    {isSelected && <Check size={14} style={{ marginLeft: 'auto' }} />}
                  </button>
                )
              })}
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

/** Màn hình xem chi tiết 1 Kênh */
function ChannelDetailView({
  channel,
  onBack,
  onChangeCategory,
}: {
  channel: ChannelItem
  onBack: () => void
  onChangeCategory: (cat: string) => void
}) {
  useHideHeader(true)
  const { showToast } = useToast()

  const [videos, setVideos] = useState<VideoRow[]>([])
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [inProgress, setInProgress] = useState<Set<string>>(new Set())
  const [statusMap, setStatusMap] = useState<Map<string, VideoStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isPlayerActive, setIsPlayerActive] = useState(false)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unwatched' | 'in_progress' | 'watched'>('all')
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  const [iframeEl, setIframeEl] = useState<HTMLIFrameElement | null>(null)
  const progressMap = useVideoProgressMap()
  const { playInMini } = useVideoMiniPlayer()

  useEffect(() => {
    void (async () => {
      let query = supabase
        ?.from('tvshow_videos')
        .select('id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at,duration')
        .is('unavailable_at', null)

      if (channel.id === 'manual') {
        query = query?.eq('creator_id', 'manual')
      } else if (channel.creator_id) {
        query = query?.or(`creator_id.eq.${channel.creator_id},creator_name.eq.${channel.creator_name}`)
      } else {
        query = query?.eq('creator_name', channel.creator_name)
      }

      const watchedRes = await supabase?.from('tvshow_watched').select('video_id')
      const watchedIds = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((r) => r.video_id))
      const sets = getVideoStatusSets('tvshow', watchedIds)

      const videoRes = await query?.order('part_number', { ascending: true, nullsFirst: false }).order('published_at', { ascending: false })
      const rows = (videoRes?.data ?? []) as VideoRow[]

      setVideos(rows)
      setWatched(sets.watchedSet)
      setInProgress(sets.inProgressSet)
      setStatusMap(sets.statusMap)

      const firstUnwatched = rows.find((r) => !sets.watchedSet.has(r.video_id))
      setPlayingId(firstUnwatched ? firstUnwatched.video_id : (rows[0]?.video_id ?? null))
      setLoading(false)
    })()
  }, [channel])

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

  const currentVideo = videos.find((v) => v.video_id === playingId) || videos[0]
  // Tự ghi "đang xem" + % đã xem; lưu ngay khi thu nhỏ hoặc tắt app.
  const player = useYouTubeProgress(iframeEl, {
    videoId: currentVideo?.video_id ?? null,
    title: currentVideo?.title,
    channelName: currentVideo?.creator_name ?? undefined,
    thumbnail: currentVideo?.thumbnail,
  })
  const embedBase = currentVideo?.embed_url || (currentVideo?.video_id ? `https://www.youtube-nocookie.com/embed/${currentVideo.video_id}` : '')
  const embedSrc = embedBase ? `${embedBase}${embedBase.includes('?') ? '&' : '?'}autoplay=1&rel=0&enablejsapi=1` : ''

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{channel.category || 'Khác'}</span>
                <Edit3 size={10} />
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
        <button
          type="button"
          className="tv-btn"
          onClick={() => {
            if (!currentVideo) return
            void shareVideosToWatchTogether([
              {
                videoId: currentVideo.video_id,
                title: currentVideo.title,
                channelName: currentVideo.creator_name ?? undefined,
                thumbnail: currentVideo.thumbnail,
              },
            ]).then(() => showToast('Đã đưa sang Xem chung', 'success'))
          }}
          disabled={!currentVideo}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 700 }}
        >
          <Users size={14} /> Xem chung
        </button>
      </div>

      {/* Trình phát Video */}
      {currentVideo && (
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' }}>
          <iframe
            ref={setIframeEl}
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
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'unwatched', 'in_progress', 'watched'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`tv-filter-pill ${filterMode === m ? 'active' : ''}`}
              onClick={() => setFilterMode(m)}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid var(--card-border)',
                background: filterMode === m ? 'var(--primary)' : 'var(--card-bg)',
                color: filterMode === m ? '#fff' : 'var(--text-main)',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {m === 'all' ? 'Tất cả' : m === 'unwatched' ? 'Chưa xem' : m === 'in_progress' ? 'Đang xem' : 'Đã xem'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {filteredVideos.map((v) => {
          const isSelected = v.video_id === playingId
          const isWatched = watched.has(v.video_id)
          return (
            <div
              key={v.id}
              onClick={() => setPlayingId(v.video_id)}
              style={{
                padding: 10,
                borderRadius: 12,
                border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--card-border)'}`,
                background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--card-bg)',
                cursor: 'pointer',
                display: 'flex',
                gap: 10,
              }}
            >
              <div style={{ position: 'relative', width: 90, height: 56, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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
      </div>

      {showCategoryPicker && (
        <Modal title="Đổi thể loại kênh" onClose={() => setShowCategoryPicker(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {DEFAULT_YOUTUBE_CATEGORIES.filter((c) => c.id !== 'ALL').map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onChangeCategory(cat.label)
                  setShowCategoryPicker(false)
                }}
                style={{
                  padding: '10px',
                  borderRadius: 10,
                  border: '1px solid var(--card-border)',
                  background: channel.category === cat.label ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </Modal>
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

/** Thẻ video kiểu YouTube: bấm vào là phát ngay tại chỗ. */
function YoutubeVideoCard({
  video,
  watched,
  inProgress,
  progress,
  playing,
  onPlay,
  onToggleWatched,
  onShare,
  onPlayMini,
}: {
  video: VideoRow
  watched: boolean
  inProgress: boolean
  progress?: { percent: number; status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' }
  playing: boolean
  onPlay: () => void
  onToggleWatched: () => void
  onShare: () => void
  onPlayMini: () => void
}) {
  const [iframeEl, setIframeEl] = useState<HTMLIFrameElement | null>(null)
  useYouTubeProgress(playing ? iframeEl : null, {
    videoId: video.video_id,
    title: video.title,
    channelName: video.creator_name ?? undefined,
    thumbnail: video.thumbnail,
  })

  const base = video.embed_url || `https://www.youtube.com/embed/${video.video_id}`
  const src = `${base}${base.includes('?') ? '&' : '?'}autoplay=1&rel=0&enablejsapi=1`
  const percent = progress?.percent ?? (watched ? 100 : 0)
  const meta = [video.creator_name || 'Kênh YouTube', timeAgo(video.published_at)].filter(Boolean).join(' · ')

  return (
    <article className="yt-card">
      <div className="yt-thumb" onClick={playing ? undefined : onPlay}>
        {playing ? (
          <iframe
            ref={setIframeEl}
            src={src}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            {video.thumbnail && <img src={video.thumbnail} alt="" loading="lazy" />}
            <span className="yt-play"><Play size={22} fill="#fff" /></span>
            {video.duration ? <span className="yt-duration">{formatVideoDuration(video.duration)}</span> : null}
            {percent > 0 && <span className="yt-seen-bar"><i style={{ width: `${Math.min(100, percent)}%` }} /></span>}
          </>
        )}
      </div>

      <div className="yt-body">
        <span className="yt-avatar" aria-hidden>{(video.creator_name || 'Y').trim().charAt(0).toUpperCase()}</span>
        <div className="yt-text">
          <h3 className="yt-title" title={video.title}>{video.title}</h3>
          <p className="yt-meta">{meta}</p>
          {(watched || inProgress || (progress && progress.percent > 0)) && (
            <p className={`yt-status ${watched || progress?.status === 'COMPLETED' ? 'done' : ''}`}>
              {progress ? progressLabel(progress) : watched ? 'Đã xem hết' : 'Đang xem'}
            </p>
          )}
          <div className="yt-actions">
            <button type="button" className="yt-action" onClick={onPlayMini} title="Phát ở khung nhỏ, đi tab khác vẫn chạy">
              <PictureInPicture2 size={13} /> Phát nền
            </button>
            <button type="button" className={`yt-action ${watched ? 'on' : ''}`} onClick={onToggleWatched}>
              {watched ? <CheckCircle2 size={13} /> : <Circle size={13} />}
              {watched ? 'Đã xem' : 'Đánh dấu đã xem'}
            </button>
            <button type="button" className="yt-action" onClick={onShare} title="Đưa sang Xem chung">
              <Users size={13} /> Xem chung
            </button>
            <a className="yt-action" href={video.canonical_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} /> YouTube
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}
