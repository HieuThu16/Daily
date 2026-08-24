import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, CheckCircle2, Circle, ExternalLink,
  Gauge, Clock, Settings, Search, ArrowUpDown, Play,
  Copy, Check, MoreVertical, Sparkles, Loader2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHideHeader } from '../HeaderAction'
import { useToast } from '../ToastContext'
import { Modal, useIncrementalList } from '../shared'
import { CategorizedGroup, VideoCategoryType } from '../../lib/videoCategorizer'
import { summarizeVideo, toKnowledgeRows, videosNeedingLesson } from '../../lib/videoLesson'
import {
  autoMarkVideoWatching,
  cycleNextVideoStatus,
  getVideoStatusSets,
  setVideoStatus as updateVideoStatusRecord,
  useVideoStatusListener,
  type VideoStatus
} from '../../lib/videoStatus'
import { useVideoWatchTracker } from '../../lib/videoWatchLog'
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
  duration?: number | null
}

export function CategoryDetailView({
  group,
  type = 'tvshow',
  initialVideoId,
  onBack,
}: {
  group: CategorizedGroup<CategoryDetailVideoRow>
  type?: VideoCategoryType
  initialVideoId?: string | null
  onBack: () => void
}) {
  const { showToast } = useToast()
  useHideHeader(true)

  const [videos, setVideos] = useState<CategoryDetailVideoRow[]>(group.videos)
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [inProgress, setInProgress] = useState<Set<string>>(new Set())
  const [statusMap, setStatusMap] = useState<Map<string, VideoStatus>>(new Map())
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [isPlayerActive, setIsPlayerActive] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unwatched' | 'in_progress' | 'watched'>('all')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${type}_playback_rate`)
      return saved ? parseFloat(saved) : 1
    } catch {
      return 1
    }
  })

  /** video_id đã có thẻ kiến thức — dùng để biết video nào còn cần AI. */
  const [lessonDone, setLessonDone] = useState<Set<string>>(new Set())
  const [lessonBusy, setLessonBusy] = useState<string | null>(null)
  const [batch, setBatch] = useState<{ done: number; total: number; failed: number } | null>(null)

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSpeedModal, setShowSpeedModal] = useState(false)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null)
  const [selectedVideoForMenu, setSelectedVideoForMenu] = useState<CategoryDetailVideoRow | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerBoxRef = useRef<HTMLDivElement>(null)

  const watchedTable = type === 'review' ? 'review_watched' : 'tvshow_watched'

  const refreshStatuses = async () => {
    const watchedRes = await supabase?.from(watchedTable).select('video_id')
    const supabaseWatchedIds = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((r) => r.video_id))
    const sets = getVideoStatusSets(type, supabaseWatchedIds)
    setWatched(sets.watchedSet)
    setInProgress(sets.inProgressSet)
    setStatusMap(sets.statusMap)
    return sets
  }

  useVideoStatusListener(() => {
    void refreshStatuses()
  })

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
      showToast('⏱️ Đã hết giờ hẹn! Trình phát video đã tạm dừng.')
    }, sleepTimerMinutes * 60 * 1000)

    return () => clearTimeout(timer)
  }, [sleepTimerMinutes])

  useEffect(() => {
    void (async () => {
      const sets = await refreshStatuses()
      setVideos(group.videos)

      const lessonRes = await supabase
        ?.from('knowledge_items')
        .select('source_video_id')
        .not('source_video_id', 'is', null)
        .is('deleted_at', null)
      setLessonDone(new Set(((lessonRes?.data ?? []) as { source_video_id: string }[]).map((r) => r.source_video_id)))

      // Ưu tiên chọn video đang xem hoặc video chưa xem đầu tiên
      const firstInProgress = group.videos.find((r) => sets.inProgressSet.has(r.video_id))
      const firstUnwatched = group.videos.find((r) => !sets.watchedSet.has(r.video_id) && !sets.inProgressSet.has(r.video_id))
      setPlayingId(initialVideoId || (firstInProgress ? firstInProgress.video_id : (firstUnwatched ? firstUnwatched.video_id : group.videos[0]?.video_id ?? null)))
      if (initialVideoId) setIsPlayerActive(true)
      setLoading(false)
    })()
  }, [group, watchedTable, type, initialVideoId])

  // Tự động chuyển sang trạng thái Đang xem khi video được phát
  useEffect(() => {
    if (isPlayerActive && playingId) {
      const v = videos.find((item) => item.video_id === playingId)
      void autoMarkVideoWatching(playingId, type, watched, {
        title: v?.title,
        channel_name: v?.creator_name || undefined,
        series_key: v?.series_key,
      })
    }
  }, [isPlayerActive, playingId, type, videos, watched])

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
      result = result.filter((v) => !watched.has(v.video_id) && !inProgress.has(v.video_id))
    } else if (filterMode === 'in_progress') {
      result = result.filter((v) => inProgress.has(v.video_id))
    } else if (filterMode === 'watched') {
      result = result.filter((v) => watched.has(v.video_id))
    }

    if (sortOrder === 'asc') {
      result.reverse()
    }
    return result
  }, [videos, search, filterMode, watched, inProgress, sortOrder])

  const list = useIncrementalList(filteredVideos.length, 48, `${search}|${filterMode}|${sortOrder}`)

  const currentIndex = filteredVideos.findIndex((v) => v.video_id === playingId)
  const currentVideo = currentIndex >= 0 ? filteredVideos[currentIndex] : (videos.find((v) => v.video_id === playingId) || videos[0])

  // Tự động theo dõi thời gian xem video thực tế trên màn hình để hiển thị lên Home
  useVideoWatchTracker({
    videoId: isPlayerActive && playingId ? playingId : null,
    title: currentVideo?.title,
    channelName: currentVideo?.creator_name || group.category.name,
    type,
    isPlaying: isPlayerActive,
  })

  /** Rút thẻ kiến thức của một video rồi lưu. Trả về null nếu xong, hoặc thông điệp lỗi. */
  const makeLesson = async (v: CategoryDetailVideoRow) => {
    try {
      const cards = await summarizeVideo(v.video_id, v.duration)
      const rows = toKnowledgeRows({ videoId: v.video_id, title: v.title }, cards, v.creator_name || group.category.name)
      if (!rows.length) throw new Error('Không có thẻ nào')
      // Rút lại thì bỏ thẻ cũ của video đi, tránh nhân đôi.
      await supabase!
        .from('knowledge_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('source_video_id', v.video_id)
        .is('deleted_at', null)
      const { error } = await supabase!.from('knowledge_items').insert(rows)
      if (error) throw error
      setLessonDone((prev) => new Set(prev).add(v.video_id))
      return null
    } catch (e) {
      return (e as Error)?.message || 'Lỗi không rõ'
    }
  }

  const pending = videosNeedingLesson(videos, lessonDone)

  /** Chạy tuần tự — Gemini tính theo lượt, đừng bắn song song. */
  const makeLessonsBatch = async () => {
    if (!pending.length || batch) return
    if (!window.confirm(`Tạo kiến thức cho ${pending.length} video chưa có? Sẽ chạy lần lượt và tốn quota AI.`)) return
    setBatch({ done: 0, total: pending.length, failed: 0 })
    let failed = 0
    for (let i = 0; i < pending.length; i++) {
      if (await makeLesson(pending[i])) failed++
      setBatch({ done: i + 1, total: pending.length, failed })
    }
    setBatch(null)
    showToast(failed ? `Xong: ${pending.length - failed} video có thẻ, ${failed} video lỗi.` : `Đã tạo kiến thức cho ${pending.length} video.`)
  }

  const handleSetStatus = async (videoId: string, status: VideoStatus, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const targetVideo = videos.find((v) => v.video_id === videoId)
    await updateVideoStatusRecord(videoId, type, status, {
      title: targetVideo?.title,
      channel_name: targetVideo?.creator_name || undefined,
      series_key: targetVideo?.series_key,
    })
  }

  const handleCycleStatus = async (videoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const currentSt = statusMap.get(videoId) || (watched.has(videoId) ? 'COMPLETED' : (inProgress.has(videoId) ? 'IN_PROGRESS' : 'UNWATCHED'))
    const targetVideo = videos.find((v) => v.video_id === videoId)
    await cycleNextVideoStatus(videoId, type, currentSt, {
      title: targetVideo?.title,
      channel_name: targetVideo?.creator_name || undefined,
      series_key: targetVideo?.series_key,
    })
  }

  const watchedCount = useMemo(() => {
    return videos.filter((v) => watched.has(v.video_id)).length
  }, [videos, watched])

  const inProgressCount = useMemo(() => {
    return videos.filter((v) => inProgress.has(v.video_id)).length
  }, [videos, inProgress])

  const unwatchedCount = videos.length - watchedCount - inProgressCount
  const currentStatus: VideoStatus = currentVideo ? (statusMap.get(currentVideo.video_id) || (watched.has(currentVideo.video_id) ? 'COMPLETED' : (inProgress.has(currentVideo.video_id) ? 'IN_PROGRESS' : 'UNWATCHED'))) : 'UNWATCHED'
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
                  aria-label="Nhấn để phát video"
                >
                  <img
                    src={currentVideo.thumbnail || `https://i.ytimg.com/vi/${currentVideo.video_id}/mqdefault.jpg`}
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

            {/* 3. BẢNG 3 NÚT HÀNG NGANG: Đánh dấu | Kiến thức | Cài đặt */}
            <div className="tv-action-grid-3">
              {/* Nút 1: Trạng thái xem (Sẽ xem / Đang xem / Đã xem) */}
              <button
                type="button"
                className={`tv-action-card-btn ${currentStatus === 'COMPLETED' ? 'active is-watched' : (currentStatus === 'IN_PROGRESS' ? 'active is-in-progress' : '')}`}
                onClick={() => currentVideo && void handleCycleStatus(currentVideo.video_id)}
                title="Bấm để đổi trạng thái: Sẽ xem → Đang xem → Đã xem"
              >
                <div className="tv-action-icon-box">
                  {currentStatus === 'COMPLETED' ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : currentStatus === 'IN_PROGRESS' ? (
                    <Clock size={18} color="#f59e0b" />
                  ) : (
                    <Circle size={18} />
                  )}
                </div>
                <span className="tv-action-label-title">Trạng thái</span>
                <span className={`tv-action-label-sub ${currentStatus === 'COMPLETED' ? 'is-green' : (currentStatus === 'IN_PROGRESS' ? 'is-amber' : '')}`}>
                  {currentStatus === 'COMPLETED' ? 'Đã xem' : (currentStatus === 'IN_PROGRESS' ? 'Đang xem' : 'Sẽ xem')}
                </span>
              </button>

              {/* Nút 2: Tạo kiến thức từ video này */}
              <button
                type="button"
                className={`tv-action-card-btn ${currentVideo && lessonDone.has(currentVideo.video_id) ? 'active' : ''}`}
                disabled={!currentVideo || lessonBusy === currentVideo.video_id}
                onClick={() => {
                  const v = currentVideo
                  if (!v) return
                  setLessonBusy(v.video_id)
                  void makeLesson(v).then((err) => {
                    setLessonBusy(null)
                    showToast(err ? `Chưa rút được kiến thức:
${err}` : 'Đã lưu thẻ kiến thức từ video này.')
                  })
                }}
                title="Dùng AI rút thẻ kiến thức từ video đang phát"
                aria-label="Dùng AI rút thẻ kiến thức từ video đang phát"
              >
                <div className="tv-action-icon-box">
                  {currentVideo && lessonBusy === currentVideo.video_id ? (
                    <Loader2 size={18} className="tv-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                </div>
                <span className="tv-action-label-title">Kiến thức</span>
                <span className="tv-action-label-sub">
                  {currentVideo && lessonBusy === currentVideo.video_id
                    ? 'đang tạo…'
                    : currentVideo && lessonDone.has(currentVideo.video_id)
                      ? 'đã tạo'
                      : 'tạo từ video'}
                </span>
              </button>

              {/* Nút 3: Cài đặt */}
              <button
                type="button"
                className={`tv-action-card-btn ${showSettingsModal ? 'active' : ''}`}
                onClick={() => setShowSettingsModal(true)}
                title="Cài đặt & Tùy chọn"
                aria-label="Cài đặt & Tùy chọn"
              >
                <div className="tv-action-icon-box">
                  <Settings size={18} />
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
                Đã xem {watchedCount}/{videos.length} {inProgressCount > 0 && `• ⏳ Đang xem ${inProgressCount}`}
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
                  📌 Sẽ xem ({unwatchedCount})
                </button>
                <button
                  type="button"
                  className={`tv-filter-pill-btn in-progress ${filterMode === 'in_progress' ? 'active' : ''}`}
                  onClick={() => setFilterMode('in_progress')}
                >
                  ⏳ Đang xem ({inProgressCount})
                </button>
                <button
                  type="button"
                  className={`tv-filter-pill-btn ${filterMode === 'watched' ? 'active' : ''}`}
                  onClick={() => setFilterMode('watched')}
                >
                  ✅ Đã xem ({watchedCount})
                </button>
              </div>

              <button
                type="button"
                className="tv-sort-toggle-btn"
                onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                title="Đổi thứ tự hiển thị"
                aria-label="Đổi thứ tự hiển thị"
              >
                <ArrowUpDown size={13} />
                {sortOrder === 'desc' ? 'Mới nhất' : 'Cũ nhất'}
              </button>

              <button
                type="button"
                className="tv-btn"
                disabled={!!batch || pending.length === 0}
                onClick={() => void makeLessonsBatch()}
                title="Dùng AI rút thẻ kiến thức cho các video chưa có"
                aria-label="Dùng AI rút thẻ kiến thức cho các video chưa có"
              >
                {batch ? <Loader2 size={13} className="tv-spin" /> : <Sparkles size={13} />}
                {batch ? `Đang tạo ${batch.done}/${batch.total}` : `Tạo kiến thức hàng loạt (${pending.length})`}
              </button>
            </div>

            {/* Danh sách Video Items */}
            <div className="tv-video-card-list">
              {filteredVideos.slice(0, list.visibleCount).map((v, i) => {
                const isPlaying = v.video_id === playingId
                const st: VideoStatus = statusMap.get(v.video_id) || (watched.has(v.video_id) ? 'COMPLETED' : (inProgress.has(v.video_id) ? 'IN_PROGRESS' : 'UNWATCHED'))
                const isWatched = st === 'COMPLETED'
                const isInProgress = st === 'IN_PROGRESS'
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
                        src={v.thumbnail || `https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`}
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
                      <div className="tv-video-item-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="tv-video-item-author">{v.creator_name || 'YouTube'}</span>
                        {isInProgress && (
                          <span className="tv-status-badge in-progress">
                            <Clock size={11} /> Đang xem
                          </span>
                        )}
                        {isWatched && (
                          <span className="tv-status-badge watched">
                            <Check size={11} /> Đã xem
                          </span>
                        )}
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
                        className={`tv-video-check-btn ${isWatched ? 'watched' : (isInProgress ? 'in-progress' : '')}`}
                        onClick={(e) => void handleCycleStatus(v.video_id, e)}
                        title={
                          isWatched
                            ? 'Đã xem — Bấm để chuyển sang Sẽ xem'
                            : isInProgress
                            ? 'Đang xem — Bấm để chuyển sang Đã xem'
                            : 'Sẽ xem — Bấm để chuyển sang Đang xem'
                        }
                      >
                        {isWatched ? (
                          <CheckCircle2 size={18} color="#10b981" />
                        ) : isInProgress ? (
                          <Clock size={18} color="#f59e0b" />
                        ) : (
                          <Circle size={18} />
                        )}
                      </button>

                      <button
                        type="button"
                        className="tv-video-menu-btn"
                        onClick={() => setSelectedVideoForMenu(v)}
                        title="Tùy chọn khác"
                        aria-label="Tùy chọn khác"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
              {list.hasMore && (
                <>
                  <div ref={list.sentinel} style={{ height: 1 }} />
                  <button type="button" className="tv-load-more" onClick={list.showMore}>
                    Hiện thêm · còn {list.remaining} video
                  </button>
                </>
              )}
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
            <button
              type="button"
              className="tv-btn"
              style={{ justifyContent: 'space-between', padding: '12px 14px' }}
              onClick={() => {
                setShowSettingsModal(false)
                setShowSpeedModal(true)
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Gauge size={16} /> Tốc độ phát
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{playbackRate}x</span>
            </button>

            <button
              type="button"
              className="tv-btn"
              style={{ justifyContent: 'space-between', padding: '12px 14px' }}
              onClick={() => {
                setShowSettingsModal(false)
                setShowTimerModal(true)
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} /> Hẹn giờ tắt
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{sleepTimerMinutes ? `${sleepTimerMinutes}p` : 'Tắt'}</span>
            </button>

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
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
              TRẠNG THÁI XEM
            </div>
            <button
              type="button"
              className="tv-btn"
              style={{ justifyContent: 'flex-start', color: '#f59e0b' }}
              onClick={() => {
                void handleSetStatus(selectedVideoForMenu.video_id, 'IN_PROGRESS')
                setSelectedVideoForMenu(null)
              }}
            >
              <Clock size={16} /> ⏳ Đánh dấu Đang xem
            </button>
            <button
              type="button"
              className="tv-btn"
              style={{ justifyContent: 'flex-start', color: '#10b981' }}
              onClick={() => {
                void handleSetStatus(selectedVideoForMenu.video_id, 'COMPLETED')
                setSelectedVideoForMenu(null)
              }}
            >
              <CheckCircle2 size={16} /> ✅ Đánh dấu Đã xem
            </button>
            <button
              type="button"
              className="tv-btn"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => {
                void handleSetStatus(selectedVideoForMenu.video_id, 'UNWATCHED')
                setSelectedVideoForMenu(null)
              }}
            >
              <Circle size={16} /> ⚪ Đánh dấu Sẽ xem (Chưa xem)
            </button>

            <div style={{ height: 1, background: 'var(--card-border)', margin: '4px 0' }} />

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
                showToast('Đã sao chép link video!')
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
