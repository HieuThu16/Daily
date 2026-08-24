import { describe, expect, it } from 'vitest'
import { buildUsageStats, formatMinutes, sinceDate } from './usageStats'

const video = (over: Partial<any> = {}) => ({
  id: 'log1',
  videoId: 'vid1',
  title: 'Video A',
  channelName: 'Kênh A',
  type: 'youtube' as const,
  startTime: '2026-08-24T10:00:00.000Z',
  endTime: '2026-08-24T10:30:00.000Z',
  durationMinutes: 30,
  log_date: '2026-08-24',
  log_time: '10:00',
  ...over,
})

const manga = (over: Partial<any> = {}) => ({
  id: 'm1',
  mangaSlug: 'truyen-bl-abc',
  mangaTitle: 'Truyện BL ABC',
  mangaType: 'BL' as const,
  chapterNumber: 1,
  chapterName: 'Chapter 1',
  readAt: '2026-08-24T11:00:00.000Z',
  log_date: '2026-08-24',
  log_time: '11:00',
  durationMinutes: 12,
  ...over,
})

describe('usageStats', () => {
  it('gộp theo mục và theo từng video / từng truyện', () => {
    const stats = buildUsageStats({
      videoLogs: [video(), video({ id: 'log2', durationMinutes: 10 })],
      mangaLogs: [manga(), manga({ id: 'm2', chapterNumber: 2, durationMinutes: 8 })],
      bookLogs: [],
    })

    expect(stats.totalMinutes).toBe(60)
    const yt = stats.sections.find((s) => s.key === 'youtube')!
    expect(yt.minutes).toBe(40)
    expect(yt.items).toHaveLength(1)
    expect(yt.items[0]).toMatchObject({ title: 'Video A', minutes: 40, count: 2 })

    const bl = stats.sections.find((s) => s.key === 'bl')!
    expect(bl.items[0]).toMatchObject({ title: 'Truyện BL ABC', minutes: 20, count: 2 })
  })

  it('bỏ log cũ hơn mốc ngày, mục rỗng thì không hiện', () => {
    const stats = buildUsageStats({
      videoLogs: [video({ log_date: '2026-08-01' })],
      mangaLogs: [manga()],
      bookLogs: [],
      from: '2026-08-20',
    })
    expect(stats.sections.map((s) => s.key)).toEqual(['bl'])
  })

  it('video mới xem dở chưa có phiên vẫn hiện kèm %', () => {
    const stats = buildUsageStats({
      videoLogs: [],
      mangaLogs: [],
      bookLogs: [],
      videoProgress: {
        vid9: { videoId: 'vid9', title: 'Video B', seconds: 60, percent: 40, status: 'IN_PROGRESS' },
      },
    })
    expect(stats.sections[0].items[0]).toMatchObject({ title: 'Video B', minutes: 0, percent: 40 })
  })

  it('đọc được giờ phút và mốc ngày', () => {
    expect(formatMinutes(45)).toBe('45 phút')
    expect(formatMinutes(135)).toBe('2 giờ 15 phút')
    expect(formatMinutes(120)).toBe('2 giờ')
    expect(sinceDate(7, new Date('2026-08-24T00:00:00'))).toBe('2026-08-18')
    expect(sinceDate(0)).toBe('0000-01-01')
  })
})
