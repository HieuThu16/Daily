import type { Entry, KnowledgeItem, Media, MoneyTransaction, Person, Todo } from '../types'

/**
 * Thống kê "hoạt động" — phần bù cho thống kê thời gian.
 *
 * Trang Thống kê cũ chỉ đo phút xem/đọc nên chỉ phủ được YouTube, truyện và sách.
 * Những tab còn lại không có khái niệm "phút": Tiền đo bằng số tiền, Việc đo bằng
 * số việc xong, Thói quen đo bằng tỉ lệ và chuỗi ngày. Ép hết về một thước đo là
 * mất nghĩa, nên mỗi tab giữ chỉ số của riêng nó.
 *
 * Hàm thuần: nhận dữ liệu đã tải sẵn, không tự gọi mạng — để test được.
 */

export type ActivityKey =
  | 'habit' | 'daily' | 'tasks' | 'money' | 'nutrition'
  | 'knowledge' | 'english' | 'library' | 'people' | 'watch'

/** Một con số phụ đứng cạnh dòng tóm tắt. */
export type ActivityMetric = { label: string; value: string }

/** Một dòng trong danh sách bung ra khi bấm mở. */
export type ActivityDetail = { key: string; title: string; subtitle?: string; value: string }

export type ActivitySection = {
  key: ActivityKey
  label: string
  /** Dòng tóm tắt chính — thứ đọc lướt cũng hiểu. */
  headline: string
  metrics: ActivityMetric[]
  details: ActivityDetail[]
}

export type HabitLogRow = { habit_id: string; date: string; completed: boolean }
export type NutritionRow = { food_name: string; price: number | string; meal_slot?: string; log_date: string }
export type SleepRow = { duration_minutes: number; log_date: string }
export type EnglishRow = { id: string; kind: string; term: string; created_at?: string | null }
export type ShareRow = {
  id: string
  sender_id: string
  sender_email: string | null
  recipient_email: string | null
  title: string
  created_at: string
}

export type ActivityInput = {
  /** Mốc 'YYYY-MM-DD'; dòng cũ hơn thì bỏ. Rỗng nghĩa là lấy tất cả. */
  from: string
  /** Số ngày của khoảng đang xem; 0 = tất cả. Dùng để tính tỉ lệ thói quen. */
  days: number
  habits?: { id: string; name: string; is_active?: boolean }[]
  habitLogs?: HabitLogRow[]
  entries?: Entry[]
  todos?: Todo[]
  transactions?: MoneyTransaction[]
  nutritionLogs?: NutritionRow[]
  sleepLogs?: SleepRow[]
  knowledge?: KnowledgeItem[]
  english?: EnglishRow[]
  media?: Media[]
  people?: Person[]
  shares?: ShareRow[]
  myUserId?: string | null
  /** Hôm nay, để tính "quá hạn". Tách ra cho test khỏi phụ thuộc đồng hồ thật. */
  today?: string
}

/** Ngày 'YYYY-MM-DD' lấy từ một cột date hoặc timestamptz. */
const day = (value?: string | null) => (value ?? '').slice(0, 10)

/** '1,2 triệu' / '350 nghìn' — số tiền đầy đủ đọc rất mệt trên điện thoại. */
export function formatMoney(amount: number): string {
  const n = Math.round(Math.abs(amount))
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')} triệu`
  }
  if (n >= 1_000) return `${Math.round(n / 1000)} nghìn`
  return `${n} đ`
}

/** Chuỗi ngày liên tiếp dài nhất trong một tập ngày. */
export function longestStreak(dates: Iterable<string>): number {
  const sorted = [...new Set(dates)].filter(Boolean).sort()
  let best = 0
  let run = 0
  let previous = ''
  for (const d of sorted) {
    if (previous) {
      const gap = (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86_400_000
      run = gap === 1 ? run + 1 : 1
    } else {
      run = 1
    }
    previous = d
    if (run > best) best = run
  }
  return best
}

/** Gộp theo khoá rồi xếp giảm dần, lấy tối đa `limit` dòng. */
function topBy<T>(
  rows: T[],
  keyOf: (row: T) => string,
  valueOf: (row: T) => number,
  render: (key: string, total: number, count: number) => ActivityDetail,
  limit = 12,
): ActivityDetail[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const row of rows) {
    const k = keyOf(row) || '(không rõ)'
    const found = map.get(k) ?? { total: 0, count: 0 }
    found.total += valueOf(row)
    found.count += 1
    map.set(k, found)
  }
  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total || b[1].count - a[1].count)
    .slice(0, limit)
    .map(([k, v]) => render(k, v.total, v.count))
}

