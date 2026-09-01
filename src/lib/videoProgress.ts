import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/** Xóa 1 video khỏi lịch sử xem (cả local và Supabase) */
export async function removeVideoProgress(videoId: string) {
  const map = getLocalProgress()
  delete map[videoId]
  writeLocal(map)
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (user) {
        await supabase.from('video_watch_progress').delete().eq('user_id', user.id).eq('video_id', videoId)
      }
    } catch {}
  }
}

/** Xóa toàn bộ lịch sử xem (cả local và Supabase) */
export async function clearAllVideoProgress() {
  writeLocal({})
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (user) {
        await supabase.from('video_watch_progress').delete().eq('user_id', user.id)
      }
    } catch {}
  }
}

/** Đồng bộ toàn bộ lịch sử & tiến độ xem từ Supabase về LocalStorage */
export async function syncVideoProgressFromSupabase(): Promise<Record<string, VideoProgress>> {
  if (!supabase) return getLocalProgress()
  try {
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    if (!user) return getLocalProgress()

    const { data: rows, error } = await supabase
      .from('video_watch_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error || !rows) return getLocalProgress()

    const localMap = getLocalProgress()
    let hasChange = false

    for (const r of rows) {
      if (!r.video_id) continue
      const local = localMap[r.video_id]
      const cloudPercent = typeof r.percent === 'number' ? r.percent : percentOf(r.seconds ?? 0, r.duration_seconds)
      const cloudUpdated = r.updated_at ? new Date(r.updated_at).getTime() : 0
      const localUpdated = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0

      const cloudRow: VideoProgress = {
        videoId: r.video_id,
        title: r.title ?? local?.title,
        channelName: r.channel_name ?? local?.channelName,
        thumbnail: r.thumbnail ?? local?.thumbnail ?? null,
        seconds: r.seconds ?? 0,
        durationSeconds: r.duration_seconds ?? null,
        percent: cloudPercent,
        status: r.status || statusOfPercent(cloudPercent),
        updatedAt: r.updated_at || new Date().toISOString(),
      }

      if (!local || cloudPercent > local.percent || cloudUpdated > localUpdated) {
        localMap[r.video_id] = cloudRow
        hasChange = true
      } else if (local && local.percent > cloudPercent && localUpdated > cloudUpdated) {
        void upsertRemote([local])
      }

      // Đảm bảo trạng thái videoStatus cũng đồng bộ
      const targetStatus = cloudRow.status === 'COMPLETED' ? 'COMPLETED' : cloudRow.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'UNWATCHED'
      void setVideoStatus(r.video_id, 'tvshow', targetStatus, {
        title: cloudRow.title,
        channel_name: cloudRow.channelName,
      })
      void setVideoStatus(r.video_id, 'review', targetStatus, {
        title: cloudRow.title,
        channel_name: cloudRow.channelName,
      })
    }

    if (hasChange) {
      writeLocal(localMap)
    }
    return localMap
  } catch (err) {
    console.warn('[videoProgress] Không tải được từ Supabase:', err)
    return getLocalProgress()
  }
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
  sourceType?: 'tvshow' | 'review'
}): Promise<VideoProgress> {
  const map = getLocalProgress()
  const prev = map[input.videoId]
  const duration = (input.durationSeconds && input.durationSeconds > 0)
    ? input.durationSeconds
    : (prev?.durationSeconds && prev.durationSeconds > 0 ? prev.durationSeconds : null)

  const percent = percentOf(input.seconds, duration)
  const isCompleted = percent >= COMPLETE_AT_PERCENT || (duration != null && duration > 5 && input.seconds >= duration - 4)
  const status: VideoProgress['status'] = isCompleted ? 'COMPLETED' : statusOfPercent(percent)

  const row: VideoProgress = {
    videoId: input.videoId,
    title: input.title ?? prev?.title,
    channelName: input.channelName ?? prev?.channelName,
    thumbnail: input.thumbnail ?? prev?.thumbnail ?? null,
    seconds: isCompleted && duration ? duration : input.seconds,
    durationSeconds: duration,
    percent: isCompleted ? 100 : percent,
    status,
    updatedAt: new Date().toISOString(),
  }

  // Không tụt lùi: xem lại từ đầu vẫn giữ mốc xa nhất đã xem
  if (!prev || row.percent >= prev.percent || row.seconds >= prev.seconds || isCompleted) {
    map[input.videoId] = row
    writeLocal(map)
  }

  const secType = input.sourceType || 'tvshow'
  const targetStatus = status === 'COMPLETED' ? 'COMPLETED' : status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'UNWATCHED'
  await setVideoStatus(input.videoId, secType, targetStatus, {
    title: input.title,
    channel_name: input.channelName,
  })
  // Đồng bộ cả 2 section để video nằm ở bảng nào cũng có trạng thái chính xác
  if (secType === 'tvshow') {
    void setVideoStatus(input.videoId, 'review', targetStatus, {
      title: input.title,
      channel_name: input.channelName,
    })
  } else {
    void setVideoStatus(input.videoId, 'tvshow', targetStatus, {
      title: input.title,
      channel_name: input.channelName,
    })
  }

  await upsertRemote([row])
  void updateMyShareProgress('VIDEO', input.videoId, row.percent, progressLabel(row))
  return row
}

