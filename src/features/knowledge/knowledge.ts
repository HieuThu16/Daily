import type { KnowledgeItem } from '../../types'

export const DEFAULT_CATEGORY = 'Chung'

/** Chuẩn hoá thể loại người dùng gõ: bỏ khoảng trắng thừa, rỗng thì về "Chung". */
export function normalizeCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ') || DEFAULT_CATEGORY
}

/** Đếm số thẻ theo từng thể loại, sắp xếp theo tên tiếng Việt. */
export function categoryStats(items: KnowledgeItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

/** Lọc theo thể loại đang chọn và từ khoá tìm kiếm (không phân biệt hoa thường). */
export function filterKnowledge(items: KnowledgeItem[], category: string | null, search: string): KnowledgeItem[] {
  const q = search.trim().toLowerCase()
  return items.filter((i) => {
    if (category && i.category !== category) return false
    if (!q) return true
    return `${i.question} ${i.answer} ${i.category}`.toLowerCase().includes(q)
  })
}

/** Nhiều câu trả lời của một thẻ được lưu chung một cột, mỗi dòng một ý. */
export function answerLines(answer: string): string[] {
  return answer.split('\n').map((a) => a.trim()).filter(Boolean)
}

export type LessonEntry = { question: string; answers: string[] }

/** Làm sạch trích dẫn (ví dụ [1, 2], [2-4], các số footnote như 1 2 . 1 2, 3 4 từ NotebookLM) và định dạng markdown thừa. */
export function cleanLessonText(raw: string): string {
  if (!raw) return ''
  return raw
    // Xoá trích dẫn dạng ngoặc vuông [1], [1, 2], [2-4], [12-14]
    .replace(/\[\s*\d+(?:[\s,–\-\.]+\d+)*\s*\]/g, '')
    // Bỏ in đậm markdown **text** hoặc __text__ trong plain text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // Xoá số footnote sau dấu câu: e.g. ". 3 4", ". 5", "! 1 2"
    .replace(/(?<=[.!?…])\s*(?:\d+[\s.·]*)+$/g, '')
    // Xoá chuỗi số footnote ở cuối câu trên mobile: e.g. "hiện diện 1 2 . 1 2" -> "hiện diện."
    .replace(/\s+(?:\d+[\s.·]*)+$/g, '.')
    // Gộp khoảng trắng thừa và chuẩn hoá dấu câu
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\.{2,}$/g, '.')
    .trim()
}

export type ParseLessonOptions = {
  /** Có xoá số thứ tự ở đầu câu hỏi không (ví dụ "1. Sự kiên trì..." -> "Sự kiên trì...") */
  stripQuestionNumbers?: boolean
}

export type ParsedLesson = {
  suggestedCategory?: string
  suggestedTitle?: string
  entries: LessonEntry[]
}

