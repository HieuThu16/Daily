/**
 * Lặp lại ngắt quãng theo FSRS (Free Spaced Repetition Scheduler), bản rút gọn của FSRS-5.
 *
 * Khác SM-2 ở chỗ mỗi thẻ giữ hai con số có ý nghĩa thật:
 * - `stability` (S): số ngày để xác suất nhớ tụt xuống 90%.
 * - `difficulty` (D, 1..10): thẻ này khó tới đâu với riêng bạn.
 * Từ đó tính được xác suất còn nhớ R lúc ôn, rồi chọn ngày ôn kế sao cho R rơi đúng
 * mức mong muốn (mặc định 0.9). Nhờ bám đường quên thật, FSRS xếp ít thẻ hơn SM-2
 * mỗi ngày mà độ nhớ tương đương.
 *
 * `ease` và `interval_days` vẫn giữ cho thẻ cũ đọc được và để hiển thị, nhưng lịch ôn
 * từ nay do S và D quyết định.
 */

export type Grade = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

export type SrsFields = {
  /** Giữ lại từ thời SM-2 cho tương thích ngược; FSRS không dùng để xếp lịch. */
  ease: number
  /** Số ngày tới lần ôn kế tiếp. */
  interval_days: number
  /** Ngày đến hạn ôn, dạng 'YYYY-MM-DD'. */
  due_date: string
  /** Số lần ôn đã qua. Dùng để phân biệt thẻ mới với thẻ đang học. */
  reps: number
  /** Số lần bấm "Quên". Thẻ hay quên được ưu tiên đưa lên đầu hàng đợi. */
  lapses: number
  /** FSRS: số ngày để xác suất nhớ tụt còn 90%. 0 = thẻ chưa ôn lần nào. */
  stability?: number
  /** FSRS: độ khó riêng của thẻ, 1 (dễ) → 10 (khó). */
  difficulty?: number
}

export const DEFAULT_EASE = 2.5
const MIN_EASE = 1.3
const MAX_EASE = 3
const MAX_INTERVAL_DAYS = 365

/** Thẻ chưa từng ôn: đến hạn ngay hôm nay. */
export function initialSrs(today: string): SrsFields {
  return { ease: DEFAULT_EASE, interval_days: 0, due_date: today, reps: 0, lapses: 0, stability: 0, difficulty: 5 }
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
    stability: typeof card.stability === 'number' ? card.stability : 0,
    difficulty: typeof card.difficulty === 'number' ? card.difficulty : 5,
  }
}

/** Cộng ngày vào chuỗi 'YYYY-MM-DD', tính theo giờ địa phương. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(y, (m ?? 1) - 1, (d ?? 1) + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}

// ── FSRS ────────────────────────────────────────────────────────────────────

/**
 * Bộ trọng số mặc định của FSRS-5, do nhóm open-spaced-repetition huấn luyện trên
 * hàng trăm triệu lượt ôn. Muốn "tối ưu tham số" như Anki thì thay mảng này.
 */
const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
]

/** Đường quên của FSRS: R(t) = (1 + F·t/S)^D. */
const DECAY = -0.5
const FACTOR = 19 / 81

/** Mức nhớ mong muốn tại ngày ôn. 0.9 là mặc định của Anki; cao hơn thì ôn dày hơn. */
export const DESIRED_RETENTION = 0.9

const GRADE_NUMBER: Record<Grade, number> = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 }

const clampDifficulty = (value: number) => Math.min(10, Math.max(1, value))

/** Xác suất còn nhớ sau `elapsedDays` ngày với độ bền `stability`. */
export function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY)
}

/** Đảo đường quên: cần bao nhiêu ngày để R tụt xuống mức mong muốn. */
function intervalFromStability(stability: number): number {
  const days = (stability / FACTOR) * (Math.pow(DESIRED_RETENTION, 1 / DECAY) - 1)
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)))
}

/** Độ bền và độ khó khởi điểm, phụ thuộc mức chấm ở lần gặp đầu tiên. */
function initialState(grade: Grade): { stability: number; difficulty: number } {
  const g = GRADE_NUMBER[grade]
  return {
    stability: Math.max(0.1, W[g - 1]),
    difficulty: clampDifficulty(W[4] - Math.exp(W[5] * (g - 1)) + 1),
  }
}

/** Độ khó mới: chấm càng thấp càng khó lên, rồi kéo nhẹ về mốc GOOD để khỏi trôi mãi. */
function nextDifficulty(difficulty: number, grade: Grade): number {
  const g = GRADE_NUMBER[grade]
  const delta = difficulty - W[6] * (g - 3)
  const target = W[4] - Math.exp(W[5] * 3) + 1
  return clampDifficulty(W[7] * target + (1 - W[7]) * delta)
}

