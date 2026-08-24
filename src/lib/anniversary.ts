/**
 * Kỷ niệm rơi đúng ngày này của các tháng/năm trước: "1 tháng trước", "2 năm trước"…
 * Dùng cho thẻ nhắc trong tab Kỷ niệm và mục Kỷ niệm trong chuông thông báo.
 */

type DatedEvent = { event_date: string }

export type Anniversary<T extends DatedEvent> = { event: T; monthsAgo: number }

/**
 * '2024-08-20' + hôm nay '2026-08-20' → 24 tháng (2 năm) trước.
 * Giữ mốc tròn năm ở mọi khoảng cách, còn mốc theo tháng chỉ nhắc trong vòng 1 năm
 * để chuông không đầy "37 tháng trước".
 */
export function anniversariesOn<T extends DatedEvent>(events: T[], today: string): Array<Anniversary<T>> {
  const day = today.slice(8)
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))

  return events
    .filter((e) => typeof e.event_date === 'string' && e.event_date.slice(8) === day)
    .map((event) => ({
      event,
      monthsAgo: (year - Number(event.event_date.slice(0, 4))) * 12 + month - Number(event.event_date.slice(5, 7)),
    }))
    .filter((a) => a.monthsAgo > 0 && (a.monthsAgo < 12 || a.monthsAgo % 12 === 0))
    .sort((a, b) => a.monthsAgo - b.monthsAgo)
}

export const yearsAgoLabel = (monthsAgo: number) =>
  monthsAgo % 12 === 0 ? `${monthsAgo / 12} năm trước` : `${monthsAgo} tháng trước`
