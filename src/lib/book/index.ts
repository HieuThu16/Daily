import { extractEpub } from './epubExtract'
import { extractPdf } from './pdfExtract'
import { BookImportError } from './types'
import type { ProgressCallback, RawBook } from './types'

export const MAX_FILE_BYTES = 60 * 1024 * 1024
const MIN_TOTAL_CHARS = 500

export { BookImportError }
export type { ExtractProgress, ProgressCallback, RawBook, RawChapter } from './types'

export async function extractBook(file: File, onProgress: ProgressCallback): Promise<RawBook> {
  if (file.size > MAX_FILE_BYTES) {
    throw new BookImportError('File quá lớn (tối đa 60MB).')
  }

  const name = file.name.toLowerCase()
  const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
  const isEpub = name.endsWith('.epub') || file.type === 'application/epub+zip'

  if (!isPdf && !isEpub) {
    throw new BookImportError('Chỉ hỗ trợ file PDF và EPUB.')
  }

  const book = isPdf ? await extractPdf(file, onProgress) : await extractEpub(file, onProgress)

  const totalChars = book.chapters.reduce((sum, chapter) => sum + chapter.content.length, 0)
  if (totalChars < MIN_TOTAL_CHARS) {
    throw new BookImportError('Không lấy được nội dung từ file này.')
  }

  return book
}
