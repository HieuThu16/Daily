/**
 * Gom video rời của một kênh thành các series review.
 *
 * Thứ tự ưu tiên bằng chứng: playlist do nền tảng công bố > tên phim rút từ
 * tiêu đề. Playlist là dữ liệu người đăng tự khai, luôn thắng suy đoán chuỗi.
 */

import { detectPart, movieKey } from './partDetector.js'
import type { MovieMatch, NormalizedVideo, ReviewSeries, SeriesVideo } from './types.js'

function toSeriesVideo(video: NormalizedVideo): SeriesVideo {
  return { ...video, part: detectPart(video.title, video.description) }
}

/**
 * Rút tiêu đề hiển thị sạch sẽ nhưng GIỮ NGUYÊN DẤU TIẾNG VIỆT và chữ hoa/thường gốc.
 */
export function cleanDisplayTitle(rawTitle: string): string {
  if (!rawTitle) return ''
  let text = rawTitle.replace(/#\S+/g, ' ')
  text = text.replace(
    /\b(?:part|phan|phần|tap|tập|ep|episode|p)\s*[.:\-_]?\s*0*(\d{1,3})\b(?:\s*(?:\/\s*|of\s+|trên\s+|tren\s+)0*(\d{1,3})\b)?/gi,
    ' ',
  )
  text = text.replace(/#\s*0*(\d{1,3})\b(?:\s*\/\s*0*(\d{1,3})\b)?/gi, ' ')
  text = text.replace(/\b0*(\d{1,3})\s*(?:\/\s*|of\s+)0*(\d{1,3})\b/gi, ' ')
  text = text.replace(
    /\b(?:part\s*cuối|part\s*cuoi|phan\s*cuoi|phần\s*cuối|tập\s*cuối|tap\s*cuoi|kỳ\s*cuối|ky\s*cuoi|final(?:\s*part)?|finale|the\s*end|ending|kết\s*thúc|ket\s*thuc|hết|het|full\s*review)\b/gi,
    ' ',
  )
  text = text.replace(
    /\b(?:review|tóm\s*tắt|tom\s*tat|tomtat|full|hd|4k|vietsub|thuyết\s*minh|thuyet\s*minh|phim|movie|series|official|trailer|reaction|spoiler|toàn\s*bộ|toan\s*bo|hay\s*nhất|hay\s*nhat)\b/gi,
    ' ',
  )
  text = text.replace(/[|\-_–—:]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text || rawTitle.trim()
}

function movieOf(videos: SeriesVideo[], playlistName: string | null): MovieMatch {
  const evidence: string[] = []
  const keys = videos.map((v) => movieKey(v.title)).filter(Boolean)

  // Khoá xuất hiện nhiều nhất là tên phim đáng tin nhất của nhóm.
  const tally = new Map<string, number>()
  for (const k of keys) tally.set(k, (tally.get(k) ?? 0) + 1)
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]

  let key = best?.[0] ?? ''
  let confidence = 0

  const playlistKey = playlistName ? movieKey(playlistName) : ''
  if (playlistKey) {
    key = playlistKey
    confidence += 0.5
    evidence.push('playlist')
  }
  if (best) {
    evidence.push('title')
    confidence += 0.3
    if (best[1] > 1) {
      evidence.push('repeated creator series')
      confidence += 0.15
    }
  }

  // Lấy tiêu đề gốc tiếng Việt có dấu từ video tương ứng
  const matchingVideo = videos.find((v) => movieKey(v.title) === key)
  const bestAccentedTitle = matchingVideo
    ? cleanDisplayTitle(matchingVideo.title)
    : (videos[0] ? cleanDisplayTitle(videos[0].title) : key)

  const movieTitle = playlistKey ? playlistName!.trim() : (bestAccentedTitle || key)

  return {
    movieId: key,
    movieTitle,
    confidence: Math.min(confidence, 0.95),
    evidence,
  }
}

/**
 * Trả về các series của một creator. Video không rút được tên phim và cũng
 * không thuộc playlist nào thì bỏ qua — thà thiếu còn hơn gom bừa.
 */
export function resolveSeries(videos: NormalizedVideo[]): ReviewSeries[] {
  const byPlaylist = new Map<string, SeriesVideo[]>()

  for (const raw of videos) {
    if (!raw.title.trim()) continue
    const video = toSeriesVideo(raw)
    const key = video.playlistId ? `pl:${video.playlistId}` : `mv:${movieKey(video.title)}`
    if (key === 'mv:') continue
    const bucket = byPlaylist.get(key)
    if (bucket) bucket.push(video)
    else byPlaylist.set(key, [video])
  }

  // Playlist chỉ đáng tin khi nó là playlist CỦA MỘT PHIM. Nhiều kênh dồn mọi
  // phim vào một playlist tổng ("Review Phim Bộ") — giữ nguyên thì cả trăm phim
  // dính thành một series vô nghĩa, nên tách lại theo tên phim.
  const buckets = new Map<string, SeriesVideo[]>()
  for (const [key, bucketVideos] of byPlaylist) {
    if (!key.startsWith('pl:') || isSingleMoviePlaylist(bucketVideos)) {
      buckets.set(key, bucketVideos)
      continue
    }
    for (const video of bucketVideos) {
      const movie = movieKey(video.title)
      if (!movie) continue
      // Gỡ nhãn playlist, nếu không movieOf() lại lấy tên playlist tổng làm tên
      // phim cho từng mảnh vừa tách.
      const detached = { ...video, playlistId: null, playlistName: null }
      const split = buckets.get(`mv:${movie}`)
      if (split) split.push(detached)
      else buckets.set(`mv:${movie}`, [detached])
    }
  }

  const series: ReviewSeries[] = []
  for (const [key, bucketVideos] of buckets) {
    const sorted = sortVideos(bucketVideos)
    const first = sorted[0]
    const playlistName = first.playlistName
    const movie = movieOf(sorted, playlistName)
    series.push({
      seriesId: `${first.platform}:${first.creatorId}:${key}`,
      platform: first.platform,
      creatorId: first.creatorId,
      creatorName: first.creatorName,
      movie,
      playlistId: first.playlistId,
      title: playlistName ?? `${movie.movieTitle} — ${first.creatorName}`,
      videos: sorted,
    })
  }

  return series
}

/**
 * Playlist có phải của đúng một phim không.
 *
 * Đo bằng tên phim rút từ tiêu đề: playlist nhiều phần của một phim thì các
 * video cùng ra một khoá, còn playlist tổng thì mỗi video một khoá khác nhau.
 * Ngưỡng nửa số video — quá bán là đủ để tin, dưới thì thà tách ra còn hơn dính
 * cả trăm phim vào một thẻ.
 */
function isSingleMoviePlaylist(videos: SeriesVideo[]): boolean {
  if (videos.length <= 1) return true

  const tally = new Map<string, number>()
  for (const v of videos) {
    const key = movieKey(v.title)
    if (key) tally.set(key, (tally.get(key) ?? 0) + 1)
  }
  if (tally.size === 0) return true

  const top = Math.max(...tally.values())
  return top * 2 >= videos.length
}

/** Sắp theo số phần; thiếu số phần thì theo position rồi ngày đăng. */
function sortVideos(videos: SeriesVideo[]): SeriesVideo[] {
  return [...videos].sort((a, b) => {
    if (a.part.partNumber !== null && b.part.partNumber !== null) {
      return a.part.partNumber - b.part.partNumber
    }
    if (a.position !== null && b.position !== null) return a.position - b.position
    return a.publishedAt.localeCompare(b.publishedAt)
  })
}