export function useVideoProgressMap(): Record<string, VideoProgress> {
  const [map, setMap] = useState<Record<string, VideoProgress>>(() => getLocalProgress())
  useEffect(() => {
    const update = () => setMap(getLocalProgress())
    window.addEventListener(EVENT_NAME, update)
    window.addEventListener('storage', update)
    void syncVideoProgressFromSupabase().then((merged) => {
      setMap(merged)
    })
    return () => {
      window.removeEventListener(EVENT_NAME, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return map
}

export type YouTubeController = {
  getCurrentTime: () => number
  getDuration: () => number
  seekTo: (seconds: number) => void
  playVideo: () => void
  pauseVideo: () => void
}

/**
 * Trình điều khiển YouTube qua postMessage chuẩn HTML5.
 * KHÔNG tiêm script ngoài, KHÔNG dùng new YT.Player() tránh làm giật/reset iframe.
 */
export function useYouTubeProgress(
  iframe: HTMLIFrameElement | React.RefObject<HTMLIFrameElement | null> | null,
  video: { videoId: string | null; title?: string; channelName?: string; thumbnail?: string | null; sourceType?: 'tvshow' | 'review' },
): YouTubeController {
  const videoRef = useRef(video)
  videoRef.current = video

  const currentTimeRef = useRef(0)
  const durationRef = useRef<number | null>(null)

  const getIframeEl = useCallback((): HTMLIFrameElement | null => {
    if (!iframe) return null
    if ('current' in iframe) return iframe.current
    return iframe
  }, [iframe])

  const sendCommand = useCallback((func: string, args: any[] = []) => {
    const el = getIframeEl()
    if (!el?.contentWindow) return
    try {
      el.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func,
          args,
        }),
        '*',
      )
    } catch {
      /* ignore */
    }
  }, [getIframeEl])

  const controller = useMemo<YouTubeController>(() => ({
    getCurrentTime: () => currentTimeRef.current,
    getDuration: () => durationRef.current ?? 0,
    seekTo: (seconds: number) => sendCommand('seekTo', [seconds, true]),
    playVideo: () => sendCommand('playVideo', []),
    pauseVideo: () => sendCommand('pauseVideo', []),
  }), [sendCommand])

  // Lắng nghe postMessage từ YouTube iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (!data) return

        // 1. infoDelivery / initialDelivery
        if ((data.event === 'infoDelivery' || data.event === 'initialDelivery') && data.info) {
          if (typeof data.info.currentTime === 'number') {
            currentTimeRef.current = data.info.currentTime
          }
          if (typeof data.info.duration === 'number' && data.info.duration > 0) {
            durationRef.current = data.info.duration
          }
          // Player state: 0 = ended, 1 = playing, 2 = paused
          if (data.info.playerState === 0 || data.info.playerState === '0') {
            const current = videoRef.current
            if (current.videoId) {
              const dur = durationRef.current || currentTimeRef.current || 100
              void saveVideoProgress({
                videoId: current.videoId,
                seconds: dur,
                durationSeconds: dur,
                title: current.title,
                channelName: current.channelName,
                thumbnail: current.thumbnail,
                sourceType: current.sourceType,
              })
            }
          }
        }

        // 2. onStateChange
        if (data.event === 'onStateChange') {
          if (data.info === 0 || data.info === '0') {
            // Video ended (Đã xem xong)
            const current = videoRef.current
            if (current.videoId) {
              const dur = durationRef.current || currentTimeRef.current || 100
              void saveVideoProgress({
                videoId: current.videoId,
                seconds: dur,
                durationSeconds: dur,
                title: current.title,
                channelName: current.channelName,
                thumbnail: current.thumbnail,
                sourceType: current.sourceType,
              })
            }
          } else if (data.info === 1 || data.info === '1') {
            // Video đang phát
            const current = videoRef.current
            if (current.videoId && currentTimeRef.current >= 1) {
              void saveVideoProgress({
                videoId: current.videoId,
                seconds: currentTimeRef.current,
                durationSeconds: durationRef.current,
                title: current.title,
                channelName: current.channelName,
                thumbnail: current.thumbnail,
                sourceType: current.sourceType,
              })
            }
          }
        }
      } catch {
        /* Ignore non-JSON messages */
      }
    }
    window.addEventListener('message', handleMessage)

    // Báo cho YouTube iframe biết parent đang lắng nghe (bắt tay ban đầu khi mount/iframe sẵn sàng)
    const pingIframe = () => {
      const el = getIframeEl()
      if (el?.contentWindow) {
        try {
          el.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*')
          el.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime' }), '*')
          el.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getDuration' }), '*')
          el.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getPlayerState' }), '*')
        } catch {}
      }
    }

    pingIframe()
    const t1 = setTimeout(pingIframe, 500)
    const t2 = setTimeout(pingIframe, 1500)
    const t3 = setTimeout(pingIframe, 3000)
    const intervalPing = setInterval(pingIframe, 4000)

    return () => {
      window.removeEventListener('message', handleMessage)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearInterval(intervalPing)
    }
  }, [getIframeEl])

  // Lưu tiến độ định kỳ
  useEffect(() => {
    if (!video.videoId) return

    const flush = () => {
      const current = videoRef.current
      if (!current.videoId) return

      const seconds = currentTimeRef.current
      const duration = durationRef.current

      if (seconds < 1) return // Chưa phát thì bỏ qua
      void saveVideoProgress({
        videoId: current.videoId,
        seconds,
        durationSeconds: duration,
        title: current.title,
        channelName: current.channelName,
        thumbnail: current.thumbnail,
        sourceType: current.sourceType,
      })
    }

    const timer = setInterval(flush, 5000)
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

  return controller
}
