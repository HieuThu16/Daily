import type { Entry, Media, NutritionLog, SleepLog, Todo } from '../types'
import { getMangaReadingLogs, type MangaReadingLog } from './mangaReadingLog'
import { getVideoWatchLogs, type VideoWatchLog } from './videoWatchLog'

/** Một mốc trong dòng thời gian của một ngày. `time` dạng 'HH:MM' hoặc 'HH:MM - HH:MM'. */
export type DayEvent = {
  time: string
  kind: 'WAKE' | 'MEAL' | 'DIARY' | 'TASK_ADD' | 'TASK_DONE' | 'MEDIA' | 'MANGA'
  label: string
  detail: string
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
export function buildDayReview({ date, entries, meals, sleeps, todos, media, mangaLogs, videoWatchLogs }: DayReviewInput): DayEvent[] {
  const events: DayEvent[] = []

  sleeps.filter((s) => s.log_date === date && s.sleep_end).forEach((s) =>
    events.push({ time: s.sleep_end, kind: 'WAKE', label: 'Thức dậy', detail: `Ngủ từ ${s.sleep_start}` }))

  meals.filter((m) => m.log_date === date).forEach((m) =>
    events.push({ time: m.log_time || '', kind: 'MEAL', label: mealLabel[m.meal_slot], detail: m.food_name }))

  entries.filter((e) => e.entry_date === date).forEach((e) =>
    events.push({ time: e.entry_time || clock(e.created_at), kind: 'DIARY', label: 'Viết nhật ký', detail: e.content }))

  todos.forEach((t) => {
    if (sameDay(t.created_at, date)) events.push({ time: clock(t.created_at), kind: 'TASK_ADD', label: 'Thêm việc', detail: t.title })
    if (t.completed && sameDay(t.completed_at, date)) events.push({ time: clock(t.completed_at), kind: 'TASK_DONE', label: 'Xong việc', detail: t.title })
  })

  media.filter((m) => m.log_date === date).forEach((m) =>
    events.push({ time: m.log_time || '', kind: 'MEDIA', label: mediaLabel[m.type], detail: m.artist || m.channel ? `${m.name} — ${m.artist || m.channel}` : m.name }))

  // 1. Dữ liệu đọc truyện (Ngôn tình, BL, Truyện H) đã được gom nhóm phiên đọc thông minh
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

  // Mục chưa có giờ vẫn giữ lại nhưng xếp cuối, để không im lặng nuốt dữ liệu.
  return events.sort((a, b) => {
    const timeA = (a.time || '').split(' - ')[0] || '99:99'
    const timeB = (b.time || '').split(' - ')[0] || '99:99'
    return timeA.localeCompare(timeB)
  })
}
