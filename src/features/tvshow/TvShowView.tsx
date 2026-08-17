import { useEffect, useMemo, useRef, useState } from 'react'
import { 
  ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Circle, CornerDownLeft, 
  ExternalLink, Film, Pause, Play, Plus, Radio, Search, Trash2, Tv, Video, 
  Youtube, Clock, Settings, Gauge, Zap, Sliders, Bookmark, Bell, MoreVertical, 
  Copy, Check, ChevronRight, ArrowUpDown, SlidersHorizontal, Moon, RefreshCw,
  Download, Loader2, Sparkles, AlertCircle, Save, LayoutGrid, Layers
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchYouTubeMeta, youtubeVideoId } from '../../lib/youtubeMeta'
import { Modal } from '../shared'
import { useHideHeader } from '../HeaderAction'
import { 
  CategorizedGroup, 
  detectVideoCategory, 
  groupVideosByCategory 
} from '../../lib/videoCategorizer'
import { CategoryDetailView } from './CategoryDetailView'
import './tvShow.css'

const MISSING_TABLE_CODES = ['42P01', 'PGRST205']

type ChannelItem = {
  id: string
  platform: string
  creator_url: string
  creator_name: string
  creator_id: string | null
  videoCount: number
  watchedCount: number
  cover: string | null
  lastSyncedAt: string | null
}

type VideoRow = {
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
    valid.push({ videoId, url: `https://www.youtube.com/watch?v=${videoId}` })
  }

  return { valid, invalid }
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Tab TV Show:
 * Hỗ trợ 2 chế độ xem: Xem theo Kênh và Xem theo Thể Loại (Tự động phân loại theo tiêu đề video).
 */
