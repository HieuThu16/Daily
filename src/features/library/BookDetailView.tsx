import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, FileText, History, ImagePlus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { blobToCover } from '../../lib/book/cover'
import {
  CHARS_PER_PAGE,
  loadBookDocument,
  loadChapterList,
  removeCover,
  saveCoverUrl,
  uploadCover,
} from '../../lib/book/repository'
import type { BookChapterMeta, BookDocument, Media } from '../../types'
import { BookCover } from './BookCover'

/** Ảnh lớn hơn mức này bị chặn trước khi giải mã, tránh treo tab trên điện thoại. */
const MAX_COVER_BYTES = 15 * 1024 * 1024

type BookDetailViewProps = {
  item: Media
  onBack: () => void
  onEdit: (item: Media) => void
  onCoverChange: (mediaItemId: string, coverUrl: string | null) => void
  onStatusChange: (item: Media, status: Media['status']) => void
  onLogProgress: (item: Media) => void
  onShowHistory: (item: Media) => void
  logCount: number
}

type Status = 'loading' | 'ready' | 'no-document'

const STATUS_LABEL: Record<Media['status'], [string, string]> = {
  PLANNED: ['Sẽ đọc', 'Sẽ nghe'],
  IN_PROGRESS: ['Đang đọc', 'Đang nghe'],
  COMPLETED: ['Đã đọc', 'Đã nghe'],
}

function chapterPages(chapter: BookChapterMeta, document: BookDocument): number {
  if (document.page_count && document.total_chars > 0) {
    return Math.max(1, Math.round((chapter.char_count / document.total_chars) * document.page_count))
  }
  return Math.max(1, Math.round(chapter.char_count / CHARS_PER_PAGE))
}

