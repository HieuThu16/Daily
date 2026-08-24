import { describe, expect, it } from 'vitest'
import { percentOf, progressLabel, statusOfPercent } from './videoProgress'

describe('videoProgress', () => {
  it('tính % theo thời lượng, không có thời lượng thì 0', () => {
    expect(percentOf(30, 60)).toBe(50)
    expect(percentOf(90, 60)).toBe(100)
    expect(percentOf(30, null)).toBe(0)
  })

  it('xem quá 90% coi như xem hết', () => {
    expect(statusOfPercent(0)).toBe('PLANNED')
    expect(statusOfPercent(45)).toBe('IN_PROGRESS')
    expect(statusOfPercent(90)).toBe('COMPLETED')
  })

  it('nhãn trạng thái đọc được cho người dùng', () => {
    expect(progressLabel({ percent: 100, status: 'COMPLETED' })).toBe('Đã xem hết')
    expect(progressLabel({ percent: 45, status: 'IN_PROGRESS' })).toBe('Đang xem 45%')
    expect(progressLabel({ percent: 0, status: 'PLANNED' })).toBe('Chưa xem')
  })
})
