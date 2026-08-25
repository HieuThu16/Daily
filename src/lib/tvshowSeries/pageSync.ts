/**
 * Sync theo từng trang cho tab TV Show / Kênh YouTube, để web có thanh tiến độ và nút tạm dừng.
 * Ghi trực tiếp vào tvshow_videos, tvshow_series, tvshow_creators, tvshow_sync_runs.
 */

// Đuôi .js là bắt buộc: file này chạy cả trong hàm serverless Node ESM.
import { fetchChannelInfo, fetchPlaylistPage, fetchPlaylists } from '../reviewSeries/youtube.js'
import { resolveSeries } from '../reviewSeries/seriesResolver.js'
import { evaluateCompletion } from '../reviewSeries/completion.js'
import type { NormalizedVideo, PlatformPlaylist } from '../reviewSeries/types.js'

type Db = any

export type PlanEntry = {
  playlistId: string
  name: string
  itemCount: number | null
  isUploads: boolean
}

export type SyncPlan = {
  creatorUrl: string
  channelId: string
  channelName: string
  entries: PlanEntry[]
  totalPages: number
}

export type PageCursor = { entryIndex: number; pageToken?: string }

export type PageOutcome = {
  saved: number
  known: number
  skippedPlaceholders: number
  nextPageToken?: string
  allKnown: boolean
  videos?: Array<NormalizedVideo & { isKnown?: boolean }>
}

const pagesOf = (itemCount: number | null) => (itemCount === null ? 1 : Math.max(1, Math.ceil(itemCount / 50)))

/** Dựng kế hoạch duyệt: uploads trước (mới nhất trước), rồi tới từng playlist. */
export async function startSync(creatorUrl: string, key: string, fetchImpl: typeof fetch = fetch): Promise<SyncPlan> {
  const { channelId, channelName, uploadsId } = await fetchChannelInfo(creatorUrl, key, fetchImpl)
  const playlists = await fetchPlaylists(channelId, key, fetchImpl)

  const entries: PlanEntry[] = [
    { playlistId: uploadsId, name: 'Video đã đăng', itemCount: null, isUploads: true },
    ...playlists.map((p) => ({ playlistId: p.playlistId, name: p.name, itemCount: p.itemCount, isUploads: false })),
  ]

  return {
    creatorUrl,
    channelId,
    channelName,
    entries,
    totalPages: entries.reduce((sum, e) => sum + pagesOf(e.itemCount), 0),
  }
}

/**
 * Xử lý đúng một trang cho TV Show: tải → bỏ video đã có → ghi video mới → đếm lại series.
 */
export async function syncOnePage(
  db: Db,
  plan: SyncPlan,
  cursor: PageCursor,
  key: string,
  fetchImpl: typeof fetch = fetch,
  options?: { dryRun?: boolean },
): Promise<PageOutcome> {
  const entry = plan.entries[cursor.entryIndex]
  if (!entry) throw new Error(`Không có mục thứ ${cursor.entryIndex} trong kế hoạch`)

  const playlist: PlatformPlaylist | null = entry.isUploads
    ? null
    : { platform: 'youtube', playlistId: entry.playlistId, name: entry.name, itemCount: entry.itemCount }

  const { videos, nextPageToken, skipped } = await fetchPlaylistPage(
    {
      playlistId: entry.playlistId,
      channelId: plan.channelId,
      channelName: plan.channelName,
      playlist,
      pageToken: cursor.pageToken,
    },
    key,
    fetchImpl,
  )

  if (videos.length === 0) {
    return { saved: 0, known: 0, skippedPlaceholders: skipped, nextPageToken, allKnown: true, videos: [] }
  }

  // Video đã có sẵn trong tvshow_videos thì không ghi lại
  const ids = videos.map((v) => v.videoId)
  const { data: existing } = await db
    .from('tvshow_videos')
    .select('video_id')
    .eq('platform', 'youtube')
    .in('video_id', ids)
  const known = new Set(((existing ?? []) as { video_id: string }[]).map((r) => r.video_id))

  const fresh = videos.filter((v) => !known.has(v.videoId))
  if (!options?.dryRun && fresh.length > 0) {
    await writeVideos(db, fresh, entry, plan)
  }

  const enrichedVideos = videos.map((v) => ({
    ...v,
    isKnown: known.has(v.videoId),
  }))

  return {
    saved: options?.dryRun ? 0 : fresh.length,
    known: known.size,
    skippedPlaceholders: skipped,
    nextPageToken,
    allKnown: fresh.length === 0,
    videos: enrichedVideos,
  }
}

/** Ghi video mới vào tvshow_series và tvshow_videos */
export async function writeVideos(db: Db, fresh: NormalizedVideo[], entry: PlanEntry, plan: SyncPlan) {
  const now = new Date().toISOString()
  const series = resolveSeries(fresh)

  for (const s of series) {
    const completion = evaluateCompletion({ series: s, playlistItemCount: entry.isUploads ? null : entry.itemCount })
    const { error } = await db.from('tvshow_series').upsert(
      {
        series_key: s.seriesId,
        platform: s.platform,
        creator_id: s.creatorId,
        creator_name: s.creatorName || plan.channelName,
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
        updated_at: now,
      },
      { onConflict: 'series_key' },
    )
    if (error) throw new Error(`tvshow_series: ${error.message}`)
  }

  const rows = series.flatMap((s) =>
    s.videos.map((v) => ({
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
      last_seen_at: now,
    })),
  )

  const { error: videoError } = await db.from('tvshow_videos').upsert(rows, { onConflict: 'platform,video_id' })
  if (videoError) throw new Error(`tvshow_videos: ${videoError.message}`)

  await refreshCounts(db, [...new Set(series.map((s) => s.seriesId))], now)
}

/** Đếm lại số video thực có của từng series trong tvshow_videos */
async function refreshCounts(db: Db, seriesKeys: string[], now: string) {
  for (const key of seriesKeys) {
    const { count } = await db
      .from('tvshow_videos')
      .select('*', { count: 'exact', head: true })
      .eq('series_key', key)
      .is('unavailable_at', null)
    if (typeof count !== 'number') continue
    await db.from('tvshow_series').update({ found_parts: count, updated_at: now }).eq('series_key', key)
  }
}
