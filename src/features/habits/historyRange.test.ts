import { describe, expect, it } from 'vitest'
import { isCurrentPeriod, isoWeekNumber, monthDates, monthLabel, shiftAnchor, weekDates, weekLabel } from './historyRange'

const at = (iso: string) => new Date(`${iso}T12:00:00`)

describe('historyRange', () => {
  it('bắt đầu tuần từ thứ Hai kể cả khi mốc là Chủ Nhật', () => {
    expect(weekDates(at('2026-08-12'))[0]).toBe('2026-08-10')
    expect(weekDates(at('2026-08-12'))).toHaveLength(7)
    expect(weekDates(at('2026-08-16'))[0]).toBe('2026-08-10')
    expect(weekDates(at('2026-08-16'))[6]).toBe('2026-08-16')
  })

  it('lấy đủ ngày của tháng, kể cả ngày trong tương lai', () => {
    expect(monthDates(at('2026-08-12'))).toHaveLength(31)
    const feb = monthDates(at('2026-02-03'))
    expect(feb[feb.length - 1]).toBe('2026-02-28')
  })

  it('đánh số tuần theo ISO', () => {
    expect(isoWeekNumber(at('2026-01-01'))).toBe(1)
    expect(isoWeekNumber(at('2026-08-12'))).toBe(33)
  })

  it('hiện nhãn tuần và tháng dễ đọc', () => {
    expect(weekLabel(at('2026-08-12'))).toBe('Tuần 33 · 10/8 – 16/8')
    expect(monthLabel(at('2026-08-12'))).toBe('Tháng 8/2026')
  })

  it('lùi/tiến theo đúng kiểu xem', () => {
    expect(weekDates(shiftAnchor(at('2026-08-12'), 'week', -1))[0]).toBe('2026-08-03')
    expect(monthLabel(shiftAnchor(at('2026-08-12'), 'month', 1))).toBe('Tháng 9/2026')
    expect(monthLabel(shiftAnchor(at('2026-12-12'), 'month', 1))).toBe('Tháng 1/2027')
  })

  it('nhận ra kỳ hiện tại để khoá nút tiến', () => {
    const today = at('2026-08-12')
    expect(isCurrentPeriod(at('2026-08-16'), 'week', today)).toBe(true)
    expect(isCurrentPeriod(at('2026-08-09'), 'week', today)).toBe(false)
    expect(isCurrentPeriod(at('2026-08-01'), 'month', today)).toBe(true)
    expect(isCurrentPeriod(at('2026-07-31'), 'month', today)).toBe(false)
  })
})
