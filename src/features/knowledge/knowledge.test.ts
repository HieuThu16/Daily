import { describe, expect, it } from 'vitest'
import { categoryStats, filterKnowledge, normalizeCategory } from './knowledge'
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

describe('categoryStats', () => {
  it('đếm số thẻ mỗi thể loại và sắp theo tên', () => {
    const more = [...items, { id: '3', question: 'Q', answer: 'A', category: 'Database' }]
    expect(categoryStats(more)).toEqual([
      { name: 'Database', count: 2 },
      { name: 'JavaScript', count: 1 },
    ])
  })
  it('danh sách rỗng thì không có thể loại nào', () => {
    expect(categoryStats([])).toEqual([])
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
