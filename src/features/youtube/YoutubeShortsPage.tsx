import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Volume2, VolumeX, Heart,
  Share2, Bookmark, ExternalLink, Play,
  Pause, ChevronUp, ChevronDown, RefreshCw,
  Search, Flame, Music, Layers,
  Compass, Radio, Check, MessageSquare,
  History, Trash2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ToastContext'
import { setVideoStatus, getVideoStatusSets } from '../../lib/videoStatus'
import { isShortVideo, type VideoRow, type CustomCategoryItem, INITIAL_YOUTUBE_CATEGORIES } from './YoutubeView'
import { getRemoteAppSetting } from '../../lib/userAppSettings'
import { YoutubeCrawlModal, GlobalYoutubeCrawlerWatcher } from './YoutubeCrawlModal'
import './youtubeShorts.css'

export type ShortWatchHistoryItem = {
  video_id: string
  watched_at: string
}

export type ShortItem = VideoRow & {
  likesCount?: number
  commentsCount?: number
  viewsCount?: number
  isLiked?: boolean
  isSubscribed?: boolean
}

function formatShortCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function pseudoRandomCount(seedStr: string, min = 1200, max = 850000): number {
  let hash = 0
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i)
    hash |= 0
  }
  const positive = Math.abs(hash)
  return min + (positive % (max - min))
}

