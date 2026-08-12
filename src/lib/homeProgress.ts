import type { Habit, HabitLog, Todo } from '../types'
import { dayMonth, localDate } from './date'

export type CompletionSummary = { done: number; total: number; percent: number; remaining: number }

/**
 * Phần trăm hoàn thành trong ngày.
 * Mẫu số = habit đang hoạt động + todo chưa xong + todo đã xong hôm nay.
 */
export function todayCompletion(
  input: { habits: Habit[]; habitLogs: HabitLog[]; todos: Todo[] },
  today = new Date(),
): CompletionSummary {
  const day = localDate(today)

  const doneHabitIds = new Set(
    input.habitLogs.filter((log) => log.date === day && log.completed).map((log) => log.habit_id),
  )
  const habitDone = input.habits.filter((h) => doneHabitIds.has(h.id)).length

  const relevantTodos = input.todos.filter(
    (t) => !t.completed || (t.completed_at ?? '').slice(0, 10) === day,
  )
  const todoDone = relevantTodos.filter((t) => t.completed).length

  const total = input.habits.length + relevantTodos.length
  const done = habitDone + todoDone
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100), remaining: total - done }
}

export type WeekDay = {
  date: Date
  key: string
  label: string
  dayMonth: string
  isToday: boolean
  isFuture: boolean
}

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** Bảy ngày của tuần hiện tại, bắt đầu từ Thứ Hai. */
export function weekDays(today = new Date()): WeekDay[] {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const offsetFromMonday = (base.getDay() + 6) % 7
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offsetFromMonday)
  const todayKey = localDate(base)

  return DAY_LABELS.map((label, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)
    const key = localDate(date)
    return { date, key, label, dayMonth: dayMonth(date), isToday: key === todayKey, isFuture: key > todayKey }
  })
}

export type DayStatus = 'done' | 'partial' | 'empty' | 'today' | 'future'

/** Tỉ lệ habit tối thiểu để coi một ngày là đã hoàn thành. */
export const DAY_DONE_RATIO = 0.8

export function dayStatus(day: WeekDay, habits: Habit[], logs: HabitLog[]): DayStatus {
  if (day.isToday) return 'today'
  if (day.isFuture) return 'future'
  if (habits.length === 0) return 'empty'

  const done = logs.filter((log) => log.date === day.key && log.completed).length
  if (done / habits.length >= DAY_DONE_RATIO) return 'done'
  return done > 0 ? 'partial' : 'empty'
}

export type Greeting = { text: string; emoji: string }

export function greetingFor(hour: number): Greeting {
  if (hour >= 5 && hour < 11) return { text: 'Chào buổi sáng', emoji: '🌤️' }
  if (hour >= 11 && hour < 13) return { text: 'Chào buổi trưa', emoji: '☀️' }
  if (hour >= 13 && hour < 18) return { text: 'Chào buổi chiều', emoji: '🌇' }
  return { text: 'Chào buổi tối', emoji: '🌙' }
}
