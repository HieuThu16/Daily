/**
 * Connector TikTok — dùng TikTok Display API v2 chính thức.
 *
 * Khác YouTube ở hai điểm quan trọng:
 *   1. Cần access token của chính chủ tài khoản (OAuth), không có key công khai.
 *   2. Không công bố playlist kèm số item đáng tin → thường không có bằng chứng
 *      mạnh cho completion. Đừng bịa `itemCount`, để rỗng và chấp nhận UNKNOWN.
 */

import type { NormalizedVideo, PlatformPlaylist } from './types.js'
import type { CreatorFeed } from './youtube'

const API = 'https://open.tiktokapis.com/v2'

type Fetch = typeof fetch

const VIDEO_FIELDS = [
  'id',
  'title',
  'video_description',
  'create_time',
  'duration',
  'cover_image_url',
  'share_url',
  'embed_link',
].join(',')

async function post(path: string, token: string, body: unknown, fetchImpl: Fetch): Promise<any> {
  const res = await fetchImpl(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`TikTok ${path} ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (data.error && data.error.code && data.error.code !== 'ok') {
    throw new Error(`TikTok ${path}: ${data.error.message}`)
  }
  return data
}

function normalize(item: any, creatorId: string, creatorName: string): NormalizedVideo {
  const videoId = String(item.id)
  return {
    platform: 'tiktok',
    creatorId,
    creatorName,
    videoId,
    canonicalUrl: item.share_url ?? `https://www.tiktok.com/@${creatorName}/video/${videoId}`,
    embedUrl: item.embed_link ?? `https://www.tiktok.com/embed/v2/${videoId}`,
    // Video TikTok thường không có title riêng, phần chữ nằm ở caption.
    title: item.title || item.video_description || '',
    description: item.video_description ?? '',
    publishedAt: new Date((item.create_time ?? 0) * 1000).toISOString(),
    duration: typeof item.duration === 'number' ? item.duration : null,
    thumbnail: item.cover_image_url ?? null,
    playlistId: null,
    playlistName: null,
    position: null,
    rawMetadata: item,
  }
}

/**
 * Lấy toàn bộ video của tài khoản đã cấp quyền.
 *
 * `playlists` luôn rỗng: Display API hiện không trả playlist kèm số item, mà
 * đoán tổng số phần từ chỗ khác thì không đủ tin để gọi là COMPLETE.
 */
export async function fetchCreatorVideos(accessToken: string, fetchImpl: Fetch = fetch): Promise<CreatorFeed> {
  const info = await post('/user/info/?fields=open_id,display_name', accessToken, {}, fetchImpl)
  const user = info.data?.user ?? {}
  const creatorId: string = user.open_id ?? 'unknown'
  const creatorName: string = user.display_name ?? ''

  const videos: NormalizedVideo[] = []
  let cursor: number | undefined
  let hasMore = true

  while (hasMore) {
    const page = await post(
      `/video/list/?fields=${VIDEO_FIELDS}`,
      accessToken,
      { max_count: 20, ...(cursor ? { cursor } : {}) },
      fetchImpl,
    )
    for (const item of page.data?.videos ?? []) videos.push(normalize(item, creatorId, creatorName))
    cursor = page.data?.cursor
    hasMore = Boolean(page.data?.has_more) && Boolean(cursor)
  }

  const playlists: PlatformPlaylist[] = []
  return { creatorId, creatorName, videos, playlists }
}
