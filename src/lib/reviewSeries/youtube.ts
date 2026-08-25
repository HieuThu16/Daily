/**
 * Connector YouTube — dùng YouTube Data API v3 chính thức.
 *
 * Chỉ lấy metadata: id, url, embed url, tiêu đề, playlist. Không tải video.
 * Cần API key (biến môi trường YOUTUBE_API_KEY).
 */

import type { NormalizedVideo, PlatformPlaylist } from './types.js'

const API = 'https://www.googleapis.com/youtube/v3'

export type CreatorFeed = {
  creatorId: string
  creatorName: string
  videos: NormalizedVideo[]
  playlists: PlatformPlaylist[]
}

type Fetch = typeof fetch

async function api(path: string, params: Record<string, string>, key: string, fetchImpl: Fetch): Promise<any> {
  const url = new URL(`${API}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', key)
  const res = await fetchImpl(url.toString())
  if (!res.ok) throw new Error(`YouTube ${path} ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Lấy channelId từ mọi dạng link kênh: /channel/UC…, /@handle, /c/name. */
export async function resolveChannelId(creatorUrl: string, key: string, fetchImpl: Fetch = fetch): Promise<string> {
  const path = new URL(creatorUrl).pathname.replace(/\/+$/, '')

  const direct = path.match(/^\/channel\/(UC[\w-]+)/)
  if (direct) return direct[1]

  const handle = path.match(/^\/@([^/]+)/)?.[1]
  if (handle) {
    const data = await api('channels', { part: 'id', forHandle: `@${handle}` }, key, fetchImpl)
    const id = data.items?.[0]?.id
    if (id) return id
  }

  // /c/name và /user/name không có endpoint tra cứu — phải qua search.
  const name = path.match(/^\/(?:c|user)\/([^/]+)/)?.[1] ?? handle
  if (name) {
    const data = await api('search', { part: 'snippet', type: 'channel', q: name, maxResults: '1' }, key, fetchImpl)
    const id = data.items?.[0]?.snippet?.channelId
    if (id) return id
  }

  throw new Error(`Không nhận ra kênh YouTube từ: ${creatorUrl}`)
}

/** Duyệt hết các trang của một endpoint list. */
async function paginate(path: string, params: Record<string, string>, key: string, fetchImpl: Fetch): Promise<any[]> {
  const items: any[] = []
  let pageToken: string | undefined
  do {
    const page = await api(path, { ...params, maxResults: '50', ...(pageToken ? { pageToken } : {}) }, key, fetchImpl)
    items.push(...(page.items ?? []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return items
}

/** ISO 8601 duration ("PT1H2M3S") → giây. */
export function parseDuration(value: string | undefined): number | null {
  const m = value?.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return null
  const [, d, h, min, s] = m
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
}

/**
 * Video riêng tư / đã xoá vẫn nằm trong playlistItems, nhưng YouTube thay tiêu
 * đề bằng đúng mấy chữ này. Giữ lại thì vừa không xem được, vừa phá việc gom
 * nhóm: cả trăm mục cùng tên "Private video" trông như một phim trăm phần.
 */
const PLACEHOLDER_TITLES = new Set(['private video', 'deleted video'])

export function isPlaceholderItem(item: any): boolean {
  const title = String(item?.snippet?.title ?? '').trim().toLowerCase()
  return PLACEHOLDER_TITLES.has(title)
}

function normalize(item: any, playlist: PlatformPlaylist | null, channelId: string, channelName: string): NormalizedVideo {
  const snippet = item.snippet ?? {}
  const videoId: string = snippet.resourceId?.videoId ?? item.contentDetails?.videoId ?? item.id?.videoId ?? item.id
  return {
    platform: 'youtube',
    creatorId: channelId,
    creatorName: snippet.videoOwnerChannelTitle ?? channelName,
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    title: snippet.title ?? '',
    description: snippet.description ?? '',
    publishedAt: item.contentDetails?.videoPublishedAt ?? snippet.publishedAt ?? new Date(0).toISOString(),
    duration: parseDuration(item.contentDetails?.duration),
    thumbnail: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? null,
    playlistId: playlist?.playlistId ?? null,
    playlistName: playlist?.name ?? null,
    position: typeof snippet.position === 'number' ? snippet.position : null,
    rawMetadata: item,
  }
}

/** Thông tin kênh + id playlist "uploads" chứa mọi video đã đăng. */
export async function fetchChannelInfo(
  creatorUrl: string,
  key: string,
  fetchImpl: Fetch = fetch,
): Promise<{ channelId: string; channelName: string; uploadsId: string }> {
  const channelId = await resolveChannelId(creatorUrl, key, fetchImpl)
  const channel = await api('channels', { part: 'snippet,contentDetails', id: channelId }, key, fetchImpl)
  const info = channel.items?.[0]
  if (!info) throw new Error(`Không đọc được kênh ${channelId}`)
  return {
    channelId,
    channelName: info.snippet?.title ?? '',
    uploadsId: info.contentDetails?.relatedPlaylists?.uploads,
  }
}

/** Danh sách playlist của kênh (không kèm video). */
export async function fetchPlaylists(
  channelId: string,
  key: string,
  fetchImpl: Fetch = fetch,
): Promise<PlatformPlaylist[]> {
  const raw = await paginate('playlists', { part: 'snippet,contentDetails', channelId }, key, fetchImpl)
  return raw.map((p) => ({
    platform: 'youtube' as const,
    playlistId: p.id,
    name: p.snippet?.title ?? '',
    itemCount: typeof p.contentDetails?.itemCount === 'number' ? p.contentDetails.itemCount : null,
  }))
}

/**
 * Đúng MỘT trang playlistItems (tối đa 50 video).
 *
 * Đây là đơn vị công việc nhỏ nhất để sync có thể tạm dừng: mỗi trang tải xong
 * là ghi được ngay, dừng giữa chừng không mất gì.
 */
export async function fetchPlaylistPage(
  args: {
    playlistId: string
    channelId: string
    channelName: string
    playlist?: PlatformPlaylist | null
    pageToken?: string
  },
  key: string,
  fetchImpl: Fetch = fetch,
): Promise<{ videos: NormalizedVideo[]; nextPageToken?: string; skipped: number }> {
  const page = await api(
    'playlistItems',
    {
      part: 'snippet,contentDetails',
      playlistId: args.playlistId,
      maxResults: '50',
      ...(args.pageToken ? { pageToken: args.pageToken } : {}),
    },
    key,
    fetchImpl,
  )

  const videos: NormalizedVideo[] = []
  let skipped = 0
  for (const item of page.items ?? []) {
    if (isPlaceholderItem(item)) {
      skipped++
      continue
    }
    const v = normalize(item, args.playlist ?? null, args.channelId, args.channelName)
    if (v.videoId) videos.push(v)
  }

  return { videos, nextPageToken: page.nextPageToken, skipped }
}

/**
 * Lấy toàn bộ video của kênh kèm thông tin playlist.
 *
 * Bản ghi từ playlist ghi đè bản ghi từ uploads, vì playlist là bằng chứng
 * mạnh nhất để gom series.
 */
export async function fetchCreatorVideos(
  creatorUrl: string,
  key: string,
  fetchImpl: Fetch = fetch,
): Promise<CreatorFeed> {
  const channelId = await resolveChannelId(creatorUrl, key, fetchImpl)
  const channel = await api('channels', { part: 'snippet,contentDetails', id: channelId }, key, fetchImpl)
  const info = channel.items?.[0]
  if (!info) throw new Error(`Không đọc được kênh ${channelId}`)

  const channelName: string = info.snippet?.title ?? ''
  const uploadsId: string = info.contentDetails?.relatedPlaylists?.uploads
  const byId = new Map<string, NormalizedVideo>()

  const uploads = await paginate('playlistItems', { part: 'snippet,contentDetails', playlistId: uploadsId }, key, fetchImpl)
  for (const item of uploads) {
    if (isPlaceholderItem(item)) continue
    const v = normalize(item, null, channelId, channelName)
    if (v.videoId) byId.set(v.videoId, v)
  }

  const rawPlaylists = await paginate('playlists', { part: 'snippet,contentDetails', channelId }, key, fetchImpl)
  const playlists: PlatformPlaylist[] = rawPlaylists.map((p) => ({
    platform: 'youtube' as const,
    playlistId: p.id,
    name: p.snippet?.title ?? '',
    itemCount: typeof p.contentDetails?.itemCount === 'number' ? p.contentDetails.itemCount : null,
  }))

  for (const playlist of playlists) {
    const items = await paginate(
      'playlistItems',
      { part: 'snippet,contentDetails', playlistId: playlist.playlistId },
      key,
      fetchImpl,
    )
    let dropped = 0
    for (const item of items) {
      if (isPlaceholderItem(item)) {
        dropped++
        continue
      }
      const v = normalize(item, playlist, channelId, channelName)
      if (v.videoId) byId.set(v.videoId, v)
    }

    // itemCount của YouTube tính cả video riêng tư. Đã bỏ chúng khỏi feed thì
    // phải trừ đi, nếu không series nào cũng "thiếu" đúng bằng số video đã ẩn.
    if (dropped > 0 && playlist.itemCount !== null) {
      playlist.itemCount = Math.max(0, playlist.itemCount - dropped)
    }
  }

  return { creatorId: channelId, creatorName: channelName, videos: [...byId.values()], playlists }
}