/** Độ bền sau một lần nhớ được. Thẻ càng dễ, càng lâu chưa ôn thì tăng càng mạnh. */
function stabilityAfterRecall(stability: number, difficulty: number, r: number, grade: Grade): number {
  const hardPenalty = grade === 'HARD' ? W[15] : 1
  const easyBonus = grade === 'EASY' ? W[16] : 1
  const growth =
    Math.exp(W[8]) *
    (11 - difficulty) *
    Math.pow(stability, -W[9]) *
    (Math.exp(W[10] * (1 - r)) - 1) *
    hardPenalty *
    easyBonus
  return Math.min(MAX_INTERVAL_DAYS, stability * (1 + growth))
}

/** Độ bền sau khi quên: tụt mạnh nhưng không về 0, vì đã từng học rồi. */
function stabilityAfterLapse(stability: number, difficulty: number, r: number): number {
  const value =
    W[11] * Math.pow(difficulty, -W[12]) * (Math.pow(stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))
  return Math.max(0.1, Math.min(stability, value))
}

/** Thẻ cũ từ thời SM-2 chưa có S/D: suy ra từ khoảng cách và hệ số dễ đang có. */
function ensureFsrsState(card: SrsFields): { stability: number; difficulty: number } {
  if (card.stability && card.stability > 0) {
    return { stability: card.stability, difficulty: clampDifficulty(card.difficulty ?? 5) }
  }
  if (card.reps > 0 && card.interval_days > 0) {
    // interval cũ là số ngày người học từng chịu được, xem như độ bền ban đầu.
    const fromEase = 11 - (card.ease - MIN_EASE) * (9 / (MAX_EASE - MIN_EASE))
    return { stability: Math.max(0.1, card.interval_days), difficulty: clampDifficulty(fromEase) }
  }
  return { stability: 0, difficulty: 5 }
}

/** Trạng thái FSRS sau một lần chấm, chưa đụng tới ngày tháng. */
function nextFsrsState(card: SrsFields, grade: Grade, elapsedDays: number) {
  const current = ensureFsrsState(card)
  if (current.stability <= 0) return initialState(grade)

  const r = retrievability(current.stability, Math.max(0, elapsedDays))
  const difficulty = nextDifficulty(current.difficulty, grade)
  const stability =
    grade === 'AGAIN'
      ? stabilityAfterLapse(current.stability, difficulty, r)
      : stabilityAfterRecall(current.stability, difficulty, r, grade)

  return { stability, difficulty }
}

/** Số ngày giữa lần ôn trước và hôm nay, suy từ due_date và interval đã lưu. */
function elapsedSince(card: SrsFields, today: string): number {
  if (!card.due_date || card.interval_days <= 0) return 0
  const lastReview = addDays(card.due_date, -card.interval_days)
  const ms = new Date(`${today}T00:00:00`).getTime() - new Date(`${lastReview}T00:00:00`).getTime()
  return Math.max(0, Math.round(ms / 86400000))
}

/** Khoảng cách tới lần ôn kế theo FSRS. `today` giúp tính đúng số ngày đã trôi qua. */
function nextInterval(grade: Grade, current: SrsFields, today = ''): number {
  if (grade === 'AGAIN') return 0 // gặp lại ngay trong phiên hôm nay
  const elapsed = today ? elapsedSince(current, today) : current.interval_days
  const { stability } = nextFsrsState(current, grade, elapsed)
  return intervalFromStability(stability)
}

/** Điều chỉnh hệ số dễ theo SM-2, kẹp trong khoảng [1.3, 3]. */
function nextEase(grade: Grade, ease: number): number {
  const delta = { AGAIN: -0.2, HARD: -0.15, GOOD: 0, EASY: 0.15 }[grade]
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Number((ease + delta).toFixed(2))))
}

/** Chấm một thẻ, trả về trạng thái SRS mới. Không đụng vào thẻ gốc. */
export function review(card: SrsFields, grade: Grade, today: string): SrsFields {
  const { stability, difficulty } = nextFsrsState(card, grade, elapsedSince(card, today))
  // Quên thì gặp lại ngay trong phiên hôm nay, nhưng S/D vẫn cập nhật để lần sau tính đúng.
  const interval = grade === 'AGAIN' ? 0 : intervalFromStability(stability)

  return {
    ease: nextEase(grade, card.ease),
    interval_days: interval,
    due_date: addDays(today, interval),
    reps: grade === 'AGAIN' ? 0 : card.reps + 1,
    lapses: grade === 'AGAIN' ? card.lapses + 1 : card.lapses,
    stability: Number(stability.toFixed(4)),
    difficulty: Number(difficulty.toFixed(4)),
  }
}

/** Nhãn "1 ngày" / "2 tuần" cho nút chấm, để người học biết bấm xong thì bao giờ gặp lại. */
export function intervalLabel(card: SrsFields, grade: Grade, today = ''): string {
  const days = nextInterval(grade, card, today)
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

/**
 * Chuỗi ngày ôn liên tiếp tính ngược từ hôm nay (hoặc từ hôm qua nếu hôm nay chưa ôn,
 * để chuỗi không bị coi là đứt ngay lúc mở app buổi sáng).
 */
export function reviewStreak(logDates: string[], today: string): number {
  const days = new Set(logDates)
  let cursor = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}
