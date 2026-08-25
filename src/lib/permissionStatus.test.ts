import { describe, expect, it } from 'vitest'
import { describeLocation, describeNotification } from './permissionStatus'

describe('describeNotification', () => {
  it('bat va da cap quyen -> xanh, gat duoc', () => {
    const s = describeNotification(true, 'granted')
    expect(s.tone).toBe('on')
    expect(s.actionable).toBe(true)
  })

  it('chua bat -> xam, van gat duoc', () => {
    const s = describeNotification(false, 'prompt')
    expect(s.tone).toBe('off')
    expect(s.actionable).toBe(true)
  })

  it('bi chan -> do, KHOA cong tac vi gat cung vo ich', () => {
    const s = describeNotification(true, 'denied')
    expect(s.tone).toBe('blocked')
    expect(s.actionable).toBe(false)
    expect(s.enabled).toBe(false)
    expect(s.label).toContain('chặn')
  })

  it('may khong ho tro -> khong gat duoc', () => {
    expect(describeNotification(true, 'unsupported').actionable).toBe(false)
  })
})

describe('describeLocation', () => {
  it('bat trong app nhung CHUA cap quyen thi khong phai mau xanh', () => {
    const s = describeLocation(true, 'prompt')
    expect(s.tone).toBe('off')
    expect(s.label).toContain('chưa cấp quyền')
  })

  it('bat va da cap quyen -> dang chia se', () => {
    expect(describeLocation(true, 'granted').tone).toBe('on')
  })

  it('tat thi noi ro nguoi kia khong thay', () => {
    const s = describeLocation(false, 'granted')
    expect(s.tone).toBe('off')
    expect(s.label).toContain('không thấy')
  })

  it('bi chan -> do va khoa', () => {
    const s = describeLocation(true, 'denied')
    expect(s.tone).toBe('blocked')
    expect(s.actionable).toBe(false)
  })
})
