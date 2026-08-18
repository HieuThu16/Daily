import type { EnglishItem, KnowledgeItem } from '../../types'
import type { SrsFields } from '../../lib/srs'

/** Hai bộ thẻ dùng chung một cỗ máy ôn tập; chỉ khác bảng và cách hiện hai mặt thẻ. */
export type DeckId = 'english' | 'knowledge'

export type StudyCard = SrsFields & {
  id: string
  /** Mặt trước: từ cần nhớ hoặc câu hỏi. */
  front: string
  /** Mặt sau: nghĩa hoặc câu trả lời. */
  back: string
  /** Dòng phụ dưới mặt sau, ví dụ câu ví dụ tiếng Anh. */
  extra?: string | null
  /** Nhãn nhóm: tag đầu tiên hoặc thể loại. */
  group?: string | null
  /** Có đọc thành tiếng được không — chỉ thẻ tiếng Anh. */
  speakable: boolean
}

export type DeckConfig = {
  id: DeckId
  table: string
  label: string
  /** Đường dẫn quay về trang danh sách của bộ thẻ. */
  path: string
}

export const DECKS: Record<DeckId, DeckConfig> = {
  english: { id: 'english', table: 'english_items', label: 'Tiếng Anh', path: '/english' },
  knowledge: { id: 'knowledge', table: 'knowledge_items', label: 'Kiến thức', path: '/knowledge' },
}

export function englishToCard(item: EnglishItem & Partial<SrsFields>, srs: SrsFields): StudyCard {
  return {
    ...srs,
    id: item.id,
    front: item.term,
    back: item.meaning,
    extra: item.example ?? null,
    group: item.tags?.[0] ?? null,
    speakable: true,
  }
}

export function knowledgeToCard(item: KnowledgeItem & Partial<SrsFields>, srs: SrsFields): StudyCard {
  return {
    ...srs,
    id: item.id,
    front: item.question,
    back: item.answer,
    extra: null,
    group: item.category ?? null,
    speakable: false,
  }
}
