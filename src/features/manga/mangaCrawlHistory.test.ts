import { describe, expect, it, beforeEach } from 'vitest'
import {
  getMangaCrawlLog,
  recordMangaCrawlLog,
  getCrawlStats,
  sortAndFilterStoriesForCrawl,
} from './mangaCrawlHistory'

describe('mangaCrawlHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lưu và đọc lịch sử cào', () => {
    expect(getMangaCrawlLog('bl')).toEqual({})

    recordMangaCrawlLog({
      slug: 'truyen-bl-1',
      title: 'Truyện BL 1',
      category: 'bl',
      lastCrawledAt: new Date('2026-08-30T10:00:00Z').toISOString(),
      addedCount: 3,
      totalChapters: 25,
      status: 'updated',
    })

    const log = getMangaCrawlLog('bl')
    expect(log['truyen-bl-1']).toBeDefined()
    expect(log['truyen-bl-1'].addedCount).toBe(3)
    expect(log['truyen-bl-1'].status).toBe('updated')
  })

  it('ưu tiên truyện chưa từng cào hoặc cào lâu nhất, né truyện vừa cào gần đây', () => {
    const now = Date.now()
    const oneHourAgo = new Date(now - 1 * 3600 * 1000).toISOString()
    const twoDaysAgo = new Date(now - 48 * 3600 * 1000).toISOString()
    const tenDaysAgo = new Date(now - 240 * 3600 * 1000).toISOString()

    // Ghi nhận lịch sử cào
    recordMangaCrawlLog({
      slug: 'vua-cao-1h',
      title: 'Vừa cào 1h trước',
      category: 'h',
      lastCrawledAt: oneHourAgo,
      addedCount: 0,
      status: 'no_change',
    })

    recordMangaCrawlLog({
      slug: 'cao-2-ngay-truoc',
      title: 'Cào 2 ngày trước',
      category: 'h',
      lastCrawledAt: twoDaysAgo,
      addedCount: 0,
      status: 'no_change',
    })

    recordMangaCrawlLog({
      slug: 'cao-10-ngay-truoc',
      title: 'Cào 10 ngày trước',
      category: 'h',
      lastCrawledAt: tenDaysAgo,
      addedCount: 0,
      status: 'no_change',
    })

    const stories = [
      { slug: 'vua-cao-1h', title: 'Vừa cào 1h trước' },
      { slug: 'chua-tung-cao-1', title: 'Chưa từng cào 1' },
      { slug: 'cao-2-ngay-truoc', title: 'Cào 2 ngày trước' },
      { slug: 'chua-tung-cao-2', title: 'Chưa từng cào 2' },
      { slug: 'cao-10-ngay-truoc', title: 'Cào 10 ngày trước' },
    ]

    // Né trong vòng 6 giờ: 'vua-cao-1h' sẽ bị đưa xuống cuối queue
    const { priorityQueue, skippedRecentCount } = sortAndFilterStoriesForCrawl(
      stories,
      'h',
      { skipHours: 6 },
    )

    expect(skippedRecentCount).toBe(1)
    const slugsInOrder = priorityQueue.map((s) => s.slug)

    // Chưa từng cào phải ở đầu tiên
    expect(slugsInOrder.slice(0, 2)).toEqual(['chua-tung-cao-1', 'chua-tung-cao-2'])
    // Cào 10 ngày trước phải trước cào 2 ngày trước
    expect(slugsInOrder[2]).toBe('cao-10-ngay-truoc')
    expect(slugsInOrder[3]).toBe('cao-2-ngay-truoc')
    // Vừa cào 1h trước phải ở cuối cùng
    expect(slugsInOrder[4]).toBe('vua-cao-1h')
  })

  it('tính toán thống kê cào chính xác', () => {
    const now = Date.now()
    const twoHoursAgo = new Date(now - 2 * 3600 * 1000).toISOString()

    recordMangaCrawlLog({
      slug: 'truyen-1',
      title: 'Truyện 1',
      category: 'ngontinh',
      lastCrawledAt: twoHoursAgo,
      addedCount: 1,
      status: 'updated',
    })

    const stats = getCrawlStats('ngontinh', 10, 6)
    expect(stats.total).toBe(10)
    expect(stats.crawledRecently).toBe(1)
    expect(stats.priorityCount).toBe(9)
  })
})
