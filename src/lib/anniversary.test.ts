import { describe, expect, it } from 'vitest'
import { anniversariesOn, yearsAgoLabel } from './anniversary'

const TODAY = '2026-08-20'

describe('anniversariesOn', () => {
  it('gom kỷ niệm cùng ngày, xếp mốc gần trước', () => {
    const result = anniversariesOn(
      [
        { id: 'c', event_date: '2022-08-20' },
        { id: 'a', event_date: '2025-08-20' },
        { id: 'm', event_date: '2026-07-20' },
      ],
      TODAY,
    )
    expect(result.map((a) => [a.event.id, a.monthsAgo])).toEqual([['m', 1], ['a', 12], ['c', 48]])
  })

  it('bỏ qua chính hôm nay và ngày khác', () => {
    expect(anniversariesOn([{ event_date: '2026-08-20' }, { event_date: '2024-08-19' }], TODAY)).toEqual([])
  })

  it('mốc lẻ quá 1 năm thì thôi, mốc tròn năm thì giữ', () => {
    expect(anniversariesOn([{ event_date: '2025-03-20' }], TODAY)).toEqual([])
    expect(anniversariesOn([{ event_date: '2024-08-20' }], TODAY)).toHaveLength(1)
  })
})

describe('yearsAgoLabel', () => {
  it('đọc thành chữ theo tháng hoặc năm', () => {
    expect(yearsAgoLabel(1)).toBe('1 tháng trước')
    expect(yearsAgoLabel(12)).toBe('1 năm trước')
    expect(yearsAgoLabel(36)).toBe('3 năm trước')
  })
})
