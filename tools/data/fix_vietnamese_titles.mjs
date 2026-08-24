/**
 * Cập nhật lại toàn bộ tiêu đề trong review_series và tvshow_series để có đầy đủ dấu tiếng Việt.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { cleanDisplayTitle } from '../../src/lib/reviewSeries/seriesResolver.ts'

config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function fixTable(seriesTable, videosTable) {
  console.log(`Đang quét bảng ${seriesTable}...`)
  const { data: series, error } = await supabase.from(seriesTable).select('id,series_key,movie_title,title,creator_name')
  if (error) {
    console.log(`Không đọc được ${seriesTable}:`, error.message)
    return
  }

  let updated = 0
  for (const s of series ?? []) {
    const { data: v } = await supabase
      .from(videosTable)
      .select('title')
      .eq('series_key', s.series_key)
      .limit(1)

    if (v?.[0]?.title) {
      const accented = cleanDisplayTitle(v[0].title)
      if (accented && accented !== s.movie_title) {
        await supabase
          .from(seriesTable)
          .update({
            movie_title: accented,
            title: `${accented} — ${s.creator_name || ''}`,
          })
          .eq('id', s.id)
        updated++
      }
    }
  }
  console.log(`✅ Đã cập nhật ${updated}/${series?.length ?? 0} tiêu đề có dấu tiếng Việt trong ${seriesTable}`)
}

async function main() {
  await fixTable('review_series', 'review_videos')
  await fixTable('tvshow_series', 'tvshow_videos')
}

main().catch(console.error)
