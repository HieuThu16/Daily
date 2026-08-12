import { describe, expect, it } from 'vitest'
import type { Entry, Habit, HabitLog, NutritionLog, SleepLog, Todo } from '../types'
import { weekDays } from './homeProgress'
import {
  daysWithEntries,
  formatDuration,
  formatMoney,
  habitRanking,
  mealBreakdown,
  sleepSummary,
  todosDoneInWeek,
  totalSpend,
  weeklySleepAverage,
  weeklyHabitPercent,
  weeklySpend,
} from './report'

const week = weekDays(new Date(2026, 7, 12)) // Thứ Tư 12/08/2026
const [mon, tue, wed] = week

const meal = (slot: NutritionLog['meal_slot'], price: number, log_date: string): NutritionLog => ({
  id: crypto.randomUUID(),
  meal_slot: slot,
  food_name: 'Cơm',
  price,
  log_date,
})

const habit = (id: string, name: string, type: 'GOOD' | 'BAD' = 'GOOD'): Habit => ({
  id,
  name,
  is_active: true,
  category_id: null,
  habit_type: type,
})

const log = (habit_id: string, date: string, completed = true): HabitLog => ({ habit_id, date, completed })

describe('mealBreakdown', () => {
  it('gộp tiền theo từng bữa và giữ đủ 4 bữa', () => {
    const result = mealBreakdown([meal('LUNCH', 35_000, wed.key), meal('LUNCH', 5_000, wed.key)])
    expect(result.map((m) => m.label)).toEqual(['Sáng', 'Trưa', 'Chiều', 'Tối'])
    expect(result.find((m) => m.slot === 'LUNCH')).toMatchObject({ total: 40_000, count: 2 })
    expect(result.find((m) => m.slot === 'MORNING')).toMatchObject({ total: 0, count: 0 })
  })
})

describe('formatMoney', () => {
  it('rút gọn theo nghìn', () => {
    expect(formatMoney(0)).toBe('0')
    expect(formatMoney(800)).toBe('800')
    expect(formatMoney(35_000)).toBe('35k')
    expect(formatMoney(35_500)).toBe('35.5k')
  })
})

describe('weeklySpend', () => {
  const logs = [meal('LUNCH', 30_000, mon.key), meal('EVENING', 50_000, tue.key), meal('LUNCH', 20_000, wed.key)]

  it('tính tổng và chia cho số ngày đã qua, không tính ngày tương lai', () => {
    const result = weeklySpend(logs, week)
    expect(result.total).toBe(100_000)
    expect(result.perDay).toBe(Math.round(100_000 / 3))
  })

  it('chỉ ra ngày tiêu nhiều nhất', () => {
    expect(weeklySpend(logs, week).topDay).toMatchObject({ key: tue.key, total: 50_000 })
  })

  it('không có chi tiêu thì không có ngày cao nhất', () => {
    expect(weeklySpend([], week)).toMatchObject({ total: 0, perDay: 0, topDay: null })
  })
})

describe('daysWithEntries', () => {
  it('đếm số ngày khác nhau có ghi nhật ký', () => {
    const entries = [
      { id: '1', content: 'a', entry_date: mon.key, created_at: '', entry_type: 'FEELING' },
      { id: '2', content: 'b', entry_date: mon.key, created_at: '', entry_type: 'SMALL_WIN' },
      { id: '3', content: 'c', entry_date: wed.key, created_at: '', entry_type: 'FEELING' },
    ] as Entry[]
    expect(daysWithEntries(entries, week)).toBe(2)
  })
})

describe('habitRanking', () => {
  const habits = [habit('h1', 'Đọc sách'), habit('h2', 'Chạy bộ'), habit('h3', 'TikTok', 'BAD')]
  const logs = [log('h1', mon.key), log('h1', tue.key), log('h2', mon.key), log('h3', mon.key)]

  it('xếp theo số ngày làm được, nhiều nhất lên đầu', () => {
    const ranked = habitRanking(habits, logs, week)
    expect(ranked[0]).toMatchObject({ days: 2 })
    expect(ranked[0].habit.name).toBe('Đọc sách')
    expect(ranked[ranked.length - 1].habit.name).toBe('Chạy bộ')
  })

  it('bỏ qua thói quen xấu', () => {
    expect(habitRanking(habits, logs, week).some((r) => r.habit.name === 'TikTok')).toBe(false)
  })
})

describe('weeklyHabitPercent', () => {
  it('tính phần trăm mỗi ngày và để ngày tương lai bằng 0', () => {
    const habits = [habit('h1', 'A'), habit('h2', 'B')]
    const percents = weeklyHabitPercent(habits, [log('h1', mon.key)], week)
    expect(percents[0]).toBe(50)
    expect(percents[6]).toBe(0)
  })

  it('không có thói quen nào thì trả về toàn 0', () => {
    expect(weeklyHabitPercent([], [], week)).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe('todosDoneInWeek', () => {
  it('đếm việc hoàn thành trong tuần theo completed_at', () => {
    const todos = [
      { id: '1', title: 'a', completed: true, created_at: '', completed_at: `${mon.key}T09:00:00` },
      { id: '2', title: 'b', completed: true, created_at: '', completed_at: '2020-01-01T09:00:00' },
      { id: '3', title: 'c', completed: false, created_at: '' },
    ] as Todo[]
    expect(todosDoneInWeek(todos, week)).toBe(1)
  })
})

describe('totalSpend', () => {
  it('cộng dồn giá', () => {
    expect(totalSpend([meal('LUNCH', 1_000, wed.key), meal('EVENING', 2_000, wed.key)])).toBe(3_000)
  })
})

describe('giấc ngủ', () => {
  const sleep = (start: string, end: string, minutes: number, log_date: string): SleepLog => ({
    id: crypto.randomUUID(),
    sleep_start: start,
    sleep_end: end,
    duration_minutes: minutes,
    log_date,
  })

  it('rút gọn thời lượng', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(45)).toBe('45p')
    expect(formatDuration(450)).toBe('7h30')
    expect(formatDuration(480)).toBe('8h')
  })

  it('cộng tổng giờ ngủ và lấy khung giờ của giấc dài nhất', () => {
    const result = sleepSummary([sleep('23:00', '06:30', 450, wed.key), sleep('13:00', '13:30', 30, wed.key)])
    expect(result.minutes).toBe(480)
    expect(result.text).toBe('8h')
    expect(result.range).toBe('23:00 → 06:30')
  })

  it('không có giấc nào thì không có khung giờ', () => {
    expect(sleepSummary([])).toMatchObject({ minutes: 0, text: '—', range: null })
  })

  it('trung bình tuần chỉ chia cho số đêm đã ghi', () => {
    const logs = [sleep('23:00', '07:00', 480, mon.key), sleep('00:00', '06:00', 360, tue.key)]
    expect(weeklySleepAverage(logs, week)).toEqual({ minutes: 420, nights: 2 })
  })
})
