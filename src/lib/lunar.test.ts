import { describe, expect, it } from 'vitest'
import { formatLunar, lunarMonthLength, lunarToSolar, solarToLunar } from './lunar'

describe('solarToLunar', () => {
  it('đổi mùng 1 Tết Bính Ngọ 2026 (17/02/2026)', () => {
    expect(solarToLunar(new Date(2026, 1, 17))).toEqual({ day: 1, month: 1, year: 2026, isLeap: false })
  })

  it('đổi mùng 1 Tết Ất Tỵ 2025 (29/01/2025)', () => {
    expect(solarToLunar(new Date(2025, 0, 29))).toEqual({ day: 1, month: 1, year: 2025, isLeap: false })
  })

  it('ngày cuối năm dương thuộc tháng chạp năm âm trước', () => {
    const lunar = solarToLunar(new Date(2025, 11, 31))
    expect(lunar.year).toBe(2025)
    expect(lunar.month).toBe(11)
  })
})

describe('lunarToSolar', () => {
  it('là phép ngược của solarToLunar', () => {
    for (const solar of [new Date(1998, 5, 12), new Date(2026, 7, 12), new Date(2031, 2, 3)]) {
      const lunar = solarToLunar(solar)
      const back = lunarToSolar(lunar.day, lunar.month, lunar.year, lunar.isLeap)
      expect(back.getTime()).toBe(solar.getTime())
    }
  })

  it('dựng lại mùng 1 Tết 2026', () => {
    expect(lunarToSolar(1, 1, 2026)).toEqual(new Date(2026, 1, 17))
  })
})

describe('tháng nhuận', () => {
  it('năm 2025 âm có tháng 6 nhuận', () => {
    const leap = solarToLunar(new Date(2025, 6, 25)) // 25/07/2025
    expect(leap.month).toBe(6)
    expect(leap.isLeap).toBe(true)
  })

  it('tháng thường và tháng nhuận cùng số ra hai ngày dương khác nhau', () => {
    const normal = lunarToSolar(1, 6, 2025, false)
    const leap = lunarToSolar(1, 6, 2025, true)
    expect(leap.getTime()).toBeGreaterThan(normal.getTime())
  })
})

describe('lunarMonthLength', () => {
  it('trả về 29 hoặc 30 ngày', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect([29, 30]).toContain(lunarMonthLength(month, 2026))
    }
  })
})

describe('formatLunar', () => {
  it('ghi kèm chữ nhuận khi cần', () => {
    expect(formatLunar({ day: 29, month: 6, year: 2026, isLeap: false })).toBe('29/6 âm')
    expect(formatLunar({ day: 1, month: 6, year: 2025, isLeap: true })).toBe('1/6 nhuận âm')
  })
})
