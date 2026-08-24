/**
 * Âm lịch Việt Nam — thuật toán Hồ Ngọc Đức, múi giờ cố định +7.
 * Lịch VN lệch lịch Trung Quốc vài ngày mỗi năm nên múi giờ ở đây không đổi theo máy.
 */

const TIMEZONE = 7

export type LunarDate = { day: number; month: number; year: number; isLeap: boolean }

const INT = (x: number) => Math.floor(x)

/** Số ngày Julian của một ngày dương lịch. */
export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083
  return jd
}

/** Ngược lại jdFromDate → [dd, mm, yy]. */
export function jdToDate(jd: number): [number, number, number] {
  let a: number
  let b: number
  let c: number
  if (jd > 2299160) {
    a = jd + 32044
    b = INT((4 * a + 3) / 146097)
    c = a - INT((b * 146097) / 4)
  } else {
    b = 0
    c = jd + 32082
  }
  const d = INT((4 * c + 3) / 1461)
  const e = c - INT((1461 * d) / 4)
  const m = INT((5 * e + 2) / 153)
  const day = e - INT((153 * m + 2) / 5) + 1
  const month = m + 3 - 12 * INT(m / 10)
  const year = b * 100 + d - 4800 + INT(m / 10)
  return [day, month, year]
}

/** Thời điểm sóc thứ k tính từ 01/01/1900, theo ngày Julian thập phân. */
function newMoon(k: number): number {
  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const dr = Math.PI / 180
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr)
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  let deltat: number
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2
  }
  return Jd1 + C1 - deltat
}

/** Kinh độ mặt trời tại thời điểm jdn (radian). */
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525
  const T2 = T * T
  const dr = Math.PI / 180
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M)
  let L = L0 + DL
  L = L * dr
  L = L - Math.PI * 2 * INT(L / (Math.PI * 2))
  return L
}

function getNewMoonDay(k: number): number {
  return INT(newMoon(k) + 0.5 + TIMEZONE / 24)
}

/** Cung hoàng đạo (0–11) mà mặt trời đi qua trong ngày. */
function getSunLongitudeIndex(dayNumber: number): number {
  return INT((sunLongitude(dayNumber - 0.5 - TIMEZONE / 24) / Math.PI) * 6)
}

/** Ngày bắt đầu tháng 11 âm của năm dương yy. */
function getLunarMonth11(yy: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k = INT(off / 29.530588853)
  let nm = getNewMoonDay(k)
  if (getSunLongitudeIndex(nm) >= 9) nm = getNewMoonDay(k - 1)
  return nm
}

/** Vị trí tháng nhuận tính từ tháng 11 âm a11. */
function getLeapMonthOffset(a11: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last: number
  let i = 1
  let arc = getSunLongitudeIndex(getNewMoonDay(k + i))
  do {
    last = arc
    i += 1
    arc = getSunLongitudeIndex(getNewMoonDay(k + i))
  } while (arc !== last && i < 14)
  return i - 1
}

/** Ngày dương (Date địa phương) → ngày âm. */
export function solarToLunar(date: Date): LunarDate {
  const dayNumber = jdFromDate(date.getDate(), date.getMonth() + 1, date.getFullYear())
  const yy = date.getFullYear()
  let a11 = getLunarMonth11(yy)
  let b11 = a11
  let lunarYear: number
  if (a11 >= dayNumber) {
    lunarYear = yy
    a11 = getLunarMonth11(yy - 1)
  } else {
    lunarYear = yy + 1
    b11 = getLunarMonth11(yy + 1)
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853)
  const monthStart = getNewMoonDay(k + INT((dayNumber - a11) / 29))
  const start = monthStart > dayNumber ? getNewMoonDay(k + INT((dayNumber - a11) / 29) - 1) : monthStart
  const diff = INT((start - a11) / 29)
  let lunarMonth = diff + 11
  let isLeap = false
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11)
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10
      if (diff === leapMonthDiff) isLeap = true
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1
  return { day: dayNumber - start + 1, month: lunarMonth, year: lunarYear, isLeap }
}

/** Ngày âm → ngày dương (Date lúc 00:00 giờ địa phương). */
export function lunarToSolar(day: number, month: number, year: number, isLeap = false): Date {
  let a11: number
  let b11: number
  if (month < 11) {
    a11 = getLunarMonth11(year - 1)
    b11 = getLunarMonth11(year)
  } else {
    a11 = getLunarMonth11(year)
    b11 = getLunarMonth11(year + 1)
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853)
  let off = month - 11
  if (off < 0) off += 12
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11)
    let leapMonth = leapOff - 2
    if (leapMonth < 0) leapMonth += 12
    if (isLeap && month !== leapMonth) {
      // Tháng yêu cầu không phải tháng nhuận của năm này → coi như tháng thường.
      isLeap = false
    }
    if (isLeap || off >= leapOff) off += 1
  }
  const monthStart = getNewMoonDay(k + off)
  const [dd, mm, yy] = jdToDate(monthStart + day - 1)
  return new Date(yy, mm - 1, dd)
}

/** Số ngày của một tháng âm (29 hoặc 30). */
export function lunarMonthLength(month: number, year: number, isLeap = false): number {
  const start = lunarToSolar(1, month, year, isLeap)
  const day30 = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 29)
  return solarToLunar(day30).day === 30 ? 30 : 29
}

/** Năm âm `year` có tháng `month` nhuận hay không. */
export function hasLeapMonth(month: number, year: number): boolean {
  return solarToLunar(lunarToSolar(1, month, year, true)).isLeap
}

/** "29/6 âm" — thêm "nhuận" khi là tháng nhuận. */
export function formatLunar(lunar: LunarDate): string {
  return `${lunar.day}/${lunar.month}${lunar.isLeap ? ' nhuận' : ''} âm`
}