/** Tách văn bản từ NotebookLM, AI tóm tắt hoặc ghi chú thành danh sách thẻ bài học. */
export function parseLessonText(rawText: string, options?: ParseLessonOptions): ParsedLesson {
  const text = rawText.replace(/\r\n/g, '\n').trim()
  if (!text) return { entries: [] }

  const lines = text.split('\n')
  const entries: LessonEntry[] = []
  let currentQuestion = ''
  let currentAnswers: string[] = []
  let suggestedTitle: string | undefined
  let suggestedCategory: string | undefined
  let seenFirstHeading = false

  // Kiểm tra định dạng bảng 2 cột Front | Back hoặc Front :: Back
  const delimiterLines = lines.filter((l) => l.trim() && (l.includes(' | ') || l.includes(' :: ')))
  if (delimiterLines.length >= 2 && delimiterLines.length >= lines.filter((l) => l.trim()).length * 0.6) {
    for (const l of lines) {
      const trimmed = l.trim()
      if (!trimmed) continue
      const sep = trimmed.includes(' | ') ? ' | ' : ' :: '
      const [q, ...a] = trimmed.split(sep)
      const qClean = cleanLessonText(q)
      const aClean = cleanLessonText(a.join(sep))
      if (qClean) {
        entries.push({ question: qClean, answers: aClean ? [aClean] : [] })
      }
    }
    return { entries }
  }

  // Regex nhận diện tiêu đề / câu hỏi
  const mdHeadingRegex = /^#{1,6}\s*(.+)$/
  const numberedHeadingRegex = /^(?:(?:\d+[\.\)]|(?:Bài(?:\s*học)?|Phần|Mục|Ý)\s*\d+[:\.]?)\s+)(.+)$/
  const qaHeadingRegex = /^(?:Q|Câu\s*hỏi|Hỏi)\s*[:：]\s*(.+)$/i
  const boldHeadingRegex = /^\*\*(?:(?:\d+[\.\)]|(?:Bài(?:\s*học)?|Phần|Mục|Ý)\s*\d+[:\.]?)\s*)?([^*]+)\*\*$/

  const commitCurrent = () => {
    if (currentQuestion.trim()) {
      let q = currentQuestion.trim()
      if (options?.stripQuestionNumbers) {
        q = q.replace(/^(?:\d+[\.\)]|(?:Bài(?:\s*học)?|Phần|Mục|Ý)\s*\d+[:\.]?)\s*/i, '').trim()
      }
      const ans = currentAnswers.map((a) => a.trim()).filter(Boolean)
      entries.push({ question: q, answers: ans })
    }
    currentQuestion = ''
    currentAnswers = []
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    // Nhận diện dòng đầu tiên có thể là tiêu đề bài học nếu trước heading đầu tiên
    if (!seenFirstHeading) {
      const h1Match = trimmed.match(/^#\s+(.+)$/)
      if (h1Match) {
        suggestedTitle = cleanLessonText(h1Match[1])
        suggestedCategory = suggestedTitle
        continue
      }
    }

    let isHeading = false
    let extractedHeading = ''

    const mdMatch = trimmed.match(mdHeadingRegex)
    if (mdMatch) {
      isHeading = true
      extractedHeading = mdMatch[1]
    } else {
      const qaMatch = trimmed.match(qaHeadingRegex)
      if (qaMatch) {
        isHeading = true
        extractedHeading = qaMatch[1]
      } else {
        const numMatch = trimmed.match(numberedHeadingRegex)
        if (numMatch) {
          isHeading = true
          extractedHeading = trimmed // Giữ số thứ tự
        } else {
          const boldMatch = trimmed.match(boldHeadingRegex)
          if (boldMatch) {
            isHeading = true
            extractedHeading = boldMatch[1]
          }
        }
      }
    }

    if (isHeading) {
      seenFirstHeading = true
      commitCurrent()
      currentQuestion = cleanLessonText(extractedHeading)
      continue
    }

    // Nếu chưa gặp heading nào, các dòng trước heading đầu tiên là intro / mô tả
    if (!seenFirstHeading) {
      if (!suggestedTitle && trimmed.length < 80) {
        suggestedTitle = cleanLessonText(trimmed)
      }
      continue
    }

    // Dòng nội dung bên dưới heading hiện tại
    const ansMatch = trimmed.match(/^(?:A|Trả\s*lời|Đáp)\s*[:：]\s*(.+)$/i)
    if (ansMatch) {
      const cl = cleanLessonText(ansMatch[1])
      if (cl) currentAnswers.push(cl)
      continue
    }

    // Gạch đầu dòng: * , - , + , • , – , —
    const bulletMatch = trimmed.match(/^[-*+•–—]\s+(.+)$/)
    if (bulletMatch) {
      const cl = cleanLessonText(bulletMatch[1])
      if (cl) currentAnswers.push(cl)
      continue
    }

    // Đoạn văn hoặc dòng nối tiếp
    const cleaned = cleanLessonText(trimmed)
    if (!cleaned) continue

    if (currentAnswers.length === 0) {
      currentAnswers.push(cleaned)
    } else {
      const prev = currentAnswers[currentAnswers.length - 1]
      const isIndented = rawLine.startsWith('  ') || rawLine.startsWith('\t')
      const prevIncomplete = !/[.!?…:]$/.test(prev)
      if (isIndented || prevIncomplete) {
        currentAnswers[currentAnswers.length - 1] = `${prev} ${cleaned}`
      } else {
        currentAnswers.push(cleaned)
      }
    }
  }

  commitCurrent()

  // Dự phòng thông minh: nếu không có heading nào, tự động cấu trúc hoá bất kỳ văn bản nào
  if (entries.length === 0) {
    const rawCleanLines = lines.map((l) => cleanLessonText(l)).filter(Boolean)
    if (lines.some((l) => /^[-*+•–—]\s+/.test(l.trim()))) {
      const fallbackAnswers: string[] = []
      for (const l of lines) {
        const m = l.trim().match(/^[-*+•–—]\s+(.+)$/)
        if (m) {
          const c = cleanLessonText(m[1])
          if (c) fallbackAnswers.push(c)
        }
      }
      if (fallbackAnswers.length > 0) {
        entries.push({
          question: suggestedTitle || 'Ý chính bài học',
          answers: fallbackAnswers,
        })
      }
    } else if (rawCleanLines.length === 1) {
      const single = rawCleanLines[0]
      const colonIdx = single.indexOf(':')
      if (colonIdx > 0 && colonIdx < 60) {
        entries.push({
          question: single.slice(0, colonIdx).trim(),
          answers: [single.slice(colonIdx + 1).trim()],
        })
      } else {
        entries.push({
          question: single,
          answers: [],
        })
      }
    } else if (rawCleanLines.length > 1) {
      const isCustomTitle = Boolean(suggestedTitle && suggestedTitle !== rawCleanLines[0])
      const q: string = isCustomTitle && suggestedTitle ? suggestedTitle : rawCleanLines[0]
      entries.push({
        question: q,
        answers: isCustomTitle ? rawCleanLines : rawCleanLines.slice(1),
      })
    }
  }

  return {
    suggestedTitle,
    suggestedCategory,
    entries,
  }
}

/** Soạn bài học bằng tay: mỗi mục là một câu hỏi kèm danh sách câu trả lời và video nguồn (nếu có). */
export function lessonRows(
  entries: LessonEntry[],
  category: string,
  sourceVideoId?: string | null,
): { question: string; answer: string; category: string; source_video_id?: string | null }[] {
  const cat = normalizeCategory(category)
  return entries
    .map((e) => {
      const row: { question: string; answer: string; category: string; source_video_id?: string | null } = {
        question: e.question.trim(),
        answer: e.answers.map((a) => a.trim()).filter(Boolean).join('\n'),
        category: cat,
      }
      if (sourceVideoId) {
        row.source_video_id = sourceVideoId.trim()
      }
      return row
    })
    .filter((r) => r.question)
}
