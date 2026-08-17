/**
 * Đồng bộ series review phim từ YouTube / TikTok.
 *
 *   node --import tsx crawl_review_series.mjs                       # sync mọi creator đã lưu
 *   node --import tsx crawl_review_series.mjs --add youtube <url>   # thêm creator rồi sync
 *
 * Admin chỉ nhập creator một lần; video tự phát hiện, không dán tay từng link.
 * Chạy lại nhiều lần vô hại: mọi thứ upsert theo khoá tự nhiên.
 *
 * Bản ở máy vét sạch cả kênh; bản trên web (/api/sync-review) chặn 6 trang mỗi
 * playlist vì serverless bị cắt sau 60 giây.
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { syncCreator } from './src/lib/reviewSeries/sync.ts'

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

async function main() {
  const [flag, platform, url] = process.argv.slice(2)
  if (flag === '--add') {
    if (!platform || !url) die('Dùng: --add <youtube|tiktok> <url>')
    await addCreator(platform, url)
  }

  let creators = await listCreators()
  if (creators.length === 0) {
    console.log('Chưa có creator nào. Thêm bằng: --add youtube https://www.youtube.com/@Kenh')
    return
  }

  // --only <chuỗi>: chỉ sync creator có link khớp. Quota YouTube mỗi ngày có
  // hạn, sync lại cả chục kênh chỉ vì một kênh dở dang là phí.
  if (flag === '--only') {
    if (!platform) die('Dùng: --only <chuỗi trong creator_url>')
    creators = creators.filter((c) => c.creator_url.includes(platform))
    if (creators.length === 0) die(`Không creator nào khớp "${platform}"`)
  }

  for (const creator of creators) {
    console.log(`\n${creator.platform} ${creator.creator_url}`)
    try {
      const { videoCount, seriesCount } = await syncCreator(supabase, creator, {
        youtubeKey: process.env.YOUTUBE_API_KEY,
        // Không đặt maxPages: chạy ở máy thì vét sạch kênh, khác bản trên web.
        onProgress: (line) => console.log(line),
      })
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
