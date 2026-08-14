import { describe, expect, it } from 'vitest'
import { filterPeople, type Person } from './bookShare'

const people: Person[] = [
  { id: '1', name: 'Nguyễn An', email: 'an@example.com', avatar_url: null },
  { id: '2', name: null, email: 'binh@example.com', avatar_url: null },
]

describe('filterPeople', () => {
  it('trả nguyên danh sách khi chưa gõ gì', () => {
    expect(filterPeople(people, '  ')).toHaveLength(2)
  })

  it('tìm theo tên và theo email, không phân biệt hoa thường', () => {
    expect(filterPeople(people, 'AN ').map((p) => p.id)).toEqual(['1'])
    expect(filterPeople(people, 'binh@').map((p) => p.id)).toEqual(['2'])
  })

  it('không vỡ khi thiếu tên', () => {
    expect(filterPeople(people, 'không có ai')).toEqual([])
  })
})
