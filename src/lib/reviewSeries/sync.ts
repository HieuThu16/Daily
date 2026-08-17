/**
 * Đồng bộ một creator: tải video → gom series → chấm đủ/thiếu phần → ghi DB.
 *
 * Dùng chung cho cả CLI (`npm run crawl:reviews`) lẫn serverless function, nên
 * nhận sẵn supabase client thay vì tự dựng — mỗi nơi một loại key khác nhau.
 */

import { fetchCreatorVideos } from './youtube'
import { resolveSeries } from './seriesResolver'
import { evaluateCompletion } from './completion'

/** Supabase client; để lỏng kiểu vì CLI truyền client từ JS thuần. */
type Db = any

export type SyncCreator = { platform: string; creator_url: string }

export type SyncResult = { creatorId: string; creatorName: string; videoCount: number; seriesCount: number }

export type SyncOptions = {
  youtubeKey: string
  /**
   * Trần số trang mỗi playlist (50 video/trang). Serverless có giới hạn thời
   * gian chạy nên phải chặn; CLI để trống thì lấy hết.
   */
  maxPages?: number
  fetchImpl?: typeof fetch
  onProgress?: (line: string) => void
}

const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

/**
 * Bọc fetch để chặn phân trang sau `maxPages` trang: bỏ `nextPageToken` là vòng
 * lặp trong youtube.ts tự dừng, không phải sửa connector.
 */
export function cappedFetch(maxPages: number, base: typeof fetch = fetch): typeof fetch {
  const pagesOf = new Map<string, number>()
  return async (input, init) => {
    const res = await base(input, init)
    const url = new URL(typeof input === 'string' ? input : String(input))
    if (!url.pathname.endsWith('/playlistItems')) return res

    const key = url.searchParams.get('playlistId') ?? ''
    const seen = (pagesOf.get(key) ?? 0) + 1
    pagesOf.set(key, seen)
    if (seen < maxPages) return res

    const body = (await res.json()) as Record<string, unknown>
    delete body.nextPageToken
    return new Response(JSON.stringify(body), { status: res.status })
  }
}

export async function syncCreator(db: Db, creator: SyncCreator, options: SyncOptions): Promise<SyncResult> {
  const { youtubeKey, maxPages, fetchImpl = fetch, onProgress } = options
  if (creator.platform !== 'youtube') throw new Error(`Nền tảng chưa hỗ trợ: ${creator.platform}`)
  if (!youtubeKey) throw new Error('Thiếu YOUTUBE_API_KEY')

  const feed = await fetchCreatorVideos(
    creator.creator_url,
    youtubeKey,
    maxPages ? cappedFetch(maxPages, fetchImpl) : fetchImpl,
  )
  const series = resolveSeries(feed.videos)
  const countByPlaylist = new Map(feed.playlists.map((p) => [p.playlistId, p.itemCount]))
  const now = new Date()

  for (const s of series) {
    // Số item playlist là bằng chứng mạnh nhất; không có thì để null, không đoán.
    const playlistItemCount = s.playlistId ? countByPlaylist.get(s.playlistId) ?? null : null
    const completion = evaluateCompletion({ series: s, playlistItemCount, now })

    const { error: seriesError } = await db.from('review_series').upsert(
      {
        series_key: s.seriesId,
        platform: s.platform,
        creator_id: s.creatorId,
        creator_name: s.creatorName,
        playlist_id: s.playlistId,
        title: s.title,
        movie_id: s.movie.movieId,
        movie_title: s.movie.movieTitle,
        movie_confidence: s.movie.confidence,
        movie_evidence: s.movie.evidence,
        status: completion.status,
        expected_parts: completion.expected,
        found_parts: completion.found,
        missing_parts: completion.missingParts,
        confidence: completion.confidence,
        evidence: completion.evidence,
        updated_at: now.toISOString(),
      },
      { onConflict: 'series_key' },
    )
    if (seriesError) throw new Error(`review_series: ${seriesError.message}`)

    const rows = s.videos.map((v) => ({
      platform: v.platform,
      video_id: v.videoId,
      series_key: s.seriesId,
      creator_id: v.creatorId,
      creator_name: v.creatorName,
      title: v.title,
      description: v.description,
      canonical_url: v.canonicalUrl,
      embed_url: v.embedUrl,
      thumbnail: v.thumbnail,
      duration: v.duration,
      published_at: v.publishedAt,
      playlist_id: v.playlistId,
      playlist_name: v.playlistName,
      position: v.position,
      part_number: v.part.partNumber,
      total_parts: v.part.totalParts,
      is_final: v.part.isFinal,
      part_confidence: v.part.confidence,
      unavailable_at: null,
      last_seen_at: now.toISOString(),
    }))

    for (const batch of chunk(rows, 100)) {
      const { error } = await db.from('review_videos').upsert(batch, { onConflict: 'platform,video_id' })
      if (error) throw new Error(`review_videos: ${error.message}`)
    }

    const missing = completion.missingParts.length ? ` thiếu ${completion.missingParts.join(',')}` : ''
    onProgress?.(`  ${completion.status} ${completion.found}/${completion.expected ?? '?'}${missing} — ${s.title}`)
  }

  // Sync có giới hạn trang thì "không thấy" chỉ nghĩa là chưa tải tới — đánh dấu
  // mất tích lúc đó là sai, nên chỉ quét khi lấy đủ.
  if (!maxPages) {
    await markUnavailable(db, creator, feed.creatorId, feed.videos.map((v) => v.videoId), now, onProgress)
  }

  return {
    creatorId: feed.creatorId,
    creatorName: feed.creatorName,
    videoCount: feed.videos.length,
    seriesCount: series.length,
  }
}

/**
 * Video từng thấy nhưng lần này không còn (xoá / để riêng tư) thì đánh dấu chứ
 * không xoá bản ghi — series hụt phần phải nhìn thấy được, không được im lặng.
 */
async function markUnavailable(
  db: Db,
  creator: SyncCreator,
  creatorId: string,
  seenIds: string[],
  now: Date,
  onProgress?: (line: string) => void,
) {
  const { data, error } = await db
    .from('review_videos')
    .select('video_id')
    .eq('platform', creator.platform)
    .eq('creator_id', creatorId)
    .is('unavailable_at', null)
  if (error) throw new Error(`review_videos read: ${error.message}`)

  const seen = new Set(seenIds)
  const gone = ((data ?? []) as { video_id: string }[]).map((r) => r.video_id).filter((id) => !seen.has(id))
  if (gone.length === 0) return

  const { error: updateError } = await db
    .from('review_videos')
    .update({ unavailable_at: now.toISOString() })
    .eq('platform', creator.platform)
    .in('video_id', gone)
  if (updateError) throw new Error(`review_videos update: ${updateError.message}`)
  onProgress?.(`  ! ${gone.length} video không còn truy cập được`)
}
