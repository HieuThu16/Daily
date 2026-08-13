import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { cleanBookLines, linesToContent } from './cleanText'
import { splitIntoChapters } from './chapters'
import { canvasToJpeg, COVER_MAX_HEIGHT, COVER_MAX_WIDTH } from './cover'
import { BookImportError } from './types'
import type { ProgressCallback, RawBook, RawChapter, TextLine } from './types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const SCAN_SAMPLE_PAGES = 5
const SCAN_MIN_CHARS_PER_PAGE = 100
const YIELD_EVERY_PAGES = 5
const SAME_LINE_TOLERANCE = 2
const MIN_CHAPTERS_BEFORE_RETRY = 3
const LONG_BOOK_CHARS = 100_000

type PdfDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>
type PdfPage = Awaited<ReturnType<PdfDocument['getPage']>>

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Dựng lại các dòng của một trang từ toạ độ của từng mảnh chữ. */
async function readPageLines(page: PdfPage, pageIndex: number): Promise<TextLine[]> {
  const content = await page.getTextContent()

  type Row = { y: number; size: number; parts: { x: number; width: number; str: string }[] }
  const rows: Row[] = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue
    const transform = item.transform as number[]
    const x = transform[4]
    const y = transform[5]
    const size = Math.abs(transform[3]) || item.height || 10

    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= SAME_LINE_TOLERANCE)
    if (!row) {
      row = { y, size, parts: [] }
      rows.push(row)
    }
    row.size = Math.max(row.size, size)
    row.parts.push({ x, width: item.width, str: item.str })
  }

  rows.sort((a, b) => b.y - a.y)

  const lines: TextLine[] = []
  for (const row of rows) {
    row.parts.sort((a, b) => a.x - b.x)
    let text = ''
    let previousEnd: number | null = null
    for (const part of row.parts) {
      if (previousEnd !== null && part.x - previousEnd > row.size * 0.25) text += ' '
      text += part.str
      previousEnd = part.x + part.width
    }
    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (trimmed) {
      lines.push({ text: trimmed, fontSize: row.size, page: pageIndex, isPageFirst: false, isPageLast: false })
    }
  }

  if (lines.length > 0) {
    lines[0].isPageFirst = true
    lines[lines.length - 1].isPageLast = true
  }
  return lines
}

async function resolvePageIndex(doc: PdfDocument, dest: unknown): Promise<number | null> {
  try {
    const resolved = typeof dest === 'string' ? await doc.getDestination(dest) : dest
    if (!Array.isArray(resolved) || !resolved[0]) return null
    return await doc.getPageIndex(resolved[0])
  } catch {
    return null
  }
}

/** Chia chương theo bookmark của PDF. Trả về null khi không dùng được. */
async function chaptersFromOutline(doc: PdfDocument, lines: TextLine[]): Promise<RawChapter[] | null> {
  let outline: Awaited<ReturnType<PdfDocument['getOutline']>>
  try {
    outline = await doc.getOutline()
  } catch {
    return null
  }
  if (!outline || outline.length === 0) return null

  const marks: { title: string; page: number }[] = []
  for (const item of outline) {
    const page = await resolvePageIndex(doc, item.dest)
    if (page === null) continue
    marks.push({ title: (item.title ?? '').trim() || `Mục ${marks.length + 1}`, page })
  }
  if (marks.length < 2) return null

  marks.sort((a, b) => a.page - b.page)

  const chapters: RawChapter[] = []
  marks.forEach((mark, position) => {
    const end = marks[position + 1]?.page ?? Number.POSITIVE_INFINITY
    let slice = lines.filter((line) => line.page >= mark.page && line.page < end)
    // Bookmark trỏ đúng vào dòng tiêu đề; bỏ đi để không lặp lại trong nội dung.
    if (slice[0] && slice[0].text.trim().toLowerCase() === mark.title.toLowerCase()) slice = slice.slice(1)
    const content = linesToContent(slice)
    if (content) chapters.push({ title: mark.title, content })
  })

  return chapters.length >= 2 ? chapters : null
}

function totalChars(chapters: RawChapter[]): number {
  return chapters.reduce((sum, chapter) => sum + chapter.content.length, 0)
}

/**
 * Trang 1 của một cuốn sách PDF gần như luôn là bìa hoặc trang tên sách, nên render nó
 * là đủ. Lỗi ở đây trả null chứ không ném: thiếu bìa không được làm hỏng lần nhập sách.
 */
async function renderCover(doc: PdfDocument): Promise<Blob | null> {
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1, COVER_MAX_WIDTH / base.width, COVER_MAX_HEIGHT / base.height)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)

    const canvasContext = canvas.getContext('2d')
    if (!canvasContext) return null

    await page.render({ canvasContext, viewport }).promise
    return await canvasToJpeg(canvas)
  } catch {
    return null
  }
}

export async function extractPdf(file: File, onProgress: ProgressCallback): Promise<RawBook> {
  onProgress({ phase: 'reading', current: 0, total: 1 })
  const data = new Uint8Array(await file.arrayBuffer())

  let doc: PdfDocument
  try {
    doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise
  } catch (error) {
    if ((error as Error).name === 'PasswordException') {
      throw new BookImportError('PDF này có mật khẩu, không mở được.')
    }
    throw new BookImportError('Không mở được file PDF này.')
  }

  const pageCount = doc.numPages
  const rawLines: TextLine[] = []
  let sampleChars = 0

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await doc.getPage(pageNumber)
    const pageLines = await readPageLines(page, pageNumber - 1)
    rawLines.push(...pageLines)

    if (pageNumber <= SCAN_SAMPLE_PAGES) {
      sampleChars += pageLines.reduce((sum, line) => sum + line.text.length, 0)
      const isLastSample = pageNumber === Math.min(SCAN_SAMPLE_PAGES, pageCount)
      if (isLastSample && sampleChars / pageNumber < SCAN_MIN_CHARS_PER_PAGE) {
        throw new BookImportError(
          'File này là bản scan (ảnh chụp), chưa hỗ trợ. Hãy dùng PDF có lớp văn bản hoặc file EPUB.',
        )
      }
    }

    onProgress({ phase: 'extracting', current: pageNumber, total: pageCount })
    if (pageNumber % YIELD_EVERY_PAGES === 0) await yieldToUi()
  }

  onProgress({ phase: 'splitting', current: pageCount, total: pageCount })

  // Render bìa sau khi đã qua bước phát hiện bản scan, để file scan không tốn công render.
  const cover = await renderCover(doc)

  const lines = cleanBookLines(rawLines, pageCount)

  let chapters = (await chaptersFromOutline(doc, lines)) ?? splitIntoChapters(lines)
  if (chapters.length < MIN_CHAPTERS_BEFORE_RETRY && totalChars(chapters) > LONG_BOOK_CHARS) {
    const heuristic = splitIntoChapters(lines)
    if (heuristic.length > chapters.length) chapters = heuristic
  }

  const metadata = await doc.getMetadata().catch(() => null)
  const info = (metadata?.info ?? {}) as { Title?: string; Author?: string }
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '')

  return {
    title: info.Title?.trim() || fallbackTitle,
    author: info.Author?.trim() || null,
    sourceFormat: 'PDF',
    sourceFilename: file.name,
    pageCount,
    cover,
    chapters,
  }
}
