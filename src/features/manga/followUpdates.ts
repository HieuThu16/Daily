/**
 * Phát hiện truyện đang theo dõi có chương mới.
 *
 * Cách làm: mỗi lần người dùng xem thông báo, số chương hiện tại được ghi lại vào
 * localStorage. Lần sau nếu dữ liệu crawl về nhiều chương hơn số đã ghi thì đó là chương mới.
 */

const SEEN_KEY = 'daily_manga_seen_chapters'

export type MangaKind = 'BL' | 'NGONTINH'

/** Thông tin tối thiểu cần để so sánh — hợp với cả BLManga lẫn NgontinhManga. */
export type FollowableManga = {
  slug: string
  title: string
  cover?: string | null
  totalChapters?: number
  chapters?: unknown[]
}

export type MangaUpdate = {
  key: string
  kind: MangaKind
  slug: string
  title: string
  cover?: string | null
  chapterCount: number
  newChapters: number
}

export type SeenMap = Record<string, number>

/** Khoá lưu trữ gộp loại truyện và slug để BL và Ngôn Tình không đè lên nhau. */
export function seenKey(kind: MangaKind, slug: string): string {
  return `${kind}:${slug}`
}

/** Số chương hiện có của một truyện. */
export function chapterCount(manga: FollowableManga): number {
  return manga.totalChapters ?? manga.chapters?.length ?? 0
}

export function getSeenChapters(): SeenMap {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {}
  } catch {
    return {}
  }
}

export function saveSeenChapters(seen: SeenMap): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch {
    // Hết dung lượng hoặc bị chặn — bỏ qua, lần sau vẫn so sánh được với dữ liệu cũ.
  }
}

/**
 * Lọc ra những truyện đang theo dõi có thêm chương so với lần xem trước.
 * Truyện mới theo dõi (chưa có mốc) coi như đã xem hết, không báo ngay.
 */
export function findNewChapters(
  mangas: FollowableManga[],
  followedSlugs: string[],
  kind: MangaKind,
  seen: SeenMap,
): MangaUpdate[] {
  const followed = new Set(followedSlugs)
  const updates: MangaUpdate[] = []
  for (const manga of mangas) {
    if (!followed.has(manga.slug)) continue
    const key = seenKey(kind, manga.slug)
    const count = chapterCount(manga)
    const before = seen[key]
    if (before === undefined || count <= before) continue
    updates.push({
      key,
      kind,
      slug: manga.slug,
      title: manga.title,
      cover: manga.cover,
      chapterCount: count,
      newChapters: count - before,
    })
  }
  return updates.sort((a, b) => b.newChapters - a.newChapters)
}

/** Ghi mốc "đã xem" cho mọi truyện đang theo dõi, kể cả truyện chưa từng có mốc. */
export function markSeen(
  mangas: FollowableManga[],
  followedSlugs: string[],
  kind: MangaKind,
  seen: SeenMap,
): SeenMap {
  const followed = new Set(followedSlugs)
  const next = { ...seen }
  for (const manga of mangas) {
    if (followed.has(manga.slug)) next[seenKey(kind, manga.slug)] = chapterCount(manga)
  }
  return next
}
