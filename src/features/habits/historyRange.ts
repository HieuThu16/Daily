import { localDate } from '../../lib/date'

export type HistoryRange = 'week' | 'month'

/** Nhãn thứ trong tuần, bắt đầu từ thứ Hai. */
export const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const atMidnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** Thứ Hai của tuần chứa `date`. */
export const startOfWeek = (date: Date) => {
  const start = atMidnight(date)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

/** Vị trí cột (0 = thứ Hai … 6 = Chủ Nhật). */
export const weekdayIndex = (date: Date) => (date.getDay() + 6) % 7

/** 7 ngày của tuần chứa `anchor`, từ thứ Hai đến Chủ Nhật. */
export const weekDates = (anchor: Date) => {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return localDate(day)
  })
}

/** Toàn bộ ngày trong tháng chứa `anchor`. */
export const monthDates = (anchor: Date) => {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const days = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: days }, (_, i) => localDate(new Date(year, month, i + 1)))
}

/** Số tuần theo chuẩn ISO (tuần bắt đầu thứ Hai, tuần 1 chứa ngày 4/1). */
export const isoWeekNumber = (date: Date) => {
  const thursday = startOfWeek(date)
  thursday.setDate(thursday.getDate() + 3)
  const firstThursday = startOfWeek(new Date(thursday.getFullYear(), 0, 4))
  firstThursday.setDate(firstThursday.getDate() + 3)
  return Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000)) + 1
}

const dayMonth = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`

/** 'Tuần 33 · 10/8 – 16/8' */
export const weekLabel = (anchor: Date) => {
  const start = startOfWeek(anchor)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `Tuần ${isoWeekNumber(anchor)} · ${dayMonth(start)} – ${dayMonth(end)}`
}

/** 'Tháng 8/2026' */
export const monthLabel = (anchor: Date) => `Tháng ${anchor.getMonth() + 1}/${anchor.getFullYear()}`

/** Lùi/tiến một tuần hoặc một tháng. */
export const shiftAnchor = (anchor: Date, range: HistoryRange, delta: number) => {
  const next = atMidnight(anchor)
  if (range === 'week') next.setDate(next.getDate() + delta * 7)
  else next.setMonth(next.getMonth() + delta, 1)
  return next
}

/** Đang xem kỳ hiện tại thì không cho bấm "tiến". */
export const isCurrentPeriod = (anchor: Date, range: HistoryRange, today = new Date()) =>
  range === 'week'
    ? localDate(startOfWeek(anchor)) === localDate(startOfWeek(today))
    : anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth()
