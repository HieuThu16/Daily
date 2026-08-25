/**
 * Đẩy kết quả tiếng Việt lên đầu danh sách tìm kiếm.
 *
 * Tham số `relevanceLanguage=vi` của YouTube chỉ *nghiêng* kết quả chứ không lọc:
 * gõ "doraemon" vẫn ra một đống kênh Nhật và Anh trước. Nên sau khi nhận kết quả
 * còn phải tự chấm điểm và xếp lại.
 *
 * Hàm thuần, không đụng trình duyệt — dùng được cả ở serverless trong api/.
 */

/** Nguyên âm và phụ âm chỉ có trong tiếng Việt. Đây là dấu hiệu mạnh nhất. */
const VIET_LETTERS =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i

/**
 * Từ khoá báo hiệu nội dung Việt kể cả khi gõ không dấu.
 * Nhiều kênh đặt tiêu đề kiểu "Doraemon Tap 1 Thuyet Minh" — không có dấu nào
 * nhưng rõ ràng là tiếng Việt.
 */
const VIET_HINTS = [
  'vietsub', 'thuyet minh', 'thuyết minh', 'long tieng', 'lồng tiếng',
  'tieng viet', 'tiếng việt', 'phu de', 'phụ đề', 'ban viet', 'bản việt',
  'tap ', 'tập ', 'phan ', 'phần ', 'toan tap', 'trọn bộ', 'tron bo',
]

/** Điểm "Việt tính" của một mục: càng cao càng nên đứng trước. */
export function vietnameseScore(title: string, channelTitle = ''): number {
  let score = 0
  if (VIET_LETTERS.test(title)) score += 3
  // Kênh Việt thì cả kênh đó đều đáng ưu tiên, kể cả video này lỡ đặt tên tiếng Anh.
  if (VIET_LETTERS.test(channelTitle)) score += 2

  const haystack = `${title} ${channelTitle}`.toLowerCase()
  if (VIET_HINTS.some((hint) => haystack.includes(hint))) score += 1

  return score
}

/**
 * Xếp lại danh sách: điểm cao lên trước, cùng điểm thì GIỮ NGUYÊN thứ tự cũ.
 *
 * Giữ nguyên thứ tự trong cùng nhóm là có chủ ý — thứ tự YouTube trả về đã là
 * theo độ liên quan, mình chỉ nâng nhóm tiếng Việt lên chứ không đảo lộn hết.
 */
export function rankVietnameseFirst<T extends { title?: string; channelTitle?: string }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index, score: vietnameseScore(item.title ?? '', item.channelTitle ?? '') }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item)
}
