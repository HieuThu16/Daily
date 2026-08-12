import { describe, expect, it } from 'vitest'
import { dayMonth, shortDate, timeOfDay, vietnameseDate } from './date'

describe('vietnameseDate', () => {
  it('ghép thứ và ngày theo định dạng tiếng Việt', () => {
    expect(vietnameseDate(new Date(2026, 7, 12))).toBe('Thứ Tư, 12/08/2026')
  })

  it('gọi Chủ Nhật đúng tên', () => {
    expect(vietnameseDate(new Date(2026, 7, 16))).toBe('Chủ Nhật, 16/08/2026')
  })
})

describe('shortDate', () => {
  it('chỉ trả về ngày tháng năm', () => {
    expect(shortDate(new Date(2026, 7, 12))).toBe('12/08/2026')
  })
})

describe('dayMonth', () => {
  it('bỏ số 0 ở đầu', () => {
    expect(dayMonth(new Date(2026, 7, 3))).toBe('3/8')
  })
})

describe('timeOfDay', () => {
  it('lấy giờ phút từ chuỗi ISO', () => {
    expect(timeOfDay('2026-08-12T08:30:00')).toBe('08:30')
  })

  it('trả chuỗi rỗng khi không có dữ liệu', () => {
    expect(timeOfDay(null)).toBe('')
  })
})
