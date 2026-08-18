import { supabase } from './supabase'

export type SearchHit = {
  id: string
  /** Nhóm hiển thị trong palette. */
  group: string
  title: string
  subtitle?: string
  /** Đường dẫn điều hướng khi chọn. */
  path: string
}

/** Bỏ dấu tiếng Việt + hạ chữ thường để "cong viec" khớp "Công việc". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export function matches(haystack: string, query: string): boolean {
  return normalize(haystack).includes(normalize(query))
}

/** Lọc danh sách tĩnh (tab điều hướng) — chạy được offline, không cần mạng. */
export function filterStatic<T>(items: T[], query: string, text: (item: T) => string): T[] {
  const q = normalize(query)
  if (!q) return items
  return items.filter((item) => normalize(text(item)).includes(q))
}

type TableSpec = {
  table: string
  group: string
  /** Cột đem đi so khớp bằng ilike. */
  columns: string[]
  toHit: (row: Record<string, unknown>) => SearchHit
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

const SPECS: TableSpec[] = [
  {
    table: 'todos',
    group: 'Công việc',
    columns: ['title'],
    toHit: (r) => ({ id: `todo-${r.id}`, group: 'Công việc', title: str(r.title), subtitle: str(r.due_date) || undefined, path: `/tasks?id=${r.id}` }),
  },
  {
    table: 'people',
    group: 'Người',
    columns: ['name', 'notes'],
    toHit: (r) => ({ id: `person-${r.id}`, group: 'Người', title: str(r.name), subtitle: str(r.notes) || undefined, path: '/people' }),
  },
  {
    table: 'english_items',
    group: 'English',
    columns: ['term', 'meaning'],
    toHit: (r) => ({ id: `en-${r.id}`, group: 'English', title: str(r.term), subtitle: str(r.meaning) || undefined, path: '/english' }),
  },
  {
    table: 'knowledge_items',
    group: 'Kiến thức',
    columns: ['question', 'answer'],
    toHit: (r) => ({ id: `kn-${r.id}`, group: 'Kiến thức', title: str(r.question), subtitle: str(r.answer) || undefined, path: '/knowledge' }),
  },
  {
    table: 'media_items',
    group: 'Thư viện',
    columns: ['name', 'author', 'artist', 'channel'],
    toHit: (r) => ({
      id: `media-${r.id}`,
      group: 'Thư viện',
      title: str(r.name),
      subtitle: str(r.author) || str(r.artist) || str(r.channel) || undefined,
      path: mediaPath(str(r.type)),
    }),
  },
  {
    table: 'daily_entries',
    group: 'Nhật ký',
    columns: ['content'],
    toHit: (r) => ({ id: `daily-${r.id}`, group: 'Nhật ký', title: str(r.content).slice(0, 80), subtitle: str(r.log_date) || undefined, path: '/daily' }),
  },
]

export function mediaPath(type: string): string {
  switch (type) {
    case 'BOOK': return '/books'
    case 'MOVIE': return '/movies'
    case 'MUSIC': return '/music'
    case 'MANGA': return '/manga'
    default: return '/books'
  }
}

/** `or()` của PostgREST: term.ilike.%q%,meaning.ilike.%q% */
export function buildOrFilter(columns: string[], query: string): string {
  // Dấu phẩy và ngoặc trong query sẽ phá cú pháp or() → bỏ đi.
  const safe = query.replace(/[,()%]/g, ' ').trim()
  return columns.map((c) => `${c}.ilike.%${safe}%`).join(',')
}

const PER_TABLE = 5

/** Tìm song song trên các bảng chính. Bảng nào lỗi thì bỏ qua, không làm hỏng cả kết quả. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  if (!supabase || query.trim().length < 2) return []
  const client = supabase
  const results = await Promise.all(
    SPECS.map(async (spec) => {
      try {
        const { data, error } = await client
          .from(spec.table)
          .select('*')
          .or(buildOrFilter(spec.columns, query))
          .limit(PER_TABLE)
        if (error || !data) return []
        return (data as Record<string, unknown>[]).filter((r) => !r.deleted_at).map(spec.toHit)
      } catch {
        return []
      }
    }),
  )
  return results.flat()
}
