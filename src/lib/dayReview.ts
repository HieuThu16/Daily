import type { Entry, Media, NutritionLog, SleepLog, Todo } from '../types'

/** Một mốc trong dòng thời gian của một ngày. `time` dạng 'HH:MM'. */
export type DayEvent = {
  time: string
  kind: 'WAKE' | 'MEAL' | 'DIARY' | 'TASK_ADD' | 'TASK_DONE' | 'MEDIA'
  label: string
  detail: string
}

const mealLabel: Record<NutritionLog['meal_slot'], string> = {
  MORNING: 'Ăn sáng',
  LUNCH: 'Ăn trưa',
  AFTERNOON: 'Ăn xế',
  EVENING: 'Ăn tối',
}

const mediaLabel: Record<Media['type'], string> = {
  BOOK: 'Đọc sách',
  MOVIE: 'Xem phim',
  YOUTUBE: 'Xem YouTube',
  MUSIC: 'Nghe nhạc',
  MANGA: 'Đọc truyện',
}

/** 'HH:MM' từ một timestamptz; '' nếu không parse được. */
function clock(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function sameDay(iso: string | null | undefined, date: string) {
  return clock(iso) !== '' && new Date(iso!).toLocaleDateString('sv-SE') === date
}

export type DayReviewInput = {
  date: string
  entries: Entry[]
  meals: NutritionLog[]
  sleeps: SleepLog[]
  todos: Todo[]
  media: Media[]
}

/** Gom mọi hoạt động đã có giờ của một ngày thành dòng thời gian tăng dần. */
export function buildDayReview({ date, entries, meals, sleeps, todos, media }: DayReviewInput): DayEvent[] {
  const events: DayEvent[] = []

  sleeps.filter((s) => s.log_date === date && s.sleep_end).forEach((s) =>
    events.push({ time: s.sleep_end, kind: 'WAKE', label: 'Thức dậy', detail: `Ngủ từ ${s.sleep_start}` }))

  meals.filter((m) => m.log_date === date).forEach((m) =>
    events.push({ time: m.log_time || '', kind: 'MEAL', label: mealLabel[m.meal_slot], detail: m.food_name }))

  entries.filter((e) => e.entry_date === date).forEach((e) =>
    events.push({ time: e.entry_time || clock(e.created_at), kind: 'DIARY', label: 'Viết nhật ký', detail: e.content }))

  todos.forEach((t) => {
    if (sameDay(t.created_at, date)) events.push({ time: clock(t.created_at), kind: 'TASK_ADD', label: 'Thêm việc', detail: t.title })
    if (t.completed && sameDay(t.completed_at, date)) events.push({ time: clock(t.completed_at), kind: 'TASK_DONE', label: 'Xong việc', detail: t.title })
  })

  media.filter((m) => m.log_date === date).forEach((m) =>
    events.push({ time: m.log_time || '', kind: 'MEDIA', label: mediaLabel[m.type], detail: m.artist || m.channel ? `${m.name} — ${m.artist || m.channel}` : m.name }))

  // Mục chưa có giờ vẫn giữ lại nhưng xếp cuối, để không im lặng nuốt dữ liệu.
  return events.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
}
