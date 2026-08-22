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
import { crawlVietManhwaStory, crawlMetruyen18Story } from './crawl-truyenh.js'
import { crawlTeamsanyStory, crawlOtruyenStory } from './crawl-bl.js'

export const config = { maxDuration: 300 }

// ponytail: tối đa 5 trang/kênh cho lần chạy đầu; kênh mới vẫn nên sync thủ công.
const MAX_PAGES = 5

export default async function handler(req: any, res: any) {
  const { CRON_SECRET, YOUTUBE_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (CRON_SECRET && req.headers?.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Không có quyền' })
  }
  if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server thiếu khoá Supabase' })
  }

  const db = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const report: any[] = []

  // 1. Đồng bộ YouTube (Review + TV Show)
  if (YOUTUBE_API_KEY) {
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
  }

  // 2. Tự động cào chapter mới cho Truyện H trên đám mây Supabase
  try {
    const { data: hStories } = await db
      .from('media_items')
      .select('id, name, channel, description, cover_url')
      .in('type', ['STORY', 'MANGA'])
      .is('deleted_at', null)
      .limit(60)

    for (const item of hStories ?? []) {
      if (!item.description || !item.description.startsWith('{')) continue
      try {
        const mangaObj = JSON.parse(item.description)
        const storyUrl = mangaObj.url || (mangaObj.slug ? `https://vietmanhwa.com/manhwa-18/${mangaObj.slug}` : '')
        if (!storyUrl) continue

        const isVietManhwa = storyUrl.includes('vietmanhwa.com')
        const updatedManga = isVietManhwa
          ? await crawlVietManhwaStory(storyUrl, mangaObj.chapters)
          : await crawlMetruyen18Story(storyUrl, mangaObj.chapters)

        const oldChapterCount = Array.isArray(mangaObj.chapters) ? mangaObj.chapters.length : 0
        const newChapterCount = Array.isArray(updatedManga.chapters) ? updatedManga.chapters.length : 0

        if (updatedManga && newChapterCount > oldChapterCount) {
          await db.from('media_items').update({
            name: updatedManga.title || item.name,
            cover_url: updatedManga.cover || item.cover_url,
            description: JSON.stringify(updatedManga),
            updated_at: new Date().toISOString(),
          }).eq('id', item.id)

          report.push({
            kind: 'truyenh',
            slug: updatedManga.slug,
            title: updatedManga.title,
            oldChapters: oldChapterCount,
            newChapters: newChapterCount,
            added: newChapterCount - oldChapterCount,
          })
        }
      } catch (err: any) {
        console.warn('Cron lỗi cào truyện H:', item.name, err?.message || err)
      }
  // 3. Tự động cào chapter mới cho Truyện BL trên đám mây Supabase
  try {
    const { data: blStories } = await db
      .from('media_items')
      .select('id, name, channel, description, cover_url')
      .eq('type', 'BL')
      .is('deleted_at', null)
      .limit(60)

    for (const item of blStories ?? []) {
      if (!item.description || !item.description.startsWith('{')) continue
      try {
        const mangaObj = JSON.parse(item.description)
        const storyUrl = mangaObj.url || (mangaObj.slug ? `https://teamsany.com/manga/${mangaObj.slug}/` : '')
        if (!storyUrl) continue

        const isOtruyen = storyUrl.includes('otruyen')
        const updatedManga = isOtruyen
          ? await crawlOtruyenStory(storyUrl, mangaObj.chapters)
          : await crawlTeamsanyStory(storyUrl, mangaObj.chapters)

        const oldChapterCount = Array.isArray(mangaObj.chapters) ? mangaObj.chapters.length : 0
        const newChapterCount = Array.isArray(updatedManga.chapters) ? updatedManga.chapters.length : 0

        if (updatedManga && newChapterCount > oldChapterCount) {
          await db.from('media_items').update({
            name: updatedManga.title || item.name,
            cover_url: updatedManga.cover || item.cover_url,
            description: JSON.stringify(updatedManga),
            updated_at: new Date().toISOString(),
          }).eq('id', item.id)

          report.push({
            kind: 'bl_manga',
            slug: updatedManga.slug,
            title: updatedManga.title,
            oldChapters: oldChapterCount,
            newChapters: newChapterCount,
            added: newChapterCount - oldChapterCount,
          })
        }
      } catch (err: any) {
        console.warn('Cron lỗi cào truyện BL:', item.name, err?.message || err)
      }
    }
  } catch (err: any) {
    console.error('Lỗi sync Truyện BL trong cron:', err)
  }

  return res.status(200).json({ ok: true, report })
}
