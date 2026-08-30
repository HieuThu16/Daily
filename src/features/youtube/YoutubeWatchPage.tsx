import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Check, CheckCircle2, Circle, ExternalLink,
  PictureInPicture2, Share2, ChevronRight, Layers,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchYouTubeMeta } from '../../lib/youtubeMeta'
import { useToast } from '../ToastContext'
import { useHideHeader } from '../HeaderAction'
import { WatchTogetherButton } from '../watch/WatchTogetherButton'
import { YoutubeChannelModal } from './YoutubeChannelModal'
import {
  progressLabel, useVideoProgressMap, useYouTubeProgress,
} from '../../lib/videoProgress'
import {
  getVideoStatusSets, setVideoStatus as updateVideoStatusRecord, useVideoStatusListener,
} from '../../lib/videoStatus'
import { useVideoMiniPlayer } from './VideoMiniPlayer'
import '../tvshow/tvShow.css'

export type WatchVideo = {
  id: string
  video_id: string
  creator_id: string | null
  creator_name: string | null
  title: string
  description: string | null
  canonical_url: string | null
  embed_url: string | null
  thumbnail: string | null
  duration: number | null
  published_at: string | null
  sourceType: 'tvshow' | 'review'
  /** True khi video chưa nằm trong kho — mở thẳng từ kết quả tìm kiếm YouTube. */
  notInApp?: boolean
}

/**
 * Thông tin kèm theo lúc điều hướng từ kết quả tìm kiếm.
 * Có sẵn thì hiện ngay tiêu đề, khỏi chờ gọi oEmbed.
 */
export type WatchHint = {
  title?: string
  channelName?: string
  thumbnail?: string
  /** Đường quay lại nơi đã bấm vào; thiếu thì về kho video như cũ. */
  from?: string
  /** Chữ trên nút quay lại, hợp với nơi sẽ quay về. */
  fromLabel?: string
}

