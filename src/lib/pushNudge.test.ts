import { describe, expect, it } from 'vitest'
import { isWithinCooldown } from './pushNudge'

const NOW = new Date('2026-08-25T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

describe('isWithinCooldown', () => {
  it('chua nhac bao gio thi nhac duoc ngay', () => {
    expect(isWithinCooldown(null, NOW)).toBe(false)
    expect(isWithinCooldown(undefined, NOW)).toBe(false)
  })

  it('vua nhac xong thi chua duoc nhac lai', () => {
    expect(isWithinCooldown(hoursAgo(1), NOW)).toBe(true)
    expect(isWithinCooldown(hoursAgo(11), NOW)).toBe(true)
  })

  it('qua 12 tieng thi nhac lai duoc', () => {
    expect(isWithinCooldown(hoursAgo(13), NOW)).toBe(false)
    expect(isWithinCooldown(hoursAgo(48), NOW)).toBe(false)
  })

  it('ngay hong thi coi nhu chua nhac, khong chan nham', () => {
    expect(isWithinCooldown('khong-phai-ngay', NOW)).toBe(false)
  })
})
