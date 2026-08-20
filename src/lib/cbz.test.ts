import { describe, expect, it } from 'vitest'
import { compareNatural, sortedImageNames } from './cbz'

describe('sortedImageNames', () => {
  it('xếp theo số tự nhiên, không phải theo chuỗi', () => {
    expect(sortedImageNames(['10.jpg', '2.jpg', '1.jpg'])).toEqual(['1.jpg', '2.jpg', '10.jpg'])
  })

  it('bỏ file không phải ảnh và rác của macOS', () => {
    const result = sortedImageNames([
      'truyen/001.jpg',
      'truyen/ComicInfo.xml',
      '__MACOSX/truyen/._001.jpg',
      'truyen/.DS_Store',
      'truyen/002.png',
    ])
    expect(result).toEqual(['truyen/001.jpg', 'truyen/002.png'])
  })

  it('giữ được thứ tự khi trang nằm trong nhiều thư mục', () => {
    expect(sortedImageNames(['ch2/1.jpg', 'ch1/9.jpg', 'ch1/10.jpg'])).toEqual([
      'ch1/9.jpg',
      'ch1/10.jpg',
      'ch2/1.jpg',
    ])
  })
})

describe('compareNatural', () => {
  it('không phân biệt hoa thường', () => {
    expect(compareNatural('Page2.JPG', 'page10.jpg')).toBeLessThan(0)
  })
})
