import { useEffect, useRef, useState } from 'react'

export interface MangaReadingLog {
  id: string
  mangaSlug: string
  mangaTitle: string
  mangaType: 'BL' | 'NGONTINH' | 'H_MANGA'
  chapterNumber: number
  chapterName: string
  readAt: string // ISO string
  log_date: string // YYYY-MM-DD
  log_time: string // HH:MM
  status?: 'READING' | 'COMPLETED'
  durationMinutes?: number
}

const STORAGE_KEY = 'daily_manga_reading_logs'
const EVENT_NAME = 'daily_manga_reading_updated'

export function getMangaReadingLogs(): MangaReadingLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('Failed to get manga reading logs:', err)
    return []
  }
}

export function recordMangaReading(params: {
  mangaSlug: string
  mangaTitle: string
  mangaType: 'BL' | 'NGONTINH' | 'H_MANGA'
  chapterNumber: number
  chapterName?: string
  status?: 'READING' | 'COMPLETED'
  readAt?: string
  durationMinutes?: number
}): MangaReadingLog {
  const now = params.readAt ? new Date(params.readAt) : new Date()
  const log_date = now.toLocaleDateString('sv-SE') // YYYY-MM-DD
  const log_time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const chapterName = params.chapterName || `Chương ${params.chapterNumber}`
  const status = params.status || 'READING'

  const current = getMangaReadingLogs()

  // Tìm xem có log nào của cùng truyện + cùng chapter trong vòng 35 phút hôm nay không
  const recentIndex = current.findIndex((log) => {
    if (log.mangaSlug !== params.mangaSlug || log.chapterNumber !== params.chapterNumber) return false
    if (log.log_date !== log_date) return false
    const logTime = new Date(log.readAt).getTime()
    return Math.abs(now.getTime() - logTime) < 35 * 60 * 1000
  })

  let targetLog: MangaReadingLog

  if (recentIndex >= 0) {
    // Cập nhật log gần đây
    const prev = current[recentIndex]
    const updatedDuration = params.durationMinutes 
      ? (prev.durationMinutes || 0) + params.durationMinutes 
      : prev.durationMinutes

    targetLog = {
      ...prev,
      mangaTitle: params.mangaTitle || prev.mangaTitle,
      chapterName: chapterName || prev.chapterName,
      status: status === 'COMPLETED' ? 'COMPLETED' : prev.status,
      readAt: now.toISOString(),
      log_time,
      durationMinutes: updatedDuration,
    }
    current[recentIndex] = targetLog
  } else {
    // Tạo bản ghi mới
    targetLog = {
      id: `manga_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      mangaSlug: params.mangaSlug,
      mangaTitle: params.mangaTitle,
      mangaType: params.mangaType,
      chapterNumber: params.chapterNumber,
      chapterName,
      readAt: now.toISOString(),
      log_date,
      log_time,
      status,
      durationMinutes: params.durationMinutes,
    }
    current.unshift(targetLog)
  }

  // Giới hạn lưu trữ 500 bản ghi gần nhất
  const trimmed = current.slice(0, 500)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: targetLog }))
    // Đồng bộ lên Supabase ngầm
    void import('./mangaCloudSync').then(({ syncMangaReadingLogToSupabase }) => {
      void syncMangaReadingLogToSupabase(targetLog)
    }).catch(() => null)
  } catch (err) {
    console.error('Failed to save manga reading log:', err)
  }

  return targetLog
}

/**
 * Hook tự động theo dõi thời gian đọc trên màn hình đọc truyện
 */
export function useMangaReadingTracker(activeReading: {
  mangaSlug?: string
  mangaTitle?: string
  mangaType?: 'BL' | 'NGONTINH' | 'H_MANGA'
  chapterNumber?: number
  chapterName?: string
  isActive: boolean
}) {
  const sessionRef = useRef<{
    mangaSlug: string
    mangaTitle: string
    mangaType: 'BL' | 'NGONTINH' | 'H_MANGA'
    chapterNumber: number
    chapterName?: string
    readSeconds: number
  } | null>(null)

  const flushSession = () => {
    if (!sessionRef.current) return
    const s = sessionRef.current
    const durationMin = Math.round(s.readSeconds / 60)
    if (durationMin >= 1) {
      recordMangaReading({
        mangaSlug: s.mangaSlug,
        mangaTitle: s.mangaTitle,
        mangaType: s.mangaType,
        chapterNumber: s.chapterNumber,
        chapterName: s.chapterName,
        durationMinutes: durationMin,
      })
    }
    sessionRef.current = null
  }

  useEffect(() => {
    if (!activeReading.isActive || !activeReading.mangaSlug || activeReading.chapterNumber == null) {
      flushSession()
      return
    }

    if (
      !sessionRef.current ||
      sessionRef.current.mangaSlug !== activeReading.mangaSlug ||
      sessionRef.current.chapterNumber !== activeReading.chapterNumber
    ) {
      flushSession()
      sessionRef.current = {
        mangaSlug: activeReading.mangaSlug,
        mangaTitle: activeReading.mangaTitle || 'Truyện tranh',
        mangaType: activeReading.mangaType || 'NGONTINH',
        chapterNumber: activeReading.chapterNumber,
        chapterName: activeReading.chapterName,
        readSeconds: 0,
      }
    }

    const interval = setInterval(() => {
      if (document.hidden) return
      if (sessionRef.current) {
        sessionRef.current.readSeconds += 1
        if (sessionRef.current.readSeconds > 0 && sessionRef.current.readSeconds % 60 === 0) {
          const s = sessionRef.current
          recordMangaReading({
            mangaSlug: s.mangaSlug,
            mangaTitle: s.mangaTitle,
            mangaType: s.mangaType,
            chapterNumber: s.chapterNumber,
            chapterName: s.chapterName,
            durationMinutes: 1,
          })
          s.readSeconds = 0
        }
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      flushSession()
    }
  }, [
    activeReading.isActive,
    activeReading.mangaSlug,
    activeReading.mangaTitle,
    activeReading.mangaType,
    activeReading.chapterNumber,
    activeReading.chapterName,
  ])

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

export function useMangaReadingLogs(): MangaReadingLog[] {
  const [logs, setLogs] = useState<MangaReadingLog[]>(() => getMangaReadingLogs())

  useEffect(() => {
    const handleUpdate = () => {
      setLogs(getMangaReadingLogs())
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
