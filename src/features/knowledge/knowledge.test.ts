import { describe, expect, it } from 'vitest'
import { answerLines, categoryStats, filterKnowledge, lessonRows, normalizeCategory } from './knowledge'
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

describe('answerLines', () => {
  it('tách nhiều câu trả lời theo dòng, bỏ dòng trống', () => {
    expect(answerLines('A' + String.fromCharCode(10) + '  ' + String.fromCharCode(10) + ' B ')).toEqual(['A', 'B'])
  })
})

describe('lessonRows', () => {
  it('gộp danh sách câu trả lời thành một thẻ, bỏ câu hỏi rỗng', () => {
    expect(
      lessonRows([{ question: ' Hỏi 1 ', answers: ['Đáp 1', ' ', 'Đáp 2'] }, { question: '  ', answers: ['x'] }], 'Lịch sử'),
    ).toEqual([{ question: 'Hỏi 1', answer: 'Đáp 1' + String.fromCharCode(10) + 'Đáp 2', category: 'Lịch sử' }])
  })

  it('không có thể loại thì mặc định Chung', () => {
    expect(lessonRows([{ question: 'a', answers: [] }], '')).toEqual([{ question: 'a', answer: '', category: 'Chung' }])
  })

  it('gắn source_video_id nếu có truyền', () => {
    expect(lessonRows([{ question: 'Bài học 1', answers: ['Ý 1'] }], 'Kinh doanh', 'dQw4w9WgXcQ')).toEqual([
      { question: 'Bài học 1', answer: 'Ý 1', category: 'Kinh doanh', source_video_id: 'dQw4w9WgXcQ' },
    ])
  })
})
