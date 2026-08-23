/**
 * GET /api/search-youtube?q=...
 * POST /api/search-youtube { q: string }
 *
 * Tìm kiếm video YouTube qua YouTube Data API v3 chính thức,
 * có dự phòng qua Invidious / oEmbed khi không có API key.
 */

export const config = { maxDuration: 30 }

export type YouTubeSearchResultItem = {
  videoId: string
  title: string
  description: string
  channelTitle: string
  channelId?: string
  thumbnail: string
  publishedAt?: string
}

export default async function handler(req: any, res: any) {
  const query = String(req.query?.q || req.body?.q || '').trim()
  if (!query) {
    return res.status(400).json({ error: 'Thiếu từ khoá tìm kiếm (q)' })
  }

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY

  // 1. Thử gọi YouTube Data API v3 nếu có API key
  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&q=${encodeURIComponent(query)}&key=${apiKey}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        const items: YouTubeSearchResultItem[] = (data.items || []).map((item: any) => ({
          videoId: item.id?.videoId || '',
          title: item.snippet?.title || '',
          description: item.snippet?.description || '',
          channelTitle: item.snippet?.channelTitle || '',
          channelId: item.snippet?.channelId || '',
          thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${item.id?.videoId}/hqdefault.jpg`,
          publishedAt: item.snippet?.publishedAt || '',
        })).filter((item: YouTubeSearchResultItem) => Boolean(item.videoId))

        return res.status(200).json({ items, source: 'youtube-api' })
      }
    } catch (err: any) {
      console.warn('Lỗi gọi YouTube v3 API, chuyển sang phương án dự phòng:', err.message)
    }
  }

  // 2. Dự phòng: Tìm kiếm qua Invidious public instance
  const invidiousInstances = [
    'https://vid.puffyan.us',
    'https://invidious.nerdvpn.de',
    'https://yewtu.be',
    'https://invidious.drgns.space',
  ]

  for (const instance of invidiousInstances) {
    try {
      const invUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const invRes = await fetch(invUrl, { signal: controller.signal })
      clearTimeout(timeout)

      if (invRes.ok) {
        const invData = await invRes.json()
        if (Array.isArray(invData) && invData.length > 0) {
          const items: YouTubeSearchResultItem[] = invData.slice(0, 25).map((item: any) => ({
            videoId: item.videoId || '',
            title: item.title || '',
            description: item.description || '',
            channelTitle: item.author || '',
            channelId: item.authorId || '',
            thumbnail: item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
            publishedAt: item.published ? new Date(item.published * 1000).toISOString() : undefined,
          })).filter((item: YouTubeSearchResultItem) => Boolean(item.videoId))

          return res.status(200).json({ items, source: 'invidious' })
        }
      }
    } catch {
      // Thử instance tiếp theo
    }
  }

  return res.status(200).json({ items: [], source: 'none' })
}
