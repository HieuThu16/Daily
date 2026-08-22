import { useEffect, useRef, useState } from 'react'

export interface VideoWatchLog {
  id: string
  videoId: string
  title: string
  channelName?: string
  type: 'tvshow' | 'review' | 'youtube'
  startTime: string // ISO string
  endTime: string // ISO string
  durationMinutes: number
  log_date: string // YYYY-MM-DD
  log_time: string // HH:MM
}

const STORAGE_KEY = 'daily_video_watch_logs'
const EVENT_NAME = 'daily_video_watch_updated'

export function getVideoWatchLogs(): VideoWatchLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('Failed to get video watch logs:', err)
    return []
  }
}

export function recordVideoWatchSession(params: {
  videoId: string
  title: string
  channelName?: string
  type?: 'tvshow' | 'review' | 'youtube'
  durationMinutes: number
  startTime?: string
  endTime?: string
}): VideoWatchLog | null {
  if (!params.videoId || params.durationMinutes < 1) return null

  const now = new Date()
  const endIso = params.endTime || now.toISOString()
  const startIso = params.startTime || new Date(now.getTime() - params.durationMinutes * 60 * 1000).toISOString()
  const startDate = new Date(startIso)
  const log_date = startDate.toLocaleDateString('sv-SE')
  const log_time = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`

  const current = getVideoWatchLogs()

  // Tìm phiên xem gần đây (cùng videoId trong vòng 30 phút) để gộp thời gian
  const recentIndex = current.findIndex((log) => {
    if (log.videoId !== params.videoId || log.log_date !== log_date) return false
    const logEndTime = new Date(log.endTime || log.startTime).getTime()
    return Math.abs(startDate.getTime() - logEndTime) < 30 * 60 * 1000
  })

  let targetLog: VideoWatchLog

  if (recentIndex >= 0) {
    const prev = current[recentIndex]
    const updatedDuration = Math.max(1, prev.durationMinutes + params.durationMinutes)
    targetLog = {
      ...prev,
      title: params.title || prev.title,
      channelName: params.channelName || prev.channelName,
      endTime: endIso,
      durationMinutes: updatedDuration,
    }
    current[recentIndex] = targetLog
  } else {
    targetLog = {
      id: `video_watch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      videoId: params.videoId,
      title: params.title || 'Video YouTube',
      channelName: params.channelName,
      type: params.type || 'youtube',
      startTime: startIso,
      endTime: endIso,
      durationMinutes: params.durationMinutes,
      log_date,
      log_time,
    }
    current.unshift(targetLog)
  }

  // Giữ tối đa 500 bản ghi
  const trimmed = current.slice(0, 500)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: targetLog }))
  } catch (err) {
    console.error('Failed to save video watch log:', err)
  }

  return targetLog
}

/**
 * Hook tự động đếm thời gian xem video thực tế trên màn hình và lưu log
 */
export function useVideoWatchTracker(activeVideo: {
  videoId: string | null
  title?: string
  channelName?: string
  type?: 'tvshow' | 'review' | 'youtube'
  isPlaying: boolean
}) {
  const sessionRef = useRef<{
    videoId: string
    title: string
    channelName?: string
    type: 'tvshow' | 'review' | 'youtube'
    startTime: Date
    watchedSeconds: number
  } | null>(null)

  const flushSession = () => {
    if (!sessionRef.current) return
    const s = sessionRef.current
    const durationMin = Math.round(s.watchedSeconds / 60)
    if (durationMin >= 1) {
      recordVideoWatchSession({
        videoId: s.videoId,
        title: s.title,
        channelName: s.channelName,
        type: s.type,
        durationMinutes: durationMin,
        startTime: s.startTime.toISOString(),
        endTime: new Date().toISOString(),
      })
    }
    sessionRef.current = null
  }

  useEffect(() => {
    if (!activeVideo.videoId || !activeVideo.isPlaying) {
      flushSession()
      return
    }

    // Khởi tạo hoặc chuyển video mới
    if (!sessionRef.current || sessionRef.current.videoId !== activeVideo.videoId) {
      flushSession()
      sessionRef.current = {
        videoId: activeVideo.videoId,
        title: activeVideo.title || 'Video',
        channelName: activeVideo.channelName,
        type: activeVideo.type || 'youtube',
        startTime: new Date(),
        watchedSeconds: 0,
      }
    }

    const interval = setInterval(() => {
      if (document.hidden) return // Người dùng tab khác thì không đếm
      if (sessionRef.current) {
        sessionRef.current.watchedSeconds += 1
        // Định kỳ 60 giây đồng bộ log 1 lần để tránh mất dữ liệu khi tắt trình duyệt
        if (sessionRef.current.watchedSeconds > 0 && sessionRef.current.watchedSeconds % 60 === 0) {
          const s = sessionRef.current
          recordVideoWatchSession({
            videoId: s.videoId,
            title: s.title,
            channelName: s.channelName,
            type: s.type,
            durationMinutes: 1,
            startTime: new Date(Date.now() - 60000).toISOString(),
            endTime: new Date().toISOString(),
          })
          // Reset đếm cho chặng tiếp theo
          s.watchedSeconds = 0
          s.startTime = new Date()
        }
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      flushSession()
    }
  }, [activeVideo.videoId, activeVideo.isPlaying, activeVideo.title, activeVideo.channelName, activeVideo.type])

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSession()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      flushSession()
    }
  }, [])
}

export function useVideoWatchLogs(): VideoWatchLog[] {
  const [logs, setLogs] = useState<VideoWatchLog[]>(() => getVideoWatchLogs())

  useEffect(() => {
    const handleUpdate = () => {
      setLogs(getVideoWatchLogs())
    }
    window.addEventListener(EVENT_NAME, handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  return logs
}
