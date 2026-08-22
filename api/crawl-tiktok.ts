import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { groupVideosIntoSeries } from '../src/lib/tiktokSeries.js'

const execFileAsync = promisify(execFile)

export const config = { maxDuration: 60 }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận POST' })

  const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  const db = (VITE_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
    ? createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null

  const action = req.body?.action || 'crawl_channel'

  try {
    if (action === 'crawl_channel') {
      const channelUrl = String(req.body?.channelUrl || '').trim()
      if (!channelUrl) return res.status(400).json({ error: 'Thiếu link kênh TikTok' })

      const username = channelUrl.split('@')[1]?.split('/')[0] || 'tiktok_creator'
      const args = [
        '--flat-playlist',
        '-J',
        '--extractor-args',
        'tiktok:api_hostname=api22-normal-c-useast1a.tiktokv.com',
        channelUrl,
      ]

      try {
        const { stdout } = await execFileAsync('yt-dlp', args, { maxBuffer: 50 * 1024 * 1024 })
        const data = JSON.parse(stdout)
        const entries = data.entries || []
        const creatorInfo = {
          creator_id: data.channel_id || data.uploader_id || username,
          creator_name: data.channel || data.uploader || username,
          creator_url: channelUrl,
        }

        const grouped = groupVideosIntoSeries(entries, creatorInfo)

        // Save to Supabase if DB configured
        if (db && req.body?.saveToDb !== false) {
          await db.from('review_creators').upsert({
            platform: 'tiktok',
            creator_url: creatorInfo.creator_url,
            creator_id: String(creatorInfo.creator_id),
            creator_name: creatorInfo.creator_name,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'platform,creator_url' })

          for (const s of grouped) {
            await db.from('review_series').upsert({
              series_key: s.series_key,
              platform: 'tiktok',
              creator_id: String(s.creator_id),
              creator_name: s.creator_name,
              title: s.title,
              movie_title: s.title,
              status: s.status === 'COMPLETE' ? 'COMPLETE' : 'UNKNOWN',
              found_parts: s.found_parts,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'series_key' })

            for (const v of s.videos) {
              await db.from('review_videos').upsert({
                platform: 'tiktok',
                video_id: v.video_id,
                series_key: s.series_key,
                creator_id: String(s.creator_id),
                creator_name: s.creator_name,
                title: v.title,
                canonical_url: v.url,
                embed_url: v.embed_url,
                thumbnail: v.thumbnail,
                duration: v.duration,
                part_number: v.part_number,
                total_parts: v.total_parts,
                is_final: v.is_final,
                last_seen_at: new Date().toISOString(),
              }, { onConflict: 'platform,video_id' })
            }
          }
        }

        return res.status(200).json({
          success: true,
          creator: creatorInfo,
          total_videos: entries.length,
          total_series: grouped.length,
          series: grouped,
        })
      } catch (err: any) {
        return res.status(500).json({
          error: `Không thể cào tự động bằng yt-dlp: ${err.message}. Vui lòng dán danh sách link hoặc file JSON.`,
        })
      }
    }

    if (action === 'save_series') {
      const { series, creator } = req.body
      if (!series || !Array.isArray(series)) {
        return res.status(400).json({ error: 'Thiếu dữ liệu series' })
      }

      if (db) {
        if (creator) {
          await db.from('review_creators').upsert({
            platform: 'tiktok',
            creator_url: creator.creator_url || `https://www.tiktok.com/@${creator.creator_name}`,
            creator_id: String(creator.creator_id || creator.creator_name),
            creator_name: creator.creator_name,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: 'platform,creator_url' })
        }

        for (const s of series) {
          await db.from('review_series').upsert({
            series_key: s.series_key,
            platform: 'tiktok',
            creator_id: String(s.creator_id),
            creator_name: s.creator_name,
            title: s.title,
            movie_title: s.title,
            status: s.status === 'COMPLETE' ? 'COMPLETE' : 'UNKNOWN',
            found_parts: s.found_parts || s.videos?.length || 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'series_key' })

          for (const v of s.videos || []) {
            await db.from('review_videos').upsert({
              platform: 'tiktok',
              video_id: v.video_id,
              series_key: s.series_key,
              creator_id: String(s.creator_id),
              creator_name: s.creator_name,
              title: v.title,
              canonical_url: v.url || v.canonical_url,
              embed_url: v.embed_url || `https://www.tiktok.com/embed/v2/${v.video_id}`,
              thumbnail: v.thumbnail,
              duration: v.duration,
              part_number: v.part_number,
              total_parts: v.total_parts,
              is_final: v.is_final,
              last_seen_at: new Date().toISOString(),
            }, { onConflict: 'platform,video_id' })
          }
        }
      }

      return res.status(200).json({ success: true, saved_series: series.length })
    }

    return res.status(400).json({ error: 'Action không hợp lệ' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Lỗi xử lý server' })
  }
}
