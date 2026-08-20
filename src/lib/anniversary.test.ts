import { describe, expect, it } from 'vitest'
import { anniversariesOn, yearsAgoLabel } from './anniversary'

const TODAY = '2026-08-20'

describe('anniversariesOn', () => {
  it('gom kỷ niệm cùng ngày-tháng, xếp năm gần trước', () => {
    const result = anniversariesOn(
      [
        { id: 'c', event_date: '2022-08-20' },
        { id: 'a', event_date: '2025-08-20' },
        { id: 'b', event_date: '2024-08-20' },
      ],
      TODAY,
    )
    expect(result.map((a) => [a.event.id, a.yearsAgo])).toEqual([['a', 1], ['b', 2], ['c', 4]])
  })

  it('bỏ qua kỷ niệm của chính năm nay và ngày khác', () => {
    expect(anniversariesOn([{ event_date: '2026-08-20' }, { event_date: '2024-08-19' }], TODAY)).toEqual([])
  })

  it('không nhầm ngày 20/8 với 20/9', () => {
    expect(anniversariesOn([{ event_date: '2024-09-20' }], TODAY)).toEqual([])
  })
})

describe('yearsAgoLabel', () => {
  it('đọc thành chữ', () => {
    expect(yearsAgoLabel(1)).toBe('1 năm trước')
    expect(yearsAgoLabel(3)).toBe('3 năm trước')
  })
})
