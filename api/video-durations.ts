import { createClient } from '@supabase/supabase-js'
import { requireAuth } from './_auth.js'

export const config = { maxDuration: 60 }

function parseIsoDuration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '')
  if (!m) return 0
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)
}

export default async function handler(req: any, res: any) {
  if (await requireAuth(req, res)) return

  const videoIds: string[] = Array.isArray(req.body?.videoIds)
    ? req.body.videoIds
    : String(req.query?.ids || req.body?.ids || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

  if (videoIds.length === 0) {
    return res.status(200).json({ ok: true, durations: {} })
  }

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY
  const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  const db =
    VITE_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null

  const durations: Record<string, number> = {}

  // Xử lý tối đa 50 ID một batch của YouTube Data API
  const uniqueIds = Array.from(new Set(videoIds)).slice(0, 200)

  if (apiKey) {
    for (let i = 0; i < uniqueIds.length; i += 50) {
      const batch = uniqueIds.slice(i, i + 50)
      try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(',')}&key=${apiKey}`
        const r = await fetch(url)
        if (r.ok) {
          const data = (await r.json()) as any
          for (const item of data.items || []) {
            const sec = parseIsoDuration(item.contentDetails?.duration || '')
            if (sec > 0) {
              durations[item.id] = sec
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi khi fetch durations từ YouTube API:', err)
      }
    }
  }

  // Cập nhật vào Supabase nếu có DB
  if (db && Object.keys(durations).length > 0) {
    for (const [vid, sec] of Object.entries(durations)) {
      try {
        await Promise.all([
          db.from('tvshow_videos').update({ duration: sec }).eq('video_id', vid).is('duration', null),
          db.from('review_videos').update({ duration: sec }).eq('video_id', vid).is('duration', null),
        ])
      } catch {}
    }
  }

  return res.status(200).json({ ok: true, durations })
}
