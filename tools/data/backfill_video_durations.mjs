/**
 * Điền cột duration cho tvshow_videos — crawler không lấy contentDetails nên
 * cột này rỗng, khiến phần rút kiến thức không biết đường chia khúc video dài.
 *
 * Chạy: npm run backfill:durations
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/** "PT1H2M3S" -> 3723 giây. */
export function parseIsoDuration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '')
  if (!m) return null
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

const { data, error } = await supabase
  .from('tvshow_videos')
  .select('id, video_id')
  .is('duration', null)
  .is('unavailable_at', null)

if (error) throw error
console.log(`Cần điền thời lượng cho ${data.length} video.`)

let filled = 0
for (let i = 0; i < data.length; i += 50) {
  const batch = data.slice(i, i + 50)
  const ids = batch.map((r) => r.video_id).join(',')
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${process.env.YOUTUBE_API_KEY}`
  )
  if (!res.ok) {
    console.error(`YouTube lỗi ${res.status}, dừng.`)
    break
  }
  const body = await res.json()
  const secById = new Map(
    (body.items ?? []).map((it) => [it.id, parseIsoDuration(it.contentDetails?.duration)])
  )

  for (const row of batch) {
    const sec = secById.get(row.video_id)
    if (!sec) continue
    await supabase.from('tvshow_videos').update({ duration: sec }).eq('id', row.id)
    filled++
  }
  console.log(`  ${Math.min(i + 50, data.length)}/${data.length} — đã điền ${filled}`)
}

console.log(`Xong: điền được ${filled} video.`)
