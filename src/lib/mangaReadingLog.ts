import { useEffect, useState } from 'react'

export interface MangaReadingLog {
  id: string
  mangaSlug: string
  mangaTitle: string
  mangaType: 'BL' | 'NGONTINH'
  chapterNumber: number
  chapterName: string
  readAt: string // ISO string
  log_date: string // YYYY-MM-DD
  log_time: string // HH:MM
  status?: 'READING' | 'COMPLETED'
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
  mangaType: 'BL' | 'NGONTINH'
  chapterNumber: number
  chapterName?: string
  status?: 'READING' | 'COMPLETED'
  readAt?: string
}): MangaReadingLog {
  const now = params.readAt ? new Date(params.readAt) : new Date()
  const log_date = now.toLocaleDateString('sv-SE') // YYYY-MM-DD
  const log_time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const chapterName = params.chapterName || `Chương ${params.chapterNumber}`
  const status = params.status || 'READING'

  const current = getMangaReadingLogs()

  // Tìm xem có log nào của cùng truyện + cùng chapter trong vòng 30 phút hôm nay không
  const recentIndex = current.findIndex((log) => {
    if (log.mangaSlug !== params.mangaSlug || log.chapterNumber !== params.chapterNumber) return false
    if (log.log_date !== log_date) return false
    const logTime = new Date(log.readAt).getTime()
    return Math.abs(now.getTime() - logTime) < 30 * 60 * 1000
  })

  let targetLog: MangaReadingLog

  if (recentIndex >= 0) {
    // Cập nhật log gần đây
    const prev = current[recentIndex]
    targetLog = {
      ...prev,
      mangaTitle: params.mangaTitle || prev.mangaTitle,
      chapterName: chapterName || prev.chapterName,
      status: status === 'COMPLETED' ? 'COMPLETED' : prev.status,
      readAt: now.toISOString(),
      log_time,
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
    }
    current.unshift(targetLog)
  }

  // Giới hạn lưu trữ 500 bản ghi gần nhất
  const trimmed = current.slice(0, 500)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: targetLog }))
  } catch (err) {
    console.error('Failed to save manga reading log:', err)
  }

  return targetLog
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
