/**
 * Kỷ niệm rơi đúng ngày này của các năm trước: "1 năm trước", "2 năm trước"…
 * Dùng cho thẻ nhắc trong tab Kỷ niệm và mục Kỷ niệm trong chuông thông báo.
 */

type DatedEvent = { event_date: string }

export type Anniversary<T extends DatedEvent> = { event: T; yearsAgo: number }

/** '2024-08-20' + hôm nay '2026-08-20' → 2 năm trước. Cùng năm hoặc tương lai thì bỏ qua. */
export function anniversariesOn<T extends DatedEvent>(events: T[], today: string): Array<Anniversary<T>> {
  const monthDay = today.slice(5)
  const year = Number(today.slice(0, 4))

  return events
    .filter((e) => typeof e.event_date === 'string' && e.event_date.slice(5) === monthDay)
    .map((event) => ({ event, yearsAgo: year - Number(event.event_date.slice(0, 4)) }))
    .filter((a) => a.yearsAgo > 0)
    .sort((a, b) => a.yearsAgo - b.yearsAgo)
}

export const yearsAgoLabel = (yearsAgo: number) => `${yearsAgo} năm trước`
