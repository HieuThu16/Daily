import type { MangaReadingLog } from './mangaReadingLog'
import { reviewStreak } from './srs'

export type MangaStats = {
  totalChapters: number
  thisWeek: number
  streak: number
  topManga: Array<{ title: string; chapters: number }>
  byDay: Array<{ date: string; count: number }>
}

/** Một chương đọc lại nhiều lần trong ngày vẫn chỉ tính một, tránh thổi phồng số liệu. */
const chapterKey = (log: MangaReadingLog) => `${log.log_date}|${log.mangaSlug}|${log.chapterNumber}`

/** Tổng hợp nhật ký đọc truyện: số chương, chuỗi ngày đọc, truyện đọc nhiều nhất. */
export function summarizeMangaLogs(logs: MangaReadingLog[], today: string, days = 30): MangaStats {
  const unique = new Map<string, MangaReadingLog>()
  for (const log of logs) unique.set(chapterKey(log), log)
  const rows = [...unique.values()]

  const countByDate = new Map<string, number>()
  const countByManga = new Map<string, number>()
  for (const log of rows) {
    countByDate.set(log.log_date, (countByDate.get(log.log_date) ?? 0) + 1)
    countByManga.set(log.mangaTitle, (countByManga.get(log.mangaTitle) ?? 0) + 1)
  }

  const byDay: Array<{ date: string; count: number }> = []
  const [y, m, d] = today.split('-').map(Number)
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(y, (m ?? 1) - 1, (d ?? 1) - i)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    byDay.push({ date: key, count: countByDate.get(key) ?? 0 })
  }

  const weekStart = byDay.slice(-7).map((d) => d.date)

  return {
    totalChapters: rows.length,
    thisWeek: weekStart.reduce((sum, date) => sum + (countByDate.get(date) ?? 0), 0),
    streak: reviewStreak([...countByDate.keys()], today),
    topManga: [...countByManga.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, chapters]) => ({ title, chapters })),
    byDay,
  }
}
