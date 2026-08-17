/**
 * Script di chuyển toàn bộ creator Web5ngay / Tri Kỷ Cảm Xúc từ review_* sang tvshow_*
 * và dọn dẹp khỏi review_*.
 *
 * Chạy bằng:
 *   node migrate_web5ngay_to_tvshow.mjs
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function run() {
  console.log('🚀 Bắt đầu di chuyển dữ liệu Web5ngay (Tri Kỷ Cảm Xúc) từ review_* sang tvshow_*...')

  // 1. Tìm creator Tri Kỷ Cảm Xúc trong review_creators
  const { data: creators, error: creatorErr } = await supabase
    .from('review_creators')
    .select('*')
    .or('creator_name.ilike.%Tri K%,creator_url.ilike.%tri_ky_cam_xuc%,creator_name.ilike.%web5%,creator_url.ilike.%web5%')

  if (creatorErr) {
    console.error('❌ Lỗi đọc review_creators:', creatorErr.message)
    return
  }

  console.log(`Tìm thấy ${creators?.length ?? 0} creator khớp:`)
  for (const c of creators ?? []) {
    console.log(` - [${c.id}] ${c.creator_name} (${c.creator_url})`)
  }

  if (!creators?.length) {
    console.log('Không có creator Web5ngay nào trong review_creators.')
  } else {
    // 2. Chép creator sang tvshow_creators
    const { error: insCreatorErr } = await supabase
      .from('tvshow_creators')
      .upsert(creators, { onConflict: 'platform,creator_url' })

    if (insCreatorErr) {
      console.error('❌ Lỗi chép sang tvshow_creators:', insCreatorErr.message)
      if (insCreatorErr.code === 'PGRST205' || insCreatorErr.code === '42P01') {
        console.log('💡 Bảng tvshow_* chưa được tạo trong Supabase. Vui lòng chạy file migration `supabase/migrations/20260915000000_tvshow_channels.sql` trong SQL Editor của Supabase trước!')
        return
      }
    } else {
      console.log('✅ Đã chép creator sang tvshow_creators')
    }
  }

  // 3. Lấy tất cả series của Tri Kỷ Cảm Xúc trong review_series
  const creatorIds = (creators ?? []).map(c => c.creator_id).filter(Boolean)
  let seriesQuery = supabase.from('review_series').select('*')
  if (creatorIds.length > 0) {
    seriesQuery = seriesQuery.or(`creator_name.ilike.%Tri K%,creator_id.in.(${creatorIds.join(',')})`)
  } else {
    seriesQuery = seriesQuery.ilike('creator_name', '%Tri K%')
  }

  const { data: seriesList, error: seriesErr } = await seriesQuery
  if (seriesErr) {
    console.error('❌ Lỗi đọc review_series:', seriesErr.message)
  } else {
    console.log(`Tìm thấy ${seriesList?.length ?? 0} series của Web5ngay/Tri Kỷ Cảm Xúc.`)
    if (seriesList?.length) {
      // Upsert theo lô 100
      for (let i = 0; i < seriesList.length; i += 100) {
        const chunk = seriesList.slice(i, i + 100)
        const { error: insSeriesErr } = await supabase
          .from('tvshow_series')
          .upsert(chunk, { onConflict: 'series_key' })
        if (insSeriesErr) {
          console.error(`❌ Lỗi chép series chunk ${i}:`, insSeriesErr.message)
          break
        }
      }
      console.log('✅ Đã chép toàn bộ series sang tvshow_series')
    }
  }

  // 4. Lấy tất cả videos của Tri Kỷ Cảm Xúc trong review_videos
  let videosQuery = supabase.from('review_videos').select('*')
  if (creatorIds.length > 0) {
    videosQuery = videosQuery.or(`creator_name.ilike.%Tri K%,creator_id.in.(${creatorIds.join(',')})`)
  } else {
    videosQuery = videosQuery.ilike('creator_name', '%Tri K%')
  }

  const { data: videoList, error: videoErr } = await videosQuery
  if (videoErr) {
    console.error('❌ Lỗi đọc review_videos:', videoErr.message)
  } else {
    console.log(`Tìm thấy ${videoList?.length ?? 0} videos của Web5ngay/Tri Kỷ Cảm Xúc.`)
    if (videoList?.length) {
      for (let i = 0; i < videoList.length; i += 100) {
        const chunk = videoList.slice(i, i + 100)
        const { error: insVidErr } = await supabase
          .from('tvshow_videos')
          .upsert(chunk, { onConflict: 'platform,video_id' })
        if (insVidErr) {
          console.error(`❌ Lỗi chép video chunk ${i}:`, insVidErr.message)
          break
        }
      }
      console.log('✅ Đã chép toàn bộ video sang tvshow_videos')
    }
  }

  // 5. Chuyển review_watched sang tvshow_watched
  if (videoList?.length) {
    const videoIds = videoList.map(v => v.video_id)
    for (let i = 0; i < videoIds.length; i += 200) {
      const idChunk = videoIds.slice(i, i + 200)
      const { data: watchedList } = await supabase.from('review_watched').select('*').in('video_id', idChunk)
      if (watchedList?.length) {
        await supabase.from('tvshow_watched').upsert(watchedList, { onConflict: 'user_id,platform,video_id' })
      }
    }
    console.log('✅ Đã chép lịch sử xem sang tvshow_watched')
  }

  // 6. Xoá Web5ngay khỏi review_*
  console.log('🧹 Đang dọn sạch Web5ngay khỏi review_*...')
  if (creators?.length) {
    for (const c of creators) {
      await supabase.from('review_creators').delete().eq('id', c.id)
    }
  }
  if (creatorIds.length > 0) {
    await supabase.from('review_videos').delete().in('creator_id', creatorIds)
    await supabase.from('review_series').delete().in('creator_id', creatorIds)
  } else {
    await supabase.from('review_videos').delete().ilike('creator_name', '%Tri K%')
    await supabase.from('review_series').delete().ilike('creator_name', '%Tri K%')
  }
  console.log('🎉 Hoàn thành di chuyển và dọn dẹp dữ liệu Web5ngay!')
}

run().catch(console.error)
