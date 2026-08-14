import { describe, expect, it } from 'vitest'
import { dueSoon, minutesLeft, reminderText } from './reminders'

const now = new Date(2026, 7, 13, 12, 0) // 13/08/2026 12:00

type Fixture = { id: string; title: string; completed: boolean; due_date?: string | null; due_time?: string | null }

const todo = (id: string, over: Partial<Fixture> = {}): Fixture => ({
  id,
  title: `Việc ${id}`,
  completed: false,
  due_date: '2026-08-13',
  due_time: '14:00',
  ...over,
})

describe('dueSoon', () => {
  it('nhắc việc chưa xong đến hạn trong 2 tiếng tới', () => {
    expect(dueSoon([todo('t1')], now).map((t) => t.id)).toEqual(['t1'])
  })

  it('không nhắc việc đã làm xong', () => {
    expect(dueSoon([todo('t1', { completed: true })], now)).toEqual([])
  })

  it('không nhắc việc còn xa hơn 2 tiếng', () => {
    expect(dueSoon([todo('t2', { due_time: '18:00' })], now)).toEqual([])
  })

  it('không nhắc việc đã quá hạn', () => {
    expect(dueSoon([todo('t3', { due_time: '11:00' })], now)).toEqual([])
  })

  it('bỏ qua việc không có hạn', () => {
    expect(dueSoon([todo('t4', { due_date: null })], now)).toEqual([])
  })

  it('việc chỉ có ngày thì lấy mốc cuối ngày', () => {
    // 23:59 cách 12:00 hơn 2 tiếng nên chưa nhắc…
    expect(dueSoon([todo('t5', { due_time: null })], now)).toEqual([])
    // …nhưng lúc 22:30 thì có.
    expect(dueSoon([todo('t5', { due_time: null })], new Date(2026, 7, 13, 22, 30)).map((t) => t.id)).toEqual(['t5'])
  })
})

describe('reminderText', () => {
  it('đếm ngược theo giờ và phút', () => {
    expect(minutesLeft(todo('t1'), now)).toBe(120)
    expect(reminderText(todo('t1'), now)).toBe('Còn 2h nữa tới hạn')
    expect(reminderText(todo('t1', { due_time: '12:45' }), now)).toBe('Còn 45p nữa tới hạn')
  })
})
