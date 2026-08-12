import { useRef, useState } from 'react'
import { BookOpen, FileUp, Loader2 } from 'lucide-react'
import { Modal } from '../shared'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { saveBook } from '../../lib/book/repository'
import type { Media } from '../../types'
import type { ExtractProgress, RawBook, RawChapter } from '../../lib/book/types'
import { BookChapterEditor } from './BookChapterEditor'

type Stage = 'pick' | 'working' | 'preview' | 'saving'

type Props = {
  /** Sách BOOK đã có trong thư viện nhưng chưa nhập nội dung. */
  attachableBooks: Media[]
  onClose: () => void
  onImported: (mediaItemId: string, createdItem: Media | null) => void
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
      setBook(result)
      setChapters(result.chapters)
      setTitle(result.title)
      setAuthor(result.author ?? '')
      setStage('preview')
    } catch (caught) {
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
            start_date: localDate(),
            log_date: localDate(),
          })
          .select()
          .single()
        if (insertError || !data) throw new Error(insertError?.message ?? 'Không tạo được mục sách.')
        createdItem = data as Media
        mediaItemId = createdItem.id
      }

      await saveBook(mediaItemId, { ...book, title: title.trim() || book.title, chapters })
      onImported(mediaItemId, createdItem)
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
            <label className="book-import-field">
              <span>Tên sách</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="book-import-field">
              <span>Tác giả</span>
              <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Chưa rõ" />
            </label>

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