export function YoutubeShortsPage() {
  const { videoId: initialVideoId } = useParams<{ videoId?: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [shorts, setShorts] = useState<ShortItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState<boolean>(() => {
    return localStorage.getItem('yts_muted') !== 'false'
  })
  const [isPlaying, setIsPlaying] = useState(true)
  const [activeTab, setActiveTab] = useState<'foryou' | 'following' | 'saved' | 'history'>('foryou')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>(INITIAL_YOUTUBE_CATEGORIES)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [crawlModalOpen, setCrawlModalOpen] = useState(false)
  const [rawChannels, setRawChannels] = useState<any[]>([])

  // Lịch sử xem Shorts (lưu danh sách video đã xem, không lặp lại trong luồng xem)
  // Lịch sử xem Shorts (lưu danh sách video đã xem, không lặp lại trong luồng xem)
  const [watchHistory, setWatchHistory] = useState<ShortWatchHistoryItem[]>(() => {
    try {
      const s = localStorage.getItem('yts_watch_history')
      return s ? JSON.parse(s) : []
    } catch {
      return []
    }
  })

  // Token để làm mới feed khi đổi tab, đổi thể loại hoặc nhấn nút Làm mới
  const [feedSessionKey, setFeedSessionKey] = useState(0)

  // Danh sách ID bị loại trừ được cố định cho phiên xem hiện tại (tránh việc video đang xem bị xóa khỏi mảng gây giật và tự động nhảy sang video kế tiếp)
  const sessionExcludedWatchedIds = useMemo(() => {
    try {
      const s = localStorage.getItem('yts_watch_history')
      const hist: ShortWatchHistoryItem[] = s ? JSON.parse(s) : []
      return new Set(hist.map((w) => w.video_id))
    } catch {
      return new Set<string>()
    }
  }, [activeTab, selectedCategory, feedSessionKey])

  // Local storage sets for likes, subscriptions, and bookmarks
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('yts_liked_ids')
      return s ? new Set(JSON.parse(s)) : new Set()
    } catch {
      return new Set()
    }
  })

  const [subscribedCreators, setSubscribedCreators] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem('yts_subscribed_creators')
      return s ? new Set(JSON.parse(s)) : new Set()
    } catch {
      return new Set()
    }
  })

  const [savedVideoIds, setSavedVideoIds] = useState<Set<string>>(() => {
    const s = getVideoStatusSets('tvshow')
    const r = getVideoStatusSets('review')
    return new Set([...s.watchedSet, ...r.watchedSet])
  })

  // Animation states
  const [showHeartPop, setShowHeartPop] = useState(false)
  const [showPlayPauseBadge, setShowPlayPauseBadge] = useState<'play' | 'pause' | null>(null)
  const [expandedCaption, setExpandedCaption] = useState(false)

  const feedRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 })
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

  // Tải danh sách thể loại từ Supabase
  useEffect(() => {
    getRemoteAppSetting<CustomCategoryItem[]>('youtube_custom_categories', INITIAL_YOUTUBE_CATEGORIES)
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) setCustomCategories(res)
      })
      .catch(() => {})
  }, [])

  // Tải dữ liệu Shorts từ Supabase
  const loadShortsData = useCallback(async () => {
    setLoading(true)
    try {
      const [tvRes, revRes, tvChRes, revChRes] = await Promise.all([
        supabase?.from('tvshow_videos').select('*').is('unavailable_at', null).order('published_at', { ascending: false }).limit(2000),
        supabase?.from('review_videos').select('*').is('unavailable_at', null).order('published_at', { ascending: false }).limit(2000),
        supabase?.from('tvshow_creators').select('*').is('deleted_at', null),
        supabase?.from('review_creators').select('*').is('deleted_at', null),
      ])

      const tvVideos = ((tvRes?.data ?? []) as VideoRow[]).map((v) => ({ ...v, sourceType: 'tvshow' as const }))
      const revVideos = ((revRes?.data ?? []) as VideoRow[]).map((v) => ({ ...v, sourceType: 'review' as const }))
      const combined = [...tvVideos, ...revVideos]

      const channelsCombined = [...(tvChRes?.data ?? []), ...(revChRes?.data ?? [])]
      setRawChannels(channelsCombined)

      const catMap: Record<string, string> = (await getRemoteAppSetting<Record<string, string>>('youtube_channel_categories', {}).catch(() => ({}))) || {}
      const tagMap: Record<string, string> = (await getRemoteAppSetting<Record<string, string>>('youtube_channel_tags', {}).catch(() => ({}))) || {}

      // Lọc các video là shorts
      const shortsOnly = combined.filter((v) => isShortVideo(v))

      // Nếu số lượng shorts ít hơn 10, bổ sung các video ngắn nhất từ kho
      let finalPool = shortsOnly
      if (finalPool.length < 15) {
        const sortedByDur = combined
          .filter((v) => !shortsOnly.some((s) => s.video_id === v.video_id))
          .sort((a, b) => (a.duration || 999) - (b.duration || 999))
          .slice(0, 30)
        finalPool = [...shortsOnly, ...sortedByDur]
      }

      // Xáo trộn hoặc đưa initialVideoId lên đầu nếu có
      let mapped: ShortItem[] = finalPool.map((v) => {
        const creatorKey = v.creator_id || v.creator_name || ''
        const assignedCat = catMap[creatorKey] || catMap[v.creator_name || ''] || v.channel_category || 'Giải trí'
        const assignedTag = tagMap[creatorKey] || tagMap[v.creator_name || ''] || v.channel_tag

        return {
          ...v,
          channel_category: assignedCat,
          channel_tag: assignedTag,
          likesCount: pseudoRandomCount(v.video_id + '_likes', 5000, 480000),
          commentsCount: pseudoRandomCount(v.video_id + '_cmts', 120, 18500),
          viewsCount: pseudoRandomCount(v.video_id + '_views', 40000, 2400000),
        }
      })

      if (initialVideoId) {
        const targetIdx = mapped.findIndex((s) => s.video_id === initialVideoId)
        if (targetIdx > 0) {
          const target = mapped[targetIdx]
          mapped.splice(targetIdx, 1)
          mapped.unshift(target)
        }
      } else {
        // Xáo ngẫu nhiên
        mapped = [...mapped].sort(() => Math.random() - 0.5)
      }

      setShorts(mapped)
    } catch (err: any) {
      console.error('Lỗi tải YouTube Shorts:', err)
      showToast(`Không tải được Shorts: ${err?.message ?? err}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [initialVideoId, showToast])

  useEffect(() => {
    void loadShortsData()
  }, [loadShortsData])

  // Lọc theo Tab, Thể loại, Tìm kiếm và Lịch sử xem (không làm mất video trong phiên đang xem)
  const displayedShorts = useMemo(() => {
    let list = shorts

    if (activeTab === 'foryou') {
      // Ẩn các video đã xem từ các phiên trước
      list = list.filter((s) => !sessionExcludedWatchedIds.has(s.video_id))
    } else if (activeTab === 'following') {
      list = list.filter(
        (s) =>
          subscribedCreators.has(s.creator_id || s.creator_name || '') &&
          !sessionExcludedWatchedIds.has(s.video_id),
      )
    } else if (activeTab === 'saved') {
      list = list.filter((s) => savedVideoIds.has(s.video_id))
    } else if (activeTab === 'history') {
      // Hiển thị danh sách theo thứ tự xem gần nhất
      const historyIndexMap = new Map(watchHistory.map((w, idx) => [w.video_id, idx]))
      list = shorts
        .filter((s) => historyIndexMap.has(s.video_id))
        .sort((a, b) => (historyIndexMap.get(a.video_id) ?? 9999) - (historyIndexMap.get(b.video_id) ?? 9999))
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter((s) => s.channel_category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.creator_name && s.creator_name.toLowerCase().includes(q)) ||
          (s.channel_category && s.channel_category.toLowerCase().includes(q)) ||
          (s.channel_tag && s.channel_tag.toLowerCase().includes(q)),
      )
    }

    return list
  }, [shorts, activeTab, selectedCategory, searchQuery, subscribedCreators, savedVideoIds, sessionExcludedWatchedIds, watchHistory])

  // Ghi nhận video đã xem vào Lịch sử khi người dùng xem >= 3 giây (lưu vào localStorage mà không làm giật/xoá video đang xem)
  useEffect(() => {
    const cur = displayedShorts[activeIndex]
    if (!cur || activeTab === 'history') return

    const timer = setTimeout(() => {
      setWatchHistory((prev) => {
        const withoutCur = prev.filter((item) => item.video_id !== cur.video_id)
        const updated = [{ video_id: cur.video_id, watched_at: new Date().toISOString() }, ...withoutCur]
        try {
          localStorage.setItem('yts_watch_history', JSON.stringify(updated.slice(0, 1000)))
        } catch {}
        return updated
      })
    }, 3000)

    return () => clearTimeout(timer)
  }, [activeIndex, displayedShorts, activeTab])

  // Xóa toàn bộ lịch sử xem Shorts để xem lại từ đầu
  const handleClearHistory = () => {
    setWatchHistory([])
    try {
      localStorage.removeItem('yts_watch_history')
    } catch {}
    setFeedSessionKey((k) => k + 1)
    showToast('🗑️ Đã làm mới lịch sử xem Shorts', 'info')
  }

  // Đồng bộ lệnh Play/Pause vào iframe YouTube
  useEffect(() => {
    const cur = displayedShorts[activeIndex]
    if (cur && iframeRefs.current[cur.video_id]?.contentWindow) {
      const cmd = isPlaying ? 'playVideo' : 'pauseVideo'
      try {
        iframeRefs.current[cur.video_id]?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: cmd, args: '' }),
          '*'
        )
      } catch {}
    }
  }, [isPlaying, activeIndex, displayedShorts])

  // Đồng bộ lệnh Mute/Unmute vào iframe YouTube
  useEffect(() => {
    const cur = displayedShorts[activeIndex]
    if (cur && iframeRefs.current[cur.video_id]?.contentWindow) {
      const cmd = muted ? 'mute' : 'unMute'
      try {
        iframeRefs.current[cur.video_id]?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: cmd, args: '' }),
          '*'
        )
      } catch {}
    }
  }, [muted, activeIndex, displayedShorts])

  // Cuộn đến slide
  const scrollToIndex = useCallback((index: number) => {
    if (!feedRef.current) return
    const el = feedRef.current
    const targetY = index * el.clientHeight
    isScrollingRef.current = true
    el.scrollTo({ top: targetY, behavior: 'smooth' })
    setActiveIndex(index)
    setIsPlaying(true)
    setExpandedCaption(false)
    setTimeout(() => {
      isScrollingRef.current = false
    }, 450)
  }, [])

  // Xử lý sự kiện cuộn tự nhiên (Snap scroll detection)
  const handleScroll = () => {
    if (isScrollingRef.current || !feedRef.current) return
    const el = feedRef.current
    const height = el.clientHeight || 1
    const newIdx = Math.round(el.scrollTop / height)
    if (newIdx !== activeIndex && newIdx >= 0 && newIdx < displayedShorts.length) {
      setActiveIndex(newIdx)
      setIsPlaying(true)
      setExpandedCaption(false)
    }
  }

  // Điều khiển phím bấm (Arrow Up/Down, Space, M, L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return

      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'j') {
        e.preventDefault()
        if (activeIndex < displayedShorts.length - 1) scrollToIndex(activeIndex + 1)
      } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (activeIndex > 0) scrollToIndex(activeIndex - 1)
      } else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handleTogglePlay()
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault()
        handleToggleMute()
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault()
        const current = displayedShorts[activeIndex]
        if (current) handleToggleLike(current.video_id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, displayedShorts, scrollToIndex])

  // Toggle Mute
  const handleToggleMute = () => {
    setMuted((prev) => {
      const next = !prev
      localStorage.setItem('yts_muted', String(next))
      showToast(next ? '🔇 Đã tắt tiếng' : '🔊 Đã bật tiếng', 'info')
      return next
    })
  }

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    setIsPlaying((prev) => {
      const next = !prev
      setShowPlayPauseBadge(next ? 'play' : 'pause')
      setTimeout(() => setShowPlayPauseBadge(null), 600)
      return next
    })
  }

  // Double Tap để Thả Tim
  const handleVideoTouchOrClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now()
    const { x, y } = { x: e.clientX, y: e.clientY }
    const timeDiff = now - lastTapRef.current.time
    const distDiff = Math.hypot(x - lastTapRef.current.x, y - lastTapRef.current.y)

    if (timeDiff < 300 && distDiff < 40) {
      // Double tap detected!
      const cur = displayedShorts[activeIndex]
      if (cur) {
        if (!likedIds.has(cur.video_id)) {
          handleToggleLike(cur.video_id)
        }
        setShowHeartPop(true)
        setTimeout(() => setShowHeartPop(false), 800)
      }
      lastTapRef.current = { time: 0, x: 0, y: 0 }
    } else {
      lastTapRef.current = { time: now, x, y }
      handleTogglePlay()
    }
  }

  // Toggle Like
  const handleToggleLike = (videoId: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) {
        next.delete(videoId)
      } else {
        next.add(videoId)
        showToast('❤️ Đã thích video', 'success')
      }
      localStorage.setItem('yts_liked_ids', JSON.stringify(Array.from(next)))
      return next
    })
  }

  // Toggle Subscribe Kênh
  const handleToggleSubscribe = (creator: string) => {
    if (!creator) return
    setSubscribedCreators((prev) => {
      const next = new Set(prev)
      if (next.has(creator)) {
        next.delete(creator)
        showToast(`Đã hủy theo dõi @${creator}`, 'info')
      } else {
        next.add(creator)
        showToast(`🎉 Đã đăng ký theo dõi @${creator}`, 'success')
      }
      localStorage.setItem('yts_subscribed_creators', JSON.stringify(Array.from(next)))
      return next
    })
  }

  // Toggle Đã xem / Lưu kho
  const handleToggleSave = (video: ShortItem) => {
    const isSaved = savedVideoIds.has(video.video_id)
    const newStatus = isSaved ? 'UNWATCHED' : 'COMPLETED'
    setVideoStatus(video.video_id, video.sourceType || 'tvshow', newStatus)

    setSavedVideoIds((prev) => {
      const next = new Set(prev)
      if (isSaved) next.delete(video.video_id)
      else next.add(video.video_id)
      return next
    })

    showToast(isSaved ? 'Đã bỏ lưu video' : '⭐ Đã lưu video vào Kho đã xem', isSaved ? 'info' : 'success')
  }

  // Chia sẻ video
  const handleShare = (video: ShortItem) => {
    const url = video.canonical_url || `https://www.youtube.com/shorts/${video.video_id}`
    if (navigator.share) {
      navigator.share({ title: video.title, url }).catch(() => {})
    } else {
      void navigator.clipboard.writeText(url)
      showToast('📋 Đã sao chép link YouTube Short', 'success')
    }
  }

  const currentShort = displayedShorts[activeIndex]

  return (
    <div className="yts-app">
      {/* ─── SIDEBAR TRÁI (DESKTOP) ────────────────────────────────────────── */}
      <aside className="yts-sidebar">
        <div>
          <div className="yts-logo">
            <div className="yts-logo-icon">
              <Flame size={20} />
            </div>
            <span>Shorts</span>
          </div>

          <nav className="yts-nav">
            <button
              className={`yts-nav-item ${activeTab === 'foryou' && selectedCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('foryou')
                setSelectedCategory('ALL')
                scrollToIndex(0)
              }}
            >
              <Flame size={22} />
              <span>Dành cho bạn</span>
            </button>

            <button
              className={`yts-nav-item ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('following')
                scrollToIndex(0)
              }}
            >
              <Compass size={22} />
              <span>Đang theo dõi</span>
            </button>

            <button
              className={`yts-nav-item ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('saved')
                scrollToIndex(0)
              }}
            >
              <Bookmark size={22} />
              <span>Kho đã lưu</span>
            </button>

            <button
              className={`yts-nav-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('history')
                scrollToIndex(0)
              }}
            >
              <History size={22} />
              <span>Lịch sử xem {watchHistory.length > 0 && `(${watchHistory.length})`}</span>
            </button>

            <button
              className="yts-nav-item"
              onClick={() => setCrawlModalOpen(true)}
              style={{ marginTop: 12, color: '#ff4e45' }}
            >
              <Radio size={22} />
              <span>Cào Shorts mới</span>
            </button>
          </nav>
        </div>

        <div className="yts-sidebar-foot">
          <button className="yts-nav-item small" onClick={() => navigate('/youtube')}>
            <ArrowLeft size={18} />
            <span>Về YouTube</span>
          </button>
          <button className="yts-nav-item small" onClick={() => navigate('/home')}>
            <ArrowLeft size={18} />
            <span>Về Trang chủ</span>
          </button>
        </div>
      </aside>

      {/* ─── MAIN FEED ────────────────────────────────────────────────────── */}
      <main className="yts-main">
        {/* TOPBAR ĐIỀU HƯỚNG */}
        <div className="yts-topbar">
          <div className="yts-top-left">
            <button
              className="yts-back-btn"
              onClick={() => navigate('/youtube')}
              title="Quay lại YouTube"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="yts-top-tabs">
              <button
                className={`yts-top-tab-btn ${activeTab === 'foryou' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('foryou')
                  scrollToIndex(0)
                }}
              >
                Dành cho bạn
              </button>
              <button
                className={`yts-top-tab-btn ${activeTab === 'following' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('following')
                  scrollToIndex(0)
                }}
              >
                Theo dõi
              </button>
              <button
                className={`yts-top-tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('saved')
                  scrollToIndex(0)
                }}
              >
                Đã lưu
              </button>
              <button
                className={`yts-top-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('history')
                  scrollToIndex(0)
                }}
              >
                Lịch sử {watchHistory.length > 0 && `(${watchHistory.length})`}
              </button>
            </div>
          </div>

          <div className="yts-top-actions">
            {/* Chọn thể loại nhanh */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                scrollToIndex(0)
              }}
              style={{
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 16,
                padding: '5px 10px',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
            >
              <option value="ALL">✨ Tất cả thể loại</option>
              {customCategories.map((c) => (
                <option key={c.id || c.label} value={c.label}>
                  {c.icon || '🏷️'} {c.label}
                </option>
              ))}
            </select>

            {/* Nút bật/tắt tiếng */}
            <button
              className="yts-icon-btn"
              onClick={handleToggleMute}
              title={muted ? 'Bật tiếng (M)' : 'Tắt tiếng (M)'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Nút làm mới nguồn video */}
            <button
              className="yts-icon-btn"
              onClick={() => {
                setFeedSessionKey((k) => k + 1)
                scrollToIndex(0)
                showToast('🔄 Đã làm mới nguồn Shorts', 'info')
              }}
              title="Làm mới nguồn video"
            >
              <RefreshCw size={18} />
            </button>

            {/* Nút tìm kiếm */}
            <button
              className="yts-icon-btn"
              onClick={() => setShowSearchModal(true)}
              title="Tìm kiếm Shorts"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        {/* BẬT TIẾNG PILL (KHI ĐANG MUTE) */}
        {muted && displayedShorts.length > 0 && (
          <div className="yts-unmute-pill" onClick={handleToggleMute}>
            <VolumeX size={15} /> Chạm để bật tiếng
          </div>
        )}

        {/* BANNER THÔNG BÁO LỊCH SỬ VÀ NÚT XOÁ */}
        {activeTab === 'history' && displayedShorts.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 58,
              left: 12,
              right: 12,
              zIndex: 25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              borderRadius: 12,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontSize: '0.76rem',
              color: '#fff',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <History size={14} color="#8b5cf6" />
              <span>Đang xem lại lịch sử ({displayedShorts.length} video)</span>
            </span>
            <button
              type="button"
              onClick={handleClearHistory}
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                color: '#ff6b6b',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: 8,
                padding: '4px 9px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Trash2 size={12} /> Xoá lịch sử
            </button>
          </div>
        )}

        {/* FEED CUỘN DỌC LIÊN TỤC (SNAP SCROLL) */}
        <div className="yts-feed" ref={feedRef} onScroll={handleScroll}>
          {loading ? (
            <div className="yts-empty-state">
              <RefreshCw size={36} className="tv-spin" color="#ff0000" />
              <p style={{ marginTop: 14, fontWeight: 700 }}>Đang tải Shorts...</p>
            </div>
          ) : displayedShorts.length === 0 ? (
            <div className="yts-empty-state">
              {activeTab === 'history' ? (
                <>
                  <History size={48} color="#8b5cf6" />
                  <h3 style={{ marginTop: 12, color: '#fff' }}>Chưa có lịch sử xem</h3>
                  <p style={{ fontSize: '0.84rem', marginTop: 4, maxWidth: 320 }}>
                    Khi bạn lướt xem các video Shorts, chúng sẽ được lưu vào đây và tự động ẩn khỏi luồng gợi ý để bạn không bị xem trùng lặp.
                  </p>
                  <button
                    type="button"
                    className="tv-btn primary"
                    onClick={() => setActiveTab('foryou')}
                    style={{ marginTop: 16, background: '#ff0000', borderRadius: 20, padding: '10px 24px', fontWeight: 700 }}
                  >
                    Xem Shorts ngay
                  </button>
                </>
              ) : activeTab === 'foryou' && watchHistory.length > 0 ? (
                <>
                  <Check size={48} color="#10b981" />
                  <h3 style={{ marginTop: 12, color: '#fff' }}>Bạn đã xem hết video mới!</h3>
                  <p style={{ fontSize: '0.84rem', marginTop: 4, maxWidth: 340 }}>
                    Bạn đã xem hết {watchHistory.length} video. Không có video nào bị phát lặp lại.
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="tv-btn"
                      onClick={() => setActiveTab('history')}
                      style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '9px 18px', fontWeight: 700 }}
                    >
                      <History size={15} style={{ marginRight: 5 }} /> Xem lại Lịch sử
                    </button>
                    <button
                      type="button"
                      className="tv-btn"
                      onClick={handleClearHistory}
                      style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 20, padding: '9px 18px', fontWeight: 700 }}
                    >
                      <RefreshCw size={15} style={{ marginRight: 5 }} /> Làm mới xem lại từ đầu
                    </button>
                    <button
                      type="button"
                      className="tv-btn primary"
                      onClick={() => setCrawlModalOpen(true)}
                      style={{ background: '#ff0000', borderRadius: 20, padding: '9px 18px', fontWeight: 700 }}
                    >
                      <Radio size={15} style={{ marginRight: 5 }} /> Cào thêm Shorts mới
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Flame size={48} color="#555" />
                  <h3 style={{ marginTop: 12, color: '#fff' }}>Chưa có Shorts nào phù hợp</h3>
                  <p style={{ fontSize: '0.84rem', marginTop: 4 }}>
                    Bấm vào nút bên dưới để quét thêm video ngắn từ các kênh YouTube của bạn.
                  </p>
                  <button
                    type="button"
                    className="tv-btn primary"
                    onClick={() => setCrawlModalOpen(true)}
                    style={{ marginTop: 16, background: '#ff0000', borderRadius: 20, padding: '10px 24px', fontWeight: 700 }}
                  >
                    <Radio size={16} style={{ marginRight: 6 }} /> Cào Shorts từ các kênh
                  </button>
                </>
              )}
            </div>
          ) : (
            displayedShorts.map((short, idx) => {
              const isActive = idx === activeIndex
              const isNear = Math.abs(idx - activeIndex) <= 1
              const isLiked = likedIds.has(short.video_id)
              const isSubscribed = subscribedCreators.has(short.creator_id || short.creator_name || '')
              const isSaved = savedVideoIds.has(short.video_id)

              // Tạo URL nhúng chuẩn YouTube Shorts
              const embedUrl = `https://www.youtube.com/embed/${short.video_id}?autoplay=${isActive ? 1 : 0}&mute=${muted ? 1 : 0}&loop=1&playlist=${short.video_id}&enablejsapi=1&playsinline=1&rel=0`

              return (
                <section className="yts-slide" key={`${short.video_id}_${idx}`}>
                  <div className="yts-stage">
                    <div className="yts-player-wrap">
                      {/* Ảnh poster nền */}
                      {short.thumbnail && (
                        <div className="yts-poster-wrap">
                          <img
                            src={short.thumbnail}
                            alt=""
                            className={isNear ? 'yts-poster-blur' : 'yts-poster-img'}
                          />
                        </div>
                      )}

                      {/* Video Player */}
                      {isNear && (
                        <iframe
                          ref={(el) => {
                            iframeRefs.current[short.video_id] = el
                          }}
                          className="yts-iframe"
                          src={embedUrl}
                          title={short.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      )}

                      {/* Overlay bắt click / double click */}
                      <div className="yts-click-overlay" onClick={handleVideoTouchOrClick} />

                      {/* Icon Play/Pause Ripple */}
                      {isActive && showPlayPauseBadge && (
                        <div className="yts-center-badge">
                          {showPlayPauseBadge === 'play' ? <Play size={36} fill="#fff" /> : <Pause size={36} fill="#fff" />}
                        </div>
                      )}

                      {/* Tim bung nở khi Double Tap */}
                      {isActive && showHeartPop && (
                        <div className="yts-heart-pop">
                          <Heart size={90} fill="#ff0000" color="#ff0000" />
                        </div>
                      )}

                      {/* OVERLAY THÔNG TIN DƯỚI CÙNG (KÊNH, TIÊU ĐỀ, ÂM THANH) */}
                      <div className="yts-bottom-overlay">
                        {/* Hàng thông tin kênh */}
                        <div className="yts-channel-row">
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: '#333',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              color: '#fff',
                              border: '1.5px solid rgba(255,255,255,0.4)',
                              flexShrink: 0,
                            }}
                          >
                            {(short.creator_name || 'Y')[0].toUpperCase()}
                          </div>

                          <div className="yts-channel-name">
                            @{short.creator_name || 'youtubeshorts'}
                          </div>

                          <button
                            className={`yts-sub-btn ${isSubscribed ? 'subscribed' : ''}`}
                            onClick={() => handleToggleSubscribe(short.creator_id || short.creator_name || '')}
                          >
                            {isSubscribed ? 'Đang theo dõi' : 'Đăng ký'}
                          </button>
                        </div>

                        {/* Tiêu đề & Caption */}
                        <div
                          className={`yts-caption-box ${expandedCaption ? 'expanded' : ''}`}
                          onClick={() => setExpandedCaption((prev) => !prev)}
                        >
                          {short.title}
                        </div>

                        {/* Thể loại & Tag pills */}
                        <div className="yts-tags-row">
                          {short.channel_category && (
                            <span className="yts-tag-pill">
                              <Layers size={11} style={{ display: 'inline', marginRight: 3 }} />
                              {short.channel_category}
                            </span>
                          )}
                          {short.channel_tag && (
                            <span className="yts-tag-pill">
                              #{short.channel_tag}
                            </span>
                          )}
                        </div>

                        {/* Âm thanh gốc Marquee */}
                        <div className="yts-audio-row">
                          <Music size={13} color="#fff" />
                          <span className="yts-audio-marquee">
                            Âm thanh gốc - @{short.creator_name || 'youtube'}
                          </span>
                        </div>
                      </div>

                      {/* RAIL HÀNH ĐỘNG BÊN PHẢI (AUTHENTIC YOUTUBE SHORTS RAIL) */}
                      <div className="yts-rail">
                        {/* 1. Nút Thích (Like) */}
                        <button
                          className={`yts-rail-item ${isLiked ? 'active' : ''}`}
                          onClick={() => handleToggleLike(short.video_id)}
                          title="Thích video (L)"
                        >
                          <div className="yts-rail-btn">
                            <Heart size={24} fill={isLiked ? '#ff3b30' : 'none'} color={isLiked ? '#ff3b30' : '#fff'} />
                          </div>
                          <span className="yts-rail-label">{formatShortCount((short.likesCount || 1000) + (isLiked ? 1 : 0))}</span>
                        </button>

                        {/* 2. Nút Bình luận (Comments) */}
                        <button
                          className="yts-rail-item"
                          onClick={() => setShowCommentsModal(true)}
                          title="Bình luận & Chi tiết"
                        >
                          <div className="yts-rail-btn">
                            <MessageSquare size={22} />
                          </div>
                          <span className="yts-rail-label">{formatShortCount(short.commentsCount || 120)}</span>
                        </button>

                        {/* 3. Nút Lưu / Đã xem (Save) */}
                        <button
                          className={`yts-rail-item ${isSaved ? 'active' : ''}`}
                          onClick={() => handleToggleSave(short)}
                          title={isSaved ? 'Đã lưu trong Kho' : 'Lưu vào Kho'}
                        >
                          <div className="yts-rail-btn">
                            <Bookmark size={22} fill={isSaved ? '#ff4e45' : 'none'} color={isSaved ? '#ff4e45' : '#fff'} />
                          </div>
                          <span className="yts-rail-label">{isSaved ? 'Đã lưu' : 'Lưu'}</span>
                        </button>

                        {/* 4. Nút Chia sẻ (Share) */}
                        <button
                          className="yts-rail-item"
                          onClick={() => handleShare(short)}
                          title="Chia sẻ"
                        >
                          <div className="yts-rail-btn">
                            <Share2 size={22} />
                          </div>
                          <span className="yts-rail-label">Chia sẻ</span>
                        </button>

                        {/* 5. Xem trên YouTube / Watch Page */}
                        <button
                          className="yts-rail-item"
                          onClick={() => navigate(`/youtube/watch/${short.video_id}`)}
                          title="Xem trang phát chi tiết"
                        >
                          <div className="yts-rail-btn">
                            <ExternalLink size={20} />
                          </div>
                          <span className="yts-rail-label">Chi tiết</span>
                        </button>

                        {/* 6. Đĩa than xoay âm nhạc */}
                        <div className="yts-vinyl-disc" title="Âm thanh gốc">
                          {short.thumbnail ? (
                            <img src={short.thumbnail} alt="" />
                          ) : (
                            <Music size={16} color="#fff" />
                          )}
                        </div>
                      </div>

                      {/* ĐIỀU HƯỚNG LÊN / XUỐNG DÀNH CHO DESKTOP */}
                      <div className="yts-desktop-nav">
                        <button
                          className="yts-nav-arrow"
                          disabled={idx === 0}
                          onClick={() => scrollToIndex(idx - 1)}
                          style={{ opacity: idx === 0 ? 0.3 : 1 }}
                          title="Short trước (Mũi tên lên)"
                        >
                          <ChevronUp size={24} />
                        </button>
                        <button
                          className="yts-nav-arrow"
                          disabled={idx === displayedShorts.length - 1}
                          onClick={() => scrollToIndex(idx + 1)}
                          style={{ opacity: idx === displayedShorts.length - 1 ? 0.3 : 1 }}
                          title="Short kế tiếp (Mũi tên xuống)"
                        >
                          <ChevronDown size={24} />
                        </button>
                      </div>

                      {/* TIMELINE PROGRESS LINE */}
                      {isActive && (
                        <div className="yts-timeline">
                          <div className="yts-timeline-fill" style={{ width: isPlaying ? '100%' : '50%', transition: 'width 20s linear' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )
            })
          )}
        </div>
      </main>

      {/* MODAL TÌM KIẾM SHORTS */}
      {showSearchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowSearchModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              background: '#18181b',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.15)',
              padding: 18,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>
              🔍 Tìm kiếm YouTube Shorts
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                autoFocus
                placeholder="Nhập từ khóa, hashtag hoặc tên kênh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowSearchModal(false)
                    scrollToIndex(0)
                  }
                }}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: 10,
                  background: '#09090b',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontSize: '0.86rem',
                }}
              />
              <button
                type="button"
                className="tv-btn primary"
                onClick={() => {
                  setShowSearchModal(false)
                  scrollToIndex(0)
                }}
                style={{ background: '#ff0000', borderRadius: 10, fontWeight: 700, padding: '0 16px' }}
              >
                Tìm
              </button>
            </div>

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setShowSearchModal(false)
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: '#aaa',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Xóa tìm kiếm (Hiện tất cả Shorts)
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL BÌNH LUẬN & THÔNG TIN SHORT */}
      {showCommentsModal && currentShort && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setShowCommentsModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '75dvh',
              background: '#18181b',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeInUp 0.3s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff' }}>
                Bình luận ({formatShortCount(currentShort.commentsCount || 120)})
              </div>
              <button
                type="button"
                onClick={() => setShowCommentsModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}>@{currentShort.creator_name}</div>
                <div>{currentShort.title}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <a
                    href={currentShort.canonical_url || `https://www.youtube.com/shorts/${currentShort.video_id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#ff4e45', fontWeight: 700, textDecoration: 'none', fontSize: '0.78rem' }}
                  >
                    Xem đầy đủ trên YouTube ↗
                  </a>
                </div>
              </div>

              {/* Fake top comments */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                  A
                </div>
                <div>
                  <div style={{ fontSize: '0.76rem', color: '#888' }}>@anh_tuan • 2 giờ trước</div>
                  <div style={{ fontSize: '0.82rem', marginTop: 2, color: '#fff' }}>Video cuốn quá xem đi xem lại mãi không chán! 🔥</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#10b981', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                  M
                </div>
                <div>
                  <div style={{ fontSize: '0.76rem', color: '#888' }}>@minh_hieu • 5 giờ trước</div>
                  <div style={{ fontSize: '0.82rem', marginTop: 2, color: '#fff' }}>Kênh này ra video chất lượng thật sự, đã đăng ký kênh 👍</div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Thêm bình luận..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 18,
                  background: '#09090b',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
              />
              <button
                type="button"
                className="tv-btn primary"
                onClick={() => {
                  showToast('Đã gửi bình luận', 'success')
                  setShowCommentsModal(false)
                }}
                style={{ background: '#ff0000', borderRadius: 18, padding: '0 14px', fontWeight: 700 }}
              >
                <Check size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CÀO SHORTS TỪ KÊNH */}
      {crawlModalOpen && (
        <YoutubeCrawlModal
          isOpen={crawlModalOpen}
          onClose={() => setCrawlModalOpen(false)}
          channels={rawChannels}
        />
      )}

      {/* TIẾN TRÌNH CÀO NỀN */}
      <GlobalYoutubeCrawlerWatcher onFinished={() => void loadShortsData()} />
    </div>
  )
}
