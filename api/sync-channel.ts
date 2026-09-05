/**
 * POST /api/sync-channel
 *
 * Query or Body param: type = 'review' | 'tvshow'
 *
 *   { action: 'plan', creatorUrl, type }        → kế hoạch duyệt + tổng số trang
 *   { action: 'page', plan, cursor, type }      → xử lý đúng một trang rồi ghi ngay
 *   { action: 'save_selected', plan, videos }   → lưu video đã chọn
 *   { action: 'finish', creatorUrl, type }      → hoàn tất đồng bộ
 *
 * Env: YOUTUBE_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import {
  startSync as startReviewSync,
  syncOnePage as syncReviewOnePage,
  writeVideos as writeReviewVideos,
} from '../src/lib/reviewSeries/pageSync.js'
import {
  startPlaylistSync as startTvshowPlaylistSync,
  startSync as startTvshowSync,
  syncOnePage as syncTvshowOnePage,
  writeVideos as writeTvshowVideos,
} from '../src/lib/tvshowSeries/pageSync.js'
import { youtubePlaylistId } from '../src/lib/youtubeMeta.js'
import { requireAuth } from './_auth.js'

export const config = { maxDuration: 60 }

/** Trả về câu báo lỗi, hoặc null nếu link hợp lệ. */
function validateChannelUrl(creatorUrl: string): string | null {
  if (!creatorUrl) return 'Thiếu creatorUrl'
  let host: string
  try {
    host = new URL(creatorUrl).hostname.replace(/^www\./, '')
  } catch {
    return 'creatorUrl không phải URL hợp lệ'
  }
  if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return 'Hiện chỉ hỗ trợ link kênh YouTube'
  return null
}

export default async function handler(req: any, res: any) {
  if (await requireAuth(req, res)) return

  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' })

  const { YOUTUBE_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!YOUTUBE_API_KEY || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server thiếu YOUTUBE_API_KEY hoặc khoá Supabase' })
  }

  const db = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const type = req.query?.type || req.body?.type || 'tvshow'
  const isReview = type === 'review'

  const creatorTable = isReview ? 'review_creators' : 'tvshow_creators'
  const syncRunsTable = isReview ? 'review_sync_runs' : 'tvshow_sync_runs'
  const action = req.body?.action ?? 'plan'

  try {
    if (action === 'plan') {
      const creatorUrl = String(req.body?.creatorUrl ?? '').trim()
      const bad = validateChannelUrl(creatorUrl)
      if (bad) return res.status(400).json({ error: bad })

      let plan: any
      if (isReview) {
        plan = await startReviewSync(creatorUrl, YOUTUBE_API_KEY)
      } else {
        const playlistId = youtubePlaylistId(creatorUrl)
        plan = playlistId
          ? await startTvshowPlaylistSync(playlistId, YOUTUBE_API_KEY)
          : await startTvshowSync(creatorUrl, YOUTUBE_API_KEY)
      }

      await db.from(creatorTable).upsert(
        {
          platform: 'youtube',
          creator_url: creatorUrl,
          creator_id: plan.channelId,
          creator_name: plan.channelName,
        },
        { onConflict: 'platform,creator_url' },
      )
      return res.status(200).json({ plan })
    }

    if (action === 'page') {
      const plan = req.body?.plan
      const cursor = req.body?.cursor
      const dryRun = Boolean(req.body?.dryRun)
      if (!plan?.entries?.length) return res.status(400).json({ error: 'Thiếu plan' })
      if (typeof cursor?.entryIndex !== 'number') return res.status(400).json({ error: 'Thiếu cursor' })

      const outcome = isReview
        ? await syncReviewOnePage(db, plan, cursor, YOUTUBE_API_KEY, fetch, { dryRun })
        : await syncTvshowOnePage(db, plan, cursor, YOUTUBE_API_KEY, fetch, { dryRun })
      return res.status(200).json({ outcome })
    }

    if (action === 'save_selected') {
      const plan = req.body?.plan
      const videos = req.body?.videos
      if (!Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({ error: 'Không có video nào được chọn' })
      }
      const entry = plan?.entries?.[0] || { playlistId: '', name: 'Video đã chọn', itemCount: videos.length, isUploads: true }
      if (isReview) {
        await writeReviewVideos(db, videos, entry, plan)
      } else {
        await writeTvshowVideos(db, videos, entry, plan)
      }

      const creatorUrl = String(plan?.creatorUrl ?? '').trim()
      if (creatorUrl) {
        await db
          .from(creatorTable)
          .update({ last_synced_at: new Date().toISOString() })
          .eq('platform', 'youtube')
          .eq('creator_url', creatorUrl)
        await db.from(syncRunsTable).insert({
          platform: 'youtube',
          creator_url: creatorUrl,
          found_count: Number(videos.length),
          series_count: 1,
        })
      }
      return res.status(200).json({ ok: true, savedCount: videos.length })
    }

    if (action === 'finish') {
      const creatorUrl = String(req.body?.creatorUrl ?? '').trim()
      await db
        .from(creatorTable)
        .update({ last_synced_at: new Date().toISOString() })
        .eq('platform', 'youtube')
        .eq('creator_url', creatorUrl)
      await db.from(syncRunsTable).insert({
        platform: 'youtube',
        creator_url: creatorUrl,
        found_count: Number(req.body?.saved ?? 0),
        series_count: Number(req.body?.pages ?? 0),
      })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: `action lạ: ${action}` })
  } catch (error: any) {
    const message = String(error?.message ?? error).slice(0, 500)
    await db.from(syncRunsTable).insert({
      platform: 'youtube',
      creator_url: String(req.body?.creatorUrl ?? req.body?.plan?.creatorUrl ?? ''),
      error: message,
    })
    return res.status(502).json({ error: message })
  }
}
