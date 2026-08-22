/**
 * Bộ tiện ích nhận diện và gom nhóm video TikTok thành Series / Phim (Browser-safe).
 */

export type ParsedPartInfo = {
  partNumber: number | null
  totalParts: number | null
  isFinal: boolean
  confidence: number
}

function removeAccents(str = ''): string {
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

export function extractPartInfo(title = ''): ParsedPartInfo {
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

export function extractSeriesName(title = ''): string {
  let text = title.replace(/#\S+/g, ' ')
  text = text.replace(
    /\b(?:part|phan|phần|tap|tập|ep|episode|p)\s*[.:\-_]?\s*0*(\d{1,3})\b(?:\s*(?:\/|of|trên|tren)\s*0*(\d{1,3}))?/gi,
    ' ',
  )
  text = text.replace(/#\s*0*(\d{1,3})\b(?:\s*\/\s*0*(\d{1,3}))?/gi, ' ')
  text = text.replace(/\b0*(\d{1,3})\s*(?:\/|of)\s*0*(\d{1,3})\b/gi, ' ')
  text = text.replace(FINAL_REGEX, ' ')
  text = text.replace(
    /\b(?:review|tóm\s*tắt|tom\s*tat|full|hd|4k|vietsub|thuyết\s*minh|thuyet\s*minh|phim|movie|series|official|trailer|reaction|spoiler|toàn\s*bộ|hay\s*nhất)\b/gi,
    ' ',
  )
  text = text.replace(/[|\-_–—:;,.!?]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length >= 2 ? text : title.slice(0, 40).trim()
}

export function normalizeSeriesKey(name = ''): string {
  return removeAccents(name).replace(/[^a-z0-9]+/g, ' ').trim()
}

export function groupVideosIntoSeries(entries: any[], creatorInfo: { creator_id?: string; creator_name?: string; creator_url?: string }) {
  const seriesMap = new Map<string, any>()

  for (const item of entries) {
    const rawTitle = item.title || item.description || ''
    const videoId = String(item.id || '')
    const url = item.url || item.webpage_url || `https://www.tiktok.com/@${creatorInfo.creator_name}/video/${videoId}`
    const thumbnail =
      item.thumbnail || (Array.isArray(item.thumbnails) ? item.thumbnails[item.thumbnails.length - 1]?.url : null)
    const timestamp = item.timestamp || item.upload_date
    const publishedAt =
      typeof timestamp === 'number'
        ? new Date(timestamp * 1000).toISOString()
        : String(timestamp || new Date().toISOString())
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
        series_key: `tiktok:${creatorInfo.creator_id || 'creator'}:${seriesKey}`,
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

  const resultSeries: any[] = []
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