const COLUMNS =
  'id,video_id,creator_id,creator_name,title,description,canonical_url,embed_url,thumbnail,duration,published_at'

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || isNaN(Number(sec))) return ''
  const total = Math.floor(Number(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

export function publishedLabel(iso: string | null | undefined, now: Date = new Date()): string {
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

/**
 * Dựng bản ghi tạm cho video KHÔNG có trong kho, để vẫn xem được.
 *
 * Ưu tiên thông tin gửi kèm lúc điều hướng (bấm từ kết quả tìm kiếm) vì có ngay;
 * vào thẳng bằng URL thì mới cần oEmbed. Không có gì thì vẫn phát được, chỉ là
 * tiêu đề chung chung — thà vậy còn hơn báo "không tìm thấy".
 */
export function buildFallbackVideo(
  videoId: string,
  hint?: WatchHint | null,
  meta?: { title: string; author: string } | null,
): WatchVideo {
  return {
    id: `yt-${videoId}`,
    video_id: videoId,
    creator_id: null,
    creator_name: hint?.channelName || meta?.author || null,
    title: hint?.title || meta?.title || 'Video YouTube',
    description: null,
    canonical_url: `https://www.youtube.com/watch?v=${videoId}`,
    embed_url: null,
    thumbnail: hint?.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: null,
    published_at: null,
    sourceType: 'review',
    notInApp: true,
  }
}

/**
 * Nút quay lại nên về đâu.
 *
 * Trước đây cứng /youtube, nên mở video từ tab Xem chung rồi bấm quay lại là
 * lạc sang kho YouTube — mất chỗ đang xem dở.
 */
export function backTarget(hint?: WatchHint | null): { to: string; label: string } {
  return {
    to: hint?.from || '/youtube',
    label: hint?.fromLabel || 'Kho video',
  }
}

/** Trang xem một video: khung phát lớn, tiêu đề, hàng nút, mô tả, video cùng kênh. */
export function YoutubeWatchPage() {
  const { videoId = '' } = useParams()
  const navigate = useNavigate()
  const hint = useLocation().state as WatchHint | null
  /*
   * Nút quay lại trước đây cứng /youtube, nên mở video từ tab Xem chung rồi bấm
   * quay lại là lạc sang kho YouTube — mất chỗ đang xem dở.
   */
  const { to: backTo, label: backLabel } = backTarget(hint)
  const { showToast } = useToast()
  const { playInMini } = useVideoMiniPlayer()
  const progressMap = useVideoProgressMap()
  useHideHeader(true)

  const [video, setVideo] = useState<WatchVideo | null>(null)
  const [siblings, setSiblings] = useState<WatchVideo[]>([])
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [watchedSet, setWatchedSet] = useState<Set<string>>(new Set())
  const [showDescription, setShowDescription] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)

  useVideoStatusListener(() => {
    if (video) {
      setWatchedSet(getVideoStatusSets(video.sourceType).watchedSet)
    }
  })

  useEffect(() => {
    let alive = true
    setLoading(true)

    void (async () => {
      // Video nằm ở một trong hai bảng; tìm cả hai rồi lấy cái có.
      const [tv, review] = await Promise.all([
        supabase?.from('tvshow_videos').select(COLUMNS).eq('video_id', videoId).maybeSingle(),
        supabase?.from('review_videos').select(COLUMNS).eq('video_id', videoId).maybeSingle(),
      ])
      const row = (tv?.data ?? review?.data) as any
      if (!alive) return

      if (!row) {
        /*
         * Không có trong kho — nhưng vẫn phải xem được. Bấm một kết quả tìm kiếm
         * YouTube mà nhận "Không tìm thấy video này trong kho" thì vô lý.
         * Điều hướng từ ô tìm kiếm có kèm sẵn tiêu đề nên hiện ngay; vào thẳng
         * bằng URL thì hỏi oEmbed, chậm một nhịp nhưng vẫn ra.
         */
        const meta = hint?.title ? null : await fetchYouTubeMeta(`https://www.youtube.com/watch?v=${videoId}`)
        if (!alive) return
        setVideo(buildFallbackVideo(videoId, hint, meta))
        setSiblings([])
        setLoading(false)
        return
      }

      const sourceType: 'tvshow' | 'review' = tv?.data ? 'tvshow' : 'review'
      const current: WatchVideo = { ...row, sourceType }
      setVideo(current)

      const table = sourceType === 'tvshow' ? 'tvshow_videos' : 'review_videos'
      const [same, watchedRes] = await Promise.all([
        supabase
          ?.from(table)
          .select(COLUMNS)
          .eq('creator_name', current.creator_name ?? '')
          .is('unavailable_at', null)
          .order('published_at', { ascending: false })
          .limit(500),
        supabase?.from(sourceType === 'tvshow' ? 'tvshow_watched' : 'review_watched').select('video_id'),
      ])
      if (!alive) return

      setSiblings(
        ((same?.data ?? []) as any[]).filter((v) => v.video_id !== videoId).map((v) => ({ ...v, sourceType })),
      )
      const watchedIds = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((r) => r.video_id))
      setWatchedSet(getVideoStatusSets(sourceType, watchedIds).watchedSet)
      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [videoId, hint])

  useYouTubeProgress(iframeRef, {
    videoId: video?.video_id ?? null,
    title: video?.title,
    channelName: video?.creator_name ?? undefined,
    thumbnail: video?.thumbnail,
  })

  const progress = progressMap[videoId]
  const watched = watchedSet.has(videoId) || progress?.status === 'COMPLETED'

  // Chỉ lấy start time 1 lần khi bắt đầu tải video (không phụ thuộc vào tiến độ thay đổi liên tục)
  const initialStartRef = useRef<Record<string, number>>({})
  if (video?.video_id && initialStartRef.current[video.video_id] === undefined) {
    initialStartRef.current[video.video_id] = Math.floor(progressMap[video.video_id]?.seconds ?? 0)
  }
  const start = video?.video_id ? (initialStartRef.current[video.video_id] ?? 0) : 0

  const embedSrc = useMemo(() => {
    if (!video) return ''
    const base = video.embed_url || `https://www.youtube.com/embed/${video.video_id}`
    return `${base}${base.includes('?') ? '&' : '?'}autoplay=1&rel=0&enablejsapi=1&playsinline=1${
      start > 3 ? `&start=${start}` : ''
    }`
    // Chỉ dựng lại src khi đổi video, không dựng theo tiến độ đang chạy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.video_id, video?.embed_url])

  const toggleWatched = async () => {
    if (!video) return
    const next = watched ? 'UNWATCHED' : 'COMPLETED'
    await updateVideoStatusRecord(video.video_id, video.sourceType, next, {
      title: video.title,
      channel_name: video.creator_name ?? undefined,
    })
    showToast(next === 'COMPLETED' ? 'Đã đánh dấu xem xong' : 'Bỏ đánh dấu đã xem', 'info')
  }

  const share = async () => {
    if (!video) return
    const url = video.canonical_url || `https://www.youtube.com/watch?v=${video.video_id}`
    try {
      if (navigator.share) await navigator.share({ title: video.title, url })
      else {
        await navigator.clipboard.writeText(url)
        showToast('Đã chép link', 'success')
      }
    } catch {
      /* người dùng bấm huỷ */
    }
  }

  if (loading) {
    return (
      <div className="yt-watch">
        <div className="yt-watch-main">
          <div className="yt-watch-player" style={{ background: '#000' }} />
        </div>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="yt-watch">
        <div className="yt-watch-main">
          <button type="button" className="tv-btn" onClick={() => navigate(backTo)}>
            <ArrowLeft size={15} /> Quay lại
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Không tìm thấy video này trong kho.</p>
        </div>
      </div>
    )
  }

  const allChannelVideos = useMemo(() => (video ? [video, ...siblings] : []), [video, siblings])

  return (
    <div className="yt-watch">
      <div className="yt-watch-main">
        <button type="button" className="yt-watch-back" onClick={() => navigate(backTo)}>
          <ArrowLeft size={16} /> {backLabel}
        </button>

        <div className="yt-watch-player">
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {video.notInApp && (
          <p className="yt-watch-notice">
            Video này chưa có trong kho — vẫn xem được, nhưng chưa lưu tiến độ theo kênh.
          </p>
        )}

        <h1 className="yt-watch-title">{video.title}</h1>

        <div
          className="yt-watch-meta"
          onClick={() => setShowChannelModal(true)}
          title="Nhấn để xem toàn bộ video & danh sách phát của kênh này"
          style={{
            cursor: 'pointer',
            transition: 'background 0.2s',
            padding: '8px 10px',
            borderRadius: 12,
            margin: '6px -10px',
          }}
        >
          <span className="yt-watch-avatar" aria-hidden>
            {(video.creator_name || 'Y').trim().charAt(0).toUpperCase()}
          </span>
          <div className="yt-watch-channel">
            <strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {video.creator_name || 'Kênh YouTube'}
              <ChevronRight size={14} style={{ opacity: 0.7 }} />
            </strong>
            <span style={{ color: 'var(--primary, #3b82f6)', fontWeight: 600 }}>
              {allChannelVideos.length} video · Bấm xem kênh & danh sách phát
            </span>
          </div>
          <span className="yt-watch-published">
            {[publishedLabel(video.published_at), formatDuration(video.duration)].filter(Boolean).join(' · ')}
          </span>
        </div>

        <div className="yt-watch-actions">
          <button type="button" className={`yt-chip ${watched ? 'on' : ''}`} onClick={() => void toggleWatched()}>
            {watched ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            {watched ? 'Đã xem xong' : 'Đánh dấu đã xem'}
          </button>

          <button
            type="button"
            className="yt-chip"
            onClick={() =>
              playInMini({
                videoId: video.video_id,
                title: video.title,
                channelName: video.creator_name,
                thumbnail: video.thumbnail,
                startSeconds: progress?.seconds,
              })
            }
          >
            <PictureInPicture2 size={15} /> Phát nền
          </button>

          <WatchTogetherButton
            item={{
              kind: 'VIDEO',
              refId: video.video_id,
              title: video.title,
              subtitle: video.creator_name ?? undefined,
              thumbnail: video.thumbnail,
              url: `https://www.youtube.com/watch?v=${video.video_id}`,
            }}
          />

          <button type="button" className="yt-chip" onClick={() => void share()}>
            <Share2 size={15} /> Chia sẻ
          </button>

          <a
            className="yt-chip"
            href={video.canonical_url || `https://www.youtube.com/watch?v=${video.video_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} /> Mở YouTube
          </a>
        </div>

        {progress && progress.percent > 0 && (
          <div className={`yt-watch-progress ${watched ? 'done' : ''}`}>
            {progressLabel(progress)}
            <span className="yt-watch-progress-bar">
              <i style={{ width: `${Math.min(100, progress.percent)}%` }} />
            </span>
          </div>
        )}

        {video.description && (
          <div
            className={`yt-watch-desc ${showDescription ? 'open' : ''}`}
            onClick={() => setShowDescription((v) => !v)}
          >
            <p>{video.description}</p>
            <button type="button">{showDescription ? 'Thu gọn' : 'Xem thêm'}</button>
          </div>
        )}
      </div>

      <aside className="yt-watch-side">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '0.98rem' }}>Video khác của kênh</h2>
          <button
            type="button"
            onClick={() => setShowChannelModal(true)}
            style={{
              background: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--primary, #3b82f6)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Layers size={13} /> Danh sách phát
          </button>
        </div>

        {siblings.length === 0 && <p className="yt-watch-side-empty">Kho chưa có video nào khác của kênh này.</p>}
        {siblings.map((item) => {
          const itemProgress = progressMap[item.video_id]
          const itemWatched = watchedSet.has(item.video_id) || itemProgress?.status === 'COMPLETED'
          return (
            <button
              key={item.id}
              type="button"
              className="yt-watch-next"
              onClick={() => navigate(`/youtube/watch/${item.video_id}`)}
            >
              <span className="yt-watch-next-thumb">
                {item.thumbnail && <img src={item.thumbnail} alt="" loading="lazy" />}
                {item.duration ? <i className="yt-watch-next-time">{formatDuration(item.duration)}</i> : null}
                {itemProgress && itemProgress.percent > 0 && (
                  <i className="yt-watch-next-seen" style={{ width: `${Math.min(100, itemProgress.percent)}%` }} />
                )}
              </span>
              <span className="yt-watch-next-body">
                <span className="yt-watch-next-title">{item.title}</span>
                <span className="yt-watch-next-sub">
                  {[item.creator_name, publishedLabel(item.published_at)].filter(Boolean).join(' · ')}
                </span>
                {itemWatched && (
                  <span className="yt-watch-next-done">
                    <Check size={11} /> Đã xem
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </aside>

      {/* Modal Chi tiết Kênh: 2 Tab Video Mới Nhất & Danh Sách Phát */}
      <YoutubeChannelModal
        isOpen={showChannelModal}
        onClose={() => setShowChannelModal(false)}
        channelName={video.creator_name || 'Kênh YouTube'}
        videos={allChannelVideos}
        currentVideoId={video.video_id}
        watchedSet={watchedSet}
        progressMap={progressMap}
        onSelectVideo={(selectedId) => navigate(`/youtube/watch/${selectedId}`)}
      />
    </div>
  )
}
