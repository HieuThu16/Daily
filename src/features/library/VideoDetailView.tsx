import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Pencil, Tv, Youtube } from 'lucide-react'
import type { Media } from '../../types'
import { youtubeVideoId } from '../../lib/youtubeMeta'
import { useVideoWatchTracker } from '../../lib/videoWatchLog'

type Props = {
  item: Media
  onBack: () => void
  onEdit: (item: Media) => void
  onStatusChange: (item: Media, status: Media['status']) => void
}

const STATUS_LABELS: Record<Media['status'], string> = {
  PLANNED: 'Sẽ xem',
  IN_PROGRESS: 'Đang xem',
  COMPLETED: 'Đã xem',
}

const STATUS_ORDER: Media['status'][] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED']

/** Ảnh đại diện lấy thẳng từ CDN của YouTube — miễn phí, không cần API key. */
export const thumbnailUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

/**
 * Màn chi tiết một mục TV Show. Cùng khuôn với màn chi tiết sách: ảnh lớn,
 * thông tin, rồi mới tới hành động.
 *
 * Video YouTube không có chương như sách, nên thay cho mục lục là khung xem
 * ngay tại chỗ — thứ tương đương gần nhất về mặt "mở ra là dùng được luôn".
 */
export function VideoDetailView({ item, onBack, onEdit, onStatusChange }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [playing, setPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tvshow_playback_rate')
      return saved ? parseFloat(saved) : 1
    } catch {
      return 1
    }
  })

  const videoId = youtubeVideoId(item.youtube_url ?? '')

  useVideoWatchTracker({
    videoId: playing && videoId ? videoId : null,
    title: item.name,
    channelName: item.channel || undefined,
    type: 'tvshow',
    isPlaying: playing,
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
      localStorage.setItem('tvshow_playback_rate', String(rate))
    } catch {}
    sendYouTubeCommand('setPlaybackRate', [rate])
  }

  useEffect(() => {
    headingRef.current?.focus()
    setPlaying(false)
  }, [item.id])

  return (
    <section className="video-detail" aria-labelledby="video-detail-title">
      <button type="button" className="library-audio-back" aria-label="Quay lại thư viện" onClick={onBack}>
        <ArrowLeft size={17} />
        Quay lại
      </button>

      <div className="video-detail-card">
        {/* Chỉ nhúng iframe sau khi bấm xem */}
        <div className="video-detail-stage">
          {playing && videoId ? (
            <iframe
              ref={iframeRef}
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0`}
              title={item.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                if (playbackRate !== 1) {
                  setTimeout(() => sendYouTubeCommand('setPlaybackRate', [playbackRate]), 400)
                  setTimeout(() => sendYouTubeCommand('setPlaybackRate', [playbackRate]), 1200)
                }
              }}
            />
          ) : videoId ? (
            <button type="button" className="video-detail-poster" aria-label={`Xem ${item.name}`} onClick={() => setPlaying(true)}>
              <img src={thumbnailUrl(videoId)} alt="" />
              <span className="video-detail-play" aria-hidden="true">
                <Youtube size={26} />
              </span>
            </button>
          ) : (
            <div className="video-detail-empty">
              <Tv size={28} />
              <p>Chưa có link YouTube. Sửa mục này và dán link vào để xem ngay tại đây.</p>
            </div>
          )}
        </div>

        {/* Speed Controls when playing */}
        {playing && videoId && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12 }}>
            <div className="tv-speed-group" title="Tốc độ phát">
              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0 4px', color: 'var(--text-muted)' }}>
                ⚡ Tốc độ:
              </span>
              {[1, 1.25, 1.5, 1.75, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={`tv-speed-btn ${rate === 2 ? 'is-2x' : ''} ${playbackRate === rate ? 'active' : ''}`}
                  onClick={() => applyPlaybackRate(rate)}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`tv-btn ${playbackRate === 2 ? 'primary' : ''}`}
              onClick={() => applyPlaybackRate(playbackRate === 2 ? 1 : 2)}
              title="Bật/Tắt tốc độ 2x"
              style={{ fontWeight: 800, fontSize: '0.78rem' }}
            >
              ⚡ {playbackRate === 2 ? 'Đang 2x' : 'Chế độ 2x'}
            </button>
          </div>
        )}

        <div className="video-detail-heading">
          <span>TV Show</span>
          <h2 id="video-detail-title" ref={headingRef} tabIndex={-1}>
            {item.name}
          </h2>
          <p>{item.channel || 'Chưa cập nhật kênh'}</p>
        </div>

        <div className="video-detail-status" role="group" aria-label="Trạng thái">
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              className={'video-detail-status-pill' + (item.status === status ? ' is-on' : '')}
              aria-pressed={item.status === status}
              onClick={() => onStatusChange(item, status)}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        {(item.log_date || item.description) && (
          <dl className="video-detail-facts">
            {item.log_date && (
              <>
                <dt>Ngày xem</dt>
                <dd>
                  {item.log_date}
                  {item.log_time ? ` • ${item.log_time}` : ''}
                </dd>
              </>
            )}
            {item.description && (
              <>
                <dt>Ghi chú</dt>
                <dd>{item.description}</dd>
              </>
            )}
          </dl>
        )}

        <div className="video-detail-actions">
          {item.youtube_url && (
            <a href={item.youtube_url} target="_blank" rel="noreferrer">
              <Youtube size={15} />
              Mở trên YouTube
            </a>
          )}
          <button type="button" onClick={() => onEdit(item)}>
            <Pencil size={14} />
            Chỉnh sửa
          </button>
        </div>
      </div>
    </section>
  )
}

