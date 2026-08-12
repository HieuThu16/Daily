export type PeriodMode = 'day' | 'week' | 'month'
export type MealSlot = 'MORNING' | 'LUNCH' | 'AFTERNOON' | 'EVENING'
export type MealFilter = 'ALL' | MealSlot

export type NutritionLog = {
  id: string
  meal_slot: MealSlot
  food_name: string
  price: number
  log_date: string
  log_time?: string
  created_at?: string
}

export type SleepLog = {
  id: string
  sleep_start: string
  sleep_end: string
  log_date: string
  duration_minutes: number
  created_at?: string
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function formatLocalDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function datesBetween(start: Date, end: Date) {
  const days: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    days.push(formatLocalDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function getPeriodRange(anchor: string, mode: PeriodMode) {
  const anchorDate = parseLocalDate(anchor)
  let start = new Date(anchorDate)
  let end = new Date(anchorDate)

  if (mode === 'week') start.setDate(start.getDate() - 6)
  if (mode === 'month') {
    start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 12)
    end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 12)
  }

  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
    days: datesBetween(start, end),
  }
}

export function filterFoodLogs(logs: NutritionLog[], slot: MealFilter) {
  return slot === 'ALL' ? logs : logs.filter((log) => log.meal_slot === slot)
}

export function groupLogsByDate<T extends { log_date: string }>(logs: T[]) {
  const grouped = new Map<string, T[]>()
  logs.forEach((log) => grouped.set(log.log_date, [...(grouped.get(log.log_date) ?? []), log]))
  return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a))
}

export function summarizeFood(logs: NutritionLog[], days: string[]) {
  const byDate = Object.fromEntries(days.map((day) => [day, 0])) as Record<string, number>
  logs.forEach((log) => {
    if (log.log_date in byDate) byDate[log.log_date] += log.price
  })
  const total = logs.reduce((sum, log) => sum + log.price, 0)
  return {
    total,
    averagePerDay: days.length ? Math.round(total / days.length) : 0,
    itemCount: logs.length,
    byDate,
  }
}

export function aggregateSleepByDate(logs: SleepLog[], days: string[]) {
  const byDate = Object.fromEntries(days.map((day) => [day, 0])) as Record<string, number>
  logs.forEach((log) => {
    if (log.log_date in byDate) byDate[log.log_date] += log.duration_minutes
  })
  return byDate
}

export function summarizeSleep(logs: SleepLog[]) {
  const totals = new Map<string, number>()
  logs.forEach((log) => totals.set(log.log_date, (totals.get(log.log_date) ?? 0) + log.duration_minutes))
  const dailyTotals = [...totals.values()]
  const totalMinutes = dailyTotals.reduce((sum, minutes) => sum + minutes, 0)
  return {
    totalMinutes,
    averagePerNight: dailyTotals.length ? Math.round(totalMinutes / dailyTotals.length) : 0,
    recordedNights: dailyTotals.length,
    targetNights: dailyTotals.filter((minutes) => minutes >= 450).length,
  }
}

export function shiftPeriodAnchor(anchor: string, mode: PeriodMode, direction: -1 | 1) {
  const date = parseLocalDate(anchor)
  if (mode === 'month') date.setMonth(date.getMonth() + direction)
  else date.setDate(date.getDate() + direction * (mode === 'week' ? 7 : 1))
  return formatLocalDate(date)
}
