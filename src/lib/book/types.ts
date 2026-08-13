import type { BookSourceFormat } from '../../types'

export type { BookSourceFormat }

/** Một dòng văn bản đã dựng lại, kèm thông tin dùng để dò tiêu đề chương. */
export type TextLine = {
  text: string
  fontSize: number
  /** Chỉ số trang (PDF) hoặc chỉ số file trong spine (EPUB), đếm từ 0. */
  page: number
  isPageFirst: boolean
  isPageLast: boolean
}

export type RawChapter = {
  title: string
  content: string
}

export type RawBook = {
  title: string
  author: string | null
  sourceFormat: BookSourceFormat
  sourceFilename: string
  /** Số trang thật, chỉ PDF mới có. */
  pageCount: number | null
  /** Ảnh bìa JPEG đã chuẩn hoá, null nếu không lấy được từ file. */
  cover: Blob | null
  chapters: RawChapter[]
}

export type ExtractPhase = 'reading' | 'extracting' | 'splitting'

export type ExtractProgress = {
  phase: ExtractPhase
  current: number
  total: number
}

export type ProgressCallback = (progress: ExtractProgress) => void

/** Lỗi có thông điệp đã viết sẵn cho người dùng, hiển thị thẳng lên UI. */
export class BookImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookImportError'
  }
}
