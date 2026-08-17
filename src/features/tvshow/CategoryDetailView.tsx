import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, CheckCircle2, ChevronRight, Circle, ExternalLink,
  Gauge, Clock, Settings, Search, ArrowUpDown, Play, Bookmark, Bell,
  Copy, Check, MoreVertical, Tv, Film
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHideHeader } from '../HeaderAction'
import { Modal } from '../shared'
import { CategorizedGroup, VideoCategoryType } from '../../lib/videoCategorizer'
import './tvShow.css'

export type CategoryDetailVideoRow = {
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

export function CategoryDetailView({
  group,
  type = 'tvshow',
  onBack,
}: {
  group: CategorizedGroup<CategoryDetailVideoRow>
  type?: VideoCategoryType
  onBack: () => void
}) {
  useHideHeader(true)

  const [videos, setVideos] = useState<CategoryDetailVideoRow[]>(group.videos)
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
      const saved = localStorage.getItem(`${type}_playback_rate`)
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
  const [selectedVideoForMenu, setSelectedVideoForMenu] = useState<CategoryDetailVideoRow | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerBoxRef = useRef<HTMLDivElement>(null)

  const watchedTable = type === 'review' ? 'review_watched' : 'tvshow_watched'

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
      localStorage.setItem(`${type}_playback_rate`, String(rate))
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
      const watchedRes = await supabase?.from(watchedTable).select('video_id')
      const watchedSet = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((r) => r.video_id))
      setWatched(watchedSet)
      setVideos(group.videos)

      const firstUnwatched = group.videos.find((r) => !watchedSet.has(r.video_id))
      setPlayingId(firstUnwatched ? firstUnwatched.video_id : group.videos[0]?.video_id ?? null)
      setLoading(false)
    })()
  }, [group, watchedTable])

  const filteredVideos = useMemo(() => {
    let result = [...videos]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.creator_name && v.creator_name.toLowerCase().includes(q))
      )
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
  const currentVideo = currentIndex >= 0 ? filteredVideos[currentIndex] : (videos.find((v) => v.video_id === playingId) || videos[0])

  const toggleWatched = async (videoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const isWatched = watched.has(videoId)
    const next = new Set(watched)
    if (isWatched) {
      next.delete(videoId)
      setWatched(next)
      await supabase?.from(watchedTable).delete().eq('platform', 'youtube').eq('video_id', videoId)
    } else {
      next.add(videoId)
      setWatched(next)
      await supabase?.from(watchedTable).upsert({
        platform: 'youtube',
        video_id: videoId,
        watched_at: new Date().toISOString(),
      })
    }
  }

  const watchedCount = useMemo(() => {
    return videos.filter((v) => watched.has(v.video_id)).length
  }, [videos, watched])

  const currentIsWatched = currentVideo ? watched.has(currentVideo.video_id) : false
  const embedBase = currentVideo?.embed_url || (currentVideo?.video_id ? `https://www.youtube-nocookie.com/embed/${currentVideo.video_id}` : '')
  const embedSrc = embedBase ? `${embedBase}${embedBase.includes('?') ? '&' : '?'}autoplay=1&rel=0&enablejsapi=1` : ''

  return (
    <div className="tv-detail">
      {/* 1. Header Top Bar */}
      <div className="tv-detail-bar">
        <button
          type="button"
          className="tv-back-circle-btn"
          onClick={onBack}
          aria-label="Quay lại danh sách thể loại"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="tv-detail-title-wrap">
          <span style={{ fontSize: '1.2rem', marginRight: 4 }}>{group.category.icon}</span>
          <span className="tv-header-title-text">{group.category.name}</span>
        </div>

        <div className="tv-header-right-actions">
          <button
            type="button"
            className="tv-header-icon-btn"
            title="Lưu thể loại"
            onClick={() => alert(`Đã ghim thể loại ${group.category.name}!`)}
          >
            <Bookmark size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="tv-empty">Đang tải danh sách video…</div>
      ) : !videos.length ? (
        <div className="tv-empty">Thể loại này chưa có video nào.</div>
      ) : (
        <>
          {/* 2. Main Player Card */}
          <div ref={playerBoxRef} className="tv-main-player-card">
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

            {/* Tiêu đề & Tên Kênh */}
            {currentVideo && (
              <div className="tv-video-info-block">
                <div className="tv-video-title-main">{currentVideo.title}</div>
                <div className="tv-video-creator-link" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{currentVideo.creator_name || 'YouTube Video'}</span>
                  <span className={`tv-video-category-tag ${type === 'review' ? 'review' : ''}`}>
                    {group.category.icon} {group.category.name}
                  </span>
                </div>
              </div>
            )}

            {/* 3. BẢNG 4 NÚT HÀNG NGANG */}
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

              {/* Nút 4: Cài đặt */}
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

          {/* 4. Section Danh sách video trong Thể loại */}
          <div className="tv-playlist-section">
            <div className="tv-playlist-head">
              <span className="tv-playlist-title">
                Danh sách video ({filteredVideos.length})
              </span>
              <span className="tv-playlist-stat">
                Đã xem {watchedCount}/{videos.length} ({videos.length > 0 ? Math.round((watchedCount / videos.length) * 100) : 0}%)
              </span>
            </div>

            {/* Ô tìm kiếm */}
            <div className="tv-search-input-wrapper">
              <input
                className="tv-search-field"
                placeholder="Tìm video trong thể loại hoặc theo tên kênh..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search className="tv-search-icon-inside" size={16} />
            </div>

            {/* Filter Pills & Sort */}
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
                  Chưa xem ({videos.length - watchedCount})
                </button>
                <button
                  type="button"
                  className={`tv-filter-pill-btn ${filterMode === 'watched' ? 'active' : ''}`}
                  onClick={() => setFilterMode('watched')}
                >
                  Đã xem ({watchedCount})
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

            {/* Danh sách Video Items */}
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

                    <div className="tv-video-meta-content">
                      <div className="tv-video-item-title">
                        #{indexNum}. {v.title}
                      </div>
                      <div className="tv-video-item-sub">
                        <span className="tv-video-item-author">{v.creator_name || 'YouTube'}</span>
                        {v.published_at && (
                          <span className="tv-video-item-date">
                            {new Date(v.published_at).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="tv-video-item-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`tv-video-check-btn ${isWatched ? 'watched' : ''}`}
                        onClick={(e) => void toggleWatched(v.video_id, e)}
                        title={isWatched ? 'Đánh dấu chưa xem' : 'Đánh dấu đã xem'}
                      >
                        {isWatched ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </button>

                      <button
                        type="button"
                        className="tv-video-menu-btn"
                        onClick={() => setSelectedVideoForMenu(v)}
                        title="Tùy chọn khác"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Speed Modal */}
      {showSpeedModal && (
        <Modal title="Tốc độ phát video" onClose={() => setShowSpeedModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
            {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
              <button
                key={rate}
                className={`tv-btn ${playbackRate === rate ? 'primary' : ''}`}
                style={{ justifyContent: 'space-between', padding: '10px 16px' }}
                onClick={() => {
                  applyPlaybackRate(rate)
                  setShowSpeedModal(false)
                }}
              >
                <span>Tốc độ {rate}x</span>
                {playbackRate === rate && <Check size={16} />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Timer Modal */}
      {showTimerModal && (
        <Modal title="Hẹn giờ tắt video" onClose={() => setShowTimerModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
            {[
              { label: 'Tắt hẹn giờ', value: null },
              { label: '15 phút', value: 15 },
              { label: '30 phút', value: 30 },
              { label: '45 phút', value: 45 },
              { label: '60 phút (1 tiếng)', value: 60 },
              { label: '90 phút (1.5 tiếng)', value: 90 },
            ].map((item) => (
              <button
                key={item.label}
                className={`tv-btn ${sleepTimerMinutes === item.value ? 'primary' : ''}`}
                style={{ justifyContent: 'space-between', padding: '10px 16px' }}
                onClick={() => {
                  setSleepTimerMinutes(item.value)
                  setShowTimerModal(false)
                }}
              >
                <span>{item.label}</span>
                {sleepTimerMinutes === item.value && <Check size={16} />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <Modal title="Cài đặt & Tùy chọn" onClose={() => setShowSettingsModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Tự động phát video kế tiếp</span>
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
                style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
              />
            </label>

            {currentVideo && (
              <a
                href={currentVideo.canonical_url || `https://www.youtube.com/watch?v=${currentVideo.video_id}`}
                target="_blank"
                rel="noreferrer"
                className="tv-btn"
                style={{ justifyContent: 'center', marginTop: 8 }}
              >
                <ExternalLink size={15} /> Mở video trên YouTube
              </a>
            )}
          </div>
        </Modal>
      )}

      {/* Video Item Menu Modal */}
      {selectedVideoForMenu && (
        <Modal title="Tùy chọn video" onClose={() => setSelectedVideoForMenu(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
            <a
              href={selectedVideoForMenu.canonical_url || `https://www.youtube.com/watch?v=${selectedVideoForMenu.video_id}`}
              target="_blank"
              rel="noreferrer"
              className="tv-btn"
              style={{ justifyContent: 'flex-start' }}
            >
              <ExternalLink size={15} /> Mở trên YouTube
            </a>
            <button
              className="tv-btn"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => {
                navigator.clipboard?.writeText(
                  selectedVideoForMenu.canonical_url || `https://www.youtube.com/watch?v=${selectedVideoForMenu.video_id}`
                )
                alert('Đã sao chép link video!')
                setSelectedVideoForMenu(null)
              }}
            >
              <Copy size={15} /> Sao chép link video
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
