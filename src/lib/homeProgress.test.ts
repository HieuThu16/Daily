import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog, Todo } from '../types'
import { dayStatus, greetingFor, todayCompletion, weekDays } from './homeProgress'

const habit = (id: string): Habit => ({ id, name: id, is_active: true, category_id: null })

const todo = (over: Partial<Todo> & { id: string }): Todo => ({
  title: over.id,
  completed: false,
  created_at: '2026-08-12T07:00:00',
  ...over,
})

describe('todayCompletion', () => {
  const today = new Date(2026, 7, 12)

  it('trả về 0% khi không có việc nào', () => {
    expect(todayCompletion({ habits: [], habitLogs: [], todos: [] }, today)).toEqual({
      done: 0,
      total: 0,
      percent: 0,
      remaining: 0,
    })
  })

  it('đếm cả habit đã tick lẫn todo hoàn thành hôm nay', () => {
    const habits = [habit('h1'), habit('h2')]
    const habitLogs: HabitLog[] = [{ habit_id: 'h1', date: '2026-08-12', completed: true }]
    const todos = [
      todo({ id: 't1' }),
      todo({ id: 't2', completed: true, completed_at: '2026-08-12T09:00:00' }),
    ]

    expect(todayCompletion({ habits, habitLogs, todos }, today)).toEqual({
      done: 2,
      total: 4,
      percent: 50,
      remaining: 2,
    })
  })

  it('bỏ qua todo hoàn thành từ hôm trước', () => {
    const todos = [
      todo({ id: 't1' }),
      todo({ id: 'old', completed: true, completed_at: '2026-08-11T09:00:00' }),
    ]

    expect(todayCompletion({ habits: [], habitLogs: [], todos }, today).total).toBe(1)
  })

  it('không tính log của ngày khác', () => {
    const habitLogs: HabitLog[] = [{ habit_id: 'h1', date: '2026-08-11', completed: true }]
    expect(todayCompletion({ habits: [habit('h1')], habitLogs, todos: [] }, today).done).toBe(0)
  })
})

describe('weekDays', () => {
  it('bắt đầu từ Thứ Hai và đủ bảy ngày', () => {
    const week = weekDays(new Date(2026, 7, 12))
    expect(week).toHaveLength(7)
    expect(week[0].key).toBe('2026-08-10')
    expect(week[0].label).toBe('T2')
    expect(week[6].key).toBe('2026-08-16')
    expect(week[6].label).toBe('CN')
  })

  it('coi Chủ Nhật là ngày cuối tuần chứ không phải ngày đầu', () => {
    const week = weekDays(new Date(2026, 7, 16))
    expect(week[0].key).toBe('2026-08-10')
    expect(week[6].isToday).toBe(true)
  })

  it('đánh dấu hôm nay và ngày tương lai', () => {
    const week = weekDays(new Date(2026, 7, 12))
    expect(week[2].isToday).toBe(true)
    expect(week[2].isFuture).toBe(false)
    expect(week[3].isFuture).toBe(true)
    expect(week[1].isFuture).toBe(false)
    expect(week[2].dayMonth).toBe('12/8')
  })
})

describe('dayStatus', () => {
  const week = weekDays(new Date(2026, 7, 12))
  const habits = [habit('h1'), habit('h2'), habit('h3'), habit('h4'), habit('h5')]
  const logsFor = (date: string, count: number): HabitLog[] =>
    habits.slice(0, count).map((h) => ({ habit_id: h.id, date, completed: true }))

  it('ngày hôm nay luôn là today', () => {
    expect(dayStatus(week[2], habits, [])).toBe('today')
  })

  it('ngày tương lai là future', () => {
    expect(dayStatus(week[3], habits, [])).toBe('future')
  })

  it('đạt từ 80% trở lên là done', () => {
    expect(dayStatus(week[0], habits, logsFor('2026-08-10', 4))).toBe('done')
  })

  it('dưới 80% mà có tick là partial', () => {
    expect(dayStatus(week[0], habits, logsFor('2026-08-10', 3))).toBe('partial')
  })

  it('không tick gì là empty', () => {
    expect(dayStatus(week[0], habits, [])).toBe('empty')
  })

  it('không có habit nào thì là empty', () => {
    expect(dayStatus(week[0], [], [])).toBe('empty')
  })
})

describe('greetingFor', () => {
  it('chia lời chào theo khung giờ', () => {
    expect(greetingFor(7).text).toBe('Chào buổi sáng')
    expect(greetingFor(12).text).toBe('Chào buổi trưa')
    expect(greetingFor(15).text).toBe('Chào buổi chiều')
    expect(greetingFor(21).text).toBe('Chào buổi tối')
    expect(greetingFor(3).text).toBe('Chào buổi tối')
  })
})
