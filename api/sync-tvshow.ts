/**
 * POST /api/sync-tvshow
 *
 *   { action: 'plan', creatorUrl }        → kế hoạch duyệt + tổng số trang
 *   { action: 'page', plan, cursor }      → xử lý đúng một trang rồi ghi vào tvshow_*
 *   { action: 'finish', creatorUrl }      → hoàn tất đồng bộ
 *
 * Env: YOUTUBE_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import { startSync, syncOnePage, writeVideos } from '../src/lib/tvshowSeries/pageSync.js'
import { requireAuth } from './_auth'

export const config = { maxDuration: 60 }

export default async function handler(req: any, res: any) {
  if (await requireAuth(req, res)) return

  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' })

  const { YOUTUBE_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!YOUTUBE_API_KEY || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server thiếu YOUTUBE_API_KEY hoặc khoá Supabase' })
  }

  const db = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const action = req.body?.action ?? 'plan'

  try {
    if (action === 'plan') {
      const creatorUrl = String(req.body?.creatorUrl ?? '').trim()
      const bad = validateChannelUrl(creatorUrl)
      if (bad) return res.status(400).json({ error: bad })

      const plan = await startSync(creatorUrl, YOUTUBE_API_KEY)
      await db.from('tvshow_creators').upsert(
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

      const outcome = await syncOnePage(db, plan, cursor, YOUTUBE_API_KEY, fetch, { dryRun })
      return res.status(200).json({ outcome })
    }

    if (action === 'save_selected') {
      const plan = req.body?.plan
      const videos = req.body?.videos
      if (!Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({ error: 'Không có video nào được chọn' })
      }
      const entry = plan?.entries?.[0] || { playlistId: '', name: 'Video đã chọn', itemCount: videos.length, isUploads: true }
      await writeVideos(db, videos, entry, plan)

      const creatorUrl = String(plan?.creatorUrl ?? '').trim()
      if (creatorUrl) {
        await db
          .from('tvshow_creators')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('platform', 'youtube')
          .eq('creator_url', creatorUrl)
        await db.from('tvshow_sync_runs').insert({
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
        .from('tvshow_creators')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('platform', 'youtube')
        .eq('creator_url', creatorUrl)
      await db.from('tvshow_sync_runs').insert({
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
    await db.from('tvshow_sync_runs').insert({
      platform: 'youtube',
      creator_url: String(req.body?.creatorUrl ?? req.body?.plan?.creatorUrl ?? ''),
      error: message,
    })
    return res.status(502).json({ error: message })
  }
}

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
