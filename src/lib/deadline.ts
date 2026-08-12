import { localDate } from './date'

/** Giờ mặc định khi task chỉ đặt ngày mà không đặt giờ: cuối ngày. */
export const END_OF_DAY = '23:59'

export type DeadlineFields = {
  due_date?: string | null
  due_time?: string | null
  created_at?: string | null
  completed?: boolean
}

/** Các mức trì hoãn nhanh (phút). */
export const POSTPONE_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 15, label: '+15 phút' },
  { minutes: 30, label: '+30 phút' },
  { minutes: 60, label: '+1 giờ' },
  { minutes: 180, label: '+3 giờ' },
  { minutes: 1440, label: '+1 ngày' },
]

const pad = (n: number) => String(n).padStart(2, '0')

/** 'HH:MM' hoặc 'HH:MM:SS' → { hour, minute }. Chuỗi không hợp lệ → null. */
const parseTime = (value?: string | null) => {
  if (!value) return null
  const [h, m] = value.split(':')
  const hour = Number(h)
  const minute = Number(m)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return { hour, minute }
}

/** Mốc ngày của task: due_date, không có thì lấy ngày tạo. */
const baseDateOf = (todo: DeadlineFields) => {
  const raw = todo.due_date || (todo.created_at ? todo.created_at.slice(0, 10) : '')
  if (!raw) return null
  const [y, m, d] = raw.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  return { year: y, month: m, day: d }
}

/** Hạn chót đầy đủ (ngày + giờ) theo giờ địa phương. Không có giờ → cuối ngày. */
export function deadlineOf(todo: DeadlineFields): Date | null {
  const base = baseDateOf(todo)
  if (!base) return null
  const time = parseTime(todo.due_time) ?? parseTime(END_OF_DAY)!
  return new Date(base.year, base.month - 1, base.day, time.hour, time.minute, 0, 0)
}

/** Đã qua hạn chưa (tính cả giờ). Task đã hoàn thành không bao giờ tính là quá hạn. */
export function isOverdue(todo: DeadlineFields, now = new Date()): boolean {
  if (todo.completed) return false
  const deadline = deadlineOf(todo)
  return deadline !== null && deadline.getTime() < now.getTime()
}

/**
 * Hạn mới sau khi trì hoãn thêm `minutes` phút.
 * Mốc cộng thêm là hạn cũ nếu còn ở tương lai, ngược lại là thời điểm hiện tại —
 * nhờ vậy trì hoãn một task đã quá hạn luôn cho ra hạn mới ở phía trước.
 */
export function postponeTo(todo: DeadlineFields, minutes: number, now = new Date()): { due_date: string; due_time: string } {
  const deadline = deadlineOf(todo)
  const base = deadline && deadline.getTime() > now.getTime() ? deadline : now
  const next = new Date(base.getTime() + minutes * 60_000)
  return { due_date: localDate(next), due_time: `${pad(next.getHours())}:${pad(next.getMinutes())}` }
}

/** 1575 → '1 ngày 2h 15p' */
export function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return '0p'
  const minutes = Math.round(total)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const parts: string[] = []
  if (days) parts.push(`${days} ngày`)
  if (hours) parts.push(`${hours}h`)
  if (mins) parts.push(`${mins}p`)
  return parts.join(' ')
}

/** 'HH:MM' rút gọn để hiện trên dòng task, hoặc chuỗi rỗng nếu task không đặt giờ. */
export function timeLabel(due_time?: string | null): string {
  const time = parseTime(due_time)
  return time ? `${pad(time.hour)}:${pad(time.minute)}` : ''
}

/** '14/08/2026 18:30' — dùng trong modal chi tiết và preview trì hoãn. */
export function formatDeadline(todo: DeadlineFields): string {
  const base = baseDateOf(todo)
  if (!base) return 'Chưa đặt hạn'
  const date = `${pad(base.day)}/${pad(base.month)}/${base.year}`
  const time = timeLabel(todo.due_time)
  return time ? `${date} ${time}` : `${date} (cả ngày)`
}
