import type { Entry, Media, NutritionLog, SleepLog, Todo } from '../types'
import { getMangaReadingLogs, type MangaReadingLog } from './mangaReadingLog'
import { getVideoWatchLogs, type VideoWatchLog } from './videoWatchLog'
import { getBookReadingSessionLogs, groupBookReadingLogs, type BookReadingSessionLog } from './bookReadingLog'
import { shiftDate } from './sleep'

/** Một mốc trong dòng thời gian của một ngày. `time` dạng 'HH:MM' hoặc 'HH:MM - HH:MM'. */
export type DayEvent = {
  time: string
  kind: 'WAKE' | 'MEAL' | 'DIARY' | 'TASK_ADD' | 'TASK_DONE' | 'MEDIA' | 'MANGA'
  label: string
  detail: string
  is_favorite?: boolean
  /** id của mục thư viện, để bấm vào là mở đúng bài nhạc/sách/phim đó. */
  mediaId?: string
}

const mealLabel: Record<NutritionLog['meal_slot'], string> = {
  MORNING: 'Ăn sáng',
  LUNCH: 'Ăn trưa',
  AFTERNOON: 'Ăn xế',
  EVENING: 'Ăn tối',
}

const mediaLabel: Record<Media['type'], string> = {
  BOOK: 'Đọc sách',
  MOVIE: 'Xem phim',
  YOUTUBE: 'Xem YouTube',
  MUSIC: 'Nghe nhạc',
  MANGA: 'Đọc truyện',
}

