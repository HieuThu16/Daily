import { linesToContent } from './cleanText'
import type { RawChapter, TextLine } from './types'

export const MAX_CHAPTER_CHARS = 60_000
const MAX_HEADING_LENGTH = 80
const MIN_PREFACE_CHARS = 500
const HEADING_SIZE_RATIO = 1.2

const CHAPTER_PATTERN =
  /^(?:chương|chuong|phần|phan|chapter|part|mục|muc)\s+(?:\d{1,3}|[ivxlcdm]{1,7}|một|mot|hai|ba|bốn|bon|tư|tu|năm|nam|sáu|sau|bảy|bay|tám|tam|chín|chin|mười|muoi)\b/i

export function isChapterHeadingText(line: string): boolean {
  const text = line.trim()
  if (!text || text.length > MAX_HEADING_LENGTH) return false
  return CHAPTER_PATTERN.test(text)
}

/** Cỡ chữ chiếm nhiều ký tự nhất — coi là cỡ chữ thân bài. */
export function bodyFontSize(lines: TextLine[]): number {
  const charsBySize = new Map<number, number>()
  for (const line of lines) {
    const size = Math.round(line.fontSize * 2) / 2
    charsBySize.set(size, (charsBySize.get(size) ?? 0) + line.text.length)
  }

  let best = 0
  let bestChars = -1
  for (const [size, chars] of charsBySize) {
    if (chars > bestChars) {
      best = size
      bestChars = chars
    }
  }
  return best
}

export function detectHeadingIndexes(lines: TextLine[]): number[] {
  const body = bodyFontSize(lines)
  const indexes: number[] = []

  lines.forEach((line, index) => {
    const text = line.text.trim()
    if (!text) return
    if (isChapterHeadingText(text)) {
      indexes.push(index)
      return
    }
    if (body > 0 && line.fontSize >= body * HEADING_SIZE_RATIO && text.length <= MAX_HEADING_LENGTH) {
      indexes.push(index)
    }
  })

  return indexes
}

export function splitIntoChapters(lines: TextLine[]): RawChapter[] {
  const wholeBook = (): RawChapter[] => [{ title: 'Toàn bộ nội dung', content: linesToContent(lines) }]

  const headings = detectHeadingIndexes(lines)
  if (headings.length === 0) return wholeBook()

  const chapters: RawChapter[] = []

  const prefaceContent = linesToContent(lines.slice(0, headings[0]))
  if (prefaceContent.length >= MIN_PREFACE_CHARS) {
    chapters.push({ title: 'Mở đầu', content: prefaceContent })
  }

  headings.forEach((start, position) => {
    const end = headings[position + 1] ?? lines.length
    const content = linesToContent(lines.slice(start + 1, end))
    if (!content) return
    chapters.push({ title: lines[start].text.trim(), content })
  })

  return chapters.length > 0 ? chapters : wholeBook()
}

/**
 * Tách chương dài hơn `maxChars` tại ranh giới đoạn để trang đọc không phải render
 * DOM quá lớn. Một đoạn đơn lẻ dài hơn `maxChars` vẫn giữ nguyên thành một phần.
 */
export function splitLongChapters(chapters: RawChapter[], maxChars = MAX_CHAPTER_CHARS): RawChapter[] {
  const out: RawChapter[] = []

  for (const chapter of chapters) {
    if (chapter.content.length <= maxChars) {
      out.push(chapter)
      continue
    }

    const parts: string[] = []
    let buffer = ''
    for (const paragraph of chapter.content.split('\n\n')) {
      if (buffer && buffer.length + paragraph.length + 2 > maxChars) {
        parts.push(buffer)
        buffer = paragraph
        continue
      }
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph
    }
    if (buffer) parts.push(buffer)

    parts.forEach((content, index) => {
      out.push({ title: `${chapter.title} — Phần ${index + 1}`, content })
    })
  }

  return out
}

export type ChapterWithOffset = RawChapter & {
  idx: number
  charCount: number
  charOffset: number
}

export function withOffsets(chapters: RawChapter[]): ChapterWithOffset[] {
  let offset = 0
  return chapters.map((chapter, idx) => {
    const charCount = chapter.content.length
    const row = { ...chapter, idx, charCount, charOffset: offset }
    offset += charCount
    return row
  })
}
