import type { Entry, Habit, HabitLog, NutritionLog, SleepLog, Todo } from '../types'
import type { WeekDay } from './homeProgress'

export const MEAL_SLOTS = [
  { slot: 'MORNING', label: 'Sáng' },
  { slot: 'LUNCH', label: 'Trưa' },
  { slot: 'AFTERNOON', label: 'Chiều' },
  { slot: 'EVENING', label: 'Tối' },
] as const

export type MealSlot = (typeof MEAL_SLOTS)[number]['slot']

export type MealSummary = { slot: MealSlot; label: string; total: number; count: number }

/** Tiền ăn theo từng bữa trong một ngày. Bữa chưa ăn vẫn có mặt với total = 0. */
export function mealBreakdown(logs: NutritionLog[]): MealSummary[] {
  return MEAL_SLOTS.map(({ slot, label }) => {
    const ofSlot = logs.filter((log) => log.meal_slot === slot)
    return {
      slot,
      label,
      total: ofSlot.reduce((sum, log) => sum + (log.price ?? 0), 0),
      count: ofSlot.length,
    }
  })
}

export function totalSpend(logs: NutritionLog[]): number {
  return logs.reduce((sum, log) => sum + (log.price ?? 0), 0)
}

/** "85k" cho số tròn nghìn, "0" khi chưa tiêu gì. */
export function formatMoney(value: number): string {
  if (!value) return '0'
  if (value < 1000) return String(value)
  const thousands = value / 1000
  return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`
}

export type SpendWeek = { total: number; perDay: number; topDay: { key: string; label: string; total: number } | null }

/** Chi tiêu cả tuần: tổng, trung bình trên số ngày đã qua, và ngày tiêu nhiều nhất. */
export function weeklySpend(logs: NutritionLog[], week: WeekDay[]): SpendWeek {
  const total = totalSpend(logs)
  const elapsed = week.filter((day) => !day.isFuture).length || 1

  let topDay: SpendWeek['topDay'] = null
  for (const day of week) {
    const dayTotal = totalSpend(logs.filter((log) => log.log_date === day.key))
    if (dayTotal > 0 && (!topDay || dayTotal > topDay.total)) {
      topDay = { key: day.key, label: day.label, total: dayTotal }
    }
  }

  return { total, perDay: Math.round(total / elapsed), topDay }
}

/** Số ngày trong tuần đã viết nhật ký. */
export function daysWithEntries(entries: Entry[], week: WeekDay[]): number {
  const written = new Set(entries.map((entry) => entry.entry_date))
  return week.filter((day) => written.has(day.key)).length
}

export type HabitStreak = { habit: Habit; days: number }

/** Xếp hạng thói quen theo số ngày đã làm trong tuần; chỉ tính thói quen tốt. */
export function habitRanking(habits: Habit[], logs: HabitLog[], week: WeekDay[]): HabitStreak[] {
  const keys = new Set(week.map((day) => day.key))
  return habits
    .filter((habit) => habit.habit_type !== 'BAD')
    .map((habit) => ({
      habit,
      days: new Set(
        logs.filter((log) => log.habit_id === habit.id && log.completed && keys.has(log.date)).map((log) => log.date),
      ).size,
    }))
    .sort((a, b) => b.days - a.days || a.habit.name.localeCompare(b.habit.name))
}

/** Phần trăm hoàn thành habit của từng ngày trong tuần, để vẽ cột. */
export function weeklyHabitPercent(habits: Habit[], logs: HabitLog[], week: WeekDay[]): number[] {
  if (habits.length === 0) return week.map(() => 0)
  const ids = new Set(habits.map((h) => h.id))
  return week.map((day) => {
    if (day.isFuture) return 0
    const done = new Set(
      logs.filter((log) => log.date === day.key && log.completed && ids.has(log.habit_id)).map((log) => log.habit_id),
    ).size
    return Math.round((done / habits.length) * 100)
  })
}

/** Việc đã hoàn thành trong tuần, dựa vào completed_at. */
export function todosDoneInWeek(todos: Todo[], week: WeekDay[]): number {
  const keys = new Set(week.map((day) => day.key))
  return todos.filter((todo) => todo.completed && keys.has((todo.completed_at ?? '').slice(0, 10))).length
}

export type SleepSummary = { minutes: number; text: string; range: string | null }

/** "7h30" — 0 phút thì trả về "—" để ô số liệu không trống trơn. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}p`
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`
}

/** Tổng thời gian ngủ của một ngày, kèm khung giờ của giấc dài nhất. */
export function sleepSummary(logs: SleepLog[]): SleepSummary {
  const minutes = logs.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0)
  const longest = logs.reduce<SleepLog | null>(
    (best, log) => (!best || log.duration_minutes > best.duration_minutes ? log : best),
    null,
  )
  return {
    minutes,
    text: formatDuration(minutes),
    range: longest ? `${longest.sleep_start} → ${longest.sleep_end}` : null,
  }
}

/** Trung bình mỗi đêm trong tuần, chỉ chia cho những đêm đã ghi. */
export function weeklySleepAverage(logs: SleepLog[], week: WeekDay[]): { minutes: number; nights: number } {
  const keys = new Set(week.map((day) => day.key))
  const inWeek = logs.filter((log) => keys.has(log.log_date))
  const nights = new Set(inWeek.map((log) => log.log_date)).size
  const total = inWeek.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0)
  return { minutes: nights ? Math.round(total / nights) : 0, nights }
}
