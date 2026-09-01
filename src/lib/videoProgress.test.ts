import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1', email: 'test@example.com' } } })),
    },
    from: () => ({
      upsert: vi.fn(async () => ({ error: null })),
      delete: () => ({
        eq: () => ({
          eq: vi.fn(async () => ({ error: null })),
        }),
      }),
    }),
  },
}))

import {
  getLocalProgress,
  saveVideoProgress,
  statusOfPercent,
  percentOf,
  COMPLETE_AT_PERCENT,
} from './videoProgress'
import { getStoredVideoStatuses } from './videoStatus'

describe('videoProgress logic', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('percentOf và statusOfPercent tính toán chính xác', () => {
    expect(percentOf(50, 100)).toBe(50)
    expect(percentOf(95, 100)).toBe(95)
    expect(statusOfPercent(50)).toBe('IN_PROGRESS')
    expect(statusOfPercent(90)).toBe('COMPLETED')
    expect(statusOfPercent(COMPLETE_AT_PERCENT)).toBe('COMPLETED')
    expect(statusOfPercent(0)).toBe('PLANNED')
  })

  it('saveVideoProgress lưu IN_PROGRESS và cập nhật videoStatus', async () => {
    const res = await saveVideoProgress({
      videoId: 'vid_123',
      seconds: 30,
      durationSeconds: 100,
      title: 'Video Demo',
      channelName: 'Kênh Test',
    })

    expect(res.percent).toBe(30)
    expect(res.status).toBe('IN_PROGRESS')

    const local = getLocalProgress()
    expect(local['vid_123']).toBeDefined()
    expect(local['vid_123'].percent).toBe(30)

    const statuses = getStoredVideoStatuses()
    expect(statuses['tvshow:vid_123']?.status).toBe('IN_PROGRESS')
  })

  it('saveVideoProgress khi xem hết (>= 90% hoặc sát kết thúc) đánh dấu COMPLETED', async () => {
    const res = await saveVideoProgress({
      videoId: 'vid_done',
      seconds: 98,
      durationSeconds: 100,
      title: 'Video Xem Xong',
      channelName: 'Kênh Test',
    })

    expect(res.percent).toBe(100)
    expect(res.status).toBe('COMPLETED')

    const statuses = getStoredVideoStatuses()
    expect(statuses['tvshow:vid_done']?.status).toBe('COMPLETED')
  })
})
