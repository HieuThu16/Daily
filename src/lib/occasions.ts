import type { Person, PersonOccasion } from '../types'

/** 'YYYY-MM-DD' → Date lúc 00:00 giờ địa phương (tránh lệch múi giờ của new Date(chuỗi)). */
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

/** Cắt phần giờ để so sánh thuần theo ngày. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Lần tới của dịp. Dịp một lần đã qua trả về null. */
export function nextOccurrence(occasion: PersonOccasion, today = new Date()): Date | null {
  const base = parseLocalDate(occasion.occasion_date)
  const from = startOfDay(today)

  if (!occasion.is_yearly) return base.getTime() >= from.getTime() ? base : null

  const build = (year: number) => {
    const candidate = new Date(year, base.getMonth(), base.getDate())
    // 29/02 ở năm không nhuận bị Date đẩy sang 01/03 → kéo về ngày cuối tháng 2.
    if (candidate.getMonth() !== base.getMonth()) return new Date(year, base.getMonth() + 1, 0)
    return candidate
  }

  const thisYear = build(from.getFullYear())
  return thisYear.getTime() >= from.getTime() ? thisYear : build(from.getFullYear() + 1)
}

/** Số ngày nguyên còn lại, làm tròn để không lệch vì giờ mùa hè. */
export function daysUntil(date: Date, today = new Date()): number {
  const diff = startOfDay(date).getTime() - startOfDay(today).getTime()
  return Math.round(diff / 86_400_000)
}

/** Tuổi sẽ tròn vào lần sinh nhật tới; null nếu không áp dụng. */
export function ageOnNext(occasion: PersonOccasion, today = new Date()): number | null {
  if (occasion.kind !== 'BIRTHDAY' || !occasion.is_yearly) return null
  const next = nextOccurrence(occasion, today)
  if (!next) return null
  const age = next.getFullYear() - parseLocalDate(occasion.occasion_date).getFullYear()
  return age > 0 ? age : null
}

export function occasionLabel(occasion: PersonOccasion, personName?: string | null): string {
  const title = occasion.title?.trim()
  if (title) return title
  const base = occasion.kind === 'BIRTHDAY' ? 'Sinh nhật' : 'Kỉ niệm'
  return personName ? `${base} ${personName}` : base
}

export function countdownLabel(days: number): string {
  if (days <= 0) return 'Hôm nay'
  if (days === 1) return 'Ngày mai'
  return `Còn ${days} ngày`
}

export type UpcomingOccasion = {
  occasion: PersonOccasion
  personName: string | null
  date: Date
  days: number
  label: string
}

export function upcomingOccasions(
  occasions: PersonOccasion[],
  people: Person[],
  today = new Date(),
  { withinDays = 60, limit = 3 }: { withinDays?: number; limit?: number } = {},
): UpcomingOccasion[] {
  const nameById = new Map(people.map((p) => [p.id, p.name]))

  return occasions
    .map((occasion): UpcomingOccasion | null => {
      const date = nextOccurrence(occasion, today)
      if (!date) return null
      const personName = occasion.person_id ? nameById.get(occasion.person_id) ?? null : null
      return { occasion, personName, date, days: daysUntil(date, today), label: occasionLabel(occasion, personName) }
    })
    .filter((item): item is UpcomingOccasion => item !== null && item.days <= withinDays)
    .sort((a, b) => a.days - b.days)
    .slice(0, limit)
}
