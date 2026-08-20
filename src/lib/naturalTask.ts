/**
 * Đọc câu tiếng Việt gõ nhanh thành ngày/giờ hạn và lịch lặp.
 *
 * Ví dụ: "họp nhóm 3h chiều thứ 5" → title "họp nhóm", due_date thứ Năm gần nhất, due_time '15:00'.
 * Chỉ nhận những mẫu hay gõ nhất; câu không khớp thì trả nguyên tiêu đề, không đoán bừa.
 */

export type RepeatRule = 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY'

export type ParsedTask = {
  /** Tiêu đề đã bỏ phần ngày giờ. */
  title: string
  /** 'YYYY-MM-DD' nếu câu có nhắc tới ngày. */
  dueDate?: string
  /** 'HH:MM' nếu câu có nhắc tới giờ. */
  dueTime?: string
  repeat?: RepeatRule
}

const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const shift = (base: Date, days: number) => {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  next.setDate(next.getDate() + days)
  return next
}

/** 0 = Chủ nhật, khớp với Date.getDay(). */
const WEEKDAY_WORDS: Array<[RegExp, number]> = [
  [/chủ nhật|\bcn\b/, 0],
  [/thứ (?:2|hai)\b/, 1],
  [/thứ (?:3|ba)\b/, 2],
  [/thứ (?:4|tư|tu)\b/, 3],
  [/thứ (?:5|năm|nam)\b/, 4],
  [/thứ (?:6|sáu|sau)\b/, 5],
  [/thứ (?:7|bảy|bay)\b/, 6],
]

const REPEAT_WORDS: Array<[RegExp, RepeatRule]> = [
  [/(hàng ngày|mỗi ngày|hằng ngày)/, 'DAILY'],
  [/(ngày thường|các ngày trong tuần)/, 'WEEKDAYS'],
  [/(hàng tuần|mỗi tuần|hằng tuần)/, 'WEEKLY'],
  [/(hàng tháng|mỗi tháng|hằng tháng)/, 'MONTHLY'],
]

/** Ngày kế tiếp của một thứ trong tuần; hôm nay đúng thứ đó thì lấy tuần sau. */
function nextWeekday(from: Date, weekday: number): Date {
  const delta = (weekday - from.getDay() + 7) % 7
  return shift(from, delta === 0 ? 7 : delta)
}

export function parseNaturalTask(input: string, today = new Date()): ParsedTask {
  let rest = ` ${input} `
  const result: ParsedTask = { title: input.trim() }

  const cut = (match: RegExpMatchArray | null) => {
    if (!match || match.index == null) return
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`
  }

  // 1. Lịch lặp
  for (const [pattern, rule] of REPEAT_WORDS) {
    const m = rest.toLowerCase().match(pattern)
    if (m) {
      result.repeat = rule
      cut(m)
      break
    }
  }

  // 2. Giờ: "3h chiều", "15h30", "9:30 sáng", "7 giờ tối"
  const timeMatch = rest.toLowerCase().match(/(\d{1,2})\s*(?:h|:|giờ)\s*(\d{2})?\s*(sáng|trưa|chiều|tối|đêm)?/)
  if (timeMatch) {
    let hour = Number(timeMatch[1])
    const minute = Number(timeMatch[2] ?? 0)
    const period = timeMatch[3]
    if (hour <= 12 && (period === 'chiều' || period === 'tối' || period === 'đêm')) hour = (hour % 12) + 12
    if (hour === 12 && period === 'sáng') hour = 0
    if (hour < 24 && minute < 60) {
      result.dueTime = `${pad(hour)}:${pad(minute)}`
      cut(timeMatch)
    }
  }

  // 3. Ngày tuyệt đối: "25/12" hoặc "25/12/2026"
  const dateMatch = rest.toLowerCase().match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/)
  if (dateMatch) {
    const day = Number(dateMatch[1])
    const month = Number(dateMatch[2])
    const year = dateMatch[3] ? Number(dateMatch[3]) : today.getFullYear()
    const date = new Date(year, month - 1, day)
    if (date.getMonth() === month - 1 && date.getDate() === day) {
      // Không ghi năm mà ngày đã trôi qua thì hiểu là năm sau.
      if (!dateMatch[3] && toKey(date) < toKey(today)) date.setFullYear(year + 1)
      result.dueDate = toKey(date)
      cut(dateMatch)
    }
  }

  // 4. Ngày tương đối
  if (!result.dueDate) {
    const relatives: Array<[RegExp, number]> = [
      [/hôm nay|\bhnay\b/, 0],
      [/ngày mai|\bmai\b/, 1],
      [/ngày mốt|\bmốt\b/, 2],
      [/tuần sau|tuần tới/, 7],
    ]
    for (const [pattern, days] of relatives) {
      const m = rest.toLowerCase().match(pattern)
      if (m) {
        result.dueDate = toKey(shift(today, days))
        cut(m)
        break
      }
    }
  }

  // 5. Thứ trong tuần
  if (!result.dueDate) {
    for (const [pattern, weekday] of WEEKDAY_WORDS) {
      const m = rest.toLowerCase().match(pattern)
      if (m) {
        result.dueDate = toKey(nextWeekday(today, weekday))
        cut(m)
        break
      }
    }
  }

  const title = rest.replace(/\s+/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '')
  // Câu chỉ có mỗi ngày giờ ("mai 8h") thì giữ nguyên chữ gốc làm tiêu đề, đỡ ra việc trống tên.
  result.title = title || input.trim()
  return result
}

/** Ngày đến hạn của lần lặp kế tiếp, tính từ ngày vừa hoàn thành. */
export function nextDueDate(rule: RepeatRule, from: string): string {
  const [y, m, d] = from.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  if (rule === 'DAILY') date.setDate(date.getDate() + 1)
  else if (rule === 'WEEKLY') date.setDate(date.getDate() + 7)
  else if (rule === 'MONTHLY') date.setMonth(date.getMonth() + 1)
  else {
    // WEEKDAYS: nhảy qua thứ Bảy và Chủ nhật.
    do {
      date.setDate(date.getDate() + 1)
    } while (date.getDay() === 0 || date.getDay() === 6)
  }
  return toKey(date)
}

export const REPEAT_LABELS: Record<RepeatRule, string> = {
  DAILY: 'Hằng ngày',
  WEEKDAYS: 'Thứ 2 → thứ 6',
  WEEKLY: 'Hằng tuần',
  MONTHLY: 'Hằng tháng',
}
