import type { MangaCategory } from './mangaChapterCrawler'

export const MANGA_CRAWL_LOG_KEY = 'daily_manga_crawl_log'

export interface MangaCrawlLogItem {
  slug: string
  title: string
  category: MangaCategory
  lastCrawledAt: string // ISO string
  addedCount: number
  totalChapters?: number
  status: 'updated' | 'no_change' | 'error'
}

export type CrawlLogMap = Record<string, MangaCrawlLogItem>

export function getMangaCrawlLog(category?: MangaCategory): CrawlLogMap {
  try {
    const raw = localStorage.getItem(MANGA_CRAWL_LOG_KEY)
    if (!raw) return {}
    const parsed: Record<string, CrawlLogMap> | CrawlLogMap = JSON.parse(raw)

    if (category) {
      if (parsed[category] && typeof parsed[category] === 'object') {
        return parsed[category] as CrawlLogMap
      }
      const filtered: CrawlLogMap = {}
      for (const [key, item] of Object.entries(parsed)) {
        if ((item as MangaCrawlLogItem)?.category === category) {
          filtered[key] = item as MangaCrawlLogItem
        }
      }
      return filtered
    }

    const merged: CrawlLogMap = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v === 'object') {
        if ('lastCrawledAt' in v) {
          merged[k] = v as MangaCrawlLogItem
        } else {
          Object.assign(merged, v)
        }
      }
    }
    return merged
  } catch {
    return {}
  }
}

export function recordMangaCrawlLog(item: MangaCrawlLogItem): void {
  try {
    const raw = localStorage.getItem(MANGA_CRAWL_LOG_KEY)
    const store: Record<string, CrawlLogMap> = raw ? JSON.parse(raw) : {}
    if (!store[item.category]) store[item.category] = {}
    store[item.category][item.slug] = item
    localStorage.setItem(MANGA_CRAWL_LOG_KEY, JSON.stringify(store))
    window.dispatchEvent(new CustomEvent('daily_manga_crawl_log_updated', { detail: item }))
  } catch (err) {
    console.error('Failed to record manga crawl log', err)
  }
}

export function getCrawlStats(
  category: MangaCategory,
  totalCount: number,
  skipHours = 6,
): { total: number; crawledRecently: number; priorityCount: number } {
  const log = getMangaCrawlLog(category)
  const now = Date.now()
  const thresholdMs = skipHours * 60 * 60 * 1000

  let crawledRecently = 0
  for (const item of Object.values(log)) {
    if (item.lastCrawledAt) {
      const diff = now - new Date(item.lastCrawledAt).getTime()
      if (diff >= 0 && diff < thresholdMs) {
        crawledRecently++
      }
    }
  }

  const priorityCount = Math.max(0, totalCount - (skipHours > 0 ? crawledRecently : 0))
  return {
    total: totalCount,
    crawledRecently,
    priorityCount,
  }
}

export function sortAndFilterStoriesForCrawl<T extends { slug: string; updatedAt?: string | null; title?: string }>(
  stories: T[],
  category: MangaCategory,
  options?: { skipHours?: number },
): { priorityQueue: T[]; skippedRecentCount: number } {
  const log = getMangaCrawlLog(category)
  const now = Date.now()
  const skipHours = options?.skipHours ?? 0
  const thresholdMs = skipHours * 60 * 60 * 1000

  const neverCrawled: T[] = []
  const olderCrawled: Array<{ story: T; lastCrawledMs: number }> = []
  const recentCrawled: T[] = []

  for (const story of stories) {
    const logItem = log[story.slug]
    const lastCrawledStr = logItem?.lastCrawledAt || story.updatedAt
    if (!lastCrawledStr) {
      neverCrawled.push(story)
      continue
    }

    const lastTime = new Date(lastCrawledStr).getTime()
    if (isNaN(lastTime)) {
      neverCrawled.push(story)
      continue
    }

    const diff = now - lastTime
    if (skipHours > 0 && diff >= 0 && diff < thresholdMs) {
      recentCrawled.push(story)
    } else {
      olderCrawled.push({ story, lastCrawledMs: lastTime })
    }
  }

  // Sắp xếp các truyện đã cào lâu nhất lên trước (lastCrawledMs nhỏ nhất trước)
  olderCrawled.sort((a, b) => a.lastCrawledMs - b.lastCrawledMs)

  // Thứ tự ưu tiên:
  // 1. Truyện chưa từng cào (neverCrawled)
  // 2. Truyện có lần cào cuối lâu nhất (olderCrawled)
  // 3. Các truyện vừa cào trong khoảng skipHours được xếp ở cuối cùng
  const priorityQueue = [
    ...neverCrawled,
    ...olderCrawled.map((item) => item.story),
    ...recentCrawled,
  ]

  return {
    priorityQueue,
    skippedRecentCount: recentCrawled.length,
  }
}
