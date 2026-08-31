import { describe, expect, it, vi, beforeEach } from 'vitest'
import { youtubeChannelCrawler } from './youtubeChannelCrawler'

describe('youtubeChannelCrawler', () => {
  beforeEach(() => {
    youtubeChannelCrawler.stop()
    youtubeChannelCrawler.clearReport()
    vi.clearAllMocks()
  })

  it('khởi tạo với trạng thái ban đầu chính xác', () => {
    const state = youtubeChannelCrawler.getState()
    expect(state.isRunning).toBe(false)
    expect(state.newVideosFound).toBe(0)
    expect(state.lastReport).toBeNull()
  })

  it('lắng nghe đăng ký subscription khi trạng thái thay đổi', () => {
    const listener = vi.fn()
    const unsubscribe = youtubeChannelCrawler.subscribe(listener)

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isRunning: false }))
    unsubscribe()
  })

  it('dừng tiến trình khi gọi stop()', () => {
    youtubeChannelCrawler.stop()
    const state = youtubeChannelCrawler.getState()
    expect(state.isRunning).toBe(false)
  })
})
