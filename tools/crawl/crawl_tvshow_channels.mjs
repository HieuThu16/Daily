/**
 * Đồng bộ toàn bộ kênh YouTube cho TV Show:
 *
 *   node --import tsx crawl_tvshow_channels.mjs                       # sync mọi channel đã lưu
 *   node --import tsx crawl_tvshow_channels.mjs --add youtube <url>   # thêm channel rồi sync
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { syncTvShowCreator } from '../../src/lib/tvshowSeries/sync.ts'

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
    .from('tvshow_creators')
    .upsert({ platform, creator_url: creatorUrl }, { onConflict: 'platform,creator_url' })
  if (error) die(`Không thêm được creator: ${error.message}`)
  console.log(`+ ${platform} ${creatorUrl}`)
}

async function listCreators() {
  const { data, error } = await supabase.from('tvshow_creators').select('*').is('deleted_at', null)
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
    console.log('Chưa có kênh nào. Thêm bằng: --add youtube https://www.youtube.com/@web5ngay')
    return
  }

  if (flag === '--only') {
    if (!platform) die('Dùng: --only <chuỗi trong creator_url>')
    creators = creators.filter((c) => c.creator_url.includes(platform))
    if (creators.length === 0) die(`Không creator nào khớp "${platform}"`)
  }

  for (const creator of creators) {
    console.log(`\n${creator.platform} ${creator.creator_url}`)
    try {
      const { videoCount, seriesCount } = await syncTvShowCreator(supabase, creator, {
        youtubeKey: process.env.YOUTUBE_API_KEY,
        onProgress: (line) => console.log(line),
      })
      await supabase.from('tvshow_creators').update({ last_synced_at: new Date().toISOString() }).eq('id', creator.id)
      await supabase.from('tvshow_sync_runs').insert({
        platform: creator.platform,
        creator_url: creator.creator_url,
        found_count: videoCount,
        series_count: seriesCount,
      })
    } catch (error) {
      console.error(`  LỖI: ${error.message}`)
      await supabase.from('tvshow_sync_runs').insert({
        platform: creator.platform,
        creator_url: creator.creator_url,
        error: String(error.message).slice(0, 500),
      })
    }
  }
}

main().catch((error) => die(error.stack ?? String(error)))
