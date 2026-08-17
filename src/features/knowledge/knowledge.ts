import type { KnowledgeItem } from '../../types'

export const DEFAULT_CATEGORY = 'Chung'

/** Chuẩn hoá thể loại người dùng gõ: bỏ khoảng trắng thừa, rỗng thì về "Chung". */
export function normalizeCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ') || DEFAULT_CATEGORY
}

/** Lọc theo thể loại đang chọn và từ khoá tìm kiếm (không phân biệt hoa thường). */
export function filterKnowledge(items: KnowledgeItem[], category: string | null, search: string): KnowledgeItem[] {
  const q = search.trim().toLowerCase()
  return items.filter((i) => {
    if (category && i.category !== category) return false
    if (!q) return true
    return `${i.question} ${i.answer} ${i.category}`.toLowerCase().includes(q)
  })
}
