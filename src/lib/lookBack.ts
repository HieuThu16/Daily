/**
 * "Nhìn lại": ngày này tuần trước và ngày này tháng trước.
 *
 * Khác `anniversary.ts` — chỗ đó lo kỷ niệm trùng ngày-tháng qua nhiều năm.
 * Ở đây chỉ hai mốc gần, kèm tóm tắt hôm đó đã làm được gì.
 *
 * Hàm thuần: nhận dữ liệu đã tải sẵn, không tự gọi mạng — để test được.
 */

export type LookBackKind = 'WEEK' | 'MONTH'

export type LookBackSummary = {
  kind: LookBackKind
  /** Ngày được nhìn lại, dạng 'YYYY-MM-DD'. */
  date: string
  /** 'Ngày này tuần trước' / 'Ngày này tháng trước'. */
  label: string
  entries: number
  tasksDone: number
  habitsDone: number
  /** Số lượt đọc truyện ghi được hôm đó. */
  mangaChapters: number
  /** Số phút đọc sách. */
  bookMinutes: number
  /** Số video đã xem. */
  videos: number
  /** Vài dòng nhật ký đầu, xem lướt là nhớ ra hôm đó. */
  preview: string[]
  /** Có gì đáng xem lại không; rỗng thì đừng làm phiền. */
  hasAnything: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Ngày này tuần trước, theo lịch địa phương. */
export function sameDayLastWeek(today: string): string {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() - 7)
  return key(d)
}

/**
 * Ngày này tháng trước.
 *
 * Ngày 31 mà tháng trước chỉ có 30 thì `setMonth` tự nhảy sang tháng sau
 * (31/03 lùi một tháng thành 03/03) — phải kẹp về ngày cuối tháng cho đúng ý.
 */
export function sameDayLastMonth(today: string): string {
  const d = new Date(`${today}T12:00:00`)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return key(d)
}

/** Ngày của một bản ghi; các bảng đặt tên cột khác nhau nên phải dò vài kiểu. */
function dateOf(row: Record<string, unknown>): string {
  const raw = row.entry_date ?? row.log_date ?? row.date ?? row.readAt ?? ''
  return String(raw).slice(0, 10)
}

export type LookBackInput = {
  entries?: Array<{ entry_date?: string | null; content?: string | null }>
  todos?: Array<{ completed?: boolean; completed_at?: string | null }>
  habitLogs?: Array<{ date: string; completed: boolean }>
  mangaLogs?: Array<{ readAt?: string; log_date?: string }>
  bookLogs?: Array<{ log_date?: string; durationMinutes?: number | null }>
  videoLogs?: Array<{ log_date?: string }>
}

/** Dựng tóm tắt cho một ngày. */
export function summarizeDay(date: string, kind: LookBackKind, input: LookBackInput): LookBackSummary {
  const onDay = <T,>(rows: T[] = []): T[] =>
    rows.filter((r) => dateOf(r as Record<string, unknown>) === date)

  const entries = onDay(input.entries ?? [])
  const tasksDone = (input.todos ?? []).filter(
    (t) => t.completed && String(t.completed_at ?? '').slice(0, 10) === date,
  ).length
  const habitsDone = (input.habitLogs ?? []).filter((l) => l.completed && l.date === date).length
  const mangaChapters = onDay(input.mangaLogs ?? []).length
  const bookMinutes = onDay(input.bookLogs ?? []).reduce(
    (sum, r) => sum + (Number(r.durationMinutes) || 0),
    0,
  )
  const videos = onDay(input.videoLogs ?? []).length

  return {
    kind,
    date,
    label: kind === 'WEEK' ? 'Ngày này tuần trước' : 'Ngày này tháng trước',
    entries: entries.length,
    tasksDone,
    habitsDone,
    mangaChapters,
    bookMinutes,
    videos,
    preview: entries
      .map((e) => String(e.content ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 3),
    hasAnything: entries.length + tasksDone + habitsDone + mangaChapters + videos > 0 || bookMinutes > 0,
  }
}

/** Một dòng chữ gọn cho chuông thông báo. */
export function summaryLine(s: LookBackSummary): string {
  const parts: string[] = []
  if (s.entries) parts.push(`${s.entries} nhật ký`)
  if (s.tasksDone) parts.push(`${s.tasksDone} việc xong`)
  if (s.habitsDone) parts.push(`${s.habitsDone} thói quen`)
  if (s.mangaChapters) parts.push(`${s.mangaChapters} lượt đọc truyện`)
  if (s.bookMinutes) parts.push(`${s.bookMinutes} phút đọc sách`)
  if (s.videos) parts.push(`${s.videos} video`)
  return parts.length ? parts.join(' · ') : 'Hôm đó không ghi gì'
}

/** Hai mốc nhìn lại, chỉ giữ mốc thật sự có gì để xem. */
export function buildLookBack(today: string, input: LookBackInput): LookBackSummary[] {
  return [
    summarizeDay(sameDayLastWeek(today), 'WEEK', input),
    summarizeDay(sameDayLastMonth(today), 'MONTH', input),
  ].filter((s) => s.hasAnything)
}
