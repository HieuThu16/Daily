import { describe, expect, it } from 'vitest'
import { summarizeMangaLogs } from './mangaStats'
import type { MangaReadingLog } from './mangaReadingLog'

const log = (over: Partial<MangaReadingLog>): MangaReadingLog => ({
  id: Math.random().toString(), mangaSlug: 'a', mangaTitle: 'Truyện A', mangaType: 'BL',
  chapterNumber: 1, chapterName: 'Chương 1', readAt: '', log_date: '2026-08-20', log_time: '10:00', ...over,
})

describe('summarizeMangaLogs', () => {
  it('đọc lại cùng chương trong ngày chỉ tính một lần', () => {
    const stats = summarizeMangaLogs([log({}), log({}), log({ chapterNumber: 2 })], '2026-08-20')
    expect(stats.totalChapters).toBe(2)
  })

  it('đếm chuỗi ngày đọc liên tiếp', () => {
    const stats = summarizeMangaLogs(
      [log({ log_date: '2026-08-20' }), log({ log_date: '2026-08-19' }), log({ log_date: '2026-08-17' })],
      '2026-08-20',
    )
    expect(stats.streak).toBe(2)
  })

  it('xếp hạng truyện đọc nhiều nhất', () => {
    const stats = summarizeMangaLogs(
      [
        log({ mangaSlug: 'a', mangaTitle: 'Truyện A', chapterNumber: 1 }),
        log({ mangaSlug: 'a', mangaTitle: 'Truyện A', chapterNumber: 2 }),
        log({ mangaSlug: 'b', mangaTitle: 'Truyện B', chapterNumber: 1 }),
      ],
      '2026-08-20',
    )
    expect(stats.topManga[0]).toEqual({ title: 'Truyện A', chapters: 2 })
  })

  it('tuần này chỉ tính bảy ngày gần nhất', () => {
    const stats = summarizeMangaLogs([log({ log_date: '2026-08-01' }), log({ log_date: '2026-08-20' })], '2026-08-20')
    expect(stats.thisWeek).toBe(1)
    expect(stats.byDay).toHaveLength(30)
  })
})
