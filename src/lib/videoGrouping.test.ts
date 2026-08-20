import { describe, expect, it } from 'vitest'
import { publishedGroupLabel } from './videoGrouping'

const TODAY = new Date('2026-08-20T12:00:00')

describe('publishedGroupLabel', () => {
  it('trong 7 ngày là "Tuần này"', () => {
    expect(publishedGroupLabel('2026-08-18T09:00:00', TODAY)).toBe('Tuần này')
  })

  it('cùng tháng nhưng quá 7 ngày là "Tháng này"', () => {
    expect(publishedGroupLabel('2026-08-02T09:00:00', TODAY)).toBe('Tháng này')
  })

  it('tháng khác trong cùng năm ghi rõ tháng', () => {
    expect(publishedGroupLabel('2026-05-11T09:00:00', TODAY)).toBe('Tháng 5/2026')
  })

  it('năm cũ gom theo năm', () => {
    expect(publishedGroupLabel('2024-12-30T09:00:00', TODAY)).toBe('Năm 2024')
  })

  it('thiếu hoặc hỏng ngày thì gom riêng', () => {
    expect(publishedGroupLabel(null, TODAY)).toBe('Chưa rõ ngày đăng')
    expect(publishedGroupLabel('không phải ngày', TODAY)).toBe('Chưa rõ ngày đăng')
  })
})
