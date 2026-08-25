/**
 * Nhận diện số phần của một video review từ tiêu đề.
 *
 * Mọi so khớp chạy trên chuỗi đã bỏ dấu tiếng Việt, nên "phần 3", "phan 3",
 * "Phần 3" đều về cùng một dạng — người đăng gõ thiếu dấu là chuyện thường.
 */

import type { PartInfo } from './types.js'

/** Bỏ dấu, hạ hoa thường, gộp khoảng trắng. Dùng chung cho mọi so khớp. */
export function deaccent(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Từ khoá báo đây là phần cuối. */
const FINAL =
  /\b(?:part\s*cuoi|phan\s*cuoi|tap\s*cuoi|ky\s*cuoi|final(?:\s*part)?|finale|the\s*end|ending|ket\s*thuc|het|full\s*review)\b/

/** "part 3", "phần 03", "tập 3", "ep 3", "p3" — kèm "/5" hoặc "of 5" nếu có. */
const MARKED =
  /\b(?:part|phan|tap|ep|episode|p)\s*[.:\-_]?\s*0*(\d{1,3})\b(?:\s*(?:\/\s*|of\s+|tren\s+)0*(\d{1,3})\b)?/

/** "#3" hoặc "#3/5". */
const HASHED = /#\s*0*(\d{1,3})\b(?:\s*\/\s*0*(\d{1,3})\b)?/

/** "3/5" hay "3 of 5" đứng trơ, không có từ khoá dẫn. */
const BARE_RATIO = /\b0*(\d{1,3})\s*(?:\/\s*|of\s+)0*(\d{1,3})\b/

const EMPTY: PartInfo = { partNumber: null, totalParts: null, isFinal: false, confidence: 0 }

/**
 * Đọc số phần. Không đoán ra thì trả partNumber null — tuyệt đối không mặc
 * định là 1, vì "coi như phần 1" sẽ đẻ ra series giả và làm sai completion.
 */
export function detectPart(title: string, description = ''): PartInfo {
  const text = deaccent(title)
  const isFinal = FINAL.test(text) || FINAL.test(deaccent(description))

  const candidates: Array<readonly [RegExp, number]> = [
    [MARKED, 0.92],
    [HASHED, 0.8],
    [BARE_RATIO, 0.7],
  ]

  for (const [pattern, confidence] of candidates) {
    const m = text.match(pattern)
    if (!m) continue
    const partNumber = Number(m[1])
    const totalRaw = m[2] ? Number(m[2]) : null
    // "12/5" kiểu ngày tháng cho tổng nhỏ hơn phần hiện tại — là rác, bỏ.
    const totalParts = totalRaw !== null && totalRaw >= partNumber ? totalRaw : null
    return { partNumber, totalParts, isFinal, confidence }
  }

  return isFinal ? { ...EMPTY, isFinal: true, confidence: 0.4 } : EMPTY
}

/** Cụm quảng cáo không thuộc tên phim. */
const NOISE =
  /\b(?:review|tom\s*tat|tomtat|full|hd|4k|vietsub|thuyet\s*minh|phim|movie|series|official|trailer|reaction|spoiler|toan\s*bo|hay\s*nhat)\b/g

/**
 * Rút tên phim từ tiêu đề: bỏ đánh số phần, bỏ từ quảng cáo, bỏ hashtag và ký
 * tự trang trí. Kết quả dùng làm khoá gom nhóm nên chỉ giữ chữ và số.
 */
export function movieKey(title: string): string {
  let text = deaccent(title)
  text = text.replace(/#\S+/g, ' ')
  text = text.replace(MARKED, ' ').replace(HASHED, ' ').replace(BARE_RATIO, ' ')
  text = text.replace(FINAL, ' ')
  text = text.replace(NOISE, ' ')
  return text.replace(/[^a-z0-9]+/g, ' ').trim()
}