export function buildActivityStats(input: ActivityInput): ActivitySection[] {
  const { from, days } = input
  const inRange = (d?: string | null) => !from || day(d) >= from
  const out: ActivitySection[] = []

  // --- Thói quen: tick được bao nhiêu lần, đều đặn tới đâu ---
  const habitLogs = (input.habitLogs ?? []).filter((l) => l.completed && inRange(l.date))
  if (habitLogs.length) {
    const habitName = new Map((input.habits ?? []).map((h) => [h.id, h.name]))
    const activeCount = (input.habits ?? []).filter((h) => h.is_active !== false).length
    // Khoảng "tất cả" thì không biết mẫu số thật, lấy số ngày đã từng tick làm mẫu.
    const span = days > 0 ? days : new Set(habitLogs.map((l) => l.date)).size
    const possible = activeCount * span
    const rate = possible > 0 ? Math.min(100, Math.round((habitLogs.length / possible) * 100)) : 0
    out.push({
      key: 'habit',
      label: 'Thói quen',
      headline: `${habitLogs.length} lần tick`,
      metrics: [
        { label: 'Đều đặn', value: `${rate}%` },
        { label: 'Chuỗi dài nhất', value: `${longestStreak(habitLogs.map((l) => l.date))} ngày` },
      ],
      details: topBy(
        habitLogs,
        (l) => habitName.get(l.habit_id) ?? 'Thói quen đã xoá',
        () => 1,
        (name, _total, count) => ({ key: name, title: name, value: `${count} lần` }),
      ),
    })
  }

  // --- Nhật ký: viết bao nhiêu bài, đều không ---
  const entries = (input.entries ?? []).filter((e) => inRange(e.entry_date))
  if (entries.length) {
    const dates = new Set(entries.map((e) => e.entry_date))
    out.push({
      key: 'daily',
      label: 'Nhật ký',
      headline: `${entries.length} bài viết`,
      metrics: [
        { label: 'Số ngày có viết', value: `${dates.size} ngày` },
        { label: 'Chuỗi dài nhất', value: `${longestStreak(dates)} ngày` },
      ],
      details: topBy(
        entries,
        (e) => String(e.entry_type ?? 'Khác'),
        () => 1,
        (type, _total, count) => ({ key: type, title: type, value: `${count} bài` }),
      ),
    })
  }

  // --- Việc: xong bao nhiêu, còn tồn bao nhiêu ---
  const todos = input.todos ?? []
  const doneInRange = todos.filter((t) => t.completed && inRange(t.completed_at ?? t.created_at))
  const pending = todos.filter((t) => !t.completed)
  if (doneInRange.length || pending.length) {
    const today = input.today ?? new Date().toLocaleDateString('sv-SE')
    const overdue = pending.filter((t) => t.due_date && t.due_date < today).length
    const postponed = doneInRange.reduce((sum, t) => sum + (Number(t.postpone_count) || 0), 0)
    out.push({
      key: 'tasks',
      label: 'Việc',
      headline: `${doneInRange.length} việc xong`,
      metrics: [
        { label: 'Còn lại', value: `${pending.length}` },
        { label: 'Quá hạn', value: `${overdue}` },
        { label: 'Lượt hoãn', value: `${postponed}` },
      ],
      details: topBy(
        doneInRange,
        (t) => t.category || 'Chưa phân loại',
        () => 1,
        (cat, _total, count) => ({ key: cat, title: cat, value: `${count} việc` }),
      ),
    })
  }

  // --- Tiền: thu chi trong khoảng ---
  const tx = (input.transactions ?? []).filter((t) => inRange(t.log_date))
  if (tx.length) {
    const income = tx.filter((t) => t.direction === 'IN').reduce((s, t) => s + Number(t.amount || 0), 0)
    const spend = tx.filter((t) => t.direction === 'OUT').reduce((s, t) => s + Number(t.amount || 0), 0)
    const diff = income - spend
    out.push({
      key: 'money',
      label: 'Tiền',
      headline: `Chi ${formatMoney(spend)}`,
      metrics: [
        { label: 'Thu', value: formatMoney(income) },
        { label: diff >= 0 ? 'Dư' : 'Hụt', value: formatMoney(diff) },
        { label: 'Số khoản', value: `${tx.length}` },
      ],
      details: topBy(
        tx.filter((t) => t.direction === 'OUT'),
        (t) => t.category || 'Chưa phân loại',
        (t) => Number(t.amount || 0),
        (cat, total, count) => ({ key: cat, title: cat, subtitle: `${count} khoản`, value: formatMoney(total) }),
      ),
    })
  }

  // --- Dưỡng: ăn uống và giấc ngủ ---
  const meals = (input.nutritionLogs ?? []).filter((n) => inRange(n.log_date))
  const sleeps = (input.sleepLogs ?? []).filter((s) => inRange(s.log_date))
  if (meals.length || sleeps.length) {
    const foodCost = meals.reduce((s, m) => s + Number(m.price || 0), 0)
    const metrics: ActivityMetric[] = [{ label: 'Tiền ăn', value: formatMoney(foodCost) }]
    if (sleeps.length) {
      const avg = Math.round(sleeps.reduce((s, x) => s + (Number(x.duration_minutes) || 0), 0) / sleeps.length)
      metrics.push({ label: 'Ngủ trung bình', value: `${Math.floor(avg / 60)}h${String(avg % 60).padStart(2, '0')}` })
      metrics.push({ label: 'Đêm đã ghi', value: `${sleeps.length}` })
    }
    out.push({
      key: 'nutrition',
      label: 'Dưỡng',
      headline: `${meals.length} bữa ăn`,
      metrics,
      details: topBy(
        meals,
        (m) => m.food_name || 'Món lạ',
        (m) => Number(m.price || 0),
        (name, total, count) => ({ key: name, title: name, subtitle: `${count} lần`, value: formatMoney(total) }),
      ),
    })
  }

  // --- Kiến thức: thẻ mới thêm ---
  const cards = (input.knowledge ?? []).filter((k) => inRange(k.created_at))
  if (cards.length) {
    out.push({
      key: 'knowledge',
      label: 'Kiến thức',
      headline: `${cards.length} thẻ mới`,
      metrics: [{ label: 'Thể loại', value: `${new Set(cards.map((c) => c.category || 'Khác')).size}` }],
      details: topBy(
        cards,
        (c) => c.category || 'Chưa phân loại',
        () => 1,
        (cat, _total, count) => ({ key: cat, title: cat, value: `${count} thẻ` }),
      ),
    })
  }

  // --- English: từ và câu mới ---
  const eng = (input.english ?? []).filter((e) => inRange(e.created_at))
  if (eng.length) {
    const words = eng.filter((e) => e.kind !== 'SENTENCE').length
    out.push({
      key: 'english',
      label: 'English',
      headline: `${eng.length} mục mới`,
      metrics: [
        { label: 'Từ', value: `${words}` },
        { label: 'Câu', value: `${eng.length - words}` },
      ],
      details: eng.slice(0, 12).map((e) => ({
        key: e.id,
        title: e.term,
        subtitle: e.kind === 'SENTENCE' ? 'Câu' : 'Từ',
        value: day(e.created_at),
      })),
    })
  }

  // --- Thư viện: sách, phim, nhạc, truyện thêm vào ---
  const MEDIA_LABEL: Record<string, string> = {
    BOOK: 'Sách', MOVIE: 'Phim', MUSIC: 'Nhạc', MANGA: 'Truyện', YOUTUBE: 'YouTube',
  }
  const media = (input.media ?? []).filter((m) => inRange(m.created_at))
  if (media.length) {
    out.push({
      key: 'library',
      label: 'Thư viện',
      headline: `${media.length} mục mới`,
      metrics: [
        { label: 'Đã xong', value: `${media.filter((m) => m.status === 'COMPLETED').length}` },
        { label: 'Đang dở', value: `${media.filter((m) => m.status === 'IN_PROGRESS').length}` },
      ],
      details: topBy(
        media,
        (m) => MEDIA_LABEL[m.type] ?? m.type,
        () => 1,
        (type, _total, count) => ({ key: type, title: type, value: `${count} mục` }),
      ),
    })
  }

  // --- Người: sổ người quen ---
  const people = input.people ?? []
  if (people.length) {
    out.push({
      key: 'people',
      label: 'Người',
      headline: `${people.length} người`,
      metrics: [{ label: 'Thêm trong kỳ', value: `${people.filter((p) => inRange(p.created_at)).length}` }],
      details: topBy(
        people,
        (p) => String(p.group_key ?? 'Chưa nhóm'),
        () => 1,
        (group, _total, count) => ({ key: group, title: group, value: `${count} người` }),
      ),
    })
  }

  // --- Xem chung: gửi đi và nhận về ---
  const shares = (input.shares ?? []).filter((s) => inRange(s.created_at))
  if (shares.length) {
    const sent = shares.filter((s) => s.sender_id === input.myUserId)
    out.push({
      key: 'watch',
      label: 'Xem chung',
      headline: `${sent.length} lượt gửi`,
      metrics: [{ label: 'Nhận được', value: `${shares.length - sent.length}` }],
      details: shares.slice(0, 12).map((s) => ({
        key: s.id,
        title: s.title,
        subtitle: s.sender_id === input.myUserId ? `Gửi ${s.recipient_email ?? ''}` : `Từ ${s.sender_email ?? ''}`,
        value: day(s.created_at),
      })),
    })
  }

  return out
}
