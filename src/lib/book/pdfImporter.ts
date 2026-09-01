import { extractBook } from './index'
import { saveBook, loadBookDocument } from './repository'
import { apiFetch } from '../apiFetch'

export type PdfImportProgress = {
  stage: 'DOWNLOADING' | 'PARSING' | 'SAVING' | 'DONE' | 'ERROR'
  percent: number
  message: string
}

/**
 * Tải file PDF từ nguồn, tự động phân tích trang/chương thành nội dung chữ và lưu vào cơ sở dữ liệu sách chính
 */
export async function downloadAndImportPdfBook(
  mediaItemId: string,
  bookTitle: string,
  pdfUrl: string,
  onProgress?: (p: PdfImportProgress) => void
): Promise<boolean> {
  if (!pdfUrl) return false

  // 1. Kiểm tra nếu đã có tài liệu sách trong database rồi thì không cần phân tích lại
  try {
    const existingDoc = await loadBookDocument(mediaItemId)
    if (existingDoc && existingDoc.chapter_count > 0) {
      onProgress?.({ stage: 'DONE', percent: 100, message: 'Đã sẵn sàng nội dung sách.' })
      return true
    }
  } catch {}

  onProgress?.({ stage: 'DOWNLOADING', percent: 15, message: 'Đang tải file PDF từ nguồn...' })

  let arrayBuffer: ArrayBuffer | null = null

  // A. Thử tải qua internal proxy stream
  try {
    const proxyUrl = `/api/link-preview?audio=1&url=${encodeURIComponent(pdfUrl)}`
    const res = await apiFetch(proxyUrl)
    if (res.ok) {
      arrayBuffer = await res.arrayBuffer()
    }
  } catch {}

  // B. Thử tải trực tiếp nếu proxy không được
  if (!arrayBuffer || arrayBuffer.byteLength < 1000) {
    try {
      const res = await fetch(pdfUrl)
      if (res.ok) {
        arrayBuffer = await res.arrayBuffer()
      }
    } catch {}
  }

  // C. Thử qua public CORS proxy nếu bị chặn
  if (!arrayBuffer || arrayBuffer.byteLength < 1000) {
    try {
      const pUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(pdfUrl)}`
      const res = await fetch(pUrl)
      if (res.ok) {
        arrayBuffer = await res.arrayBuffer()
      }
    } catch {}
  }

  if (!arrayBuffer || arrayBuffer.byteLength < 1000) {
    throw new Error('Không thể tải file PDF từ máy chủ nguồn.')
  }

  onProgress?.({ stage: 'PARSING', percent: 45, message: 'Đang trích xuất văn bản & chia chương...' })

  const file = new File([arrayBuffer], `${bookTitle}.pdf`, { type: 'application/pdf' })

  const rawBook = await extractBook(file, (extractP) => {
    const rawPct = extractP.total > 0 ? (extractP.current / extractP.total) * 100 : 50
    const pct = Math.round(45 + rawPct * 0.45)
    onProgress?.({
      stage: 'PARSING',
      percent: Math.min(90, pct),
      message: `Đang bóc tách trang (${extractP.current}/${extractP.total})...`,
    })
  })

  onProgress?.({ stage: 'SAVING', percent: 92, message: 'Đang lưu nội dung vào thư viện ứng dụng...' })

  await saveBook(mediaItemId, rawBook)

  onProgress?.({ stage: 'DONE', percent: 100, message: 'Hoàn tất bóc tách! Đang mở trình đọc...' })
  return true
}
