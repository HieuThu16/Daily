import type { BookReadingSessionLog } from './bookReadingLog'
import type { MangaReadingLog } from './mangaReadingLog'
import type { VideoWatchLog } from './videoWatchLog'
import type { VideoProgress } from './videoProgress'

export type UsageSectionKey = 'youtube' | 'bl' | 'ngontinh' | 'truyenh' | 'books'

export type UsageItem = {
  /** Khoá gộp: id video hoặc slug truyện. */
  key: string
  title: string
  subtitle?: string
  minutes: number
  /** Số lượt xem / số chương / số trang đọc. */
  count: number
  /** Xem được bao nhiêu % (chỉ video). */
  percent?: number
  lastAt?: string
}

export type UsageSection = {
  key: UsageSectionKey
  label: string
  minutes: number
  items: UsageItem[]
}

export type UsageStats = {
  totalMinutes: number
  sections: UsageSection[]
}

const SECTION_LABEL: Record<UsageSectionKey, string> = {
  youtube: 'YouTube',
  bl: 'Truyện BL',
  ngontinh: 'Ngôn tình',
  truyenh: 'Truyện H',
  books: 'Sách',
}

/** "2 giờ 15 phút" — số phút trần trụi khó đọc. */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} phút`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`
}

/** Mốc ngày YYYY-MM-DD của "n ngày gần đây"; days <= 0 nghĩa là lấy tất cả. */
export function sinceDate(days: number, today = new Date()): string {
  if (days <= 0) return '0000-01-01'
  const d = new Date(today)
  d.setDate(d.getDate() - (days - 1))
  return d.toLocaleDateString('sv-SE')
}

function push(map: Map<string, UsageItem>, item: UsageItem) {
  const found = map.get(item.key)
  if (!found) {
    map.set(item.key, { ...item })
    return
  }
  found.minutes += item.minutes
  found.count += item.count
  if (item.lastAt && (!found.lastAt || item.lastAt > found.lastAt)) {
    found.lastAt = item.lastAt
    if (item.title) found.title = item.title
  }
}

function toSection(key: UsageSectionKey, map: Map<string, UsageItem>): UsageSection {
  const items = [...map.values()].sort((a, b) => b.minutes - a.minutes || b.count - a.count)
  return {
    key,
    label: SECTION_LABEL[key],
    minutes: items.reduce((sum, i) => sum + i.minutes, 0),
    items,
  }
}

const MANGA_SECTION: Record<MangaReadingLog['mangaType'], UsageSectionKey> = {
  BL: 'bl',
  NGONTINH: 'ngontinh',
  H_MANGA: 'truyenh',
}

/**
 * Gộp mọi nhật ký thành "ở mục nào, món nào, bao nhiêu phút".
 * Hàm thuần: truyền log vào, không tự đọc localStorage — để test được.
 */
export function buildUsageStats(input: {
  videoLogs: VideoWatchLog[]
  mangaLogs: MangaReadingLog[]
  bookLogs: BookReadingSessionLog[]
  videoProgress?: Record<string, VideoProgress>
  from?: string
}): UsageStats {
  const from = input.from ?? '0000-01-01'
  const inRange = (logDate: string | undefined) => !logDate || logDate >= from

  const maps: Record<UsageSectionKey, Map<string, UsageItem>> = {
    youtube: new Map(),
    bl: new Map(),
    ngontinh: new Map(),
    truyenh: new Map(),
    books: new Map(),
  }

  for (const log of input.videoLogs) {
    if (!inRange(log.log_date)) continue
    push(maps.youtube, {
      key: log.videoId,
      title: log.title || 'Video YouTube',
      subtitle: log.channelName,
      minutes: Number(log.durationMinutes) || 0,
      count: 1,
      lastAt: log.endTime || log.startTime,
    })
  }

  // Video đã xem nhưng chưa kịp ghi phiên nào thì vẫn phải hiện, chỉ là 0 phút.
  for (const p of Object.values(input.videoProgress ?? {})) {
    if (maps.youtube.has(p.videoId) || p.percent <= 0) continue
    push(maps.youtube, {
      key: p.videoId,
      title: p.title || 'Video YouTube',
      subtitle: p.channelName,
      minutes: 0,
      count: 1,
      lastAt: p.updatedAt,
    })
  }

  for (const item of maps.youtube.values()) {
    item.percent = input.videoProgress?.[item.key]?.percent
  }

  for (const log of input.mangaLogs) {
    if (!inRange(log.log_date)) continue
    const section = MANGA_SECTION[log.mangaType] ?? 'ngontinh'
    push(maps[section], {
      key: log.mangaSlug,
      title: log.mangaTitle || log.mangaSlug,
      subtitle: log.chapterName || `Chapter ${log.chapterNumber}`,
      minutes: Number(log.durationMinutes) || 0,
      count: 1,
      lastAt: log.readAt,
    })
  }

  for (const log of input.bookLogs) {
    if (!inRange(log.log_date)) continue
    push(maps.books, {
      key: log.mediaItemId || log.bookTitle,
      title: log.bookTitle || 'Sách',
      subtitle: log.bookAuthor ?? undefined,
      minutes: Number(log.durationMinutes) || 0,
      count: Number(log.pagesRead) || 0,
      lastAt: log.endTime,
    })
  }

  const sections = (['youtube', 'bl', 'ngontinh', 'truyenh', 'books'] as UsageSectionKey[])
    .map((key) => toSection(key, maps[key]))
    .filter((s) => s.items.length > 0)
    .sort((a, b) => b.minutes - a.minutes)

  return {
    totalMinutes: sections.reduce((sum, s) => sum + s.minutes, 0),
    sections,
  }
}
