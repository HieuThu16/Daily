/**
 * GET /api/search-youtube?q=...&pageToken=...
 * POST /api/search-youtube { q: string, pageToken?: string }
 *
 * Tìm kiếm video YouTube qua YouTube Data API v3 chính thức,
 * có dự phòng qua Invidious khi không có API key.
 *
 * Trả về `nextPageToken` để lấy trang tiếp; hết kết quả thì không có trường đó.
 *
 * Ưu tiên tiếng Việt hai tầng: xin YouTube nghiêng về vi/VN, rồi tự xếp lại
 * theo dấu tiếng Việt trong tiêu đề và tên kênh (relevanceLanguage chỉ nghiêng
 * chứ không lọc — gõ "doraemon" vẫn ra kênh Nhật đứng đầu).
 *
 * QUOTA: mỗi lần gọi search tốn 100 đơn vị, hạn mức miễn phí 10.000/ngày —
 * tức khoảng 100 lượt tìm. Lấy 50 kết quả cũng tốn đúng 100 như lấy 25, nên
 * lấy tối đa để đỡ phải bấm "xem thêm".
 */
import { requireAuth } from './_auth.js'
import { rankVietnameseFirst } from '../src/lib/vietnameseRank.js'


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
  if (await requireAuth(req, res)) return

  const query = String(req.query?.q || req.body?.q || '').trim()
  if (!query) {
    return res.status(400).json({ error: 'Thiếu từ khoá tìm kiếm (q)' })
  }
  const pageToken = String(req.query?.pageToken || req.body?.pageToken || '').trim()

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY

  // 1. Thử gọi YouTube Data API v3 nếu có API key
  if (apiKey) {
    try {
      const url =
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50` +
        `&relevanceLanguage=vi&regionCode=VN` +
        `&q=${encodeURIComponent(query)}&key=${apiKey}` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
      const response = await fetch(url)
      if (response.ok) {
        const data = (await response.json()) as any
        const items: YouTubeSearchResultItem[] = (data.items || []).map((item: any) => ({
          videoId: item.id?.videoId || '',
          title: item.snippet?.title || '',
          description: item.snippet?.description || '',
          channelTitle: item.snippet?.channelTitle || '',
          channelId: item.snippet?.channelId || '',
          thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${item.id?.videoId}/hqdefault.jpg`,
          publishedAt: item.snippet?.publishedAt || '',
        })).filter((item: YouTubeSearchResultItem) => Boolean(item.videoId))

        return res.status(200).json({
          items: rankVietnameseFirst(items),
          source: 'youtube-api',
          nextPageToken: data.nextPageToken || null,
        })
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
      // Invidious phân trang bằng số trang, không phải token — quy ước token là số trang.
      const page = Number(pageToken) > 1 ? Number(pageToken) : 1
      const invUrl =
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=${page}` +
        `&region=VN`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const invRes = await fetch(invUrl, { signal: controller.signal })
      clearTimeout(timeout)

      if (invRes.ok) {
        const invData = await invRes.json()
        if (Array.isArray(invData) && invData.length > 0) {
          const items: YouTubeSearchResultItem[] = invData.slice(0, 50).map((item: any) => ({
            videoId: item.videoId || '',
            title: item.title || '',
            description: item.description || '',
            channelTitle: item.author || '',
            channelId: item.authorId || '',
            thumbnail: item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
            publishedAt: item.published ? new Date(item.published * 1000).toISOString() : undefined,
          })).filter((item: YouTubeSearchResultItem) => Boolean(item.videoId))

          // Còn đủ một trang thì đoán là còn nữa; Invidious không nói tổng số.
          return res.status(200).json({
            items: rankVietnameseFirst(items),
            source: 'invidious',
            nextPageToken: items.length >= 20 ? String(page + 1) : null,
          })
        }
      }
    } catch {
      // Thử instance tiếp theo
    }
  }

  return res.status(200).json({ items: [], source: 'none', nextPageToken: null })
}
