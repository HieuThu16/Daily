import { describe, expect, it } from 'vitest'
import { chapterCount, findNewChapters, markSeen, seenKey } from './followUpdates'

const mangas = [
  { slug: 'a', title: 'Truyện A', totalChapters: 12 },
  { slug: 'b', title: 'Truyện B', totalChapters: 5 },
  { slug: 'c', title: 'Truyện C', totalChapters: 30 },
]

describe('chapterCount', () => {
  it('ưu tiên totalChapters, thiếu thì đếm mảng chapters', () => {
    expect(chapterCount({ slug: 'x', title: 'X', totalChapters: 7 })).toBe(7)
    expect(chapterCount({ slug: 'x', title: 'X', chapters: [1, 2, 3] })).toBe(3)
    expect(chapterCount({ slug: 'x', title: 'X' })).toBe(0)
  })
})

describe('findNewChapters', () => {
  it('chỉ báo truyện đang theo dõi và có thêm chương', () => {
    const seen = { 'BL:a': 10, 'BL:b': 5, 'BL:c': 20 }
    const updates = findNewChapters(mangas, ['a', 'b'], 'BL', seen)
    expect(updates.map((u) => u.slug)).toEqual(['a'])
    expect(updates[0].newChapters).toBe(2)
  })

  it('truyện mới theo dõi chưa có mốc thì không báo', () => {
    expect(findNewChapters(mangas, ['a'], 'BL', {})).toEqual([])
  })

  it('số chương giảm hoặc giữ nguyên thì không báo', () => {
    expect(findNewChapters(mangas, ['a'], 'BL', { 'BL:a': 99 })).toEqual([])
    expect(findNewChapters(mangas, ['a'], 'BL', { 'BL:a': 12 })).toEqual([])
  })

  it('mốc của BL không lẫn sang Ngôn Tình', () => {
    expect(findNewChapters(mangas, ['a'], 'NGONTINH', { 'BL:a': 1 })).toEqual([])
    expect(findNewChapters(mangas, ['a'], 'NGONTINH', { 'NGONTINH:a': 1 })).toHaveLength(1)
  })

  it('truyện nhiều chương mới nhất đứng trước', () => {
    const seen = { 'BL:a': 1, 'BL:c': 1 }
    expect(findNewChapters(mangas, ['a', 'c'], 'BL', seen).map((u) => u.slug)).toEqual(['c', 'a'])
  })
})

describe('markSeen', () => {
  it('ghi mốc cho truyện đang theo dõi, giữ nguyên mốc khác', () => {
    const next = markSeen(mangas, ['a'], 'BL', { 'NGONTINH:z': 3 })
    expect(next).toEqual({ 'NGONTINH:z': 3, 'BL:a': 12 })
  })

  it('sau khi ghi mốc thì không còn chương mới nào', () => {
    const next = markSeen(mangas, ['a', 'c'], 'BL', { 'BL:a': 1 })
    expect(findNewChapters(mangas, ['a', 'c'], 'BL', next)).toEqual([])
  })
})

describe('seenKey', () => {
  it('gộp loại truyện với slug', () => {
    expect(seenKey('BL', 'the-leashed')).toBe('BL:the-leashed')
  })
})
