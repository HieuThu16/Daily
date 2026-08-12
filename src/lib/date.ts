export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
export const longDate = (date = new Date()) => new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(date)

const WEEKDAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

const pad = (value: number) => String(value).padStart(2, '0')

/** '12/08/2026' */
export const shortDate = (date = new Date()) =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`

/** 'Thứ Tư, 12/08/2026' */
export const vietnameseDate = (date = new Date()) =>
  `${WEEKDAY_NAMES[date.getDay()]}, ${shortDate(date)}`

/** '3/8' — dùng cho dải ngày trong tuần, không đệm số 0. */
export const dayMonth = (date = new Date()) => `${date.getDate()}/${date.getMonth() + 1}`

/** Lấy 'HH:MM' từ chuỗi thời gian ISO; rỗng nếu không có. */
export const timeOfDay = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
