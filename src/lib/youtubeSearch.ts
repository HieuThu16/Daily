import { apiFetch, readJson } from './apiFetch'
export type YouTubeSearchResult = {
  videoId: string
  title: string
  description: string
  channelTitle: string
  channelId?: string
  thumbnail: string
  publishedAt?: string
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
export async function searchYouTubePage(query: string, pageToken?: string | null): Promise<YouTubeSearchPage> {
  const trimmed = query.trim()
  if (!trimmed) return { items: [], nextPageToken: null }

  try {
    const url =
      `/api/search-youtube?q=${encodeURIComponent(trimmed)}` +
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
