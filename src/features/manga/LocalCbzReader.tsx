import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, FolderOpen, Loader2 } from 'lucide-react'
import { openCbz, releaseCbz, type CbzPage } from '../../lib/cbz'
import { ReaderControls, useAutoScroll, useReaderPrefs } from './readerControls'

/**
 * Đọc file .cbz/.zip tải sẵn trên máy.
 *
 * Ảnh chỉ nằm trong bộ nhớ trình duyệt, không tải lên đâu cả, nên đọc được khi
 * mất mạng và không tốn dung lượng Supabase. Đóng trình đọc là nhả hết blob URL.
 */
export function LocalCbzReader({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [pages, setPages] = useState<CbzPage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  const { prefs, update: updatePrefs, readerStyle } = useReaderPrefs()
  const autoScroll = useAutoScroll(useCallback(() => mainRef.current, []), prefs.speed)

  // Rời trình đọc thì trả bộ nhớ lại cho trình duyệt.
  useEffect(() => () => releaseCbz(pages), [pages])

  const pick = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      releaseCbz(pages)
      const book = await openCbz(file)
      setTitle(book.name)
      setPages(book.pages)
      if (mainRef.current) mainRef.current.scrollTop = 0
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không mở được file này.')
      setPages([])
    }
    setBusy(false)
  }

  return (
    <div className="bl-reader-overlay">
      {pages.length > 0 && (
        <ReaderControls running={autoScroll.running} onToggle={autoScroll.toggle} prefs={prefs} onChange={updatePrefs} />
      )}

      <header className="bl-reader-header-compact">
        <div className="bl-reader-header-left">
          <button className="bl-reader-back-btn" onClick={onClose} title="Trở về" aria-label="Trở về">
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="bl-reader-header-right">
          <span style={{ fontSize: '0.82rem', fontWeight: 700, marginRight: 8 }}>
            {title || 'Đọc file trên máy'}
            {pages.length > 0 && ` · ${pages.length} trang`}
          </span>
          <button className="bl-reader-nav-icon-btn" onClick={() => fileInput.current?.click()} title="Chọn file khác" aria-label="Chọn file khác">
            <FolderOpen size={18} />
          </button>
        </div>
      </header>

      <input
        aria-label="Chọn file truyện CBZ hoặc EPUB"
        ref={fileInput}
        type="file"
        accept=".cbz,.zip,application/zip,application/x-cbz"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void pick(file)
        }}
      />

      <main ref={mainRef} className="bl-reader-body" style={readerStyle}>
        {busy ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#e5e7eb' }}>
            <Loader2 size={28} className="spin" />
            <p style={{ marginTop: 8, fontSize: '0.85rem' }}>Đang giải nén…</p>
          </div>
        ) : pages.length > 0 ? (
          <div className="bl-reader-image-stream">
            {pages.map((page, idx) => (
              <div key={page.url} className="bl-image-frame">
                <img src={page.url} alt={`Trang ${idx + 1}`} loading={idx < 3 ? 'eager' : 'lazy'} className="bl-chapter-img" />
                <span className="bl-page-badge">{idx + 1} / {pages.length}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#e5e7eb' }}>
            <p style={{ fontSize: '0.9rem', marginBottom: 12 }}>
              Chọn file <strong>.cbz</strong> hoặc <strong>.zip</strong> chứa ảnh truyện trên máy.
            </p>
            {error && <p style={{ color: 'var(--rose)', fontSize: '0.82rem', marginBottom: 12 }}>{error}</p>}
            <button className="bl-btn-load-more" onClick={() => fileInput.current?.click()}>
              <FolderOpen size={16} /> Chọn file truyện
            </button>
            <p style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 12 }}>
              File chỉ mở trong máy bạn, không tải lên máy chủ.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
