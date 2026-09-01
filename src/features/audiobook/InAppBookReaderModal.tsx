import { useState } from 'react'
import { X, Maximize2, Minimize2, BookOpen, RotateCw } from 'lucide-react'
import type { Audiobook } from '../../types/audiobook'

interface InAppBookReaderModalProps {
  isOpen: boolean
  book: Audiobook | null
  onClose: () => void
}

/** Chuyển đổi link PDF / Google Drive sang URL nhúng xem trực tiếp trong app */
function getEmbeddableReaderUrl(url: string): string {
  if (!url) return ''
  const trimmed = url.trim()

  // Google Drive link
  if (trimmed.includes('drive.google.com')) {
    const idMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/)
    if (idMatch && idMatch[1]) {
      return `https://drive.google.com/file/d/${idMatch[1]}/preview`
    }
  }

  // Direct PDF file
  if (trimmed.toLowerCase().endsWith('.pdf') || trimmed.includes('.pdf?')) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(trimmed)}&embedded=true`
  }

  return trimmed
}

export function InAppBookReaderModal({ isOpen, book, onClose }: InAppBookReaderModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  if (!isOpen || !book) return null

  const targetUrl = book.readbookUrl || book.pdfUrl || ''
  const embedUrl = getEmbeddableReaderUrl(targetUrl)

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev)
  }

  const handleReload = () => {
    setIsLoading(true)
    setReloadKey((k) => k + 1)
  }

  return (
    <div className={`inapp-reader-overlay ${isFullscreen ? 'fullscreen' : ''}`} onClick={onClose}>
      <div
        className={`inapp-reader-modal ${isFullscreen ? 'fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="inapp-reader-header">
          <div className="inapp-reader-title-box">
            <div className="inapp-reader-badge">
              <BookOpen size={14} />
              <span>Đọc sách trong App</span>
            </div>
            <h3 className="inapp-reader-title" title={book.title}>
              {book.title}
            </h3>
            {book.author && <span className="inapp-reader-author">· {book.author}</span>}
          </div>

          <div className="inapp-reader-actions">
            <button
              type="button"
              className="inapp-reader-btn"
              onClick={handleReload}
              title="Tải lại trang đọc"
            >
              <RotateCw size={16} />
            </button>

            <button
              type="button"
              className="inapp-reader-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              type="button"
              className="inapp-reader-btn close"
              onClick={onClose}
              title="Đóng trình đọc"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Reader Frame Body */}
        <div className="inapp-reader-body">
          {isLoading && (
            <div className="inapp-reader-loading">
              <div className="inapp-reader-spinner" />
              <span>Đang tải nội dung sách...</span>
            </div>
          )}

          {embedUrl ? (
            <iframe
              key={reloadKey}
              src={embedUrl}
              title={`Đọc sách ${book.title}`}
              className="inapp-reader-iframe"
              allow="fullscreen; clipboard-read; clipboard-write"
              onLoad={() => setIsLoading(false)}
            />
          ) : (
            <div className="inapp-reader-empty">
              <BookOpen size={48} />
              <p>Chưa có bản đọc trực tuyến cho cuốn sách này.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
