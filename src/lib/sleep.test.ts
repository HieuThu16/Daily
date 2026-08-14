import { describe, expect, it } from 'vitest'
import { sleepDates, sleepDuration, sleepMinutesOn } from './sleep'

const overnight = { sleep_start: '19:00', sleep_end: '07:00', log_date: '2026-08-12' }
const sameDay = { sleep_start: '13:00', sleep_end: '14:30', log_date: '2026-08-12' }

describe('sleep qua nửa đêm', () => {
  it('giữ nguyên thời lượng cả phiên', () => {
    expect(sleepDuration(overnight)).toBe(12 * 60)
    expect(sleepDuration(sameDay)).toBe(90)
  })

  it('chia giờ cho hai ngày', () => {
    expect(sleepMinutesOn(overnight, '2026-08-12')).toBe(5 * 60)
    expect(sleepMinutesOn(overnight, '2026-08-13')).toBe(7 * 60)
    expect(sleepMinutesOn(overnight, '2026-08-14')).toBe(0)
    expect(sleepDates(overnight)).toEqual(['2026-08-12', '2026-08-13'])
  })

  it('giấc trong ngày chỉ tính cho ngày đó', () => {
    expect(sleepMinutesOn(sameDay, '2026-08-12')).toBe(90)
    expect(sleepMinutesOn(sameDay, '2026-08-13')).toBe(0)
    expect(sleepDates(sameDay)).toEqual(['2026-08-12'])
  })

  it('kết thúc đúng nửa đêm không lấn sang ngày sau', () => {
    const toMidnight = { sleep_start: '22:00', sleep_end: '00:00', log_date: '2026-08-12' }
    expect(sleepMinutesOn(toMidnight, '2026-08-12')).toBe(120)
    expect(sleepMinutesOn(toMidnight, '2026-08-13')).toBe(0)
  })

  it('vắt qua cuối tháng', () => {
    const monthEnd = { sleep_start: '23:00', sleep_end: '06:00', log_date: '2026-08-31' }
    expect(sleepMinutesOn(monthEnd, '2026-09-01')).toBe(6 * 60)
  })
})
