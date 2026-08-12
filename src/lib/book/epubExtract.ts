import JSZip from 'jszip'
import { cleanBookLines, linesToContent, normalizeUnicode } from './cleanText'
import { splitIntoChapters } from './chapters'
import { BookImportError } from './types'
import type { ProgressCallback, RawBook, RawChapter, TextLine } from './types'

const DC_NAMESPACE = 'http://purl.org/dc/elements/1.1/'
const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,dd,dt'
const BODY_FONT_SIZE = 12
const HEADING_FONT_SIZE: Record<string, number> = { h1: 20, h2: 18, h3: 16, h4: 15, h5: 14, h6: 13 }
const YIELD_EVERY_FILES = 5
const MIN_CHAPTERS_BEFORE_RETRY = 3
const LONG_BOOK_CHARS = 100_000
const MAX_HEADING_LENGTH = 80

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const invalidEpub = () => new BookImportError('File EPUB không hợp lệ hoặc đã hỏng.')

function parseXml(source: string, mimeType: DOMParserSupportedType): Document {
  const doc = new DOMParser().parseFromString(source, mimeType)
  if (doc.querySelector('parsererror')) throw invalidEpub()
  return doc
}

/** Gộp đường dẫn tương đối bên trong file EPUB (luôn dùng `/`, không phải đường dẫn hệ thống). */
function resolvePath(basePath: string, relative: string): string {
  const stack = basePath.split('/').slice(0, -1)
  for (const segment of decodeURIComponent(relative).split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') stack.pop()
    else stack.push(segment)
  }
  return stack.join('/')
}

const stripFragment = (href: string) => href.split('#')[0]

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path)
  return entry ? entry.async('string') : null
}

/** Lấy các dòng văn bản từ một file XHTML, giữ cấp tiêu đề dưới dạng cỡ chữ. */
function xhtmlToLines(source: string, fileIndex: number): TextLine[] {
  let doc: Document
  try {
    doc = parseXml(source, 'application/xhtml+xml')
  } catch {
    doc = new DOMParser().parseFromString(source, 'text/html')
  }

  const root = doc.body ?? doc.documentElement
  if (!root) return []

  root.querySelectorAll('script, style, nav, header, footer, svg, figure, table').forEach((node) => node.remove())
  root.querySelectorAll('br').forEach((br) => br.replaceWith(doc.createTextNode('\n')))

  const lines: TextLine[] = []
  const push = (text: string, fontSize: number) => {
    for (const piece of text.split('\n')) {
      const normalized = normalizeUnicode(piece)
      if (normalized) {
        lines.push({ text: normalized, fontSize, page: fileIndex, isPageFirst: false, isPageLast: false })
      }
    }
  }

  const blocks = Array.from(root.querySelectorAll(BLOCK_SELECTOR))
  if (blocks.length === 0) {
    push(root.textContent ?? '', BODY_FONT_SIZE)
    return lines
  }

  for (const block of blocks) {
    // Bỏ qua khối lồng khối để không lấy trùng nội dung.
    if (block.querySelector(BLOCK_SELECTOR)) continue
    const tag = block.tagName.toLowerCase()
    push(block.textContent ?? '', HEADING_FONT_SIZE[tag] ?? BODY_FONT_SIZE)
  }

  return lines
}

/** Đọc mục lục: ưu tiên nav của EPUB 3, lùi về toc.ncx của EPUB 2. Khoá là đường dẫn file. */
async function readToc(zip: JSZip, opfPath: string, opf: Document): Promise<Map<string, string>> {
  const titles = new Map<string, string>()
  const manifestItems = Array.from(opf.querySelectorAll('manifest > item'))

  const navItem = manifestItems.find((item) =>
    (item.getAttribute('properties') ?? '').split(/\s+/).includes('nav'),
  )
  if (navItem) {
    const navPath = resolvePath(opfPath, navItem.getAttribute('href') ?? '')
    const navSource = await readText(zip, navPath)
    if (navSource) {
      const navDoc = new DOMParser().parseFromString(navSource, 'text/html')
      const navs = Array.from(navDoc.querySelectorAll('nav'))
      const tocNav = navs.find((nav) => (nav.getAttribute('epub:type') ?? '').includes('toc')) ?? navs[0]
      for (const anchor of Array.from(tocNav?.querySelectorAll('a') ?? [])) {
        const href = anchor.getAttribute('href')
        const label = normalizeUnicode(anchor.textContent ?? '')
        if (!href || !label) continue
        const target = resolvePath(navPath, stripFragment(href))
        if (!titles.has(target)) titles.set(target, label)
      }
    }
  }

  if (titles.size > 0) return titles

  const ncxItem = manifestItems.find(
    (item) => item.getAttribute('media-type') === 'application/x-dtbncx+xml',
  )
  if (!ncxItem) return titles

  const ncxPath = resolvePath(opfPath, ncxItem.getAttribute('href') ?? '')
  const ncxSource = await readText(zip, ncxPath)
  if (!ncxSource) return titles

  const ncxDoc = parseXml(ncxSource, 'application/xml')
  for (const point of Array.from(ncxDoc.querySelectorAll('navPoint'))) {
    const href = point.querySelector('content')?.getAttribute('src')
    const label = normalizeUnicode(point.querySelector('navLabel > text')?.textContent ?? '')
    if (!href || !label) continue
    const target = resolvePath(ncxPath, stripFragment(href))
    if (!titles.has(target)) titles.set(target, label)
  }

  return titles
}

