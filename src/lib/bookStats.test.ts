import { describe, expect, it } from 'vitest'
import { listenMinutesByDate, pagesReadByDate, summarizePages } from './bookStats'

const days = ['2026-08-11', '2026-08-12', '2026-08-13']

const logs = [
  // Sách b1: mốc trang luỹ kế 40 → 70 → 120
  { media_item_id: 'b1', log_date: '2026-08-10', page: 40 },
  { media_item_id: 'b1', log_date: '2026-08-12', page: 70 },
  { media_item_id: 'b1', log_date: '2026-08-13', page: 120 },
  // Sách b2 mới bắt đầu trong khoảng
  { media_item_id: 'b2', log_date: '2026-08-13', page: 25 },
]

describe('pagesReadByDate', () => {
  it('tính hiệu so với mốc trước đó, kể cả mốc nằm ngoài khoảng', () => {
    expect(pagesReadByDate(logs, days)).toEqual({
      '2026-08-11': 0,
      '2026-08-12': 30, // 70 − 40 (mốc ngày 10 nằm ngoài khoảng)
      '2026-08-13': 75, // b1: 120 − 70 = 50, b2: 25 − 0 = 25
    })
  })

  it('không cho số âm khi mốc bị ghi lùi', () => {
    const messy = [
      { media_item_id: 'b1', log_date: '2026-08-12', page: 100 },
      { media_item_id: 'b1', log_date: '2026-08-13', page: 60 },
    ]
    expect(pagesReadByDate(messy, days)['2026-08-13']).toBe(0)
  })

  it('bỏ qua dòng không có số trang (sách nói)', () => {
    expect(pagesReadByDate([{ media_item_id: 'b3', log_date: '2026-08-12', page: null }], days)['2026-08-12']).toBe(0)
  })
})

describe('listenMinutesByDate', () => {
  it('cộng giờ và phút nghe', () => {
    const audio = [{ media_item_id: 'b3', log_date: '2026-08-12', listen_hours: 1, listen_minutes: 20 }]
    expect(listenMinutesByDate(audio, days)['2026-08-12']).toBe(80)
  })
})

describe('summarizePages', () => {
  it('chỉ chia trung bình cho những ngày có đọc', () => {
    expect(summarizePages(pagesReadByDate(logs, days))).toEqual({
      total: 105,
      activeDays: 2,
      averagePerActiveDay: 53,
      best: 75,
    })
  })
})
