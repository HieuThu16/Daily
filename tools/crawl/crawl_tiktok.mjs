#!/usr/bin/env node
/**
 * Pipeline cào & nhóm Series TikTok tự động bằng Node.js.
 * Hỗ trợ chạy trực tiếp với yt-dlp, đọc file JSON hoặc dán link.
 *
 * Cách dùng:
 *   node crawl_tiktok.mjs --channel https://www.tiktok.com/@username
 *   node crawl_tiktok.mjs --json channel.json --output series.json
 *   node crawl_tiktok.mjs --channel https://www.tiktok.com/@username --supabase
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

config()
const execFileAsync = promisify(execFile)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null

function removeAccents(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
}

const FINAL_REGEX =
  /\b(?:part\s*(?:cuối|cuoi)|(?:phần|phan)\s*(?:cuối|cuoi)|(?:tập|tap)\s*(?:cuối|cuoi)|(?:kỳ|ky)\s*(?:cuối|cuoi)|final(?:\s*part)?|finale|the\s*end|ending|(?:kết\s*thúc|ket\s*thuc)|hết|het|full\s*review|end)\b/i
const PART_PATTERNS = [
  /\b(?:part|phan|tap|ep|episode|p)\s*[.:\-_]?\s*0*(\d{1,3})\b(?:\s*(?:\/|of|tren)\s*0*(\d{1,3}))?/i,
  /#\s*0*(\d{1,3})\b(?:\s*\/\s*0*(\d{1,3}))?/i,
  /\b0*(\d{1,3})\s*(?:\/|of)\s*0*(\d{1,3})\b/i,
]

export function extractPartInfo(title = '') {
  const norm = removeAccents(title)
  const isFinal = FINAL_REGEX.test(norm)

  for (const pattern of PART_PATTERNS) {
    const match = norm.match(pattern)
    if (match) {
      const partNum = parseInt(match[1], 10)
      let totalParts = match[2] ? parseInt(match[2], 10) : null
      if (totalParts !== null && totalParts < partNum) totalParts = null
      return { partNumber: partNum, totalParts, isFinal, confidence: 0.9 }
    }
  }

  return { partNumber: null, totalParts: null, isFinal, confidence: isFinal ? 0.4 : 0 }
}

export function extractSeriesName(title = '') {
  let text = title.replace(/#\S+/g, ' ')
  text = text.replace(/\b(?:part|phan|phần|tap|tập|ep|episode|p)\s*[.:\-_]?\s*0*(\d{1,3})\b(?:\s*(?:\/|of|trên|tren)\s*0*(\d{1,3}))?/gi, ' ')
  text = text.replace(/#\s*0*(\d{1,3})\b(?:\s*\/\s*0*(\d{1,3}))?/gi, ' ')
  text = text.replace(/\b0*(\d{1,3})\s*(?:\/|of)\s*0*(\d{1,3})\b/gi, ' ')
  text = text.replace(FINAL_REGEX, ' ')
  text = text.replace(/\b(?:review|tóm\s*tắt|tom\s*tat|full|hd|4k|vietsub|thuyết\s*minh|thuyet\s*minh|phim|movie|series|official|trailer|reaction|spoiler|toàn\s*bộ|hay\s*nhất)\b/gi, ' ')
  text = text.replace(/[|\-_–—:;,.!?]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length >= 2 ? text : title.slice(0, 40).trim()
}

export function normalizeSeriesKey(name = '') {
  return removeAccents(name).replace(/[^a-z0-9]+/g, ' ').trim()
}

export function groupVideosIntoSeries(entries, creatorInfo) {
  const seriesMap = new Map()

  for (const item of entries) {
    const rawTitle = item.title || item.description || ''
    const videoId = String(item.id || '')
    const url = item.url || item.webpage_url || `https://www.tiktok.com/@${creatorInfo.creator_name}/video/${videoId}`
    const thumbnail = item.thumbnail || (Array.isArray(item.thumbnails) ? item.thumbnails[item.thumbnails.length - 1]?.url : null)
    const timestamp = item.timestamp || item.upload_date
    const publishedAt = typeof timestamp === 'number' ? new Date(timestamp * 1000).toISOString() : String(timestamp || new Date().toISOString())
    const duration = item.duration || null

    const partInfo = extractPartInfo(rawTitle)
    const displayTitle = extractSeriesName(rawTitle)
    let seriesKey = normalizeSeriesKey(displayTitle)
    if (!seriesKey) seriesKey = 'video_le'

    const videoObj = {
      video_id: videoId,
      title: rawTitle,
      clean_title: displayTitle,
      url,
      embed_url: `https://www.tiktok.com/embed/v2/${videoId}`,
      thumbnail,
      duration,
      published_at: publishedAt,
      part_number: partInfo.partNumber,
      total_parts: partInfo.totalParts,
      is_final: partInfo.isFinal,
    }

    if (!seriesMap.has(seriesKey)) {
      seriesMap.set(seriesKey, {
        series_key: `tiktok:${creatorInfo.creator_id}:${seriesKey}`,
        title: displayTitle,
        creator_id: creatorInfo.creator_id,
        creator_name: creatorInfo.creator_name,
        creator_url: creatorInfo.creator_url,
        cover: thumbnail,
        videos: [],
      })
    }

    seriesMap.get(seriesKey).videos.push(videoObj)
  }

  const resultSeries = []
  for (const [, sData] of seriesMap) {
    const sorted = [...sData.videos].sort((a, b) => {
      const pa = a.part_number !== null ? a.part_number : 9999
      const pb = b.part_number !== null ? b.part_number : 9999
      if (pa !== pb) return pa - pb
      return (a.published_at || '').localeCompare(b.published_at || '')
    })

    const parts = sorted.map((v) => v.part_number).filter((p) => p !== null)
    const hasFinal = sorted.some((v) => v.is_final)
    let status = 'UNKNOWN'
    if (parts.length > 1) {
      const isSeq = parts.every((p, idx) => p === idx + 1)
      if (isSeq && hasFinal) status = 'COMPLETE'
      else if (isSeq) status = 'IN_PROGRESS'
      else status = 'INCOMPLETE'
    } else if (sorted.length === 1 && !hasFinal && parts.length === 0) {
      status = 'SINGLE'
    }

    resultSeries.push({
      ...sData,
      videos: sorted,
      video_count: sorted.length,
      status,
      found_parts: parts.length,
    })
  }

  resultSeries.sort((a, b) => b.video_count - a.video_count)
  return resultSeries
}

async function fetchFromYtDlp(channelUrl) {
  console.log(`🚀 Đang quét video từ kênh: ${channelUrl} ...`)
  const args = [
    '--flat-playlist',
    '-J',
    '--extractor-args',
    'tiktok:api_hostname=api22-normal-c-useast1a.tiktokv.com',
    channelUrl,
  ]

  const { stdout } = await execFileAsync('yt-dlp', args, { maxBuffer: 100 * 1024 * 1024 })
  const data = JSON.parse(stdout)
  const entries = data.entries || []
  const creatorInfo = {
    creator_id: data.channel_id || data.uploader_id || data.uploader || 'tiktok_creator',
    creator_name: data.channel || data.uploader || channelUrl.split('@')[1]?.split('/')[0] || 'tiktok_user',
    creator_url: channelUrl,
  }

  console.log(`✅ Đã tìm thấy ${entries.length} video từ @${creatorInfo.creator_name}`)
  return { entries, creatorInfo }
}

async function saveToSupabase(seriesList, creatorInfo) {
  if (!supabase) {
    console.log('⚠️ Thiếu VITE_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env. Bỏ qua Supabase.')
    return
  }

  console.log('💾 Đang lưu dữ liệu vào Supabase...')
  await supabase.from('review_creators').upsert({
    platform: 'tiktok',
    creator_url: creatorInfo.creator_url,
    creator_id: String(creatorInfo.creator_id),
    creator_name: creatorInfo.creator_name,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: 'platform,creator_url' })

  for (const s of seriesList) {
    await supabase.from('review_series').upsert({
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
      await supabase.from('review_videos').upsert({
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

  console.log('🎉 Đã đồng bộ toàn bộ Series và Video TikTok vào Supabase thành công!')
}

async function main() {
  const args = process.argv.slice(2)
  let channelUrl = ''
  let jsonPath = ''
  let outputPath = 'tiktok_series.json'
  let shouldSaveSupabase = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel' && args[i + 1]) channelUrl = args[++i]
    else if (args[i] === '--json' && args[i + 1]) jsonPath = args[++i]
    else if (args[i] === '--output' && args[i + 1]) outputPath = args[++i]
    else if (args[i] === '--supabase') shouldSaveSupabase = true
  }

  if (!channelUrl && !jsonPath) {
    console.log(`
Cách dùng:
  node crawl_tiktok.mjs --channel https://www.tiktok.com/@username
  node crawl_tiktok.mjs --json channel.json --output result.json
  node crawl_tiktok.mjs --channel https://www.tiktok.com/@username --supabase
    `)
    return
  }

  let entries = []
  let creatorInfo = { creator_id: 'unknown', creator_name: 'TikTok Creator', creator_url: channelUrl }

  if (jsonPath) {
    const raw = await fs.readFile(path.resolve(jsonPath), 'utf-8')
    const parsed = JSON.parse(raw)
    entries = Array.isArray(parsed) ? parsed : (parsed.entries || [parsed])
    creatorInfo.creator_name = parsed.uploader || parsed.channel || 'tiktok_user'
    creatorInfo.creator_id = parsed.uploader_id || creatorInfo.creator_name
    console.log(`📂 Đã nạp ${entries.length} video từ file JSON: ${jsonPath}`)
  } else if (channelUrl) {
    const res = await fetchFromYtDlp(channelUrl)
    entries = res.entries
    creatorInfo = res.creatorInfo
  }

  const seriesList = groupVideosIntoSeries(entries, creatorInfo)

  console.log('\n============================================================')
  console.log(`📊 KẾT QUẢ GOM SERIES: @${creatorInfo.creator_name}`)
  console.log(`Tổng số series tìm thấy: ${seriesList.length}`)
  console.log('============================================================')

  for (let i = 0; i < Math.min(10, seriesList.length); i++) {
    const s = seriesList[i]
    console.log(`\n🎬 ${i + 1}. ${s.title} (${s.video_count} video, Trạng thái: ${s.status})`)
    for (const v of s.videos.slice(0, 4)) {
      const p = v.part_number ? `P${v.part_number}` : 'Tập ?'
      console.log(`   - ${p}: ${v.url}`)
    }
  }

  await fs.writeFile(outputPath, JSON.stringify({
    creator: creatorInfo,
    total_series: seriesList.length,
    total_videos: entries.length,
    series: seriesList,
  }, null, 2), 'utf-8')
  console.log(`\n💾 Đã lưu kết quả vào: ${outputPath}`)

  if (shouldSaveSupabase) {
    await saveToSupabase(seriesList, creatorInfo)
  }
}

// Chạy trực tiếp qua CLI
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('crawl_tiktok.mjs') ||
  process.argv[1].endsWith('crawl_tiktok.js')
)

if (isDirectExecution) {
  main().catch((err) => {
    console.error('❌ Lỗi:', err)
    process.exit(1)
  })
}
