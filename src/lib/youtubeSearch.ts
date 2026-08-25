import { apiFetch, readJson } from './apiFetch'
export type YouTubeSearchResult = {
  videoId: string
  title: string
  description: string
  channelTitle: string
  channelId?: string
  thumbnail: string
  publishedAt?: string
  /** Lượt xem; có thể thiếu nếu không lấy được thống kê. */
  viewCount?: number
  /** Độ dài (giây). */
  duration?: number
}

/** Thứ tự sắp xếp kết quả tìm kiếm. */
export type SearchOrder = 'relevance' | 'viewCount' | 'date'

/** '1,2 tr lượt xem' — số đầy đủ dài quá, đọc trên điện thoại rất mệt. */
export function formatViews(views?: number): string {
  if (!views || views <= 0) return ''
  if (views >= 1_000_000) {
    const m = views / 1_000_000
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')} tr lượt xem`
  }
  if (views >= 1_000) return `${Math.round(views / 1000)}N lượt xem`
  return `${views} lượt xem`
}

export type YouTubeSearchPage = {
  items: YouTubeSearchResult[]
  /** Đưa lại vào lần gọi sau để lấy trang tiếp; null là hết kết quả. */
  nextPageToken: string | null
}

/**
 * Tìm kiếm video YouTube qua backend API /api/search-youtube.
 *
 * Mỗi trang tối đa 50 kết quả. Truyền `pageToken` của lần trước để lấy tiếp —
 * mỗi lần gọi tốn 100 đơn vị quota YouTube (hạn mức ~100 lượt/ngày), nên đừng
 * gọi vòng lặp tự động, để người dùng chủ động bấm "xem thêm".
 */
export async function searchYouTubePage(
  query: string,
  pageToken?: string | null,
  order: SearchOrder = 'relevance',
): Promise<YouTubeSearchPage> {
  const trimmed = query.trim()
  if (!trimmed) return { items: [], nextPageToken: null }

  try {
    const url =
      `/api/search-youtube?q=${encodeURIComponent(trimmed)}&order=${order}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await apiFetch(url)
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`)
    }
    const data = await readJson(res, 'Không tìm được video YouTube')
    return {
      items: (data.items || []) as YouTubeSearchResult[],
      nextPageToken: (data.nextPageToken as string | null) ?? null,
    }
  } catch (err) {
    console.warn('Lỗi tìm kiếm video YouTube:', err)
    return { items: [], nextPageToken: null }
  }
}

/** Chỉ cần trang đầu — giữ cho các chỗ gọi cũ khỏi phải sửa. */
export async function searchYouTubeVideos(query: string): Promise<YouTubeSearchResult[]> {
  return (await searchYouTubePage(query)).items
}

/** Bỏ video trùng khi nối trang mới vào danh sách đang có. */
export function mergeSearchPages(
  current: YouTubeSearchResult[],
  incoming: YouTubeSearchResult[],
): YouTubeSearchResult[] {
  const seen = new Set(current.map((v) => v.videoId))
  return [...current, ...incoming.filter((v) => v.videoId && !seen.has(v.videoId))]
}
