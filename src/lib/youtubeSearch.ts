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

/**
 * Tìm kiếm video YouTube qua backend API /api/search-youtube
 */
export async function searchYouTubeVideos(query: string): Promise<YouTubeSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  try {
    const res = await apiFetch(`/api/search-youtube?q=${encodeURIComponent(trimmed)}`)
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`)
    }
    const data = await readJson(res, 'Không tìm được video YouTube')
    return (data.items || []) as YouTubeSearchResult[]
  } catch (err) {
    console.warn('Lỗi tìm kiếm video YouTube:', err)
    return []
  }
}
