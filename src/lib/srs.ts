/**
 * Lặp lại ngắt quãng, SM-2 rút gọn.
 *
 * Mỗi thẻ giữ ba con số: `ease` (hệ số dễ), `interval_days` (khoảng cách tới lần ôn kế)
 * và `due_date` (ngày đến hạn). Người học chấm một trong bốn mức sau khi lật thẻ; thuật
 * toán quyết định bao lâu nữa gặp lại. Nhớ càng chắc thì khoảng cách càng giãn ra.
 */

export type Grade = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

export type SrsFields = {
  /** Hệ số dễ, càng cao thì giãn càng nhanh. Chuẩn SM-2 khởi điểm 2.5. */
  ease: number
  /** Số ngày tới lần ôn kế tiếp. */
  interval_days: number
  /** Ngày đến hạn ôn, dạng 'YYYY-MM-DD'. */
  due_date: string
  /** Số lần ôn đã qua. Dùng để phân biệt thẻ mới với thẻ đang học. */
  reps: number
  /** Số lần bấm "Quên". Thẻ hay quên được ưu tiên đưa lên đầu hàng đợi. */
  lapses: number
}

export const DEFAULT_EASE = 2.5
const MIN_EASE = 1.3
const MAX_EASE = 3
const MAX_INTERVAL_DAYS = 365

/** Thẻ chưa từng ôn: đến hạn ngay hôm nay. */
export function initialSrs(today: string): SrsFields {
  return { ease: DEFAULT_EASE, interval_days: 0, due_date: today, reps: 0, lapses: 0 }
}

/** Điền mặc định cho thẻ cũ chưa có cột SRS, để mọi nơi đọc được cùng một hình dạng. */
export function withSrsDefaults<T extends Partial<SrsFields>>(card: T, today: string): T & SrsFields {
  const base = initialSrs(today)
  return {
    ...card,
    ease: typeof card.ease === 'number' && card.ease > 0 ? card.ease : base.ease,
    interval_days: typeof card.interval_days === 'number' ? card.interval_days : base.interval_days,
    due_date: card.due_date || base.due_date,
    reps: typeof card.reps === 'number' ? card.reps : base.reps,
    lapses: typeof card.lapses === 'number' ? card.lapses : base.lapses,
  }
}

/** Cộng ngày vào chuỗi 'YYYY-MM-DD', tính theo giờ địa phương. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(y, (m ?? 1) - 1, (d ?? 1) + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}

/** Khoảng cách mới theo từng mức chấm. Hai bước đầu cố định 1 rồi 3 ngày cho ổn định. */
function nextInterval(grade: Grade, current: SrsFields): number {
  if (grade === 'AGAIN') return 0 // gặp lại ngay trong phiên hôm nay
  if (current.reps === 0) return grade === 'EASY' ? 3 : 1
  if (current.reps === 1) return grade === 'EASY' ? 6 : 3

  const factor = grade === 'HARD' ? 1.2 : grade === 'EASY' ? current.ease * 1.3 : current.ease
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(current.interval_days * factor)))
}

/** Điều chỉnh hệ số dễ theo SM-2, kẹp trong khoảng [1.3, 3]. */
function nextEase(grade: Grade, ease: number): number {
  const delta = { AGAIN: -0.2, HARD: -0.15, GOOD: 0, EASY: 0.15 }[grade]
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Number((ease + delta).toFixed(2))))
}

/** Chấm một thẻ, trả về trạng thái SRS mới. Không đụng vào thẻ gốc. */
export function review(card: SrsFields, grade: Grade, today: string): SrsFields {
  const interval = nextInterval(grade, card)
  return {
    ease: nextEase(grade, card.ease),
    interval_days: interval,
    // interval 0 nghĩa là còn nợ trong phiên hôm nay, nên hạn vẫn là hôm nay.
    due_date: addDays(today, interval),
    reps: grade === 'AGAIN' ? 0 : card.reps + 1,
    lapses: grade === 'AGAIN' ? card.lapses + 1 : card.lapses,
  }
}

/** Nhãn "1 ngày" / "2 tuần" cho nút chấm, để người học biết bấm xong thì bao giờ gặp lại. */
export function intervalLabel(card: SrsFields, grade: Grade): string {
  const days = nextInterval(grade, card)
  if (days === 0) return 'lát nữa'
  if (days === 1) return '1 ngày'
  if (days < 7) return `${days} ngày`
  if (days < 30) return `${Math.round(days / 7)} tuần`
  if (days < 365) return `${Math.round(days / 30)} tháng`
  return `${Math.round(days / 365)} năm`
}

export function isDue(card: SrsFields, today: string): boolean {
  return card.due_date <= today
}

/** Mục tiêu mặc định mỗi ngày. Học 20 thẻ đều đặn bền hơn 200 thẻ một lần rồi bỏ. */
export const DAILY_GOAL = 20

/** Hàng đợi ôn hôm nay: chỉ thẻ đến hạn, thẻ hay quên lên trước, rồi tới thẻ quá hạn lâu nhất. */
export function buildQueue<T extends SrsFields>(cards: T[], today: string, limit = DAILY_GOAL): T[] {
  return cards
    .filter((c) => isDue(c, today))
    .sort((a, b) => b.lapses - a.lapses || a.due_date.localeCompare(b.due_date))
    .slice(0, limit)
}

export type DeckStats = {
  total: number
  due: number
  /** Thẻ chưa ôn lần nào. */
  fresh: number
  /** Thẻ đã giãn tới 21 ngày trở lên — coi như đã thuộc. */
  mature: number
}

const MATURE_DAYS = 21

export function deckStats<T extends SrsFields>(cards: T[], today: string): DeckStats {
  return {
    total: cards.length,
    due: cards.filter((c) => isDue(c, today)).length,
    fresh: cards.filter((c) => c.reps === 0).length,
    mature: cards.filter((c) => c.interval_days >= MATURE_DAYS).length,
  }
}
