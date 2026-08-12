import { describe, expect, it } from 'vitest'
import type { Person, PersonOccasion } from '../types'
import { ageOnNext, countdownLabel, daysUntil, nextOccurrence, occasionLabel, upcomingOccasions } from './occasions'

const make = (over: Partial<PersonOccasion> = {}): PersonOccasion => ({
  id: 'o1',
  person_id: 'p1',
  kind: 'BIRTHDAY',
  title: '',
  occasion_date: '2001-08-15',
  is_yearly: true,
  ...over,
})

const people: Person[] = [{ id: 'p1', name: 'Linh' }]

describe('nextOccurrence', () => {
  it('trả về ngày trong năm nay khi dịp chưa qua', () => {
    expect(nextOccurrence(make(), new Date(2026, 7, 12))).toEqual(new Date(2026, 7, 15))
  })

  it('coi dịp rơi đúng hôm nay là chưa qua', () => {
    expect(nextOccurrence(make(), new Date(2026, 7, 15))).toEqual(new Date(2026, 7, 15))
  })

  it('nhảy sang năm sau khi dịp đã qua', () => {
    expect(nextOccurrence(make(), new Date(2026, 8, 1))).toEqual(new Date(2027, 7, 15))
  })

  it('lùi 29/02 về 28/02 ở năm không nhuận', () => {
    expect(nextOccurrence(make({ occasion_date: '2000-02-29' }), new Date(2026, 0, 10))).toEqual(new Date(2026, 1, 28))
  })

  it('giữ nguyên 29/02 ở năm nhuận', () => {
    expect(nextOccurrence(make({ occasion_date: '2000-02-29' }), new Date(2028, 0, 10))).toEqual(new Date(2028, 1, 29))
  })

  it('ẩn dịp một lần đã qua', () => {
    expect(nextOccurrence(make({ is_yearly: false, occasion_date: '2026-08-01' }), new Date(2026, 7, 12))).toBeNull()
  })

  it('giữ dịp một lần còn ở tương lai', () => {
    expect(nextOccurrence(make({ is_yearly: false, occasion_date: '2026-09-01' }), new Date(2026, 7, 12))).toEqual(new Date(2026, 8, 1))
  })
})

describe('daysUntil', () => {
  it('đếm theo ngày địa phương', () => {
    expect(daysUntil(new Date(2026, 7, 15), new Date(2026, 7, 12, 23, 30))).toBe(3)
  })

  it('trả 0 cho hôm nay', () => {
    expect(daysUntil(new Date(2026, 7, 12, 1), new Date(2026, 7, 12, 22))).toBe(0)
  })
})

describe('ageOnNext', () => {
  it('tính tuổi sẽ tròn vào lần tới', () => {
    expect(ageOnNext(make(), new Date(2026, 7, 12))).toBe(25)
  })

  it('trả null cho kỉ niệm', () => {
    expect(ageOnNext(make({ kind: 'ANNIVERSARY' }), new Date(2026, 7, 12))).toBeNull()
  })

  it('trả null khi năm gốc ở tương lai', () => {
    expect(ageOnNext(make({ occasion_date: '2030-08-15' }), new Date(2026, 7, 12))).toBeNull()
  })
})

describe('occasionLabel', () => {
  it('ưu tiên tiêu đề tự đặt', () => {
    expect(occasionLabel(make({ title: 'Kỉ niệm quen nhau' }), 'Linh')).toBe('Kỉ niệm quen nhau')
  })

  it('sinh nhật không tiêu đề thì ghép tên người', () => {
    expect(occasionLabel(make(), 'Linh')).toBe('Sinh nhật Linh')
  })

  it('không gắn người thì dùng nhãn chung', () => {
    expect(occasionLabel(make({ person_id: null }), null)).toBe('Sinh nhật')
  })
})

describe('countdownLabel', () => {
  it('gọi tên hôm nay và ngày mai', () => {
    expect(countdownLabel(0)).toBe('Hôm nay')
    expect(countdownLabel(1)).toBe('Ngày mai')
    expect(countdownLabel(3)).toBe('Còn 3 ngày')
  })
})

describe('upcomingOccasions', () => {
  const list = [
    make({ id: 'far', occasion_date: '2001-10-20' }),
    make({ id: 'near', occasion_date: '2001-08-15' }),
    make({ id: 'outside', occasion_date: '2001-12-25' }),
  ]

  it('sắp xếp theo số ngày còn lại và cắt theo giới hạn', () => {
    const result = upcomingOccasions(list, people, new Date(2026, 7, 12), { withinDays: 90, limit: 2 })
    expect(result.map((r) => r.occasion.id)).toEqual(['near', 'far'])
    expect(result[0].days).toBe(3)
    expect(result[0].label).toBe('Sinh nhật Linh')
  })

  it('bỏ dịp nằm ngoài cửa sổ ngày', () => {
    const result = upcomingOccasions(list, people, new Date(2026, 7, 12), { withinDays: 10, limit: 5 })
    expect(result.map((r) => r.occasion.id)).toEqual(['near'])
  })
})
