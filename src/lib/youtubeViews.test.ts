import { describe, expect, it } from 'vitest'
import { formatViews } from './youtubeSearch'

describe('formatViews', () => {
  it('rut gon cho de doc tren dien thoai', () => {
    expect(formatViews(1_200_000)).toBe('1.2 tr lượt xem')
    expect(formatViews(25_000_000)).toBe('25 tr lượt xem')
    expect(formatViews(45_000)).toBe('45N lượt xem')
    expect(formatViews(320)).toBe('320 lượt xem')
  })

  it('trieu tron thi bo duoi .0', () => {
    expect(formatViews(2_000_000)).toBe('2 tr lượt xem')
  })

  it('khong co so lieu thi tra chuoi rong, khong hien "0 luot xem"', () => {
    expect(formatViews(undefined)).toBe('')
    expect(formatViews(0)).toBe('')
  })
})
