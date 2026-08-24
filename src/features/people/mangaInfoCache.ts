import { fetchHMangaList, getCustomHMangaList } from '../manga/hMangaService'
import { fetchNgontinhList } from '../manga/ngontinhService'
import { fetchBLMangaList } from '../manga/mangaService'

export type MangaInfo = { type: 'NGONTINH' | 'BL' | 'H_MANGA'; cover?: string; title?: string }
export type MangaInfoMap = Map<string, MangaInfo>

const STORAGE_KEY = 'daily_manga_info_cache_v1'
const TTL_MS = 6 * 60 * 60 * 1000

let inflight: Promise<MangaInfoMap> | null = null

function readCache(): MangaInfoMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.at || Date.now() - parsed.at > TTL_MS) return null
    return new Map(parsed.entries)
  } catch {
    return null
  }
}

function writeCache(map: MangaInfoMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), entries: [...map] }))
  } catch {
    /* hết chỗ thì thôi, lần sau tải lại */
  }
}

async function build(): Promise<MangaInfoMap> {
  const map: MangaInfoMap = new Map()
  const [hList, blList, ngontinhList] = await Promise.all([
    fetchHMangaList().catch(() => []),
    fetchBLMangaList().catch(() => []),
    fetchNgontinhList().catch(() => []),
  ])
  const add = (list: any[], type: MangaInfo['type']) => {
    for (const m of list) {
      if (m?.slug) map.set(String(m.slug).toLowerCase().trim(), { type, cover: m.cover ?? undefined, title: m.title ?? undefined })
    }
  }
  add([...hList, ...getCustomHMangaList()], 'H_MANGA')
  add(blList, 'BL')
  add(ngontinhList, 'NGONTINH')
  if (map.size > 0) writeCache(map)
  return map
}

/**
 * Bảng tra ảnh bìa / thể loại truyện theo slug.
 *
 * Dựng bảng này phải gọi ra mấy nguồn truyện bên ngoài nên rất chậm, mà nội
 * dung thì gần như không đổi trong ngày — nhớ lại 6 tiếng và gộp các lời gọi
 * trùng nhau, nếu không tab Xem chung sẽ crawl lại mỗi lần có sự kiện realtime.
 */
export function loadMangaInfo(): Promise<MangaInfoMap> {
  const cached = readCache()
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = build().finally(() => {
      inflight = null
    })
  }
  return inflight
}