function formatDay(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatMoment(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function BookDetailView({ item, onBack, onEdit, onCoverChange, onStatusChange, onLogProgress, onShowHistory, logCount }: BookDetailViewProps) {
  const nav = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const [status, setStatus] = useState<Status>('loading')
  const [document_, setDocument] = useState<BookDocument | null>(null)
  const [chapters, setChapters] = useState<BookChapterMeta[]>([])
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverError, setCoverError] = useState('')

  const listen = item.book_format === 'LISTEN'

  useEffect(() => {
    headingRef.current?.focus()
  }, [item.id])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setLoadError('')

    const run = async () => {
      try {
        const found = await loadBookDocument(item.id)
        if (cancelled) return
        if (!found) {
          setDocument(null)
          setChapters([])
          setStatus('no-document')
          return
        }
        const list = await loadChapterList(found.id)
        if (cancelled) return
        setDocument(found)
        setChapters(list)
        setStatus('ready')
      } catch (caught) {
        if (cancelled) return
        // Phân biệt với sách thật sự chưa nhập file bằng dòng lỗi và nút Thử lại.
        // Xoá dữ liệu cũ để không lộ thông tin của sách trước đó (item.id đổi mà component không remount).
        setDocument(null)
        setChapters([])
        setLoadError(caught instanceof Error ? caught.message : 'Không tải được thông tin sách.')
        setStatus('no-document')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [item.id, reloadKey])

  const handleCoverFile = async (file: File) => {
    setCoverError('')
    if (file.size > MAX_COVER_BYTES) {
      setCoverError('Ảnh quá lớn (tối đa 15MB).')
      return
    }

    setCoverBusy(true)
    try {
      const cover = await blobToCover(file)
      if (!cover) {
        setCoverError('File này không phải ảnh hợp lệ.')
        return
      }
      const url = await uploadCover(item.id, cover)
      await saveCoverUrl(item.id, url)
      onCoverChange(item.id, url)
    } catch {
      // Lỗi từ Supabase là chuỗi tiếng Anh và có thể lộ tên policy RLS, không hiện thẳng.
      setCoverError('Không lưu được ảnh bìa, thử lại sau.')
    } finally {
      setCoverBusy(false)
    }
  }

  const handleCoverRemove = async () => {
    setCoverError('')
    setCoverBusy(true)
    try {
      await removeCover(item.id)
      onCoverChange(item.id, null)
    } catch {
      setCoverError('Không xoá được ảnh bìa, thử lại sau.')
    } finally {
      setCoverBusy(false)
    }
  }

  return (
    <section className="library-book-detail" aria-labelledby="library-book-title">
      <button type="button" className="library-audio-back" aria-label="Quay lại thư viện" onClick={onBack}>
        <ArrowLeft size={17} />
        Quay lại
      </button>

      <div className="library-book-detail-card">
        <div className="library-book-header">
          <BookCover url={item.cover_url} alt={`Bìa ${item.name}`} size="large" />

          <div className="library-book-heading">
            <h2 id="library-book-title" ref={headingRef} tabIndex={-1}>
              {item.name}
            </h2>
            <p>{item.author || 'Chưa cập nhật tác giả'}</p>
            <div className="library-book-badges">
              <span>{listen ? '🎧 Nghe' : '📖 Đọc'}</span>
              {item.is_favorite && <span>♥ Yêu thích</span>}
              {/* Ô bìa trong lưới không còn dropdown trạng thái, nên nó nằm ở đây — không thì
                  muốn đánh dấu đã đọc phải mở thêm modal Sửa. */}
              <select
                className="library-book-status"
                aria-label="Trạng thái"
                value={item.status}
                onChange={(event) => onStatusChange(item, event.target.value as Media['status'])}
              >
                {(['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const).map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status][listen ? 1 : 0]}
                  </option>
                ))}
              </select>
            </div>

            <div className="library-book-cover-actions">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                aria-label="Chọn ảnh bìa mới"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void handleCoverFile(file)
                }}
              />
              <button type="button" disabled={coverBusy} onClick={() => fileInput.current?.click()}>
                {coverBusy ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />}
                {coverBusy ? 'Đang lưu…' : 'Đổi ảnh bìa'}
              </button>
              {item.cover_url && (
                <button type="button" disabled={coverBusy} aria-label="Xoá ảnh bìa" onClick={() => void handleCoverRemove()}>
                  <Trash2 size={13} />
                  Xoá bìa
                </button>
              )}
            </div>
            {coverError && <p className="library-book-error" role="alert">{coverError}</p>}
          </div>
        </div>

        {status === 'ready' && document_ && (
          <div className="library-book-progress">
            <div className="library-book-bar">
              <div style={{ width: `${Math.min(100, Math.max(0, document_.percent))}%` }} />
            </div>
            <span>{Math.round(document_.percent)}%</span>
            <span>
              Chương {Math.min(document_.last_chapter_idx + 1, chapters.length)}/{chapters.length}
            </span>
          </div>
        )}

        <div className="library-book-detail-actions">
          {status === 'ready' && (
            <button type="button" className="primary" onClick={() => nav(`/read/${item.id}`)}>
              <BookOpen size={14} />
              Đọc tiếp
            </button>
          )}
          <button type="button" onClick={() => onEdit(item)}>
            <Pencil size={14} />
            Chỉnh sửa
          </button>
          {(item.status === 'IN_PROGRESS' || item.status === 'COMPLETED') && (
            <>
              <button type="button" onClick={() => onLogProgress(item)}>
                {listen ? <Clock size={14} /> : <FileText size={14} />}
                {listen ? 'Ghi giờ' : 'Ghi trang'}
              </button>
              <button type="button" onClick={() => onShowHistory(item)}>
                <History size={14} />
                Lịch sử
                <span className="library-book-count">{logCount}</span>
              </button>
            </>
          )}
        </div>

        <div className="library-book-section">
          <h3>Thông tin</h3>
          <dl className="library-book-info">
            {status === 'ready' && document_ && (
              <>
                <div>
                  <dt>Nguồn</dt>
                  <dd>
                    {document_.source_format}
                    {document_.source_filename ? ` · ${document_.source_filename}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Số chương</dt>
                  <dd>{document_.chapter_count}</dd>
                </div>
                <div>
                  <dt>Số chữ</dt>
                  <dd>{document_.total_chars.toLocaleString('vi-VN')}</dd>
                </div>
                <div>
                  <dt>Số trang</dt>
                  <dd>
                    {document_.page_count
                      ? `${document_.page_count} trang`
                      : `~${document_.est_pages} trang ước tính`}
                  </dd>
                </div>
              </>
            )}
            {item.start_date && (
              <div>
                <dt>Bắt đầu</dt>
                <dd>{formatDay(item.start_date)}</dd>
              </div>
            )}
            {item.end_date && (
              <div>
                <dt>Kết thúc</dt>
                <dd>{formatDay(item.end_date)}</dd>
              </div>
            )}
            {item.current_chapter != null && (
              <div>
                <dt>Chương ghi tay</dt>
                <dd>{item.current_chapter}</dd>
              </div>
            )}
            {status === 'ready' && document_?.last_read_at && (
              <div>
                <dt>Đọc lần cuối</dt>
                <dd>{formatMoment(document_.last_read_at)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="library-book-section">
          <h3>{status === 'ready' ? `Mục lục (${chapters.length})` : 'Mục lục'}</h3>

          {status === 'loading' && <p className="library-book-muted">Đang tải…</p>}

          {status === 'no-document' && (
            <div className="library-book-empty">
              {loadError ? (
                <>
                  <p>Không tải được thông tin sách. Kiểm tra kết nối rồi thử lại.</p>
                  <p className="library-book-error" role="alert">{loadError}</p>
                  <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
                    Thử lại
                  </button>
                </>
              ) : (
                <p>Chưa nhập file cho sách này. Dùng nút Nhập sách ở Library để đọc ngay trong app.</p>
              )}
            </div>
          )}

          {status === 'ready' && document_ && (
            <ol className="library-book-toc">
              {chapters.map((chapter) => (
                <li key={chapter.id}>
                  <button
                    type="button"
                    aria-current={chapter.idx === document_.last_chapter_idx ? 'true' : undefined}
                    onClick={() => nav(`/read/${item.id}?chapter=${chapter.idx}`)}
                  >
                    <span className="library-book-toc-index">{chapter.idx + 1}</span>
                    <span className="library-book-toc-title">{chapter.title}</span>
                    <span className="library-book-toc-pages">{chapterPages(chapter, document_)} tr</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
