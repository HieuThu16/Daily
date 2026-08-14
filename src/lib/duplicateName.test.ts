import { describe, expect, it } from 'vitest'
import { findDuplicateByName, normalizeName } from './duplicateName'

const items = [
  { id: 'm1', type: 'BOOK', name: 'Người đua diều' },
  { id: 'm2', type: 'MUSIC', name: 'Chúng ta của tương lai' },
  { id: 'm3', type: 'MANGA', name: 'One Piece' },
]

describe('normalizeName', () => {
  it('bỏ dấu, hoa thường, khoảng trắng và dấu câu', () => {
    expect(normalizeName('Người đua diều')).toBe('nguoi dua dieu')
    expect(normalizeName('  ONE   PIECE!! ')).toBe('one piece')
    expect(normalizeName('Đường tăng')).toBe('duong tang')
  })
})

describe('findDuplicateByName', () => {
  it('bắt trùng dù khác dấu, hoa thường hay khoảng trắng', () => {
    expect(findDuplicateByName(items, 'BOOK', 'nguoi dua dieu')?.id).toBe('m1')
    expect(findDuplicateByName(items, 'MANGA', '  one   piece ')?.id).toBe('m3')
  })

  it('khác loại thì không tính là trùng', () => {
    expect(findDuplicateByName(items, 'MUSIC', 'One Piece')).toBeUndefined()
  })

  it('bỏ qua chính nó khi sửa', () => {
    expect(findDuplicateByName(items, 'BOOK', 'Người đua diều', 'm1')).toBeUndefined()
  })

  it('tên rỗng không báo trùng', () => {
    expect(findDuplicateByName(items, 'BOOK', '   ')).toBeUndefined()
  })
})
