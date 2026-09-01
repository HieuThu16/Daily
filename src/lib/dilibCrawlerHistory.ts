export type CrawlHistoryAction =
  | 'NEW_AUDIO'
  | 'NEW_PDF'
  | 'NEW_BOTH'
  | 'ADDED_AUDIO_TO_EXISTING_PDF'
  | 'ADDED_PDF_TO_EXISTING_AUDIO'
  | 'ALREADY_EXISTS'
  | 'SKIPPED'

export type CrawledBookHistoryItem = {
  id: string
  title: string
  author: string
  source: 'Dilib' | 'DTV eBook' | 'EbookNhanh' | 'SachHayMienPhi' | string
  cover?: string
  url?: string
  readbookUrl?: string | null
  pdfUrl?: string | null
  hasAudio: boolean
  hasPdf: boolean
  audioCount: number
  durationFormatted?: string
  addedAudio: boolean
  addedPdf: boolean
  action: CrawlHistoryAction
  actionLabel: string
  crawledAt: string // ISO timestamp string
}

export type CrawlTimePeriod = '1H' | '24H' | 'ALL'

export type CrawlTimeStats = {
  period: CrawlTimePeriod
  totalScanned: number
  totalAdded: number
  audioAdded: number
  pdfAdded: number
  totalAudioTracks: number
  dilibCount: number
  dtvCount: number
  smartIncrementalCount: number
  items: CrawledBookHistoryItem[]
}

const STORAGE_KEY = 'daily_dilib_crawler_history'
const MAX_HISTORY_ITEMS = 500

/** Tải toàn bộ danh sách lịch sử cào sách từ LocalStorage */
export function getCrawlHistory(): CrawledBookHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('[dilibCrawlerHistory] Lỗi đọc lịch sử:', err)
    return []
  }
}

/** Lưu lịch sử cào sách vào LocalStorage */
export function saveCrawlHistory(items: CrawledBookHistoryItem[]): void {
  try {
    const trimmed = items.slice(0, MAX_HISTORY_ITEMS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch (err) {
    console.warn('[dilibCrawlerHistory] Lỗi lưu lịch sử:', err)
  }
}

/** Thêm một mục lịch sử cào mới */
export function addCrawlHistoryItem(
  item: Omit<CrawledBookHistoryItem, 'id' | 'crawledAt'> & { crawledAt?: string; id?: string }
): CrawledBookHistoryItem {
  const list = getCrawlHistory()
  const nowIso = item.crawledAt || new Date().toISOString()
  const newId = item.id || `crawl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const newItem: CrawledBookHistoryItem = {
    ...item,
    id: newId,
    crawledAt: nowIso,
  }

  // Nếu đã có item cùng URL hoặc cùng tên trong 30 giây gần nhất -> cập nhật thay vì trùng lặp
  const existingIdx = list.findIndex(
    (i) => i.url === newItem.url && Math.abs(new Date(i.crawledAt).getTime() - new Date(nowIso).getTime()) < 30000
  )

  if (existingIdx >= 0) {
    list[existingIdx] = newItem
  } else {
    list.unshift(newItem)
  }

  saveCrawlHistory(list)
  return newItem
}

/** Thêm hàng loạt các mục lịch sử */
export function addCrawlHistoryBatch(
  items: Array<Omit<CrawledBookHistoryItem, 'id' | 'crawledAt'> & { crawledAt?: string; id?: string }>
): void {
  const current = getCrawlHistory()
  const now = Date.now()

  const newItems: CrawledBookHistoryItem[] = items.map((item, idx) => ({
    ...item,
    id: item.id || `crawl-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    crawledAt: item.crawledAt || new Date(now - idx * 100).toISOString(),
  }))

  const merged = [...newItems, ...current]
  saveCrawlHistory(merged)
}

/** Xóa toàn bộ lịch sử cào */
export function clearCrawlHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('[dilibCrawlerHistory] Lỗi xoá lịch sử:', err)
  }
}

/** Xóa một mục trong lịch sử cào */
export function deleteCrawlHistoryItem(id: string): void {
  const list = getCrawlHistory().filter((item) => item.id !== id)
  saveCrawlHistory(list)
}

/** Tính toán thống kê theo các khung thời gian: 1H (1 giờ qua), 24H (24 giờ qua), ALL (toàn bộ) */
export function getCrawlStats(period: CrawlTimePeriod = 'ALL'): CrawlTimeStats {
  const allItems = getCrawlHistory()
  const now = Date.now()
  const oneHourAgo = now - 60 * 60 * 1000
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

  const filteredItems = allItems.filter((item) => {
    const time = new Date(item.crawledAt).getTime()
    if (period === '1H') return time >= oneHourAgo
    if (period === '24H') return time >= twentyFourHoursAgo
    return true
  })

  let totalAdded = 0
  let audioAdded = 0
  let pdfAdded = 0
  let totalAudioTracks = 0
  let dilibCount = 0
  let dtvCount = 0
  let smartIncrementalCount = 0

  for (const item of filteredItems) {
    if (item.source === 'Dilib') dilibCount++
    else if (item.source === 'DTV eBook') dtvCount++

    if (item.addedAudio) {
      audioAdded++
      totalAudioTracks += item.audioCount || 0
    }
    if (item.addedPdf) {
      pdfAdded++
    }
    if (item.addedAudio || item.addedPdf) {
      totalAdded++
    }

    if (
      item.action === 'ADDED_AUDIO_TO_EXISTING_PDF' ||
      item.action === 'ADDED_PDF_TO_EXISTING_AUDIO'
    ) {
      smartIncrementalCount++
    }
  }

  return {
    period,
    totalScanned: filteredItems.length,
    totalAdded,
    audioAdded,
    pdfAdded,
    totalAudioTracks,
    dilibCount,
    dtvCount,
    smartIncrementalCount,
    items: filteredItems,
  }
}

/** Định dạng nhãn thời gian tương đối thân thiện (VD: "5 phút trước", "2 giờ trước", "Hôm qua 14:20") */
export function formatRelativeTime(isoString: string): string {
  const time = new Date(isoString).getTime()
  if (isNaN(time)) return ''
  const diffMs = Date.now() - time
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 45) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  if (diffHour < 24) return `${diffHour} giờ trước`
  if (diffDay === 1) {
    const d = new Date(isoString)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `Hôm qua ${hh}:${mm}`
  }
  const d = new Date(isoString)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month} ${hh}:${mm}`
}
