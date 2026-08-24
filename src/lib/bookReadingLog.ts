import { useEffect, useRef, useState } from 'react'
import { reviewStreak } from './srs'
import type { DayEvent } from './dayReview'

export interface BookReadingSessionLog {
  id: string
  mediaItemId: string
  bookTitle: string
  bookAuthor?: string | null
  startPage: number
  endPage: number
  pagesRead: number
  startTime: string // ISO string
  endTime: string // ISO string
  log_date: string // YYYY-MM-DD
  log_time: string // HH:MM (start time)
  durationMinutes: number
  status?: 'READING' | 'COMPLETED'
}

const STORAGE_KEY = 'daily_book_reading_sessions'
const EVENT_NAME = 'daily_book_reading_updated'

export function getBookReadingSessionLogs(): BookReadingSessionLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('Failed to get book reading session logs:', err)
    return []
  }
}

export function recordBookReadingSession(params: {
  mediaItemId: string
  bookTitle: string
  bookAuthor?: string | null
  startPage: number
  endPage: number
  pagesRead?: number
  durationMinutes?: number
  status?: 'READING' | 'COMPLETED'
  startTime?: string
  endTime?: string
}): BookReadingSessionLog {
  const now = params.endTime ? new Date(params.endTime) : new Date()
  const log_date = now.toLocaleDateString('sv-SE') // YYYY-MM-DD
  const log_time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const status = params.status || 'READING'

  const current = getBookReadingSessionLogs()

  // Tìm xem có phiên đọc của cùng cuốn sách trong vòng 35 phút hôm nay không
  const recentIndex = current.findIndex((log) => {
    if (log.mediaItemId !== params.mediaItemId) return false
    if (log.log_date !== log_date) return false
    const logTime = new Date(log.endTime || log.startTime).getTime()
    return Math.abs(now.getTime() - logTime) < 35 * 60 * 1000
  })

  let targetLog: BookReadingSessionLog

  if (recentIndex >= 0) {
    const prev = current[recentIndex]
    const updatedDuration = params.durationMinutes
      ? (prev.durationMinutes || 0) + params.durationMinutes
      : prev.durationMinutes || 1

    const newStartPage = Math.min(prev.startPage, params.startPage)
    const newEndPage = Math.max(prev.endPage, params.endPage)
    const calculatedPages = Math.max(1, newEndPage - newStartPage + 1)
    const totalPagesRead = Math.max(prev.pagesRead, params.pagesRead || 0, calculatedPages)

    targetLog = {
      ...prev,
      bookTitle: params.bookTitle || prev.bookTitle,
      bookAuthor: params.bookAuthor !== undefined ? params.bookAuthor : prev.bookAuthor,
      startPage: newStartPage,
      endPage: newEndPage,
      pagesRead: totalPagesRead,
      status: status === 'COMPLETED' ? 'COMPLETED' : prev.status,
      endTime: now.toISOString(),
      durationMinutes: updatedDuration,
    }
    current[recentIndex] = targetLog
  } else {
    const calculatedPages = Math.max(1, params.endPage - params.startPage + 1)
    const totalPagesRead = params.pagesRead || calculatedPages
    const startTimeIso = params.startTime || now.toISOString()

    targetLog = {
      id: `book_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      mediaItemId: params.mediaItemId,
      bookTitle: params.bookTitle,
      bookAuthor: params.bookAuthor,
      startPage: params.startPage,
      endPage: params.endPage,
      pagesRead: totalPagesRead,
      startTime: startTimeIso,
      endTime: now.toISOString(),
      log_date,
      log_time,
      status,
      durationMinutes: params.durationMinutes || 1,
    }
    current.unshift(targetLog)
  }

  // Lưu tối đa 500 phiên gần nhất
  const trimmed = current.slice(0, 500)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: targetLog }))
  } catch (err) {
    console.error('Failed to save book reading session log:', err)
  }

  return targetLog
}

/**
 * Hook tự động theo dõi thời gian và số trang khi đọc sách
 */
export function useBookReadingSessionTracker(activeReading: {
  mediaItemId?: string
  bookTitle?: string
  bookAuthor?: string | null
  currentPage: number
  isActive: boolean
  isCompleted?: boolean
}) {
  const sessionRef = useRef<{
    mediaItemId: string
    bookTitle: string
    bookAuthor?: string | null
    startPage: number
    endPage: number
    startTime: string
    readSeconds: number
  } | null>(null)

  const flushSession = () => {
    if (!sessionRef.current) return
    const s = sessionRef.current
    const durationMin = Math.round(s.readSeconds / 60)
    if (durationMin >= 1 || s.endPage > s.startPage) {
      recordBookReadingSession({
        mediaItemId: s.mediaItemId,
        bookTitle: s.bookTitle,
        bookAuthor: s.bookAuthor,
        startPage: s.startPage,
        endPage: s.endPage,
        pagesRead: Math.max(1, s.endPage - s.startPage + 1),
        durationMinutes: Math.max(1, durationMin),
        startTime: s.startTime,
        endTime: new Date().toISOString(),
        status: activeReading.isCompleted ? 'COMPLETED' : 'READING',
      })
    }
    sessionRef.current = null
  }

  useEffect(() => {
    if (!activeReading.isActive || !activeReading.mediaItemId || !activeReading.currentPage) {
      flushSession()
      return
    }

    if (
      !sessionRef.current ||
      sessionRef.current.mediaItemId !== activeReading.mediaItemId
    ) {
      flushSession()
      sessionRef.current = {
        mediaItemId: activeReading.mediaItemId,
        bookTitle: activeReading.bookTitle || 'Sách',
        bookAuthor: activeReading.bookAuthor,
        startPage: activeReading.currentPage,
        endPage: activeReading.currentPage,
        startTime: new Date().toISOString(),
        readSeconds: 0,
      }
    } else {
      // Cập nhật trang kết thúc khi lật trang
      sessionRef.current.endPage = Math.max(sessionRef.current.endPage, activeReading.currentPage)
      sessionRef.current.startPage = Math.min(sessionRef.current.startPage, activeReading.currentPage)
    }

    const interval = setInterval(() => {
      if (document.hidden) return
      if (sessionRef.current) {
        sessionRef.current.readSeconds += 1
        if (sessionRef.current.readSeconds > 0 && sessionRef.current.readSeconds % 60 === 0) {
          const s = sessionRef.current
          recordBookReadingSession({
            mediaItemId: s.mediaItemId,
            bookTitle: s.bookTitle,
            bookAuthor: s.bookAuthor,
            startPage: s.startPage,
            endPage: s.endPage,
            pagesRead: Math.max(1, s.endPage - s.startPage + 1),
            durationMinutes: 1,
            startTime: s.startTime,
            endTime: new Date().toISOString(),
            status: activeReading.isCompleted ? 'COMPLETED' : 'READING',
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
    activeReading.mediaItemId,
    activeReading.bookTitle,
    activeReading.bookAuthor,
    activeReading.currentPage,
    activeReading.isCompleted,
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

export function useBookReadingSessionLogs(): BookReadingSessionLog[] {
  const [logs, setLogs] = useState<BookReadingSessionLog[]>(() => getBookReadingSessionLogs())

  useEffect(() => {
    const handleUpdate = () => {
      setLogs(getBookReadingSessionLogs())
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

export type BookStats = {
  totalPages: number
  totalMinutes: number
  thisWeekPages: number
  streak: number
  topBooks: Array<{ title: string; pages: number; minutes: number }>
  byDay: Array<{ date: string; pages: number; minutes: number }>
}

/**
 * Tổng hợp số liệu đọc sách: tổng số trang, thời lượng, chuỗi ngày đọc và sách đọc nhiều nhất
 */
export function summarizeBookSessions(logs: BookReadingSessionLog[], today: string, days = 30): BookStats {
  const pagesByDate = new Map<string, number>()
  const minutesByDate = new Map<string, number>()
  const byBook = new Map<string, { pages: number; minutes: number }>()

  let totalPages = 0
  let totalMinutes = 0

  for (const log of logs) {
    const p = log.pagesRead || Math.max(1, (log.endPage || 1) - (log.startPage || 1) + 1)
    const m = log.durationMinutes || 1

    totalPages += p
    totalMinutes += m

    pagesByDate.set(log.log_date, (pagesByDate.get(log.log_date) ?? 0) + p)
    minutesByDate.set(log.log_date, (minutesByDate.get(log.log_date) ?? 0) + m)

    const prevBook = byBook.get(log.bookTitle) || { pages: 0, minutes: 0 }
    byBook.set(log.bookTitle, {
      pages: prevBook.pages + p,
      minutes: prevBook.minutes + m,
    })
  }

  const byDay: Array<{ date: string; pages: number; minutes: number }> = []
  const [y, mon, d] = today.split('-').map(Number)
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(y, (mon ?? 1) - 1, (d ?? 1) - i)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    byDay.push({
      date: key,
      pages: pagesByDate.get(key) ?? 0,
      minutes: minutesByDate.get(key) ?? 0,
    })
  }

  const weekStart = byDay.slice(-7).map((item) => item.date)
  const thisWeekPages = weekStart.reduce((sum, date) => sum + (pagesByDate.get(date) ?? 0), 0)

  return {
    totalPages,
    totalMinutes,
    thisWeekPages,
    streak: reviewStreak([...pagesByDate.keys()], today),
    topBooks: [...byBook.entries()]
      .sort((a, b) => b[1].pages - a[1].pages)
      .slice(0, 5)
      .map(([title, val]) => ({ title, pages: val.pages, minutes: val.minutes })),
    byDay,
  }
}

/** 'HH:MM' từ một timestamptz */
function clockStr(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Gom các bản ghi phiên đọc sách trong ngày thành dòng sự kiện thời gian thông minh
 */
export function groupBookReadingLogs(logs: BookReadingSessionLog[]): DayEvent[] {
  if (!logs || logs.length === 0) return []

  const sorted = [...logs].sort((a, b) => {
    const tA = new Date(a.startTime || a.endTime || 0).getTime()
    const tB = new Date(b.startTime || b.endTime || 0).getTime()
    if (tA !== tB) return tA - tB
    return (a.log_time || '').localeCompare(b.log_time || '')
  })

  const sessions: BookReadingSessionLog[][] = []
  let currentSession: BookReadingSessionLog[] = []

  for (const log of sorted) {
    if (currentSession.length === 0) {
      currentSession.push(log)
    } else {
      const prevLog = currentSession[currentSession.length - 1]
      const prevTime = new Date(prevLog.endTime || prevLog.startTime || 0).getTime()
      const currTime = new Date(log.startTime || log.endTime || 0).getTime()
      const diffMin = Math.abs(currTime - prevTime) / 60000

      if (prevLog.mediaItemId === log.mediaItemId && diffMin <= 35) {
        currentSession.push(log)
      } else {
        sessions.push(currentSession)
        currentSession = [log]
      }
    }
  }
  if (currentSession.length > 0) {
    sessions.push(currentSession)
  }

  const events: DayEvent[] = []

  for (const session of sessions) {
    const firstLog = session[0]
    const lastLog = session[session.length - 1]

    const startPage = Math.min(...session.map((s) => s.startPage))
    const endPage = Math.max(...session.map((s) => s.endPage))
    const totalPages = Math.max(
      ...session.map((s) => s.pagesRead),
      endPage - startPage + 1,
    )
    const totalDurationMin = session.reduce((acc, s) => acc + (s.durationMinutes || 1), 0)

    const startTime = firstLog.log_time || clockStr(firstLog.startTime)
    const endTime = clockStr(lastLog.endTime) || firstLog.log_time

    const isCompleted = session.some((s) => s.status === 'COMPLETED') || lastLog.status === 'COMPLETED'
    const statusNote = isCompleted ? ' (Đã đọc xong)' : ''

    const timeDisplay = startTime && endTime && startTime !== endTime ? `${startTime} - ${endTime}` : startTime

    const pageDetail =
      startPage !== endPage ? `${totalPages} trang (Trang ${startPage} → ${endPage})` : `Trang ${startPage}`

    events.push({
      time: timeDisplay || startTime,
      kind: 'MEDIA',
      label: 'Đọc sách',
      detail: `${firstLog.bookTitle} — Đã đọc ${pageDetail} trong ~${totalDurationMin} phút${statusNote}`,
    })
  }

  return events
}

// ── VỊ TRÍ ĐỌC GẦN NHẤT ĐỂ TIẾP TỤC ĐỌC 1-CHẠM ──────────────────────────────

export interface LastReadBookInfo {
  mediaItemId: string
  title: string
  author?: string | null
  coverUrl?: string | null
  chapterIdx: number
  chapterTitle?: string | null
  percent: number
  page?: number | null
  pageCount?: number | null
  lastReadAt: string // ISO string
  lastScrollRatio?: number
}

const LAST_READ_BOOK_KEY = 'daily_last_read_book_session'
const LAST_READ_BOOK_EVENT = 'daily_last_read_book_updated'

export function getLastReadBook(): LastReadBookInfo | null {
  try {
    const raw = localStorage.getItem(LAST_READ_BOOK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && parsed.mediaItemId ? (parsed as LastReadBookInfo) : null
  } catch {
    return null
  }
}

export function saveLastReadBook(info: LastReadBookInfo) {
  try {
    localStorage.setItem(LAST_READ_BOOK_KEY, JSON.stringify(info))
    window.dispatchEvent(new CustomEvent(LAST_READ_BOOK_EVENT, { detail: info }))
  } catch (err) {
    console.error('Failed to save last read book session:', err)
  }
}

export function clearLastReadBook() {
  try {
    localStorage.removeItem(LAST_READ_BOOK_KEY)
    window.dispatchEvent(new CustomEvent(LAST_READ_BOOK_EVENT, { detail: null }))
  } catch {
    // Ignored
  }
}

export function useLastReadBook(): LastReadBookInfo | null {
  const [lastRead, setLastRead] = useState<LastReadBookInfo | null>(() => getLastReadBook())

  useEffect(() => {
    const handleUpdate = () => {
      setLastRead(getLastReadBook())
    }
    window.addEventListener(LAST_READ_BOOK_EVENT, handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener(LAST_READ_BOOK_EVENT, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  return lastRead
}

