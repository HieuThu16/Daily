/** Giấc ngủ qua nửa đêm được chia cho hai ngày; phiên ngủ vẫn giữ nguyên start/end/duration. */
type SleepSpan = { sleep_start: string; sleep_end: string; log_date: string }

function toMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

/** Dời một ngày dạng 'YYYY-MM-DD' đi `days` ngày (giữ giờ trưa để tránh lệch DST). */
export function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(year, month - 1, day, 12)
  shifted.setDate(shifted.getDate() + days)
  return [shifted.getFullYear(), String(shifted.getMonth() + 1).padStart(2, '0'), String(shifted.getDate()).padStart(2, '0')].join('-')
}

/** Tổng thời lượng của cả phiên ngủ, tính phần qua nửa đêm. */
export function sleepDuration(log: SleepSpan) {
  const minutes = toMinutes(log.sleep_end) - toMinutes(log.sleep_start)
  return minutes < 0 ? minutes + 24 * 60 : minutes
}

/** Số phút của giấc ngủ rơi vào đúng ngày `date` (0 nếu không dính). */
export function sleepMinutesOn(log: SleepSpan, date: string) {
  const start = toMinutes(log.sleep_start)
  const end = toMinutes(log.sleep_end)
  if (end > start) return date === log.log_date ? end - start : 0
  if (date === log.log_date) return 24 * 60 - start
  if (end > 0 && date === shiftDate(log.log_date, 1)) return end
  return 0
}

/** Các ngày mà giấc ngủ này có đóng góp thời lượng. */
export function sleepDates(log: SleepSpan) {
  const start = toMinutes(log.sleep_start)
  const end = toMinutes(log.sleep_end)
  return end > start || end === 0 ? [log.log_date] : [log.log_date, shiftDate(log.log_date, 1)]
}