export function TvShowView() {
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [allVideos, setAllVideos] = useState<VideoRow[]>([])
  const [watchedSet, setWatchedSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'channel' | 'category'>('channel')
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<CategorizedGroup<VideoRow> | null>(null)
  const [addChannelOpen, setAddChannelOpen] = useState(false)
  const [addVideoOpen, setAddVideoOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Tải danh sách Kênh & Toàn bộ video TV Show
  useEffect(() => {
    let alive = true
    setLoading(true)

    void (async () => {
      // 1. Lấy danh sách creators
      const creatorsRes = await supabase
        ?.from('tvshow_creators')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (creatorsRes?.error && MISSING_TABLE_CODES.includes(creatorsRes.error.code ?? '')) {
        if (alive) {
          setNeedsMigration(true)
          setLoading(false)
        }
        return
      }

      const creators = (creatorsRes?.data ?? []) as any[]

      // 2. Lấy danh sách video
      const [videosRes, watchedRes] = await Promise.all([
        supabase
          ?.from('tvshow_videos')
          .select('id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at')
          .is('unavailable_at', null)
          .order('published_at', { ascending: false }),
        supabase?.from('tvshow_watched').select('video_id'),
      ])

      const videos = (videosRes?.data ?? []) as VideoRow[]
      const watchedIds = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((w) => w.video_id))

      // Gom video theo creator
      const statsByCreator = new Map<string, { total: number; watched: number; cover: string | null }>()

      for (const v of videos) {
        const key = v.creator_id || v.creator_name || 'manual'
        const stat = statsByCreator.get(key) ?? { total: 0, watched: 0, cover: null }
        stat.total += 1
        if (watchedIds.has(v.video_id)) stat.watched += 1
        if (!stat.cover && v.thumbnail) stat.cover = v.thumbnail
        statsByCreator.set(key, stat)
      }

      // Xây dựng danh sách Channel Cards
      const channelCards: ChannelItem[] = creators.map((c) => {
        const key = c.creator_id || c.creator_name || c.id
        const stat = statsByCreator.get(key) || statsByCreator.get(c.creator_name) || { total: 0, watched: 0, cover: null }
        return {
          id: c.id,
          platform: c.platform,
          creator_url: c.creator_url,
          creator_name: c.creator_name || 'Kênh YouTube',
          creator_id: c.creator_id,
          videoCount: stat.total,
          watchedCount: stat.watched,
          cover: stat.cover,
          lastSyncedAt: c.last_synced_at,
        }
      })

      // Nếu có video tự thêm mà không thuộc creator nào trong danh sách
      const manualStat = statsByCreator.get('manual')
      if (manualStat && manualStat.total > 0 && !creators.some((c) => c.creator_id === 'manual')) {
        channelCards.push({
          id: 'manual',
          platform: 'youtube',
          creator_url: '',
          creator_name: 'Video tự thêm',
          creator_id: 'manual',
          videoCount: manualStat.total,
          watchedCount: manualStat.watched,
          cover: manualStat.cover,
          lastSyncedAt: null,
        })
      }

      if (alive) {
        setChannels(channelCards)
        setAllVideos(videos)
        setWatchedSet(watchedIds)
        setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [reloadKey])

  // Gom nhóm video theo Thể Loại tự động dựa vào tiêu đề
  const categoryGroups = useMemo(() => {
    return groupVideosByCategory(allVideos, 'tvshow', watchedSet)
  }, [allVideos, watchedSet])

  // Lọc kênh theo tìm kiếm
  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return channels
    return channels.filter((c) => c.creator_name.toLowerCase().includes(q))
  }, [channels, search])

  // Lọc thể loại theo tìm kiếm
  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categoryGroups
    return categoryGroups.filter(
      (g) =>
        g.category.name.toLowerCase().includes(q) ||
        g.category.description.toLowerCase().includes(q) ||
        g.videos.some((v) => v.title.toLowerCase().includes(q))
    )
  }, [categoryGroups, search])

  const deleteChannel = async (channel: ChannelItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Xoá kênh "${channel.creator_name}" cùng toàn bộ video của kênh này?`)) return
    setLoading(true)

    if (channel.id !== 'manual') {
      await supabase?.from('tvshow_creators').delete().eq('id', channel.id)
    }

    if (channel.creator_id) {
      await supabase?.from('tvshow_videos').delete().eq('creator_id', channel.creator_id)
      await supabase?.from('tvshow_series').delete().eq('creator_id', channel.creator_id)
    } else {
      await supabase?.from('tvshow_videos').delete().eq('creator_name', channel.creator_name)
      await supabase?.from('tvshow_series').delete().eq('creator_name', channel.creator_name)
    }

    setReloadKey((k) => k + 1)
  }

  // Nếu đang mở chi tiết 1 Thể loại
  if (selectedCategory) {
    return (
      <CategoryDetailView
        group={selectedCategory}
        type="tvshow"
        onBack={() => {
          setSelectedCategory(null)
          setReloadKey((k) => k + 1)
        }}
      />
    )
  }

  // Nếu đang mở chi tiết 1 kênh
  if (selectedChannel) {
    return (
      <ChannelDetailView
        channel={selectedChannel}
        onBack={() => {
          setSelectedChannel(null)
          setReloadKey((k) => k + 1)
        }}
      />
    )
  }

  return (
    <section className="tv-page">
      {/* Toolbar & Switch Chế độ */}
      <div className="tv-bar">
        {/* Toggle Kênh / Thể loại */}
        <div className="tv-view-mode-toggle">
          <button
            type="button"
            className={`tv-mode-btn ${viewMode === 'channel' ? 'active' : ''}`}
            onClick={() => setViewMode('channel')}
          >
            <Radio size={14} /> Theo kênh ({channels.length})
          </button>
          <button
            type="button"
            className={`tv-mode-btn ${viewMode === 'category' ? 'active' : ''}`}
            onClick={() => setViewMode('category')}
          >
            <Layers size={14} /> Theo thể loại ({categoryGroups.length})
          </button>
        </div>

        {/* Ô Tìm kiếm */}
        <div className="tv-search-box">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            className="tv-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              viewMode === 'channel'
                ? 'Tìm kiếm kênh YouTube…'
                : 'Tìm thể loại, kỹ năng (học tập, tự tin, giao tiếp…)'
            }
          />
        </div>

        {/* Nút hành động */}
        <button className="tv-btn primary" onClick={() => setAddChannelOpen(true)}>
          <Radio size={14} /> Thêm kênh
        </button>
        <button className="tv-btn" onClick={() => setAddVideoOpen(true)}>
          <Plus size={14} /> Thêm video lẻ
        </button>
      </div>

      {needsMigration ? (
        <div className="tv-empty">
          Chưa có bảng TV Show trên Supabase. Chạy migration <code>20260915000000_tvshow_channels.sql</code> trên SQL Editor rồi tải lại trang.
        </div>
      ) : loading ? (
        <div className="tv-empty">Đang tải danh sách video & kênh…</div>
      ) : viewMode === 'category' ? (
        /* CHẾ ĐỘ XEM THEO THỂ LOẠI (Học tập, Tự tin, Giao tiếp, Kinh doanh,...) */
        !filteredCategories.length ? (
          <div className="tv-empty">
            {search
              ? `Không tìm thấy thể loại nào khớp “${search}”.`
              : 'Chưa có video nào để phân loại thể loại.'}
          </div>
        ) : (
          <div className="tv-category-grid">
            {filteredCategories.map((g) => {
              const isDone = g.totalCount > 0 && g.watchedCount >= g.totalCount
              const percent = g.totalCount > 0 ? Math.round((g.watchedCount / g.totalCount) * 100) : 0

              return (
                <div
                  key={g.category.id}
                  className="tv-category-card"
                  onClick={() => setSelectedCategory(g)}
                >
                  <div className="tv-category-cover">
                    {g.cover ? (
                      <img src={g.cover} alt={g.category.name} loading="lazy" />
                    ) : (
                      <div className="tv-category-cover-fallback">
                        {g.category.icon}
                      </div>
                    )}

                    <span className="tv-category-icon-pill">
                      <span>{g.category.icon}</span> THỂ LOẠI
                    </span>

                    <span className="tv-count-pill">
                      {g.totalCount} video
                    </span>

                    {g.watchedCount > 0 && (
                      <span className={`tv-seen-pill${isDone ? ' done' : ''}`}>
                        {isDone ? 'Đã xem hết' : `Đã xem ${g.watchedCount}/${g.totalCount}`}
                      </span>
                    )}
                  </div>

                  <div className="tv-category-body">
                    <div className="tv-category-title">{g.category.name}</div>
                    <div className="tv-category-desc">{g.category.description}</div>

                    {g.totalCount > 0 && (
                      <div className="tv-channel-progress" style={{ marginTop: 4 }}>
                        <div className="tv-channel-progress-head">
                          <span>Tiến độ xem</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="tv-channel-progress-bar">
                          <div
                            className="tv-channel-progress-fill"
                            style={{
                              width: `${percent}%`,
                              background: g.category.color || 'var(--primary)',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* CHẾ ĐỘ XEM THEO KÊNH (1 Kênh = 1 Card) */
        !filteredChannels.length ? (
          <div className="tv-empty">
            {search
              ? `Không tìm thấy kênh nào khớp “${search}”.`
              : 'Chưa có kênh nào. Bấm “Thêm kênh” rồi dán link YouTube để cào toàn bộ video về.'}
          </div>
        ) : (
          <div className="tv-channel-grid">
            {filteredChannels.map((c) => {
              const isDone = c.videoCount > 0 && c.watchedCount >= c.videoCount
              const percent = c.videoCount > 0 ? Math.round((c.watchedCount / c.videoCount) * 100) : 0

              return (
                <div
                  key={c.id}
                  className="tv-channel-card"
                  onClick={() => setSelectedChannel(c)}
                >
                  <div className="tv-channel-cover">
                    {c.cover ? (
                      <img src={c.cover} alt={c.creator_name} loading="lazy" />
                    ) : (
                      <div className="tv-channel-cover-empty">
                        <Tv size={36} />
                      </div>
                    )}

                    <span className="tv-badge-live">
                      <Radio size={11} /> KÊNH
                    </span>

                    <span className="tv-count-pill">
                      {c.videoCount} video
                    </span>

                    {c.watchedCount > 0 && (
                      <span className={`tv-seen-pill${isDone ? ' done' : ''}`}>
                        {isDone ? 'Đã xem hết' : `Đã xem ${c.watchedCount}/${c.videoCount}`}
                      </span>
                    )}
                  </div>

                  <div className="tv-channel-body">
                    <div className="tv-channel-header">
                      <div className="tv-channel-title">{c.creator_name}</div>
                      <button
                        className="tv-btn"
                        style={{ padding: '4px 6px', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
                        onClick={(e) => void deleteChannel(c, e)}
                        title="Xoá kênh này"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <span className="tv-channel-sub">
                      {c.videoCount > 0 ? `Tổng cộng ${c.videoCount} video` : 'Chưa có video'}
                    </span>

                    {c.videoCount > 0 && (
                      <div className="tv-channel-progress">
                        <div className="tv-channel-progress-head">
                          <span>Tiến độ xem</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="tv-channel-progress-bar">
                          <div
                            className="tv-channel-progress-fill"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {addChannelOpen && (
        <AddTvShowChannelModal
          onClose={() => setAddChannelOpen(false)}
          onSynced={() => setReloadKey((k) => k + 1)}
        />
      )}

      {addVideoOpen && (
        <AddTvShowMovieModal
          onClose={() => setAddVideoOpen(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </section>
  )
}

/**
 * Màn hình xem chi tiết 1 Kênh (Gộp toàn bộ video của kênh).
 * Thiết kế giao diện khớp chuẩn 100% hình ảnh (Header, Player, 4 Nút Hành Động, Playlist).
 */
function ChannelDetailView({
  channel,
  onBack,
}: {
  channel: ChannelItem
  onBack: () => void
}) {
  useHideHeader(true)

  const [videos, setVideos] = useState<VideoRow[]>([])
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isPlayerActive, setIsPlayerActive] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unwatched' | 'watched'>('all')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tvshow_playback_rate')
      return saved ? parseFloat(saved) : 1
    } catch {
      return 1
    }
  })

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSpeedModal, setShowSpeedModal] = useState(false)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null)
  const [selectedVideoForMenu, setSelectedVideoForMenu] = useState<VideoRow | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerBoxRef = useRef<HTMLDivElement>(null)

  const sendYouTubeCommand = (func: string, args: any[] = []) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({
        event: 'command',
        func,
        args,
      }),
      '*'
    )
  }

  const applyPlaybackRate = (rate: number) => {
    setPlaybackRate(rate)
    try {
      localStorage.setItem('tvshow_playback_rate', String(rate))
    } catch {}
    sendYouTubeCommand('setPlaybackRate', [rate])
  }

  // Sleep timer handler
  useEffect(() => {
    if (!sleepTimerMinutes) return
    const timer = setTimeout(() => {
      sendYouTubeCommand('pauseVideo')
      setSleepTimerMinutes(null)
      alert('⏱️ Đã hết giờ hẹn! Trình phát video đã tạm dừng.')
    }, sleepTimerMinutes * 60 * 1000)

    return () => clearTimeout(timer)
  }, [sleepTimerMinutes])

  useEffect(() => {
    void (async () => {
      let query = supabase
        ?.from('tvshow_videos')
        .select('id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at')
        .is('unavailable_at', null)

      if (channel.id === 'manual') {
        query = query?.eq('creator_id', 'manual')
      } else if (channel.creator_id) {
        query = query?.or(`creator_id.eq.${channel.creator_id},creator_name.eq.${channel.creator_name}`)
      } else {
        query = query?.eq('creator_name', channel.creator_name)
      }

      const [videoRes, watchedRes] = await Promise.all([
        query?.order('part_number', { ascending: true, nullsFirst: false }).order('published_at', { ascending: false }),
        supabase?.from('tvshow_watched').select('video_id'),
      ])

      const rows = (videoRes?.data ?? []) as VideoRow[]
      setVideos(rows)

      const watchedSet = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((r) => r.video_id))
      setWatched(watchedSet)

      // Mặc định chọn video chưa xem đầu tiên
      const firstUnwatched = rows.find((r) => !watchedSet.has(r.video_id))
      setPlayingId(firstUnwatched ? firstUnwatched.video_id : rows[0]?.video_id ?? null)
      setLoading(false)
    })()
  }, [channel])

  const filteredVideos = useMemo(() => {
    let result = [...videos]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((v) => v.title.toLowerCase().includes(q))
    }
    if (filterMode === 'unwatched') {
      result = result.filter((v) => !watched.has(v.video_id))
    } else if (filterMode === 'watched') {
      result = result.filter((v) => watched.has(v.video_id))
    }

    if (sortOrder === 'asc') {
      result.reverse()
    }
    return result
  }, [videos, search, filterMode, watched, sortOrder])

  const currentIndex = filteredVideos.findIndex((v) => v.video_id === playingId)
  const currentVideo = currentIndex >= 0 ? filteredVideos[currentIndex] : (videos.find(v => v.video_id === playingId) || videos[0])

  const toggleWatched = async (videoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const isWatched = watched.has(videoId)
    const next = new Set(watched)
    if (isWatched) {
      next.delete(videoId)
      setWatched(next)
      await supabase?.from('tvshow_watched').delete().eq('platform', 'youtube').eq('video_id', videoId)
    } else {
      next.add(videoId)
      setWatched(next)
      await supabase?.from('tvshow_watched').upsert({
        platform: 'youtube',
        video_id: videoId,
        watched_at: new Date().toISOString(),
      })
    }
  }

  const watchedCountInChannel = useMemo(() => {
    return videos.filter((v) => watched.has(v.video_id)).length
  }, [videos, watched])

  const currentIsWatched = currentVideo ? watched.has(currentVideo.video_id) : false
  const embedBase = currentVideo?.embed_url || (currentVideo?.video_id ? `https://www.youtube-nocookie.com/embed/${currentVideo.video_id}` : '')
  const embedSrc = embedBase ? `${embedBase}${embedBase.includes('?') ? '&' : '?'}autoplay=1&rel=0&enablejsapi=1` : ''

  return (
    <div className="tv-detail">
      {/* 1. Header Top Bar (Quay lại < | TV Show | Chuông thông báo 3 | Bookmark) */}
      <div className="tv-detail-bar">
        <button 
          type="button" 
          className="tv-back-circle-btn" 
          onClick={onBack} 
          aria-label="Quay lại danh sách kênh"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="tv-detail-title-wrap">
          <Tv size={20} color="#f59e0b" />
          <span className="tv-header-title-text">TV Show</span>
        </div>

        <div className="tv-header-right-actions">
          <button 
            type="button" 
            className="tv-header-icon-btn" 
            title="Thông báo"
            onClick={() => alert('Bạn không có thông báo mới.')}
          >
            <Bell size={18} />
            <span className="tv-header-badge">3</span>
          </button>
          <button 
            type="button" 
            className="tv-header-icon-btn" 
            title="Lưu kênh"
            onClick={() => alert('Đã lưu kênh vào danh sách yêu thích!')}
          >
            <Bookmark size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="tv-empty">Đang tải danh sách video…</div>
      ) : !videos.length ? (
        <div className="tv-empty">Kênh này chưa có video nào.</div>
      ) : (
        <>
          {/* 2. Main Player Card (Player + Meta + 4 NÚT HÀNG NGANG) */}
          <div ref={playerBoxRef} className="tv-main-player-card">
            {/* Khung video / Poster */}
            <div className="tv-player-frame-wrapper">
              {isPlayerActive && currentVideo && embedSrc ? (
                <iframe
                  ref={iframeRef}
                  src={embedSrc}
                  title={currentVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => {
                    if (playbackRate !== 1) {
                      setTimeout(() => sendYouTubeCommand('setPlaybackRate', [playbackRate]), 400)
                      setTimeout(() => sendYouTubeCommand('setPlaybackRate', [playbackRate]), 1200)
                    }
                  }}
                />
              ) : currentVideo ? (
                <button
                  type="button"
                  className="tv-player-poster-btn"
                  onClick={() => setIsPlayerActive(true)}
                  title="Nhấn để phát video"
                >
                  <img
                    src={currentVideo.thumbnail || `https://i.ytimg.com/vi/${currentVideo.video_id}/hqdefault.jpg`}
                    alt={currentVideo.title}
                  />
                  <div className="tv-player-play-overlay">
                    <Play size={28} fill="#ffffff" style={{ marginLeft: 3 }} />
                  </div>
                </button>
              ) : (
                <div className="tv-channel-cover-empty">Chưa có video</div>
              )}
            </div>

            {/* Tiêu đề & Kênh */}
            {currentVideo && (
              <div className="tv-video-info-block">
                <div className="tv-video-title-main">{currentVideo.title}</div>
                <div className="tv-video-creator-link">
                  {channel.creator_name} <ChevronRight size={14} />
                </div>
              </div>
            )}

            {/* 3. BẢNG 4 NÚT HÀNG NGANG: Đánh dấu | Tốc độ | Hẹn giờ | Cài đặt */}
            <div className="tv-action-grid-4">
              {/* Nút 1: Đánh dấu đã xem */}
              <button
                type="button"
                className={`tv-action-card-btn ${currentIsWatched ? 'active is-watched' : ''}`}
                onClick={() => currentVideo && void toggleWatched(currentVideo.video_id)}
                title={currentIsWatched ? 'Đánh dấu chưa xem' : 'Đánh dấu đã xem'}
              >
                <div className="tv-action-icon-box">
                  {currentIsWatched ? <CheckCircle2 size={22} color="#10b981" /> : <Circle size={22} />}
                </div>
                <span className="tv-action-label-title">Đánh dấu</span>
                <span className={`tv-action-label-sub ${currentIsWatched ? 'is-green' : ''}`}>
                  {currentIsWatched ? 'đã xem' : 'chưa xem'}
                </span>
              </button>

              {/* Nút 2: Tốc độ */}
              <button
                type="button"
                className={`tv-action-card-btn ${playbackRate !== 1 ? 'active' : ''}`}
                onClick={() => setShowSpeedModal(true)}
                title="Thay đổi tốc độ phát"
              >
                <div className="tv-action-icon-box">
                  <Gauge size={22} />
                </div>
                <span className="tv-action-label-title">Tốc độ</span>
                <span className={`tv-action-label-sub ${playbackRate === 2 ? 'highlight' : ''}`}>
                  {playbackRate}x
                </span>
              </button>

              {/* Nút 3: Hẹn giờ */}
              <button
                type="button"
                className={`tv-action-card-btn ${sleepTimerMinutes ? 'active' : ''}`}
                onClick={() => setShowTimerModal(true)}
                title="Hẹn giờ tự tắt video"
              >
                <div className="tv-action-icon-box">
                  <Clock size={22} />
                </div>
                <span className="tv-action-label-title">Hẹn giờ</span>
                <span className={`tv-action-label-sub ${sleepTimerMinutes ? 'highlight' : ''}`}>
                  {sleepTimerMinutes ? `${sleepTimerMinutes}p` : 'Tắt'}
                </span>
              </button>

              {/* Nút 4: Cài đặt (Chứa Mở trên YouTube & Tự phát tiếp) */}
              <button
                type="button"
                className={`tv-action-card-btn ${showSettingsModal ? 'active' : ''}`}
                onClick={() => setShowSettingsModal(true)}
                title="Cài đặt & Tùy chọn"
              >
                <div className="tv-action-icon-box">
                  <Settings size={22} />
                </div>
                <span className="tv-action-label-title">Cài đặt</span>
                <span className="tv-action-label-sub">Tùy chọn</span>
              </button>
            </div>
          </div>

          {/* 4. Section Danh sách video */}
          <div className="tv-playlist-section">
            {/* Header: Danh sách video (664) | Đã xem 0/664 */}
            <div className="tv-playlist-head">
              <span className="tv-playlist-title">
                Danh sách video ({filteredVideos.length})
              </span>
              <span className="tv-playlist-stat">
                Đã xem {watchedCountInChannel}/{videos.length}
              </span>
            </div>

            {/* Ô tìm kiếm */}
            <div className="tv-search-input-wrapper">
              <input
                className="tv-search-field"
                placeholder="Tìm video trong kênh..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search className="tv-search-icon-inside" size={16} />
            </div>

            {/* Filter Pills & Nút Sort */}
            <div className="tv-filter-sort-row">
              <div className="tv-filter-pills-wrap">
                <button
                  type="button"
                  className={`tv-filter-pill-btn ${filterMode === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterMode('all')}
                >
                  Tất cả ({videos.length})
                </button>
                <button
                  type="button"
                  className={`tv-filter-pill-btn ${filterMode === 'unwatched' ? 'active' : ''}`}
                  onClick={() => setFilterMode('unwatched')}
                >
                  Chưa xem ({videos.length - watchedCountInChannel})
                </button>
                <button
                  type="button"
                  className={`tv-filter-pill-btn ${filterMode === 'watched' ? 'active' : ''}`}
                  onClick={() => setFilterMode('watched')}
                >
                  Đã xem ({watchedCountInChannel})
                </button>
              </div>

              <button
                type="button"
                className="tv-sort-toggle-btn"
                onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                title="Đổi thứ tự hiển thị"
              >
                <ArrowUpDown size={13} />
                {sortOrder === 'desc' ? 'Mới nhất' : 'Cũ nhất'}
              </button>
            </div>

            {/* Danh sách video items */}
            <div className="tv-video-card-list">
              {filteredVideos.map((v, i) => {
                const isPlaying = v.video_id === playingId
                const isWatched = watched.has(v.video_id)
                const indexNum = sortOrder === 'desc' ? i + 1 : videos.length - i
                return (
                  <div
                    key={v.video_id}
                    className={`tv-video-card-item ${isPlaying ? 'playing' : ''}`}
                    onClick={() => {
                      setPlayingId(v.video_id)
                      setIsPlayerActive(true)
                      playerBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                    }}
                  >
                    {/* Thumbnail + badge thời lượng */}
                    <div className="tv-video-thumb-container">
                      <img
                        src={v.thumbnail || `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`}
                        alt=""
                        loading="lazy"
                      />
                      <span className="tv-video-duration-pill">
                        {v.part_number ? `P.${v.part_number}` : 'Video'}
                      </span>
                    </div>

                    {/* Tiêu đề & Kênh */}
                    <div className="tv-video-meta-content">
                      <div className="tv-video-item-title">
                        #{indexNum}. {v.title}
                      </div>
                      <div className="tv-video-item-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{channel.creator_name}</span>
                        {(() => {
                          const cat = detectVideoCategory(v.title, 'tvshow')
                          return (
                            <span className="tv-video-category-tag">
                              {cat.icon} {cat.name}
                            </span>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Nút check xem & Nút 3 chấm */}
                    <div className="tv-video-right-tools">
                      <button
                        type="button"
                        className={`tv-video-watch-circle-btn ${isWatched ? 'watched' : ''}`}
                        onClick={(e) => void toggleWatched(v.video_id, e)}
                        title={isWatched ? 'Đánh dấu chưa xem' : 'Đánh dấu đã xem'}
                      >
                        {isWatched ? <CheckCircle2 size={20} color="#10b981" /> : <Circle size={20} />}
                      </button>
                      <button
                        type="button"
                        className="tv-video-more-dots-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedVideoForMenu(v)
                        }}
                        title="Tùy chọn khác"
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CÀI ĐẶT (Chứa Mở trên YouTube & Tự phát tiếp)  */}
      {/* ======================================================== */}
      {showSettingsModal && (
        <Modal title="⚙️ Cài đặt trình phát" onClose={() => setShowSettingsModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 0' }}>
            {/* 1. Mở trên YouTube */}
            {currentVideo && (
              <a
                href={currentVideo.canonical_url || `https://www.youtube.com/watch?v=${currentVideo.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tv-setting-item-row"
                onClick={() => setShowSettingsModal(false)}
              >
                <div className="tv-setting-item-left">
                  <div className="tv-setting-item-icon youtube">
                    <Youtube size={22} />
                  </div>
                  <div className="tv-setting-item-text">
                    <span className="tv-setting-item-title">Mở trên YouTube</span>
                    <span className="tv-setting-item-desc">Xem video gốc trực tiếp trên ứng dụng YouTube</span>
                  </div>
                </div>
                <ExternalLink size={16} color="var(--text-muted)" />
              </a>
            )}

            {/* 2. Tự phát tiếp */}
            <div className="tv-setting-item-row" onClick={() => setAutoplay((prev) => !prev)}>
              <div className="tv-setting-item-left">
                <div className="tv-setting-item-icon">
                  <Zap size={22} />
                </div>
                <div className="tv-setting-item-text">
                  <span className="tv-setting-item-title">Tự phát tiếp</span>
                  <span className="tv-setting-item-desc">Tự động chuyển sang video tiếp theo sau khi phát xong</span>
                </div>
              </div>
              <label className="tv-toggle-switch" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={autoplay}
                  onChange={(e) => setAutoplay(e.target.checked)}
                />
                <span className="tv-toggle-slider" />
              </label>
            </div>

            {/* 3. Tùy chọn phím tắt 2x nhanh */}
            <div className="tv-setting-item-row" onClick={() => applyPlaybackRate(playbackRate === 2 ? 1 : 2)}>
              <div className="tv-setting-item-left">
                <div className="tv-setting-item-icon">
                  <Gauge size={22} />
                </div>
                <div className="tv-setting-item-text">
                  <span className="tv-setting-item-title">Chế độ 2x nhanh</span>
                  <span className="tv-setting-item-desc">Chuyển đổi tức thì tốc độ 2.0x</span>
                </div>
              </div>
              <label className="tv-toggle-switch" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={playbackRate === 2}
                  onChange={(e) => applyPlaybackRate(e.target.checked ? 2 : 1)}
                />
                <span className="tv-toggle-slider" />
              </label>
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: TỐC ĐỘ PHÁT                                    */}
      {/* ======================================================== */}
      {showSpeedModal && (
        <Modal title="⚡ Tốc độ phát video" onClose={() => setShowSpeedModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Chọn tốc độ phát phù hợp để thưởng thức nội dung nhanh chóng:
            </p>
            <div className="tv-speed-modal-grid">
              {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={`tv-speed-modal-btn ${playbackRate === rate ? 'active' : ''}`}
                  onClick={() => {
                    applyPlaybackRate(rate)
                    setShowSpeedModal(false)
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{rate}x</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                    {rate === 1 ? 'Chuẩn' : rate === 2 ? 'Siêu tốc' : 'Nhanh'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: HẸN GIỜ TẮT VIDEO                              */}
      {/* ======================================================== */}
      {showTimerModal && (
        <Modal title="⏱️ Hẹn giờ tắt video" onClose={() => setShowTimerModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Video sẽ tự động tạm dừng sau khoảng thời gian được chọn:
            </p>
            <div className="tv-timer-modal-grid">
              {[
                { min: null, label: 'Tắt hẹn giờ' },
                { min: 15, label: '15 phút' },
                { min: 30, label: '30 phút' },
                { min: 45, label: '45 phút' },
                { min: 60, label: '60 phút (1h)' },
                { min: 90, label: '90 phút (1.5h)' },
              ].map((item) => {
                const isActive = sleepTimerMinutes === item.min
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`tv-timer-modal-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setSleepTimerMinutes(item.min)
                      setShowTimerModal(false)
                    }}
                  >
                    <Clock size={16} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: MENU 3 CHẤM CỦA MỖI VIDEO                       */}
      {/* ======================================================== */}
      {selectedVideoForMenu && (
        <Modal 
          title={`🎬 ${selectedVideoForMenu.title}`} 
          onClose={() => setSelectedVideoForMenu(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Phát video này */}
            <button
              type="button"
              className="tv-btn"
              style={{ justifyContent: 'flex-start', padding: '12px 14px' }}
              onClick={() => {
                setPlayingId(selectedVideoForMenu.video_id)
                setIsPlayerActive(true)
                setSelectedVideoForMenu(null)
                playerBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              }}
            >
              <Play size={16} /> Phát video này ngay
            </button>

            {/* Đánh dấu đã xem / chưa xem */}
            <button
              type="button"
              className="tv-btn"
              style={{ justifyContent: 'flex-start', padding: '12px 14px' }}
              onClick={() => {
                void toggleWatched(selectedVideoForMenu.video_id)
                setSelectedVideoForMenu(null)
              }}
            >
              {watched.has(selectedVideoForMenu.video_id) ? (
                <>
                  <Circle size={16} /> Đánh dấu là chưa xem
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} color="#10b981" /> Đánh dấu là đã xem
                </>
              )}
            </button>

            {/* Mở trên YouTube */}
            <a
              href={selectedVideoForMenu.canonical_url || `https://www.youtube.com/watch?v=${selectedVideoForMenu.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tv-btn"
              style={{ justifyContent: 'flex-start', padding: '12px 14px', textDecoration: 'none' }}
              onClick={() => setSelectedVideoForMenu(null)}
            >
              <Youtube size={16} color="#ef4444" /> Mở trên YouTube
            </a>

            {/* Sao chép link */}
            <button
              type="button"
              className="tv-btn"
              style={{ justifyContent: 'flex-start', padding: '12px 14px' }}
              onClick={() => {
                const url = selectedVideoForMenu.canonical_url || `https://www.youtube.com/watch?v=${selectedVideoForMenu.video_id}`
                navigator.clipboard.writeText(url)
                alert('Đã sao chép liên kết video vào bộ nhớ tạm!')
                setSelectedVideoForMenu(null)
              }}
            >
              <Copy size={16} /> Sao chép liên kết video
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function formatVideoDuration(sec: number | null | undefined): string {
  if (!sec || isNaN(sec)) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const h = Math.floor(m / 60)
  const remM = m % 60
  if (h > 0) {
    return `${h}:${String(remM).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${remM}:${String(s).padStart(2, '0')}`
}

type DiscoveredTvVideo = {
  videoId: string
  title: string
  thumbnail: string | null
  duration: number | null
  publishedAt: string
  playlistName: string | null
  channelName: string
  creatorId: string
  canonicalUrl: string
  embedUrl: string
  description: string
  position?: number | null
  isKnown?: boolean
  rawMetadata?: any
  part?: any
}

/** Modal cào kênh YouTube TV Show (với danh sách tích chọn video) */
function AddTvShowChannelModal({ onClose, onSynced }: { onClose: () => void; onSynced: () => void }) {
  const [text, setText] = useState('')
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'paused' | 'scanned' | 'saving' | 'saved'>('idle')
  const [discoveredVideos, setDiscoveredVideos] = useState<DiscoveredTvVideo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activePlan, setActivePlan] = useState<any>(null)
  const [activeJob, setActiveJob] = useState<{ channelName: string; sectionName: string; percent: number } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'fresh' | 'known'>('all')
  const [savingProgress, setSavingProgress] = useState<{ current: number; total: number } | null>(null)
  const stopRef = useRef(false)

  const post = async (body: any) => {
    const res = await fetch('/api/sync-tvshow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
    return json
  }

  const isChannelUrl = (raw: string) => {
    try {
      const u = new URL(raw.trim())
      const host = u.hostname.replace(/^www\./, '')
      return host === 'youtube.com' || host.endsWith('.youtube.com')
    } catch {
      return false
    }
  }

  const urls = useMemo(
    () => [...new Set(text.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean))],
    [text],
  )
  const valid = useMemo(() => urls.filter(isChannelUrl), [urls])
  const invalid = useMemo(() => urls.filter((u) => !isChannelUrl(u)), [urls])

  const runScanChannel = async (url: string) => {
    const { plan } = await post({ action: 'plan', creatorUrl: url })
    setActivePlan(plan)
    let pages = 0

    for (let entryIndex = 0; entryIndex < plan.entries.length; entryIndex++) {
      const entry = plan.entries[entryIndex]
      let pageToken: string | undefined

      do {
        if (stopRef.current) return { stopped: true }

        const { outcome } = await post({ action: 'page', plan, cursor: { entryIndex, pageToken }, dryRun: true })
        pages++

        const pageVideos: DiscoveredTvVideo[] = (outcome.videos || []).map((v: any) => ({
          ...v,
          channelName: plan.channelName,
          creatorId: plan.channelId,
        }))

        if (pageVideos.length > 0) {
          setDiscoveredVideos((prev) => {
            const seen = new Set(prev.map((item) => item.videoId))
            const newItems = pageVideos.filter((item) => !seen.has(item.videoId))
            return [...prev, ...newItems]
          })

          setSelectedIds((prev) => {
            const next = new Set(prev)
            pageVideos.forEach((v) => {
              // Mặc định tích chọn video mới
              if (!v.isKnown) next.add(v.videoId)
            })
            return next
          })
        }

        const calculatedPercent = plan.totalPages > 0 ? Math.min(100, Math.round((pages / plan.totalPages) * 100)) : 50
        setActiveJob({
          channelName: plan.channelName,
          sectionName: entry.name,
          percent: calculatedPercent,
        })

        if (entry.isUploads && outcome.allKnown && pages > 1) break

        pageToken = outcome.nextPageToken
      } while (pageToken)
    }

    return { stopped: false }
  }

  const startScan = async () => {
    stopRef.current = false
    setScanState('scanning')
    setDiscoveredVideos([])
    setSelectedIds(new Set())

    for (let i = 0; i < valid.length; i++) {
      if (stopRef.current) {
        setScanState('paused')
        return
      }

      try {
        const { stopped } = await runScanChannel(valid[i])
        if (stopped) {
          setScanState('paused')
          return
        }
      } catch (error: any) {
        console.error('Scan channel error:', error)
      }
    }

    setScanState('scanned')
  }

  const handlePauseScan = () => {
    stopRef.current = true
    setScanState('paused')
  }

  const handleResumeScan = () => {
    startScan()
  }

  const toggleSelectVideo = (videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      return next
    })
  }

  const filteredVideos = useMemo(() => {
    return discoveredVideos.filter((v) => {
      const matchSearch = !searchTerm.trim() || v.title.toLowerCase().includes(searchTerm.toLowerCase())
      const matchFilter =
        filterType === 'all' ||
        (filterType === 'fresh' && !v.isKnown) ||
        (filterType === 'known' && Boolean(v.isKnown))
      return matchSearch && matchFilter
    })
  }, [discoveredVideos, searchTerm, filterType])

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredVideos.forEach((v) => next.add(v.videoId))
      return next
    })
  }

  const deselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredVideos.forEach((v) => next.delete(v.videoId))
      return next
    })
  }

  const selectOnlyFresh = () => {
    setSelectedIds(new Set(discoveredVideos.filter((v) => !v.isKnown).map((v) => v.videoId)))
  }

  const handleSaveSelected = async () => {
    const selectedVideos = discoveredVideos.filter((v) => selectedIds.has(v.videoId))
    if (selectedVideos.length === 0) return

    stopRef.current = true
    setScanState('saving')
    setSavingProgress({ current: 0, total: selectedVideos.length })

    try {
      // Lưu theo từng mẻ 50 video để ổn định
      const chunkSize = 50
      for (let i = 0; i < selectedVideos.length; i += chunkSize) {
        const chunk = selectedVideos.slice(i, i + chunkSize)
        await post({
          action: 'save_selected',
          plan: activePlan || { creatorUrl: valid[0], channelName: chunk[0]?.channelName || 'Kênh YouTube' },
          videos: chunk,
        })
        setSavingProgress({ current: Math.min(i + chunkSize, selectedVideos.length), total: selectedVideos.length })
      }

      setScanState('saved')
      onSynced()
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err: any) {
      alert(`Lỗi khi lưu video: ${err.message || err}`)
      setScanState('scanned')
    }
  }

  const freshCount = discoveredVideos.filter((v) => !v.isKnown).length
  const knownCount = discoveredVideos.filter((v) => v.isKnown).length

  return (
    <Modal
      title="📡 Thêm kênh YouTube"
      onClose={scanState === 'scanning' ? handlePauseScan : onClose}
    >
      <div className="tv-sync-container">
        {scanState === 'idle' ? (
          <>
            <textarea
              className="tv-links-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Dán link kênh, mỗi dòng một kênh:\nhttps://www.youtube.com/@web5ngay\nhttps://www.youtube.com/@tri_ky_cam_xuc'}
            />

            <div className="tv-sync-sample-bar">
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Mẫu nhanh:</span>
              <button
                type="button"
                className="tv-sync-sample-pill"
                onClick={() =>
                  setText((prev) =>
                    prev.includes('@web5ngay')
                      ? prev
                      : (prev.trim() ? prev + '\n' : '') + 'https://www.youtube.com/@web5ngay',
                  )
                }
              >
                + @web5ngay
              </button>
              <button
                type="button"
                className="tv-sync-sample-pill"
                onClick={() =>
                  setText((prev) =>
                    prev.includes('@tri_ky_cam_xuc')
                      ? prev
                      : (prev.trim() ? prev + '\n' : '') + 'https://www.youtube.com/@tri_ky_cam_xuc',
                  )
                }
              >
                + @tri_ky_cam_xuc
              </button>
            </div>

            <div className="tv-sync-badge-summary">
              <span className="tv-sync-pill-valid">
                <Check size={12} /> {valid.length} link kênh hợp lệ
              </span>
              {invalid.length > 0 && (
                <span className="tv-sync-pill-invalid">
                  <AlertCircle size={12} /> {invalid.length} link sai định dạng
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Hệ thống sẽ quét toàn bộ danh sách video của kênh, bạn có thể tự do xem và tích chọn các video muốn thêm vào Thư viện.
            </div>

            <div className="tv-sync-actions">
              <button type="button" className="tv-btn-action secondary" onClick={onClose}>
                Đóng
              </button>
              <button
                type="button"
                className="tv-btn-action primary"
                onClick={() => void startScan()}
                disabled={!valid.length}
              >
                <Search size={15} /> Quét danh sách video
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Thanh tiến trình quét */}
            <div className="tv-sync-dashboard" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 700 }}>
                  {scanState === 'scanning' ? (
                    <>
                      <div className="tv-sync-pulse-dot" />
                      <span>Đang quét: {activeJob?.channelName || 'YouTube...'}</span>
                    </>
                  ) : scanState === 'paused' ? (
                    <>
                      <div className="tv-sync-pulse-dot paused" />
                      <span style={{ color: '#f59e0b' }}>Đã tạm dừng quét</span>
                    </>
                  ) : scanState === 'saving' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" color="#10b981" />
                      <span style={{ color: '#10b981' }}>Đang lưu {savingProgress?.current}/{savingProgress?.total} video...</span>
                    </>
                  ) : scanState === 'saved' ? (
                    <>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span style={{ color: '#10b981' }}>Đã lưu thành công {selectedIds.size} video!</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>Đã quét xong: {discoveredVideos.length} video tìm thấy</span>
                    </>
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                  Đã chọn {selectedIds.size} / {discoveredVideos.length} video
                </div>
              </div>

              {scanState === 'scanning' && (
                <div className="tv-sync-progress-bar" style={{ marginTop: 6 }}>
                  <div
                    className="tv-sync-progress-fill running"
                    style={{ width: `${activeJob ? activeJob.percent : 30}%` }}
                  />
                </div>
              )}
            </div>

            {/* Thanh tìm kiếm & Trợ giúp chọn nhanh */}
            <div className="tv-sync-video-toolbar">
              <div className="tv-sync-search-box">
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Lọc video theo tên..."
                  className="tv-sync-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="tv-sync-select-helpers">
                <button
                  type="button"
                  className={`tv-sync-pill-btn ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  Tất cả ({discoveredVideos.length})
                </button>
                <button
                  type="button"
                  className={`tv-sync-pill-btn ${filterType === 'fresh' ? 'active' : ''}`}
                  onClick={() => setFilterType('fresh')}
                >
                  Video mới ({freshCount})
                </button>
                <button
                  type="button"
                  className={`tv-sync-pill-btn ${filterType === 'known' ? 'active' : ''}`}
                  onClick={() => setFilterType('known')}
                >
                  Đã có ({knownCount})
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'flex-end', marginTop: 2 }}>
                <button type="button" className="tv-sync-pill-btn" onClick={selectAllFiltered}>
                  Chọn tất cả
                </button>
                <button type="button" className="tv-sync-pill-btn" onClick={deselectAllFiltered}>
                  Bỏ chọn
                </button>
                <button type="button" className="tv-sync-pill-btn" onClick={selectOnlyFresh}>
                  Chỉ chọn video mới
                </button>
              </div>
            </div>

            {/* Danh sách video quét được */}
            <div className="tv-sync-video-container">
              {filteredVideos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {discoveredVideos.length === 0 ? (
                    <span>Đang kết nối và lấy dữ liệu video từ YouTube...</span>
                  ) : (
                    <span>Không có video nào khớp với bộ lọc tìm kiếm.</span>
                  )}
                </div>
              ) : (
                filteredVideos.map((v) => {
                  const isSelected = selectedIds.has(v.videoId)
                  return (
                    <div
                      key={v.videoId}
                      className={`tv-sync-video-item ${isSelected ? 'selected' : ''} ${v.isKnown ? 'known' : ''}`}
                      onClick={() => toggleSelectVideo(v.videoId)}
                    >
                      {/* Checkbox */}
                      <div className="tv-sync-checkbox">
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>

                      {/* Thumbnail */}
                      <div className="tv-sync-video-thumb-wrap">
                        {v.thumbnail ? (
                          <img src={v.thumbnail} alt={v.title} className="tv-sync-video-thumb" />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#333' }} />
                        )}
                        {v.duration ? (
                          <span className="tv-sync-video-duration">{formatVideoDuration(v.duration)}</span>
                        ) : null}
                      </div>

                      {/* Video Meta */}
                      <div className="tv-sync-video-meta">
                        <div className="tv-sync-video-title" title={v.title}>
                          {v.title}
                        </div>
                        <div className="tv-sync-video-sub">
                          <span>{v.channelName}</span>
                          {v.playlistName && <span>· {v.playlistName}</span>}
                          {v.isKnown ? (
                            <span className="tv-sync-known-badge">Đã có trong thư viện</span>
                          ) : (
                            <span className="tv-sync-fresh-badge">Mới</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Nút hành động */}
            <div className="tv-sync-actions">
              <button
                type="button"
                className="tv-btn-action secondary"
                onClick={() => {
                  stopRef.current = true
                  setScanState('idle')
                }}
                disabled={scanState === 'saving'}
              >
                Nhập link khác
              </button>

              {scanState === 'scanning' && (
                <button type="button" className="tv-btn-action pause" onClick={handlePauseScan}>
                  <Pause size={15} /> Tạm dừng quét
                </button>
              )}

              {scanState === 'paused' && (
                <button type="button" className="tv-btn-action secondary" onClick={handleResumeScan}>
                  <Play size={15} /> Quét tiếp
                </button>
              )}

              <button
                type="button"
                className="tv-btn-action save"
                onClick={() => void handleSaveSelected()}
                disabled={selectedIds.size === 0 || scanState === 'saving'}
              >
                {scanState === 'saving' ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={15} /> Thêm {selectedIds.size} video đã chọn
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

type DraftPart = ParsedVideo & { title: string; thumbnail: string }

/** Modal thêm video lẻ TV Show */
function AddTvShowMovieModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [channelName, setChannelName] = useState('')
  const [status, setStatus] = useState<'UNWATCHED' | 'WATCHED'>('UNWATCHED')
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [autofilling, setAutofilling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingCreators, setExistingCreators] = useState<Array<{ id: string; name: string }>>([])

  // Chế độ nhiều phần (batch)
  const [step, setStep] = useState<'paste' | 'order'>('paste')
  const [text, setText] = useState('')
  const [movie, setMovie] = useState('')
  const [parts, setParts] = useState<DraftPart[]>([])
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const { valid, invalid } = useMemo(() => parseVideoLinks(text), [text])

  // Lấy danh sách kênh hiện có để gợi ý datalist
  useEffect(() => {
    supabase
      ?.from('tvshow_creators')
      .select('id,creator_name')
      .is('deleted_at', null)
      .then(({ data }) => {
        if (data) {
          setExistingCreators(data.map((c) => ({ id: c.id, name: c.creator_name || '' })).filter((c) => c.name))
        }
      })
  }, [])

  // Khi paste link video đơn, tự động đọc tiêu đề và kênh
  const handleUrlChange = async (val: string) => {
    setUrl(val)
    const videoId = youtubeVideoId(val)
    if (!videoId) {
      setThumbnail(null)
      return
    }

    const defaultThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    setThumbnail(defaultThumb)
    setAutofilling(true)
    setError(null)

    try {
      const meta = await fetchYouTubeMeta(`https://www.youtube.com/watch?v=${videoId}`)
      if (meta) {
        if (!title.trim() || title === 'Video mới') {
          setTitle(meta.title)
        }
        if (!channelName.trim()) {
          setChannelName(meta.author.replace(/(?:\s*-\s*topic|\s*\bofficial\b|\s*vevo\b|\s*\bchannel\b)+\s*$/i, '').trim() || meta.author)
        }
      }
    } catch {
      // Bỏ qua lỗi fetch oEmbed
    } finally {
      setAutofilling(false)
    }
  }

  const handleSaveSingle = async () => {
    const videoId = youtubeVideoId(url)
    if (!videoId) return setError('Vui lòng nhập link video YouTube hợp lệ.')
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề video.')
    setBusy(true)
    setError(null)

    const now = new Date().toISOString()
    const cleanChannel = channelName.trim() || 'Tự thêm'

    // Tìm xem creator đã có chưa
    const existing = existingCreators.find((c) => c.name.toLowerCase() === cleanChannel.toLowerCase())
    let creatorId = existing?.id || 'manual'

    // Nếu là tên kênh mới (khác 'Tự thêm'), tạo kênh trong tvshow_creators để hiển thị card riêng
    if (!existing && cleanChannel !== 'Tự thêm') {
      const { data: newCreator } = await supabase!
        .from('tvshow_creators')
        .insert({
          platform: 'youtube',
          creator_url: `https://www.youtube.com/@${cleanChannel.replace(/\s+/g, '')}`,
          creator_name: cleanChannel,
          creator_id: `manual_${Date.now()}`,
          is_active: true,
        })
        .select('id,creator_id')
        .single()

      if (newCreator) {
        creatorId = newCreator.creator_id || newCreator.id
      }
    }

    const { error: videoError } = await supabase!.from('tvshow_videos').upsert(
      {
        platform: 'youtube',
        video_id: videoId,
        series_key: `manual:${videoId}`,
        creator_id: creatorId,
        creator_name: cleanChannel,
        title: title.trim(),
        canonical_url: `https://www.youtube.com/watch?v=${videoId}`,
        embed_url: `https://www.youtube.com/embed/${videoId}`,
        thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        part_number: 1,
        total_parts: 1,
        is_final: true,
        part_confidence: 1,
        last_seen_at: now,
      },
      { onConflict: 'platform,video_id' },
    )

    if (videoError) {
      setBusy(false)
      return setError(`Không lưu được video: ${videoError.message}`)
    }

    // Nếu trạng thái là đã xem, ghi nhận vào tvshow_watched
    if (status === 'WATCHED') {
      await supabase!.from('tvshow_watched').upsert({ video_id: videoId, watched_at: now }, { onConflict: 'video_id' })
    } else {
      await supabase!.from('tvshow_watched').delete().eq('video_id', videoId)
    }

    setBusy(false)
    onSaved()
    onClose()
  }

  const insertNewline = () => {
    const box = boxRef.current
    const at = box?.selectionStart ?? text.length
    const end = box?.selectionEnd ?? at
    setText(text.slice(0, at) + '\n' + text.slice(end))
    requestAnimationFrame(() => {
      box?.focus()
      box?.setSelectionRange(at + 1, at + 1)
    })
  }

  const loadBatchTitles = async () => {
    setBusy(true)
    const metas = await Promise.all(valid.map((v) => fetchYouTubeMeta(v.url)))
    const drafts: DraftPart[] = valid.map((v, i) => ({
      ...v,
      title: metas[i]?.title ?? `Video ${i + 1}`,
      thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    }))
    setParts(drafts)
    if (!movie.trim() && drafts[0]) setMovie(drafts[0].title)
    if (!channelName.trim() && metas[0]?.author) {
      setChannelName(metas[0].author.replace(/(?:\s*-\s*topic|\s*\bofficial\b|\s*vevo\b|\s*\bchannel\b)+\s*$/i, '').trim())
    }
    setBusy(false)
    setStep('order')
  }

  const handleSaveBatch = async () => {
    const name = movie.trim()
    if (!name) return setError('Nhập tên video / danh sách.')
    setBusy(true)
    setError(null)

    const now = new Date().toISOString()
    const seriesKey = `manual:${parts[0].videoId}`
    const cleanChannel = channelName.trim() || 'Tự thêm'

    const { error: videoError } = await supabase!.from('tvshow_videos').upsert(
      parts.map((p, i) => ({
        platform: 'youtube',
        video_id: p.videoId,
        series_key: seriesKey,
        creator_id: 'manual',
        creator_name: cleanChannel,
        title: p.title,
        canonical_url: p.url,
        embed_url: `https://www.youtube.com/embed/${p.videoId}`,
        thumbnail: p.thumbnail,
        part_number: i + 1,
        total_parts: parts.length,
        is_final: i === parts.length - 1,
        part_confidence: 1,
        last_seen_at: now,
      })),
      { onConflict: 'platform,video_id' },
    )
    setBusy(false)
    if (videoError) return setError(`Không lưu được danh sách video: ${videoError.message}`)
    onSaved()
    onClose()
  }

  return (
    <Modal title="📺 Thêm video lẻ TV Show" onClose={onClose}>
      {/* Nút chuyển chế độ 1 video lẻ / nhiều phần */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: 'var(--bg-main)', padding: 3, borderRadius: 8 }}>
        <button
          type="button"
          onClick={() => setMode('single')}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 6,
            border: 0,
            fontSize: '0.8rem',
            fontWeight: 700,
            background: mode === 'single' ? 'var(--card-bg)' : 'transparent',
            color: mode === 'single' ? 'var(--amber)' : 'var(--text-muted)',
            boxShadow: mode === 'single' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
          }}
        >
          1 Video lẻ (Tự động điền)
        </button>
        <button
          type="button"
          onClick={() => setMode('batch')}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 6,
            border: 0,
            fontSize: '0.8rem',
            fontWeight: 700,
            background: mode === 'batch' ? 'var(--card-bg)' : 'transparent',
            color: mode === 'batch' ? 'var(--amber)' : 'var(--text-muted)',
            boxShadow: mode === 'batch' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
          }}
        >
          Nhiều video / Playlist
        </button>
      </div>

      {mode === 'single' ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Ô nhập Link YouTube */}
          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Link YouTube</span>
              {autofilling && (
                <span style={{ fontSize: '0.75rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RefreshCw size={12} className="spin" /> Đang lấy thông tin...
                </span>
              )}
            </div>
            <input
              value={url}
              onChange={(e) => void handleUrlChange(e.target.value)}
              placeholder="Dán link video (https://www.youtube.com/watch?v=... hoặc https://youtu.be/...)"
              autoFocus
            />
          </label>

          {/* Thumbnail preview nếu có */}
          {thumbnail && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-main)', padding: 8, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <img src={thumbnail} alt="" style={{ width: 80, height: 46, borderRadius: 6, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: '0.78rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {title || 'Đã nhận diện video'}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>{channelName || 'YouTube'}</div>
              </div>
            </div>
          )}

          {/* Ô Tiêu đề video */}
          <label>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Tiêu đề video</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề video (tự điền khi dán link)..."
            />
          </label>

          {/* Ô Kênh YouTube */}
          <label>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Kênh YouTube</span>
            <input
              list="tvshow-creators-datalist"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Tên kênh (tự điền khi dán link hoặc chọn từ danh sách)..."
            />
            <datalist id="tvshow-creators-datalist">
              {existingCreators.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </label>

          {/* Ô Trạng thái xem */}
          <label>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Trạng thái xem</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'UNWATCHED' | 'WATCHED')}>
              <option value="UNWATCHED">⏳ Chưa xem (Sẽ xem)</option>
              <option value="WATCHED">✅ Đã xem</option>
            </select>
          </label>

          {error && <div className="tv-hint tv-bad">{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="tv-btn" onClick={onClose}>Huỷ</button>
            <button className="tv-btn primary" onClick={() => void handleSaveSingle()} disabled={busy || !url.trim()}>
              {busy ? 'Đang lưu…' : 'Lưu video'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {step === 'paste' ? (
            <>
              <textarea
                ref={boxRef}
                className="tv-links-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'Dán link video, mỗi dòng một video:\nhttps://www.youtube.com/watch?v=...\nhttps://youtu.be/...'}
              />
              <button className="tv-btn" onClick={insertNewline} style={{ marginTop: 6 }}>
                <CornerDownLeft size={13} /> Xuống dòng
              </button>
              <div className="tv-hint">
                Nhận được <strong>{valid.length}</strong> link video.
                {invalid.length > 0 && (
                  <>
                    {' '}
                    <span className="tv-bad">{invalid.length} dòng không phải link YouTube:</span>{' '}
                    {invalid.slice(0, 3).join(', ')}
                    {invalid.length > 3 ? '…' : ''}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="tv-btn" onClick={onClose}>Huỷ</button>
                <button className="tv-btn primary" onClick={() => void loadBatchTitles()} disabled={busy || !valid.length}>
                  {busy ? 'Đang đọc tiêu đề…' : `Tiếp — ${valid.length} video`}
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                className="tv-search"
                style={{ width: '100%', marginBottom: 10 }}
                value={movie}
                onChange={(e) => setMovie(e.target.value)}
                placeholder="Tên video / danh sách…"
              />

              <div className="tv-order">
                {parts.map((p, i) => (
                  <div key={p.videoId} className="tv-order-row">
                    <span style={{ fontWeight: 700, color: 'var(--amber)' }}>#{i + 1}</span>
                    <img src={p.thumbnail} alt="" style={{ width: 44, height: 28, borderRadius: 4, objectFit: 'cover' }} loading="lazy" />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                    <button
                      className="tv-btn"
                      style={{ padding: '3px 6px' }}
                      onClick={() => setParts((v) => moveItem(v, i, i - 1))}
                      disabled={i === 0}
                      title="Lên"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      className="tv-btn"
                      style={{ padding: '3px 6px' }}
                      onClick={() => setParts((v) => moveItem(v, i, i + 1))}
                      disabled={i === parts.length - 1}
                      title="Xuống"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      className="tv-btn"
                      style={{ padding: '3px 6px', color: 'var(--rose)' }}
                      onClick={() => setParts((v) => v.filter((_, k) => k !== i))}
                      title="Bỏ video này"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {error && <div className="tv-hint tv-bad">{error}</div>}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="tv-btn" onClick={() => setStep('paste')}>Quay lại</button>
                <button className="tv-btn primary" onClick={() => void handleSaveBatch()} disabled={busy || !parts.length}>
                  {busy ? 'Đang lưu…' : `Lưu ${parts.length} video`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
