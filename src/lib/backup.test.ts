import { describe, expect, it } from 'vitest'
import { backupReminder, daysSinceBackup } from './backup'

const at = (iso: string) => new Date(iso)

describe('nhắc sao lưu', () => {
  it('chưa từng sao lưu thì nhắc ngay, không đợi đủ 30 ngày', () => {
    expect(daysSinceBackup(null)).toBeNull()
    expect(backupReminder(null)).toContain('chưa từng sao lưu')
  })

  it('vừa sao lưu thì im lặng', () => {
    expect(backupReminder('2026-08-18T10:00:00Z', at('2026-08-20T10:00:00Z'))).toBeNull()
  })

  it('ngày thứ 29 vẫn im, sang ngày thứ 30 mới nhắc', () => {
    const last = '2026-07-21T10:00:00Z'
    expect(backupReminder(last, at('2026-08-19T09:00:00Z'))).toBeNull()
    expect(backupReminder(last, at('2026-08-20T10:00:00Z'))).toContain('30 ngày')
  })

  it('đồng hồ máy chạy lùi cũng không ra số ngày âm', () => {
    expect(daysSinceBackup('2026-08-20T10:00:00Z', at('2026-08-19T10:00:00Z'))).toBe(0)
  })
})
