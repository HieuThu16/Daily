import { describe, expect, it } from 'vitest'
import { filterKnowledge, normalizeCategory } from './knowledge'
import type { KnowledgeItem } from '../../types'

const items: KnowledgeItem[] = [
  { id: '1', question: 'Closure là gì?', answer: 'Hàm nhớ scope ngoài', category: 'JavaScript' },
  { id: '2', question: 'Index giúp gì?', answer: 'Tăng tốc truy vấn', category: 'Database' },
]

describe('normalizeCategory', () => {
  it('gộp khoảng trắng và giữ nội dung', () => {
    expect(normalizeCategory('  Lập   trình ')).toBe('Lập trình')
  })
  it('rỗng thì về Chung', () => {
    expect(normalizeCategory('   ')).toBe('Chung')
  })
})

describe('filterKnowledge', () => {
  it('không lọc gì thì trả hết', () => {
    expect(filterKnowledge(items, null, '')).toHaveLength(2)
  })
  it('lọc theo thể loại', () => {
    expect(filterKnowledge(items, 'Database', '').map((i) => i.id)).toEqual(['2'])
  })
  it('tìm trong cả câu hỏi và câu trả lời, bỏ qua hoa thường', () => {
    expect(filterKnowledge(items, null, 'TRUY VẤN').map((i) => i.id)).toEqual(['2'])
    expect(filterKnowledge(items, null, 'closure').map((i) => i.id)).toEqual(['1'])
  })
  it('thể loại và từ khoá cùng lúc', () => {
    expect(filterKnowledge(items, 'JavaScript', 'index')).toHaveLength(0)
  })
})
