/**
 * `book_reading_logs.page` là *trang đã đọc tới* của một cuốn trong ngày đó,
 * nên số trang đọc trong ngày = trang hôm nay − trang lần ghi gần nhất trước đó.
 */
type ReadingLog = { media_item_id: string; log_date: string; page?: number | null; listen_hours?: number; listen_minutes?: number }

/** Số trang đọc được mỗi ngày. Truyền TOÀN BỘ log để ngày đầu khoảng vẫn trừ đúng mốc trước đó. */
export function pagesReadByDate(logs: ReadingLog[], days: string[]) {
  const byDate = Object.fromEntries(days.map((day) => [day, 0])) as Record<string, number>
  const byBook = new Map<string, ReadingLog[]>()
  logs.forEach((log) => {
    if (log.page == null) return
    byBook.set(log.media_item_id, [...(byBook.get(log.media_item_id) ?? []), log])
  })

  byBook.forEach((bookLogs) => {
    const sorted = [...bookLogs].sort((a, b) => a.log_date.localeCompare(b.log_date))
    let previousPage = 0
    sorted.forEach((log) => {
      const page = log.page ?? 0
      const delta = Math.max(0, page - previousPage)
      previousPage = Math.max(previousPage, page)
      if (log.log_date in byDate) byDate[log.log_date] += delta
    })
  })

  return byDate
}

/** Số phút nghe sách nói mỗi ngày (cộng thẳng, không phải mốc luỹ kế). */
export function listenMinutesByDate(logs: ReadingLog[], days: string[]) {
  const byDate = Object.fromEntries(days.map((day) => [day, 0])) as Record<string, number>
  logs.forEach((log) => {
    if (log.log_date in byDate) byDate[log.log_date] += (log.listen_hours ?? 0) * 60 + (log.listen_minutes ?? 0)
  })
  return byDate
}

export function summarizePages(byDate: Record<string, number>) {
  const values = Object.values(byDate)
  const total = values.reduce((sum, value) => sum + value, 0)
  const activeDays = values.filter((value) => value > 0).length
  return {
    total,
    activeDays,
    averagePerActiveDay: activeDays ? Math.round(total / activeDays) : 0,
    best: values.length ? Math.max(...values) : 0,
  }
}
