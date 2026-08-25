import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { setVideoStatus } from './videoStatus'
import { updateMyShareProgress } from './watchTogether'

/** Xem tới đây coi như xem hết — phần đuôi thường là credit/quảng cáo. */
export const COMPLETE_AT_PERCENT = 90

export type VideoProgress = {
  videoId: string
  title?: string
  channelName?: string
  thumbnail?: string | null
  seconds: number
  durationSeconds?: number | null
  percent: number
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
  userName?: string
  updatedAt?: string
}

const STORAGE_KEY = 'daily_video_progress'
const EVENT_NAME = 'daily_video_progress_changed'

export function percentOf(seconds: number, duration?: number | null): number {
  if (!duration || duration <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((seconds / duration) * 100)))
}

export function statusOfPercent(percent: number): VideoProgress['status'] {
  if (percent >= COMPLETE_AT_PERCENT) return 'COMPLETED'
  if (percent > 0) return 'IN_PROGRESS'
  return 'PLANNED'
}

/** Nhãn ngắn hiện trên thẻ video và ở tab Xem chung. */
export function progressLabel(p: Pick<VideoProgress, 'percent' | 'status'>): string {
  if (p.status === 'COMPLETED') return 'Đã xem hết'
  if (p.status === 'PLANNED' || p.percent <= 0) return 'Chưa xem'
  return `Đang xem ${p.percent}%`
}

export function getLocalProgress(): Record<string, VideoProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocal(map: Record<string, VideoProgress>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* hết chỗ thì thôi, mất tiến độ còn hơn vỡ app */
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

async function upsertRemote(rows: VideoProgress[]) {
  if (!supabase || rows.length === 0) return
  try {
    const { data } = await supabase.auth.getUser()
    const user = data?.user
    if (!user) return
    const today = new Date().toLocaleDateString('sv-SE')
    await supabase.from('video_watch_progress').upsert(
      rows.map((r) => ({
        id: `${user.id}:${r.videoId}`,
        user_id: user.id,
        user_email: user.email ?? null,
        video_id: r.videoId,
        title: r.title ?? null,
        channel_name: r.channelName ?? null,
        thumbnail: r.thumbnail ?? null,
        seconds: Math.round(r.seconds),
        duration_seconds: r.durationSeconds ?? null,
        percent: r.percent,
        status: r.status,
        log_date: today,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' },
    )
  } catch (err) {
    console.warn('[videoProgress] không đồng bộ được:', err)
  }
}

/** Ghi tiến độ xem: lưu máy, đẩy lên đám mây và cập nhật trạng thái Chưa/Đang/Đã xem. */
export async function saveVideoProgress(input: {
  videoId: string
  seconds: number
  durationSeconds?: number | null
  title?: string
  channelName?: string
  thumbnail?: string | null
}): Promise<VideoProgress> {
  const map = getLocalProgress()
  const prev = map[input.videoId]
  const duration = (input.durationSeconds && input.durationSeconds > 0)
    ? input.durationSeconds
    : (prev?.durationSeconds && prev.durationSeconds > 0 ? prev.durationSeconds : null)

  const percent = percentOf(input.seconds, duration)
  const row: VideoProgress = {
    videoId: input.videoId,
    title: input.title ?? prev?.title,
    channelName: input.channelName ?? prev?.channelName,
    thumbnail: input.thumbnail ?? prev?.thumbnail ?? null,
    seconds: input.seconds,
    durationSeconds: duration,
    percent,
    status: statusOfPercent(percent),
    updatedAt: new Date().toISOString(),
  }

  // Không tụt lùi: xem lại từ đầu vẫn giữ mốc xa nhất đã xem.
  if (!prev || row.percent >= prev.percent || row.seconds >= prev.seconds) {
    map[input.videoId] = row
    writeLocal(map)
  }

  await setVideoStatus(input.videoId, 'tvshow', row.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS', {
    title: input.title,
    channel_name: input.channelName,
  })
  await upsertRemote([row])
  void updateMyShareProgress('VIDEO', input.videoId, percent, progressLabel(row))
  return row
}

export function useVideoProgressMap(): Record<string, VideoProgress> {
  const [map, setMap] = useState<Record<string, VideoProgress>>(() => getLocalProgress())
  useEffect(() => {
    const update = () => setMap(getLocalProgress())
    window.addEventListener(EVENT_NAME, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(EVENT_NAME, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return map
}

/* ------------------------------------------------------------------ */
/* Trình phát YouTube: đọc được số giây đang xem qua IFrame Player API */
/* ------------------------------------------------------------------ */

let apiPromise: Promise<any> | null = null

function loadYouTubeApi(): Promise<any> {
  const w = window as any
  if (w.YT?.Player) return Promise.resolve(w.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(w.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}

/** Bám vào iframe YouTube (cần enablejsapi=1) và trả về đối tượng player. */
export function useYouTubePlayer(iframe: HTMLIFrameElement | null, videoId: string | null) {
  const [player, setPlayer] = useState<any>(null)
  useEffect(() => {
    if (!iframe || !videoId) return
    let alive = true
    void loadYouTubeApi().then((YT) => {
      if (alive) setPlayer(new YT.Player(iframe, {}))
    })
    return () => {
      alive = false
      setPlayer(null)
    }
  }, [iframe, videoId])
  return player
}

/**
 * Lưu tiến độ xem định kỳ, và lưu ngay khi thu nhỏ / tắt app hay đổi video.
 * Trả về player để chỗ gọi dùng lại (phụ đề song ngữ cần số giây hiện tại).
 */
export function useYouTubeProgress(
  iframe: HTMLIFrameElement | null,
  video: { videoId: string | null; title?: string; channelName?: string; thumbnail?: string | null },
) {
  const player = useYouTubePlayer(iframe, video.videoId)
  const playerRef = useRef<any>(null)
  playerRef.current = player
  const videoRef = useRef(video)
  videoRef.current = video

  const currentTimeRef = useRef(0)
  const durationRef = useRef<number | null>(null)

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data && data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') {
            currentTimeRef.current = data.info.currentTime
          }
          if (typeof data.info.duration === 'number' && data.info.duration > 0) {
            durationRef.current = data.info.duration
          }
        }
      } catch {
        /* Ignore non-JSON messages */
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (!video.videoId) return

    const flush = () => {
      const p = playerRef.current
      const current = videoRef.current
      if (!current.videoId) return

      let seconds = currentTimeRef.current
      let duration = durationRef.current

      if (p && typeof p.getCurrentTime === 'function') {
        try {
          const s = Number(p.getCurrentTime())
          if (s > 0) seconds = s
        } catch {}
      }
      if (p && typeof p.getDuration === 'function') {
        try {
          const d = Number(p.getDuration())
          if (d > 0) duration = d
        } catch {}
      }

      if (seconds < 3) return // bấm nhầm rồi thoát thì không tính là đang xem
      void saveVideoProgress({
        videoId: current.videoId,
        seconds,
        durationSeconds: duration,
        title: current.title,
        channelName: current.channelName,
        thumbnail: current.thumbnail,
      })
    }

    const timer = setInterval(flush, 10000)
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flush)
    window.addEventListener('blur', flush)

    return () => {
      flush()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('blur', flush)
    }
  }, [video.videoId])

  return player
}
