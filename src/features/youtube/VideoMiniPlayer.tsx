import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Maximize2, X } from 'lucide-react'
import { useYouTubeProgress } from '../../lib/videoProgress'

export type MiniVideo = {
  videoId: string
  title?: string
  channelName?: string | null
  thumbnail?: string | null
  /** Mở tiếp từ giây nào (đang xem dở). */
  startSeconds?: number
}

type MiniPlayerApi = {
  current: MiniVideo | null
  /** Đẩy video xuống khung nhỏ, phát tiếp kể cả khi đi sang trang khác trong app. */
  playInMini: (video: MiniVideo) => void
  closeMini: () => void
}

const MiniPlayerContext = createContext<MiniPlayerApi>({
  current: null,
  playInMini: () => {},
  closeMini: () => {},
})

export const useVideoMiniPlayer = () => useContext(MiniPlayerContext)

export function VideoMiniPlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<MiniVideo | null>(null)
  const api = useMemo<MiniPlayerApi>(
    () => ({ current, playInMini: setCurrent, closeMini: () => setCurrent(null) }),
    [current],
  )
  return <MiniPlayerContext.Provider value={api}>{children}</MiniPlayerContext.Provider>
}

/**
 * Khung video nhỏ ở góc màn hình. Nằm ngoài <Routes> nên đổi tab trong app
 * cũng không dựng lại iframe — video chạy tiếp thay vì tắt.
 */
export function VideoMiniPlayer() {
  const { current, closeMini } = useVideoMiniPlayer()
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Vẫn ghi "đang xem" và % như trình phát lớn.
  useYouTubeProgress(iframeRef, {
    videoId: current?.videoId ?? null,
    title: current?.title,
    channelName: current?.channelName ?? undefined,
    thumbnail: current?.thumbnail,
  })

  if (!current) return null

  const src = useMemo(() => {
    if (!current) return ''
    const start = Math.max(0, Math.floor(current.startSeconds ?? 0))
    return (
      `https://www.youtube.com/embed/${current.videoId}` +
      `?autoplay=1&rel=0&enablejsapi=1&playsinline=1${start > 0 ? `&start=${start}` : ''}`
    )
  }, [current?.videoId])

  return (
    <div className="yt-mini" role="complementary" aria-label="Video đang phát">
      <div className="yt-mini-frame">
        <iframe
          ref={iframeRef}
          src={src}
          title={current.title || 'Video YouTube'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="yt-mini-bar">
        <span className="yt-mini-title" title={current.title}>{current.title || 'Video YouTube'}</span>
        <button type="button" onClick={() => navigate('/youtube')} title="Mở trang YouTube" aria-label="Mở trang YouTube">
          <Maximize2 size={14} />
        </button>
        <button type="button" onClick={closeMini} title="Đóng" aria-label="Đóng khung video nhỏ">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
