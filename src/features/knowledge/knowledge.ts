import type { KnowledgeItem } from '../../types'

export const DEFAULT_CATEGORY = 'Chung'

/** Chuẩn hoá thể loại người dùng gõ: bỏ khoảng trắng thừa, rỗng thì về "Chung". */
export function normalizeCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ') || DEFAULT_CATEGORY
}

/** Đếm số thẻ theo từng thể loại, sắp xếp theo tên tiếng Việt. */
export function categoryStats(items: KnowledgeItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
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

/** Nhiều câu trả lời của một thẻ được lưu chung một cột, mỗi dòng một ý. */
export function answerLines(answer: string): string[] {
  return answer.split('\n').map((a) => a.trim()).filter(Boolean)
}

export type LessonEntry = { question: string; answers: string[] }

/** Soạn bài học bằng tay: mỗi mục là một câu hỏi kèm danh sách câu trả lời và video nguồn (nếu có). */
export function lessonRows(
  entries: LessonEntry[],
  category: string,
  sourceVideoId?: string | null,
): { question: string; answer: string; category: string; source_video_id?: string | null }[] {
  const cat = normalizeCategory(category)
  return entries
    .map((e) => {
      const row: { question: string; answer: string; category: string; source_video_id?: string | null } = {
        question: e.question.trim(),
        answer: e.answers.map((a) => a.trim()).filter(Boolean).join('\n'),
        category: cat,
      }
      if (sourceVideoId) {
        row.source_video_id = sourceVideoId.trim()
      }
      return row
    })
    .filter((r) => r.question)
}
