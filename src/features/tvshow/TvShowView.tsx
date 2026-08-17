import { useEffect, useMemo, useRef, useState } from 'react'
import { 
  ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Circle, CornerDownLeft, 
  ExternalLink, Film, Pause, Play, Plus, Radio, Search, Trash2, Tv, Video, 
  Youtube, Clock, Settings, Gauge, Zap, Sliders, Bookmark, Bell, MoreVertical, 
  Copy, Check, ChevronRight, ArrowUpDown, SlidersHorizontal, Moon
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchYouTubeMeta, youtubeVideoId } from '../../lib/youtubeMeta'
import { Modal } from '../shared'
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
 * Tab TV Show: 1 Kênh = 1 Card.
 * Gộp toàn bộ video của kênh vào trong card đó, bấm vào xem toàn bộ video.
 */
export function TvShowView() {
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null)
  const [addChannelOpen, setAddChannelOpen] = useState(false)
  const [addVideoOpen, setAddVideoOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Tải danh sách Kênh (1 kênh = 1 card) kèm thống kê video & tiến độ đã xem
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

      // 2. Lấy danh sách video để tính số lượng, thumbnail và tiến độ cho từng kênh
      const [videosRes, watchedRes] = await Promise.all([
        supabase
          ?.from('tvshow_videos')
          .select('video_id,creator_id,creator_name,thumbnail,published_at')
          .is('unavailable_at', null)
          .order('published_at', { ascending: false }),
        supabase?.from('tvshow_watched').select('video_id'),
      ])

      const allVideos = (videosRes?.data ?? []) as any[]
      const watchedIds = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((w) => w.video_id))

      // Gom video theo creator
      const statsByCreator = new Map<string, { total: number; watched: number; cover: string | null }>()

      for (const v of allVideos) {
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
        setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [reloadKey])

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return channels
    return channels.filter((c) => c.creator_name.toLowerCase().includes(q))
  }, [channels, search])

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
      {/* Toolbar */}
      <div className="tv-bar">
        <div className="tv-search-box">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            className="tv-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm kênh YouTube…"
          />
        </div>
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
        <div className="tv-empty">Đang tải danh sách kênh…</div>
      ) : !filteredChannels.length ? (
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
                      <div className="tv-video-item-sub">
                        {channel.creator_name}
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

/** Modal cào kênh YouTube */
function AddTvShowChannelModal({ onClose, onSynced }: { onClose: () => void; onSynced: () => void }) {
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [rows, setRows] = useState<{ url: string; status: 'chờ' | 'đang chạy' | 'xong' | 'lỗi' | 'dừng'; note: string }[]>([])
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

  const runChannel = async (url: string, at: number) => {
    const { plan } = await post({ action: 'plan', creatorUrl: url })
    let saved = 0
    let pages = 0

    for (let entryIndex = 0; entryIndex < plan.entries.length; entryIndex++) {
      const entry = plan.entries[entryIndex]
      let pageToken: string | undefined

      do {
        if (stopRef.current) return { saved, pages, stopped: true }

        const { outcome } = await post({ action: 'page', plan, cursor: { entryIndex, pageToken } })
        saved += outcome.saved
        pages++

        setProgress({ done: pages, total: Math.max(plan.totalPages, pages), label: entry.name })
        setRows((prev) =>
          prev.map((r, k) => (k === at ? { ...r, note: `${plan.channelName} — đã lưu ${saved} video mới` } : r)),
        )
        if (outcome.saved > 0) onSynced()

        if (entry.isUploads && outcome.allKnown && pages > 1) break

        pageToken = outcome.nextPageToken
      } while (pageToken)
    }

    await post({ action: 'finish', creatorUrl: url, saved, pages })
    return { saved, pages, stopped: false }
  }

  const run = async () => {
    stopRef.current = false
    setRunning(true)
    setRows(valid.map((url) => ({ url, status: 'chờ', note: '' })))

    for (let i = 0; i < valid.length; i++) {
      if (stopRef.current) {
        setRows((prev) => prev.map((r, k) => (k >= i ? { ...r, status: 'dừng' } : r)))
        break
      }
      setRows((prev) => prev.map((r, k) => (k === i ? { ...r, status: 'đang chạy' } : r)))
      try {
        const { saved, stopped } = await runChannel(valid[i], i)
        setRows((prev) =>
          prev.map((r, k) =>
            k === i ? { ...r, status: stopped ? 'dừng' : 'xong', note: `đã lưu ${saved} video mới` } : r,
          ),
        )
      } catch (error: any) {
        setRows((prev) =>
          prev.map((r, k) => (k === i ? { ...r, status: 'lỗi', note: String(error?.message ?? error) } : r)),
        )
      }
    }

    setProgress(null)
    setRunning(false)
    onSynced()
  }

  return (
    <Modal title="📡 Thêm kênh YouTube" onClose={onClose}>
      <textarea
        className="tv-links-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={running}
        placeholder={'Dán link kênh, mỗi dòng một kênh:\nhttps://www.youtube.com/@web5ngay\nhttps://www.youtube.com/@tri_ky_cam_xuc'}
      />

      <div className="tv-hint">
        Nhận được <strong>{valid.length}</strong> link kênh. Server sẽ cào toàn bộ video & playlist của kênh và gom thành một thẻ Kênh.
        {invalid.length > 0 && (
          <>
            {' '}
            <span className="tv-bad">{invalid.length} dòng không phải link kênh YouTube:</span> {invalid.slice(0, 3).join(', ')}
            {invalid.length > 3 ? '…' : ''}
          </>
        )}
      </div>

      {progress && (
        <div className="tv-progress-box">
          <div className="tv-progress-head">
            <span>{progress.label}</span>
            <span>
              trang {progress.done}/{progress.total}
            </span>
          </div>
          <div className="tv-progress-track">
            <div
              className="tv-progress-fill"
              style={{ width: `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="tv-order">
          {rows.map((r) => (
            <div key={r.url} className="tv-order-row">
              <span className={`tv-run-${r.status === 'lỗi' ? 'bad' : r.status === 'xong' ? 'ok' : 'wait'}`}>
                {r.status}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {r.url}
                {r.note && ` · ${r.note}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="tv-btn" onClick={onClose} disabled={running}>
          Đóng
        </button>
        {running ? (
          <button className="tv-btn" onClick={() => (stopRef.current = true)}>
            <Pause size={13} /> Tạm dừng
          </button>
        ) : (
          <button className="tv-btn primary" onClick={() => void run()} disabled={!valid.length}>
            {rows.some((r) => r.status === 'dừng') ? 'Chạy tiếp' : `Tải ${valid.length} kênh`}
          </button>
        )}
      </div>
    </Modal>
  )
}

type DraftPart = ParsedVideo & { title: string; thumbnail: string }

/** Modal thêm video lẻ */
function AddTvShowMovieModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<'paste' | 'order'>('paste')
  const [text, setText] = useState('')
  const [movie, setMovie] = useState('')
  const [parts, setParts] = useState<DraftPart[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boxRef = useRef<HTMLTextAreaElement>(null)
  const { valid, invalid } = useMemo(() => parseVideoLinks(text), [text])

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

  const loadTitles = async () => {
    setBusy(true)
    const metas = await Promise.all(valid.map((v) => fetchYouTubeMeta(v.url)))
    const drafts: DraftPart[] = valid.map((v, i) => ({
      ...v,
      title: metas[i]?.title ?? `Video ${i + 1}`,
      thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    }))
    setParts(drafts)
    if (!movie.trim() && drafts[0]) setMovie(drafts[0].title)
    setBusy(false)
    setStep('order')
  }

  const save = async () => {
    const name = movie.trim()
    if (!name) return setError('Nhập tên video / chủ đề.')
    setBusy(true)
    setError(null)

    const now = new Date().toISOString()
    const seriesKey = `manual:${parts[0].videoId}`

    const { error: videoError } = await supabase!.from('tvshow_videos').upsert(
      parts.map((p, i) => ({
        platform: 'youtube',
        video_id: p.videoId,
        series_key: seriesKey,
        creator_id: 'manual',
        creator_name: 'Tự thêm',
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
    <Modal title="📺 Thêm video lẻ" onClose={onClose}>
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
            <button className="tv-btn primary" onClick={() => void loadTitles()} disabled={busy || !valid.length}>
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
            <button className="tv-btn primary" onClick={() => void save()} disabled={busy || !parts.length}>
              {busy ? 'Đang lưu…' : `Lưu ${parts.length} video`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
