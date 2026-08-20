import { describe, expect, it } from 'vitest'
import { nextDueDate, parseNaturalTask } from './naturalTask'

// Thứ Ba 18/08/2026 làm mốc cho mọi phép tính tương đối.
const TODAY = new Date(2026, 7, 18)

describe('parseNaturalTask', () => {
  it('tách giờ chiều và thứ trong tuần', () => {
    const r = parseNaturalTask('họp nhóm 3h chiều thứ 5', TODAY)
    expect(r.title).toBe('họp nhóm')
    expect(r.dueTime).toBe('15:00')
    expect(r.dueDate).toBe('2026-08-20')
  })

  it('hiểu "mai" và giờ có phút', () => {
    const r = parseNaturalTask('gọi mẹ mai 19h30', TODAY)
    expect(r.title).toBe('gọi mẹ')
    expect(r.dueDate).toBe('2026-08-19')
    expect(r.dueTime).toBe('19:30')
  })

  it('ngày tháng đã qua thì hiểu là năm sau', () => {
    expect(parseNaturalTask('sinh nhật 1/1', TODAY).dueDate).toBe('2027-01-01')
    expect(parseNaturalTask('khám răng 25/12', TODAY).dueDate).toBe('2026-12-25')
  })

  it('nhận lịch lặp', () => {
    const r = parseNaturalTask('uống thuốc hằng ngày 8h', TODAY)
    expect(r.repeat).toBe('DAILY')
    expect(r.dueTime).toBe('08:00')
    expect(r.title).toBe('uống thuốc')
  })

  it('câu không có ngày giờ thì giữ nguyên', () => {
    const r = parseNaturalTask('dọn nhà', TODAY)
    expect(r).toEqual({ title: 'dọn nhà' })
  })

  it('trùng thứ hôm nay thì lấy tuần sau', () => {
    expect(parseNaturalTask('gym thứ 3', TODAY).dueDate).toBe('2026-08-25')
  })
})

describe('nextDueDate', () => {
  it('ngày / tuần / tháng', () => {
    expect(nextDueDate('DAILY', '2026-08-18')).toBe('2026-08-19')
    expect(nextDueDate('WEEKLY', '2026-08-18')).toBe('2026-08-25')
    expect(nextDueDate('MONTHLY', '2026-08-18')).toBe('2026-09-18')
  })

  it('ngày thường nhảy qua cuối tuần', () => {
    expect(nextDueDate('WEEKDAYS', '2026-08-21')).toBe('2026-08-24') // thứ 6 → thứ 2
  })
})
