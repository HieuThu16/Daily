/** Kiểu chung cho hệ thống gom series review phim từ YouTube / TikTok. */

export type Platform = 'youtube' | 'tiktok'

/**
 * Video đã chuẩn hoá. Mọi logic phía sau chỉ được đọc kiểu này — connector nào
 * cũng phải quy về đây, để thêm nền tảng không phải sửa business logic.
 */
export type NormalizedVideo = {
  platform: Platform
  creatorId: string
  creatorName: string
  videoId: string
  canonicalUrl: string
  embedUrl: string
  title: string
  description: string
  publishedAt: string // ISO 8601
  duration: number | null // giây
  thumbnail: string | null
  playlistId: string | null
  playlistName: string | null
  position: number | null
  rawMetadata: unknown
}

/** Playlist / series do chính nền tảng công bố. Bằng chứng mạnh nhất. */
export type PlatformPlaylist = {
  platform: Platform
  playlistId: string
  name: string
  /** Số item nền tảng tự báo. null = không có số đáng tin. */
  itemCount: number | null
}

export type PartInfo = {
  partNumber: number | null
  totalParts: number | null
  isFinal: boolean
  confidence: number
}

export type MovieMatch = {
  movieId: string
  movieTitle: string
  confidence: number
  evidence: string[]
}

export type SeriesVideo = NormalizedVideo & { part: PartInfo }

export type ReviewSeries = {
  seriesId: string
  platform: Platform
  creatorId: string
  creatorName: string
  movie: MovieMatch
  /** Playlist id của nền tảng nếu series suy ra từ playlist. */
  playlistId: string | null
  title: string
  videos: SeriesVideo[]
}

export type CompletionStatus =
  | 'COMPLETE'
  | 'INCOMPLETE'
  | 'POSSIBLY_COMPLETE'
  | 'STALLED'
  | 'UNKNOWN'
  | 'ERROR'

export type CompletionResult = {
  status: CompletionStatus
  expected: number | null
  found: number
  missingParts: number[]
  confidence: number
  evidence: string[]
}
