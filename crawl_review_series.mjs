/**
 * Đồng bộ series review phim từ YouTube / TikTok.
 *
 *   node --import tsx crawl_review_series.mjs                       # sync mọi creator đã lưu
 *   node --import tsx crawl_review_series.mjs --add youtube <url>   # thêm creator rồi sync
 *
 * Admin chỉ nhập creator một lần; video tự phát hiện, không dán tay từng link.
 * Chạy lại nhiều lần vô hại: mọi thứ upsert theo khoá tự nhiên.
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY,
 *      TIKTOK_ACCESS_TOKEN (chỉ cần khi có creator tiktok).
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { fetchCreatorVideos as fetchYouTube } from './src/lib/reviewSeries/youtube.ts'
import { fetchCreatorVideos as fetchTikTok } from './src/lib/reviewSeries/tiktok.ts'
import { resolveSeries } from './src/lib/reviewSeries/seriesResolver.ts'
import { evaluateCompletion } from './src/lib/reviewSeries/completion.ts'

config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const die = (message) => {
  console.error(message)
  process.exit(1)
}

async function addCreator(platform, creatorUrl) {
  const { error } = await supabase
    .from('review_creators')
    .upsert({ platform, creator_url: creatorUrl }, { onConflict: 'platform,creator_url' })
  if (error) die(`Không thêm được creator: ${error.message}`)
  console.log(`+ ${platform} ${creatorUrl}`)
}

async function listCreators() {
  const { data, error } = await supabase.from('review_creators').select('*').is('deleted_at', null)
  if (error) die(`Không đọc được danh sách creator: ${error.message}`)
  return data ?? []
}

/** Gọi connector tương ứng. Chỉ dùng API chính thức của từng nền tảng. */
async function fetchFeed(creator) {
  if (creator.platform === 'youtube') {
    const key = process.env.YOUTUBE_API_KEY
    if (!key) throw new Error('Thiếu YOUTUBE_API_KEY')
    return fetchYouTube(creator.creator_url, key)
  }
  if (creator.platform === 'tiktok') {
    const token = process.env.TIKTOK_ACCESS_TOKEN
    if (!token) throw new Error('Thiếu TIKTOK_ACCESS_TOKEN')
    return fetchTikTok(token)
  }
  throw new Error(`Nền tảng chưa hỗ trợ: ${creator.platform}`)
}

const chunk = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

async function syncCreator(creator) {
  const feed = await fetchFeed(creator)
  const series = resolveSeries(feed.videos)
  const countByPlaylist = new Map(feed.playlists.map((p) => [p.playlistId, p.itemCount]))
  const now = new Date()

  for (const s of series) {
    // Số item playlist là bằng chứng mạnh nhất; không có thì để null, không đoán.
    const playlistItemCount = s.playlistId ? countByPlaylist.get(s.playlistId) ?? null : null
    const completion = evaluateCompletion({ series: s, playlistItemCount, now })

    const { error: seriesError } = await supabase.from('review_series').upsert(
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
      const { error } = await supabase.from('review_videos').upsert(batch, { onConflict: 'platform,video_id' })
      if (error) throw new Error(`review_videos: ${error.message}`)
    }

    const label = `${completion.status} ${completion.found}/${completion.expected ?? '?'}`
    const missing = completion.missingParts.length ? ` thiếu ${completion.missingParts.join(',')}` : ''
    console.log(`  ${label}${missing} — ${s.title}`)
  }

  await markUnavailable(creator, feed, now)
  return { videoCount: feed.videos.length, seriesCount: series.length }
}

/**
 * Video từng thấy nhưng lần này không còn (xoá / để riêng tư) thì đánh dấu chứ
 * không xoá bản ghi — series hụt phần phải nhìn thấy được, không được im lặng.
 */
async function markUnavailable(creator, feed, now) {
  const { data, error } = await supabase
    .from('review_videos')
    .select('video_id')
    .eq('platform', creator.platform)
    .eq('creator_id', feed.creatorId)
    .is('unavailable_at', null)
  if (error) throw new Error(`review_videos read: ${error.message}`)

  const seen = new Set(feed.videos.map((v) => v.videoId))
  const gone = (data ?? []).map((r) => r.video_id).filter((id) => !seen.has(id))
  if (gone.length === 0) return

  const { error: updateError } = await supabase
    .from('review_videos')
    .update({ unavailable_at: now.toISOString() })
    .eq('platform', creator.platform)
    .in('video_id', gone)
  if (updateError) throw new Error(`review_videos update: ${updateError.message}`)
  console.log(`  ! ${gone.length} video không còn truy cập được`)
}

async function main() {
  const [flag, platform, url] = process.argv.slice(2)
  if (flag === '--add') {
    if (!platform || !url) die('Dùng: --add <youtube|tiktok> <url>')
    await addCreator(platform, url)
  }

  const creators = await listCreators()
  if (creators.length === 0) {
    console.log('Chưa có creator nào. Thêm bằng: --add youtube https://www.youtube.com/@Kenh')
    return
  }

  for (const creator of creators) {
    console.log(`\n${creator.platform} ${creator.creator_url}`)
    try {
      const { videoCount, seriesCount } = await syncCreator(creator)
      await supabase.from('review_creators').update({ last_synced_at: new Date().toISOString() }).eq('id', creator.id)
      await supabase.from('review_sync_runs').insert({
        platform: creator.platform,
        creator_url: creator.creator_url,
        found_count: videoCount,
        series_count: seriesCount,
      })
    } catch (error) {
      // Một kênh hỏng không được làm chết cả job — ghi lại rồi đi tiếp.
      console.error(`  LỖI: ${error.message}`)
      await supabase.from('review_sync_runs').insert({
        platform: creator.platform,
        creator_url: creator.creator_url,
        error: String(error.message).slice(0, 500),
      })
    }
  }
}

main().catch((error) => die(error.stack ?? String(error)))
