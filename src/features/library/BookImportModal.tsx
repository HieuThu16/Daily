import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileUp, Loader2 } from 'lucide-react'
import { Modal } from '../shared'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { saveBook, saveCoverUrl, uploadCover } from '../../lib/book/repository'
import type { Media } from '../../types'
import type { ExtractProgress, RawBook, RawChapter } from '../../lib/book/types'
import { BookChapterEditor } from './BookChapterEditor'

type Stage = 'pick' | 'working' | 'preview' | 'saving'

/** Kết quả một lần nhập sách, gói thành object để không phải nhớ thứ tự bốn tham số. */
export type ImportResult = {
  mediaItemId: string
  createdItem: Media | null
  coverUrl: string | null
  coverFailed: boolean
}

type Props = {
  /** Sách BOOK đã có trong thư viện nhưng chưa nhập nội dung. */
  attachableBooks: Media[]
  onClose: () => void
  onImported: (result: ImportResult) => void
}

const PHASE_LABEL: Record<ExtractProgress['phase'], string> = {
  reading: 'Đang đọc file',
  extracting: 'Đang bóc tách',
  splitting: 'Đang chia chương',
}

export function BookImportModal({ attachableBooks, onClose, onImported }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('pick')
  const [progress, setProgress] = useState<ExtractProgress | null>(null)
  const [error, setError] = useState('')
  const [book, setBook] = useState<RawBook | null>(null)
  const [chapters, setChapters] = useState<RawChapter[]>([])
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [target, setTarget] = useState('NEW')
  const [isPublic, setIsPublic] = useState(true)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  // Object URL của bìa phải được thu hồi, nếu không mỗi lần chọn file lại rò một blob.
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  // Bóc tách một file lớn mất vài chục giây. Người dùng đóng modal giữa chừng thì promise
  // vẫn chạy nốt và vẫn tạo object URL, nhưng setState lúc đó là no-op nên URL không vào
  // state và cleanup ở trên không bao giờ thu hồi nó — rò tới khi tải lại cả trang.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const totalChars = chapters.reduce((sum, chapter) => sum + chapter.content.length, 0)
  const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  const handleFile = async (file: File) => {
    setError('')
    setStage('working')
    setProgress({ phase: 'reading', current: 0, total: 1 })
    try {
      // Nạp động: pdfjs và jszip chỉ tải về khi người dùng thực sự nhập sách.
      const { extractBook } = await import('../../lib/book')
      const result = await extractBook(file, setProgress)
      if (!mounted.current) return
      setBook(result)
      setCoverPreview(result.cover ? URL.createObjectURL(result.cover) : null)
      setChapters(result.chapters)
      setTitle(result.title)
      setAuthor(result.author ?? '')
      setStage('preview')
    } catch (caught) {
      if (!mounted.current) return
      setError(caught instanceof Error ? caught.message : 'Không xử lý được file này.')
      setStage('pick')
    }
  }

  const save = async () => {
    if (!book || !supabase) return
    setError('')
    setStage('saving')
    try {
      let mediaItemId = target
      let createdItem: Media | null = null

      if (target === 'NEW') {
        const { data, error: insertError } = await supabase
          .from('media_items')
          .insert({
            type: 'BOOK',
            name: title.trim() || book.title,
            description: null,
            author: author.trim() || null,
            status: 'IN_PROGRESS',
            is_favorite: false,
            book_format: 'READ',
            is_public: isPublic,
            start_date: localDate(),
            log_date: localDate(),
          })
          .select()
          .single()
        if (insertError || !data) throw new Error(insertError?.message ?? 'Không tạo được mục sách.')
        createdItem = data as Media
        mediaItemId = createdItem.id
      } else {
        await supabase.from('media_items').update({ is_public: isPublic }).eq('id', target)
      }

      await saveBook(mediaItemId, { ...book, title: title.trim() || book.title, chapters })

      // Bìa lưu sau cùng và lỗi ở đây không huỷ lần nhập: sách đã vào thư viện rồi,
      // người dùng đổi bìa tay ở màn chi tiết được.
      let coverUrl: string | null = null
      let coverFailed = false
      if (book.cover) {
        try {
          coverUrl = await uploadCover(mediaItemId, book.cover)
          await saveCoverUrl(mediaItemId, coverUrl)
        } catch {
          coverUrl = null
          coverFailed = true
        }
      }

      onImported({
        mediaItemId,
        createdItem: createdItem ? { ...createdItem, cover_url: coverUrl } : null,
        coverUrl,
        coverFailed,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được sách.')
      setStage('preview')
    }
  }

  return (
    <Modal title="📥 Nhập sách từ PDF / EPUB" onClose={onClose}>
      <div className="book-import">
        {error && <p className="book-import-error">{error}</p>}

        {stage === 'pick' && (
          <>
            <input
              aria-label="Chọn file sách để nhập"
              ref={fileInput}
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void handleFile(file)
              }}
            />
            <button className="primary book-import-pick" onClick={() => fileInput.current?.click()}>
              <FileUp size={18} /> Chọn file PDF hoặc EPUB
            </button>
            <p className="book-import-note">
              File được xử lý ngay trên máy bạn, chỉ phần văn bản đã bóc tách mới được lưu lên Supabase.
              Tối đa 60MB. PDF bản scan (ảnh chụp trang sách) chưa hỗ trợ.
            </p>
          </>
        )}

        {stage === 'working' && progress && (
          <div className="book-import-progress">
            <div className="book-import-phase">
              <Loader2 size={16} className="spin" />
              {PHASE_LABEL[progress.phase]}
              {progress.total > 1 && ` ${progress.current}/${progress.total}`}
            </div>
            <div className="book-import-bar">
              <div style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        {(stage === 'preview' || stage === 'saving') && book && (
          <>
            <div className="book-import-cover">
              {coverPreview ? (
                <img src={coverPreview} alt="Ảnh bìa lấy từ file" />
              ) : (
                <div className="book-import-cover-empty">
                  <p>Không tìm thấy ảnh bìa trong file</p>
                  <p>Đổi được ở màn chi tiết sách</p>
                </div>
              )}
            </div>
            <label className="book-import-field">
              <span>Tên sách</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="book-import-field">
              <span>Tác giả</span>
              <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Chưa rõ" />
            </label>

            {/* Tuỳ chọn: Công khai cho mọi người cùng đọc hay Riêng tư cá nhân */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0', padding: '10px 12px', background: 'var(--card-subtle-bg, rgba(255,255,255,0.04))', borderRadius: 10, border: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Quyền hiển thị</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.84rem' }}>
                <input
                  type="radio"
                  name="book-visibility"
                  checked={isPublic}
                  onChange={() => setIsPublic(true)}
                />
                <span>🌐 <strong>Tất cả mọi người</strong> (Ai cũng thấy và đọc được sách trong thư viện)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.84rem' }}>
                <input
                  type="radio"
                  name="book-visibility"
                  checked={!isPublic}
                  onChange={() => setIsPublic(false)}
                />
                <span>🔒 <strong>Chỉ mình tôi</strong> (Sách riêng tư cá nhân)</span>
              </label>
            </div>

            <p className="book-import-note">
              {book.sourceFormat} · {chapters.length} chương · {totalChars.toLocaleString('vi-VN')} ký tự ·{' '}
              {book.pageCount
                ? `${book.pageCount} trang`
                : `~${Math.max(1, Math.round(totalChars / 1800))} trang ước tính`}
            </p>

            <label className="book-import-field">
              <span>Lưu vào</span>
              <select value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="NEW">➕ Tạo sách mới trong thư viện</option>
                {attachableBooks.map((item) => (
                  <option key={item.id} value={item.id}>
                    📖 {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="book-import-label">Mục lục — sửa lại nếu chia chưa đúng</p>
              <div className="book-import-chapters">
                <BookChapterEditor chapters={chapters} onChange={setChapters} />
              </div>
            </div>

            <button
              className="primary book-import-save"
              disabled={stage === 'saving' || chapters.length === 0}
              onClick={() => void save()}
            >
              {stage === 'saving' ? <Loader2 size={16} className="spin" /> : <BookOpen size={16} />}
              {stage === 'saving' ? 'Đang lưu…' : 'Lưu và đọc ngay'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
