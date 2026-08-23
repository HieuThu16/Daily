/**
 * Đoán link YouTube vừa chia sẻ thuộc mục nào: nhạc, TV Show, review phim hay video lẻ.
 *
 * Không có API key nên không đọc được thời lượng hay thể loại từ YouTube —
 * oEmbed chỉ cho tiêu đề và tên kênh. Bù lại app có thứ YouTube không có:
 * danh sách kênh bạn đã theo dõi. Kênh đã biết là bằng chứng chắc nhất,
 * sau đó mới tới tên miền và từ khoá trong tiêu đề.
 */

export type ShareKind = 'MUSIC' | 'TVSHOW' | 'REVIEW' | 'VIDEO'

export type ShareGuess = {
  kind: ShareKind
  /** Chắc chắn thì đi thẳng, không thì hỏi lại người dùng. */
  confident: boolean
  reason: string
}

export type KnownChannels = { tvshow: string[]; review: string[] }

const MUSIC_WORDS = [
  'official music video', 'music video', 'official audio', 'lyrics', 'lyric video',
  'karaoke', 'audio official', 'mv', 'cover', 'acoustic', 'live performance', 'remix', 'beat',
]

const REVIEW_WORDS = [
  'review', 'tóm tắt phim', 'tom tat phim', 'recap phim', 'spoiler', 'phân tích phim', 'bóc phim',
]

const TVSHOW_WORDS = ['tập ', 'tap ', 'ep.', 'episode', 'số ', 'phần ', 'season', 'talkshow', 'gameshow']

const norm = (value: string) => value.toLowerCase().trim()

/** So tên kênh không phân biệt hoa thường và khoảng trắng thừa. */
const hasChannel = (list: string[], author: string) =>
  Boolean(author) && list.some((name) => norm(name) === norm(author))

export function guessShareKind(
  link: string,
  meta: { title?: string; author?: string } | null,
  known: KnownChannels = { tvshow: [], review: [] },
): ShareGuess {
  const title = norm(meta?.title ?? '')
  const author = meta?.author ?? ''

  // 1. Kênh đã có trong app — bằng chứng mạnh nhất, không cần đoán thêm.
  if (hasChannel(known.review, author)) return { kind: 'REVIEW', confident: true, reason: `Kênh "${author}" đã có trong Review phim` }
  if (hasChannel(known.tvshow, author)) return { kind: 'TVSHOW', confident: true, reason: `Kênh "${author}" đã có trong TV Show` }

  // 2. Chia sẻ từ YouTube Music thì chắc chắn là nhạc.
  try {
    if (new URL(link).hostname.replace(/^www\./, '') === 'music.youtube.com') {
      return { kind: 'MUSIC', confident: true, reason: 'Link đến từ YouTube Music' }
    }
  } catch {
    // Link hỏng thì bỏ qua, để các bước sau đoán tiếp.
  }

  // 3. Kênh VEVO / "- Topic" gần như luôn là kênh nhạc chính thức.
  if (/vevo|official artist|- topic$/i.test(author)) {
    return { kind: 'MUSIC', confident: true, reason: `Kênh "${author}" là kênh nhạc chính thức` }
  }

  // 4. Từ khoá trong tiêu đề — đoán được nhưng vẫn nên hỏi lại.
  const hit = (words: string[]) => words.find((word) => title.includes(word))

  const reviewWord = hit(REVIEW_WORDS)
  if (reviewWord) return { kind: 'REVIEW', confident: false, reason: `Tiêu đề có "${reviewWord}"` }

  const musicWord = hit(MUSIC_WORDS)
  if (musicWord) return { kind: 'MUSIC', confident: false, reason: `Tiêu đề có "${musicWord}"` }

  const tvWord = hit(TVSHOW_WORDS)
  if (tvWord) return { kind: 'TVSHOW', confident: false, reason: `Tiêu đề có "${tvWord}"` }

  return { kind: 'VIDEO', confident: false, reason: 'Chưa đoán được, chọn giúp mình nhé' }
}

/** Nơi mỗi loại được mở ra, kèm link đã điền sẵn. */
export const SHARE_ROUTES: Record<ShareKind, (link: string) => string> = {
  MUSIC: (link) => `/music?youtube=${encodeURIComponent(link)}`,
  TVSHOW: (link) => `/youtube?youtube=${encodeURIComponent(link)}`,
  REVIEW: (link) => `/youtube?youtube=${encodeURIComponent(link)}`,
  VIDEO: (link) => `/movies?youtube=${encodeURIComponent(link)}`,
}

export const SHARE_LABELS: Record<ShareKind, string> = {
  MUSIC: '🎵 Nhạc',
  TVSHOW: '📺 TV Show',
  REVIEW: '🎬 Review phim',
  VIDEO: '🎞️ Video lẻ',
}