function firstHeadingTitle(lines: TextLine[]): string | null {
  const heading = lines.find((line) => line.fontSize > BODY_FONT_SIZE && line.text.length <= MAX_HEADING_LENGTH)
  return heading?.text ?? null
}

export async function extractEpub(file: File, onProgress: ProgressCallback): Promise<RawBook> {
  onProgress({ phase: 'reading', current: 0, total: 1 })

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw invalidEpub()
  }

  const containerSource = await readText(zip, 'META-INF/container.xml')
  if (!containerSource) throw invalidEpub()
  const opfPath = parseXml(containerSource, 'application/xml')
    .querySelector('rootfile')
    ?.getAttribute('full-path')
  if (!opfPath) throw invalidEpub()

  const opfSource = await readText(zip, opfPath)
  if (!opfSource) throw invalidEpub()
  const opf = parseXml(opfSource, 'application/xml')

  const hrefById = new Map<string, string>()
  for (const item of Array.from(opf.querySelectorAll('manifest > item'))) {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    if (id && href) hrefById.set(id, href)
  }

  const spinePaths: string[] = []
  for (const itemref of Array.from(opf.querySelectorAll('spine > itemref'))) {
    const href = hrefById.get(itemref.getAttribute('idref') ?? '')
    if (href) spinePaths.push(resolvePath(opfPath, href))
  }
  if (spinePaths.length === 0) throw invalidEpub()

  const toc = await readToc(zip, opfPath, opf)

  const documents: { path: string; lines: TextLine[] }[] = []
  for (const [index, path] of spinePaths.entries()) {
    const source = await readText(zip, path)
    if (source) documents.push({ path, lines: xhtmlToLines(source, index) })
    onProgress({ phase: 'extracting', current: index + 1, total: spinePaths.length })
    if ((index + 1) % YIELD_EVERY_FILES === 0) await yieldToUi()
  }

  onProgress({ phase: 'splitting', current: spinePaths.length, total: spinePaths.length })

  // EPUB không có khái niệm trang nên truyền pageCount = 0: bỏ qua bước gỡ tiêu đề chạy.
  const allLines = cleanBookLines(
    documents.flatMap((document) => document.lines),
    0,
  )

  let chapters: RawChapter[] = []
  for (const document of documents) {
    const lines = cleanBookLines(document.lines, 0)
    const tocTitle = toc.get(document.path)
    const body = lines[0] && tocTitle && lines[0].text === tocTitle ? lines.slice(1) : lines
    const content = linesToContent(body)
    if (!content) continue

    if (tocTitle === undefined && chapters.length > 0) {
      chapters[chapters.length - 1].content += '\n\n' + content
      continue
    }
    chapters.push({
      title: tocTitle ?? firstHeadingTitle(lines) ?? `Phần ${chapters.length + 1}`,
      content,
    })
  }

  const total = chapters.reduce((sum, chapter) => sum + chapter.content.length, 0)
  if (chapters.length < MIN_CHAPTERS_BEFORE_RETRY && total > LONG_BOOK_CHARS) {
    const heuristic = splitIntoChapters(allLines)
    if (heuristic.length > chapters.length) chapters = heuristic
  }
  if (chapters.length === 0) chapters = splitIntoChapters(allLines)

  const title = opf.getElementsByTagNameNS(DC_NAMESPACE, 'title')[0]?.textContent?.trim()
  const author = opf.getElementsByTagNameNS(DC_NAMESPACE, 'creator')[0]?.textContent?.trim()

  return {
    title: title || file.name.replace(/\.[^.]+$/, ''),
    author: author || null,
    sourceFormat: 'EPUB',
    sourceFilename: file.name,
    pageCount: null,
    // TODO(Task 4): thay bằng ảnh bìa lấy từ manifest EPUB.
    cover: null,
    chapters,
  }
}
