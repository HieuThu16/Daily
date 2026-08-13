import { describe, expect, it } from 'vitest'
import { normalizeStorageUrl } from './storageUrl'

const base = 'https://ejcwwiohwgidksablzjl.supabase.co/storage/v1/object'
const file = 'media-covers/8ae4ac3f-6f93-4d69-affa-c2ef166bc26b.jpg'

describe('normalizeStorageUrl', () => {
  it('thêm public vào link Storage thiếu nó', () => {
    expect(normalizeStorageUrl(`${base}/${file}`)).toBe(`${base}/public/${file}`)
  })

  it('giữ nguyên link đã đúng', () => {
    expect(normalizeStorageUrl(`${base}/public/${file}`)).toBe(`${base}/public/${file}`)
  })

  it('không đụng vào link ký hạn và link tải lên', () => {
    expect(normalizeStorageUrl(`${base}/sign/${file}?token=abc`)).toBe(`${base}/sign/${file}?token=abc`)
    expect(normalizeStorageUrl(`${base}/authenticated/${file}`)).toBe(`${base}/authenticated/${file}`)
  })

  it('giữ nguyên tham số truy vấn khi sửa', () => {
    expect(normalizeStorageUrl(`${base}/${file}?v=2`)).toBe(`${base}/public/${file}?v=2`)
  })

  it('không đụng vào ảnh ở nơi khác', () => {
    expect(normalizeStorageUrl('https://example.com/bia.jpg')).toBe('https://example.com/bia.jpg')
    expect(normalizeStorageUrl('https://i.ytimg.com/vi/abc/hqdefault.jpg')).toBe(
      'https://i.ytimg.com/vi/abc/hqdefault.jpg',
    )
  })

  it('bỏ qua chuỗi rỗng và thứ không phải link', () => {
    expect(normalizeStorageUrl('')).toBe('')
    expect(normalizeStorageUrl('   ')).toBe('')
    expect(normalizeStorageUrl('chưa có ảnh')).toBe('chưa có ảnh')
  })

  it('cắt khoảng trắng thừa hai đầu khi dán', () => {
    expect(normalizeStorageUrl(`  ${base}/${file}  `)).toBe(`${base}/public/${file}`)
  })
})
