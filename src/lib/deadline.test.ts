import { describe, expect, it } from 'vitest'
import { deadlineOf, formatDeadline, formatMinutes, isOverdue, postponeTo } from './deadline'

const todo = (over: Partial<Parameters<typeof deadlineOf>[0]> = {}) => ({
  due_date: '2026-08-14',
  due_time: '18:30',
  created_at: '2026-08-10T03:00:00.000Z',
  ...over,
})

describe('deadlineOf', () => {
  it('ghép due_date với due_time theo giờ địa phương', () => {
    expect(deadlineOf(todo())).toEqual(new Date(2026, 7, 14, 18, 30, 0, 0))
  })

  it('không có giờ thì coi hạn là cuối ngày', () => {
    expect(deadlineOf(todo({ due_time: null }))).toEqual(new Date(2026, 7, 14, 23, 59, 0, 0))
  })

  it('chấp nhận giờ dạng HH:MM:SS từ Postgres', () => {
    expect(deadlineOf(todo({ due_time: '18:30:00' }))).toEqual(new Date(2026, 7, 14, 18, 30, 0, 0))
  })

  it('không có due_date thì lấy ngày tạo làm mốc', () => {
    const d = deadlineOf(todo({ due_date: null, due_time: '08:00', created_at: '2026-08-10T03:00:00.000Z' }))
    expect(d).toEqual(new Date(2026, 7, 10, 8, 0, 0, 0))
  })

  it('trả về null khi không có mốc ngày nào', () => {
    expect(deadlineOf({ due_date: null, due_time: null, created_at: '' })).toBeNull()
  })
})

describe('isOverdue', () => {
  const now = new Date(2026, 7, 14, 19, 0)

  it('quá hạn khi đã qua giờ hạn trong cùng ngày', () => {
    expect(isOverdue(todo(), now)).toBe(true)
  })

  it('chưa quá hạn khi còn trong giờ', () => {
    expect(isOverdue(todo({ due_time: '21:00' }), now)).toBe(false)
  })

  it('task không có giờ thì chỉ quá hạn sau khi hết ngày', () => {
    expect(isOverdue(todo({ due_time: null }), now)).toBe(false)
    expect(isOverdue(todo({ due_time: null }), new Date(2026, 7, 15, 0, 30))).toBe(true)
  })

  it('task đã hoàn thành không tính quá hạn', () => {
    expect(isOverdue({ ...todo(), completed: true }, now)).toBe(false)
  })
})

describe('postponeTo', () => {
  it('cộng phút vào hạn cũ khi hạn còn ở tương lai', () => {
    const now = new Date(2026, 7, 14, 10, 0)
    expect(postponeTo(todo(), 30, now)).toEqual({ due_date: '2026-08-14', due_time: '19:00' })
  })

  it('cộng phút từ thời điểm hiện tại khi task đã quá hạn', () => {
    const now = new Date(2026, 7, 15, 9, 20)
    expect(postponeTo(todo(), 60, now)).toEqual({ due_date: '2026-08-15', due_time: '10:20' })
  })

  it('tự nhảy sang ngày hôm sau khi vượt nửa đêm', () => {
    const now = new Date(2026, 7, 14, 10, 0)
    expect(postponeTo(todo({ due_time: '23:50' }), 30, now)).toEqual({ due_date: '2026-08-15', due_time: '00:20' })
  })

  it('trì hoãn 1 ngày giữ nguyên giờ hạn', () => {
    const now = new Date(2026, 7, 14, 10, 0)
    expect(postponeTo(todo(), 1440, now)).toEqual({ due_date: '2026-08-15', due_time: '18:30' })
  })

  it('task cả ngày được đẩy từ cuối ngày và có giờ hạn cụ thể', () => {
    const now = new Date(2026, 7, 14, 10, 0)
    expect(postponeTo(todo({ due_time: null }), 60, now)).toEqual({ due_date: '2026-08-15', due_time: '00:59' })
  })

  it('task không có hạn thì tính từ bây giờ', () => {
    const now = new Date(2026, 7, 14, 10, 0)
    expect(postponeTo({ due_date: null, due_time: null, created_at: '' }, 45, now)).toEqual({
      due_date: '2026-08-14',
      due_time: '10:45',
    })
  })
})

describe('formatMinutes', () => {
  it('hiển thị phút, giờ và ngày gọn gàng', () => {
    expect(formatMinutes(0)).toBe('0p')
    expect(formatMinutes(45)).toBe('45p')
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(135)).toBe('2h 15p')
    expect(formatMinutes(1440)).toBe('1 ngày')
    expect(formatMinutes(1560)).toBe('1 ngày 2h')
    expect(formatMinutes(1575)).toBe('1 ngày 2h 15p')
  })
})

describe('formatDeadline', () => {
  it('hiện ngày kèm giờ khi có giờ hạn', () => {
    expect(formatDeadline(todo())).toBe('14/08/2026 18:30')
  })

  it('hiện "cả ngày" khi không đặt giờ', () => {
    expect(formatDeadline(todo({ due_time: null }))).toBe('14/08/2026 (cả ngày)')
  })

  it('trả về thông báo khi chưa có hạn', () => {
    expect(formatDeadline({ due_date: null, due_time: null, created_at: '' })).toBe('Chưa đặt hạn')
  })
})
