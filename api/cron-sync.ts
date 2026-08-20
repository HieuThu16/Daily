/**
 * GET /api/cron-sync — Vercel Cron gọi mỗi ngày.
 *
 * Với mỗi kênh đã thêm (review_creators + tvshow_creators): duyệt playlist
 * "Video đã đăng" (mới nhất trước) và dừng ngay khi gặp trang toàn video đã có.
 * Nhờ vậy mỗi kênh thường chỉ tốn 1 trang quota.
 *
 * Env: CRON_SECRET (Vercel tự gửi trong header Authorization), YOUTUBE_API_KEY,
 * VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import * as review from '../src/lib/reviewSeries/pageSync.js'
import * as tvshow from '../src/lib/tvshowSeries/pageSync.js'

export const config = { maxDuration: 300 }

// ponytail: tối đa 5 trang/kênh cho lần chạy đầu; kênh mới vẫn nên sync thủ công.
const MAX_PAGES = 5

export default async function handler(req: any, res: any) {
  const { CRON_SECRET, YOUTUBE_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (CRON_SECRET && req.headers?.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Không có quyền' })
  }
  if (!YOUTUBE_API_KEY || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server thiếu YOUTUBE_API_KEY hoặc khoá Supabase' })
  }

  const db = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const report: any[] = []

  for (const kind of ['review', 'tvshow'] as const) {
    const mod = kind === 'review' ? review : tvshow
    const { data: creators } = await db.from(`${kind}_creators`).select('creator_url')
    for (const { creator_url: creatorUrl } of (creators ?? []) as { creator_url: string }[]) {
      try {
        const plan = await mod.startSync(creatorUrl, YOUTUBE_API_KEY)
        let saved = 0
        let pageToken: string | undefined
        for (let page = 0; page < MAX_PAGES; page++) {
          const outcome = await mod.syncOnePage(db, plan, { entryIndex: 0, pageToken }, YOUTUBE_API_KEY, fetch)
          saved += outcome.saved
          pageToken = outcome.nextPageToken
          if (outcome.allKnown || !pageToken) break
        }
        await db.from(`${kind}_creators`).update({ last_synced_at: new Date().toISOString() })
          .eq('platform', 'youtube').eq('creator_url', creatorUrl)
        await db.from(`${kind}_sync_runs`).insert({
          platform: 'youtube', creator_url: creatorUrl, found_count: saved, series_count: 0,
        })
        report.push({ kind, creatorUrl, saved })
      } catch (error: any) {
        const message = String(error?.message ?? error).slice(0, 500)
        await db.from(`${kind}_sync_runs`).insert({ platform: 'youtube', creator_url: creatorUrl, error: message })
        report.push({ kind, creatorUrl, error: message })
      }
    }
  }

  return res.status(200).json({ ok: true, report })
}
