import { describe, expect, it } from 'vitest'
import type { RawChapter, TextLine } from './types'
import {
  MAX_CHAPTER_CHARS,
  bodyFontSize,
  detectHeadingIndexes,
  isChapterHeadingText,
  splitIntoChapters,
  splitLongChapters,
  withOffsets,
} from './chapters'

function line(text: string, fontSize = 12): TextLine {
  return { text, fontSize, page: 0, isPageFirst: false, isPageLast: false }
}

describe('isChapterHeadingText', () => {
  it('nhận ra tiêu đề chương tiếng Việt và tiếng Anh', () => {
    expect(isChapterHeadingText('Chương 3')).toBe(true)
    expect(isChapterHeadingText('CHƯƠNG MỘT')).toBe(true)
    expect(isChapterHeadingText('Phần II')).toBe(true)
    expect(isChapterHeadingText('Chapter 12')).toBe(true)
  })

  it('không nhận nhầm câu văn có chữ chương', () => {
    expect(isChapterHeadingText('Trong chương 3 tác giả đã nói rất rõ rằng mọi thứ đều có giá của nó.')).toBe(false)
    expect(isChapterHeadingText('Một đoạn văn bình thường.')).toBe(false)
  })
})

describe('bodyFontSize', () => {
  it('lấy cỡ chữ chiếm nhiều văn bản nhất, không phải cỡ xuất hiện nhiều dòng nhất', () => {
    const lines = [line('A', 24), line('B', 24), line('x'.repeat(400), 12)]

    expect(bodyFontSize(lines)).toBe(12)
  })
})

describe('detectHeadingIndexes', () => {
  it('dò theo mẫu chữ', () => {
    const lines = [line('Chương 1'), line('Nội dung một'), line('Chương 2'), line('Nội dung hai')]

    expect(detectHeadingIndexes(lines)).toEqual([0, 2])
  })

  it('dò theo cỡ chữ lớn hơn thân bài', () => {
    const lines = [line('Mở đầu câu chuyện', 20), line('x'.repeat(400), 12), line('Kết thúc', 20)]

    expect(detectHeadingIndexes(lines)).toEqual([0, 2])
  })
})

describe('splitIntoChapters', () => {
  it('cắt tại từng tiêu đề và bỏ dòng tiêu đề khỏi nội dung', () => {
    const lines = [line('Chương 1'), line('Nội dung một.'), line('Chương 2'), line('Nội dung hai.')]

    expect(splitIntoChapters(lines)).toEqual([
      { title: 'Chương 1', content: 'Nội dung một.' },
      { title: 'Chương 2', content: 'Nội dung hai.' },
    ])
  })

  it('gom phần trước tiêu đề đầu tiên thành Mở đầu khi đủ dài', () => {
    const lines = [line('x'.repeat(600) + '.'), line('Chương 1'), line('Nội dung.')]

    const chapters = splitIntoChapters(lines)

    expect(chapters[0].title).toBe('Mở đầu')
    expect(chapters[1].title).toBe('Chương 1')
  })

  it('trả về một chương duy nhất khi không dò được tiêu đề nào', () => {
    const chapters = splitIntoChapters([line('Một đoạn văn.'), line('Đoạn nữa.')])

    expect(chapters).toHaveLength(1)
    expect(chapters[0].title).toBe('Toàn bộ nội dung')
  })
})

describe('splitLongChapters', () => {
  it('tách chương dài tại ranh giới đoạn', () => {
    const paragraph = 'y'.repeat(20_000)
    const chapter: RawChapter = {
      title: 'Chương dài',
      content: [paragraph, paragraph, paragraph, paragraph].join('\n\n'),
    }

    const parts = splitLongChapters([chapter])

    expect(parts.length).toBeGreaterThan(1)
    expect(parts[0].title).toBe('Chương dài — Phần 1')
    expect(parts[1].title).toBe('Chương dài — Phần 2')
    expect(parts.every((part) => part.content.length <= MAX_CHAPTER_CHARS)).toBe(true)
    expect(parts.map((part) => part.content).join('\n\n')).toBe(chapter.content)
  })

  it('để nguyên chương ngắn', () => {
    const chapters: RawChapter[] = [{ title: 'Chương 1', content: 'ngắn thôi' }]

    expect(splitLongChapters(chapters)).toEqual(chapters)
  })
})

describe('withOffsets', () => {
  it('đánh số thứ tự và tính offset tích luỹ', () => {
    const rows = withOffsets([
      { title: 'A', content: '12345' },
      { title: 'B', content: '123' },
      { title: 'C', content: '1234567' },
    ])

    expect(rows.map((row) => row.idx)).toEqual([0, 1, 2])
    expect(rows.map((row) => row.charOffset)).toEqual([0, 5, 8])
    expect(rows.map((row) => row.charCount)).toEqual([5, 3, 7])
  })
})