/** 'HH:MM' từ một timestamptz; '' nếu không parse được. */
function clock(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function sameDay(iso: string | null | undefined, date: string) {
  return clock(iso) !== '' && new Date(iso!).toLocaleDateString('sv-SE') === date
}

export type DayReviewInput = {
  date: string
  entries: Entry[]
  meals: NutritionLog[]
  sleeps: SleepLog[]
  todos: Todo[]
  media: Media[]
  mangaLogs?: MangaReadingLog[]
  bookReadingLogs?: BookReadingSessionLog[]
  videoWatchLogs?: VideoWatchLog[]
}

/**
 * Gom các bản ghi đọc truyện trong cùng một buổi đọc liên tục thành một mốc thời gian thông minh
 */
export function groupMangaReadingLogs(logs: MangaReadingLog[]): DayEvent[] {
  if (!logs || logs.length === 0) return []

  const sorted = [...logs].sort((a, b) => {
    const tA = new Date(a.readAt || 0).getTime()
    const tB = new Date(b.readAt || 0).getTime()
    if (tA !== tB) return tA - tB
    return (a.log_time || '').localeCompare(b.log_time || '')
  })

  const sessions: MangaReadingLog[][] = []
  let currentSession: MangaReadingLog[] = []

  for (const log of sorted) {
    if (currentSession.length === 0) {
      currentSession.push(log)
    } else {
      const prevLog = currentSession[currentSession.length - 1]
      const prevTime = new Date(prevLog.readAt || 0).getTime()
      const currTime = new Date(log.readAt || 0).getTime()
      const diffMin = Math.abs(currTime - prevTime) / 60000

      // Nếu cùng truyện và cách nhau dưới 35 phút -> cùng một buổi đọc
      if (prevLog.mangaSlug === log.mangaSlug && diffMin <= 35) {
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
    const typeLabel =
      firstLog.mangaType === 'BL'
        ? 'Đọc truyện BL'
        : firstLog.mangaType === 'H_MANGA'
        ? 'Đọc truyện H (18+)'
        : 'Đọc truyện Ngôn tình'

    const distinctChapters = Array.from(new Set(session.map((s) => s.chapterNumber))).sort((a, b) => a - b)
    const isCompleted = session.some((s) => s.status === 'COMPLETED') || lastLog.status === 'COMPLETED'
    const statusNote = isCompleted ? ' (Đã đọc xong)' : ''

    const startTime = firstLog.log_time || clock(firstLog.readAt)
    const endTime = lastLog.log_time || clock(lastLog.readAt)

    if (session.length === 1 || distinctChapters.length === 1) {
      const singleChap = distinctChapters[0] ?? firstLog.chapterNumber
      const durationNote = firstLog.durationMinutes && firstLog.durationMinutes > 1 ? ` (~${firstLog.durationMinutes} phút)` : ''
      events.push({
        time: startTime,
        kind: 'MANGA',
        label: typeLabel,
        detail: `${firstLog.mangaTitle} — ${firstLog.chapterName || `Chương ${singleChap}`}${durationNote}${statusNote}`,
      })
    } else {
      const minChap = distinctChapters[0]
      const maxChap = distinctChapters[distinctChapters.length - 1]
      const chapRangeStr = minChap === maxChap ? `Chương ${minChap}` : `Chương ${minChap} → ${maxChap}`

      const firstTimeMs = new Date(firstLog.readAt || 0).getTime()
      const lastTimeMs = new Date(lastLog.readAt || 0).getTime()
      const diffMinutes = Math.max(1, Math.round(Math.abs(lastTimeMs - firstTimeMs) / 60000))

      const totalTrackedMin = session.reduce((acc, s) => acc + (s.durationMinutes || 0), 0)
      const estimatedMin = Math.max(diffMinutes, totalTrackedMin, distinctChapters.length * 5)
      const finalDuration = Math.max(1, Math.min(estimatedMin, 300))

      const displayTime = startTime && endTime && startTime !== endTime ? `${startTime} - ${endTime}` : startTime

      events.push({
        time: displayTime || startTime,
        kind: 'MANGA',
        label: typeLabel,
        detail: `${firstLog.mangaTitle} — Đã đọc ${distinctChapters.length} chương (${chapRangeStr}) trong ~${finalDuration} phút${statusNote}`,
      })
    }
  }

  return events
}

/** Gom mọi hoạt động đã có giờ của một ngày thành dòng thời gian tăng dần. */
export function buildDayReview({ date, entries = [], meals = [], sleeps = [], todos = [], media = [], mangaLogs, bookReadingLogs, videoWatchLogs }: DayReviewInput): DayEvent[] {
  const events: DayEvent[] = []

  ;(sleeps || []).forEach((s) => {
    if (!s || !s.sleep_end || !s.sleep_start) return
    const isOvernight = s.sleep_end <= s.sleep_start
    if (s.log_date === date) {
      events.push({
        time: s.sleep_end,
        kind: 'WAKE',
        label: 'Thức dậy',
        detail: `Ngủ từ ${s.sleep_start}`,
      })
    } else if (isOvernight && date === shiftDate(s.log_date, 1)) {
      events.push({
        time: s.sleep_end,
        kind: 'WAKE',
        label: 'Thức dậy',
        detail: `Ngủ từ ${s.sleep_start} hôm qua`,
      })
    }
  })

  ;(meals || []).filter((m) => m && m.log_date === date).forEach((m) =>
    events.push({ time: m.log_time || '', kind: 'MEAL', label: mealLabel[m.meal_slot] || 'Ăn uống', detail: m.food_name || '' }))

  entries.filter((e) => e.entry_date === date).forEach((e) => {
    let displayTime = e.entry_time || clock(e.created_at)
    if (e.content) {
      const match = e.content.match(/^(?:Từ\s+)?(\d{1,2}(?:h\d{1,2}|:\d{2}|h)?)(?:\s*(?:->|-)\s*(\d{1,2}(?:h\d{1,2}|:\d{2}|h)?))?:\s*/i)
      if (match && match[1]) {
        const normalizeH = (s: string) => {
          s = s.replace(/^từ\s+/i, '').trim()
          if (/^\d{1,2}:\d{2}$/.test(s)) {
            const [h, m] = s.split(':')
            return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
          }
          const hm = s.match(/^(\d{1,2})h(\d{1,2})?$/i)
          if (hm) return `${hm[1].padStart(2, '0')}:${(hm[2] || '00').padStart(2, '0')}`
          if (/^\d{1,2}$/.test(s)) return `${s.padStart(2, '0')}:00`
          return s
        }
        const fromH = normalizeH(match[1])
        const toH = match[2] ? normalizeH(match[2]) : ''
        if (fromH && toH) {
          displayTime = `${fromH} - ${toH}`
        } else if (fromH && !displayTime) {
          displayTime = fromH
        }
      }
    }

    events.push({
      time: displayTime,
      kind: 'DIARY',
      label: 'Viết nhật ký',
      detail: e.content,
      is_favorite: !!e.is_favorite,
    })
  })

  todos.forEach((t) => {
    if (sameDay(t.created_at, date)) events.push({ time: clock(t.created_at), kind: 'TASK_ADD', label: 'Thêm việc', detail: t.title })
    if (t.completed && sameDay(t.completed_at, date)) events.push({ time: clock(t.completed_at), kind: 'TASK_DONE', label: 'Xong việc', detail: t.title })
  })

  // 1. Dữ liệu đọc sách theo dõi thời gian và số trang thực tế
  const bLogs = bookReadingLogs ?? getBookReadingSessionLogs()
  const todayBookLogs = bLogs.filter((b) => b.log_date === date)
  const bookEvents = groupBookReadingLogs(todayBookLogs)
  events.push(...bookEvents)

  media.filter((m) => m.log_date === date && m.status === 'COMPLETED').forEach((m) => {
    // Nếu sách đã có phiên đọc chi tiết thì không cần thẻ media chung chung
    if (m.type === 'BOOK' && todayBookLogs.length > 0) return
    events.push({
      time: m.log_time || '',
      kind: 'MEDIA',
      label: mediaLabel[m.type],
      detail: m.artist || m.channel ? `${m.name} — ${m.artist || m.channel}` : m.name,
      is_favorite: !!m.is_favorite,
      mediaId: m.id,
    })
  })



  // 2. Dữ liệu đọc truyện (Ngôn tình, BL, Truyện H) đã được gom nhóm phiên đọc thông minh
  const logs = mangaLogs ?? getMangaReadingLogs()
  const todayMangaLogs = logs.filter((m) => m.log_date === date)
  const mangaEvents = groupMangaReadingLogs(todayMangaLogs)
  events.push(...mangaEvents)

  // 2. Dữ liệu xem YouTube / TV Show theo dõi thời gian thực tế trên màn hình
  const vLogs = videoWatchLogs ?? getVideoWatchLogs()
  vLogs.filter((v) => v.log_date === date && v.durationMinutes >= 1).forEach((v) => {
    const typeLabel = v.type === 'review' ? 'Xem Review Phim' : 'Xem YouTube'
    const startClock = clock(v.startTime) || v.log_time
    const endClock = clock(v.endTime)
    const timeDisplay = startClock && endClock && startClock !== endClock ? `${startClock} - ${endClock}` : startClock
    const channelDisplay = v.channelName ? ` — ${v.channelName}` : ''
    events.push({
      time: timeDisplay || startClock || v.log_time,
      kind: 'MEDIA',
      label: typeLabel,
      detail: `${v.title}${channelDisplay} (Đã xem ${v.durationMinutes} phút)`,
    })
  })

  // Mục gần hiện tại nhất (giờ mới nhất) xếp lên đầu, mục chưa có giờ xếp cuối cùng.
  return events.sort((a, b) => {
    const timeA = (a.time || '').split(' - ')[0]
    const timeB = (b.time || '').split(' - ')[0]
    if (!timeA && !timeB) return 0
    if (!timeA) return 1
    if (!timeB) return -1
    return timeB.localeCompare(timeA)
  })
}

