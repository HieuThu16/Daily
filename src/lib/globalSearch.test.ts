import { describe, expect, it } from 'vitest'
import { buildOrFilter, filterStatic, matches, mediaPath, normalize } from './globalSearch'

describe('globalSearch', () => {
  it('bỏ dấu tiếng Việt khi chuẩn hoá', () => {
    expect(normalize('Công Việc Đã Xong')).toBe('cong viec da xong')
  })

  it('khớp không dấu với chuỗi có dấu', () => {
    expect(matches('Dưỡng sinh', 'duong')).toBe(true)
    expect(matches('Dưỡng sinh', 'xyz')).toBe(false)
  })

  it('lọc danh sách tĩnh, query rỗng trả nguyên danh sách', () => {
    const tabs = [{ label: 'Kiến thức' }, { label: 'Tiền' }]
    expect(filterStatic(tabs, '', (t) => t.label)).toHaveLength(2)
    expect(filterStatic(tabs, 'kien', (t) => t.label)).toEqual([{ label: 'Kiến thức' }])
  })

  it('dựng bộ lọc or() và loại ký tự phá cú pháp', () => {
    expect(buildOrFilter(['term', 'meaning'], 'a,b(c)')).toBe('term.ilike.%a b c%,meaning.ilike.%a b c%')
  })

  it('ánh xạ loại media sang đúng tab', () => {
    expect(mediaPath('MUSIC')).toBe('/music')
    expect(mediaPath('LẠ')).toBe('/books')
  })
})
