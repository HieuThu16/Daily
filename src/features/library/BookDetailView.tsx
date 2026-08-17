import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, ChevronRight, Clock, FileText, History, Pencil } from 'lucide-react'
import { CHARS_PER_PAGE, loadBookDocument, loadChapterList } from '../../lib/book/repository'
import type { BookChapterMeta, BookDocument, Media } from '../../types'
import { BookCover } from './BookCover'
import { useHideHeader } from '../HeaderAction'

type BookDetailViewProps = {
  item: Media
  onBack: () => void
  onEdit: (item: Media) => void
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

export function BookDetailView({ item, onBack, onEdit, onStatusChange, onLogProgress, onShowHistory, logCount }: BookDetailViewProps) {
  useHideHeader(true)
  const nav = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const [status, setStatus] = useState<Status>('loading')
  const [document_, setDocument] = useState<BookDocument | null>(null)
  const [chapters, setChapters] = useState<BookChapterMeta[]>([])
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  /** Mục lục hay Thông tin. Mặc định mục lục vì mở sách ra là để đọc tiếp. */
  const [tab, setTab] = useState<'toc' | 'info'>('toc')

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

  return (
    <section className="library-book-detail" aria-labelledby="library-book-title">
      <header className="library-book-topbar">
        <button type="button" className="library-book-round" aria-label="Quay lại thư viện" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <h2>Chi tiết sách</h2>
        <button
          type="button"
          className="library-book-round"
          onClick={() => onEdit(item)}
          aria-label="Chỉnh sửa thông tin sách"
          title="Chỉnh sửa"
        >
          <Pencil size={16} />
        </button>
      </header>

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
              {item.genre && <span>🏷️ {item.genre}</span>}
              {item.is_favorite && <span>♥ Yêu thích</span>}
              {item.shared_by && <span>📚 Do {item.shared_by} chia sẻ</span>}
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
          </div>
        </div>

        {status === 'ready' && document_ && (
          <div className="library-book-stats">
            <div>
              <FileText size={15} />
              <strong>{document_.chapter_count} chương</strong>
              <span>{document_.page_count ? `${document_.page_count} trang` : `~${document_.est_pages} trang`}</span>
            </div>
            <div>
              <BookOpen size={15} />
              <strong>{document_.total_chars.toLocaleString('vi-VN')}</strong>
              <span>Số chữ</span>
            </div>
            <div>
              <Clock size={15} />
              <strong>{Math.round(document_.percent)}%</strong>
              <span>Đã {listen ? 'nghe' : 'đọc'}</span>
            </div>
          </div>
        )}

        {status === 'ready' && document_ && (
          <div className="library-book-progress-card">
            <div className="library-book-progress">
              <span>Tiến độ {listen ? 'nghe' : 'đọc'}</span>
              <span>
                Chương {Math.min(document_.last_chapter_idx + 1, chapters.length)}/{chapters.length}
              </span>
            </div>
            <div className="library-book-bar">
              <div style={{ width: `${Math.min(100, Math.max(0, document_.percent))}%` }} />
            </div>
          </div>
        )}

        {status === 'ready' && (
          <button type="button" className="library-book-cta" onClick={() => nav(`/read/${item.id}`)}>
            <BookOpen size={16} />
            Đọc tiếp
          </button>
        )}

        <div className="library-book-detail-actions">
          {(item.status === 'IN_PROGRESS' || item.status === 'COMPLETED') && (
            <>
              <button type="button" onClick={() => onLogProgress(item)}>
                {listen ? <Clock size={16} /> : <FileText size={16} />}
                {listen ? 'Ghi giờ' : 'Ghi trang'}
              </button>
              <button type="button" onClick={() => onShowHistory(item)}>
                <History size={16} />
                Lịch sử
                <span className="library-book-count">{logCount}</span>
              </button>
            </>
          )}
        </div>

        <div className="library-book-tabs" role="tablist" aria-label="Nội dung sách">
          <button
            type="button"
            role="tab"
            id="library-book-tab-toc"
            aria-selected={tab === 'toc'}
            aria-controls="library-book-panel-toc"
            className={tab === 'toc' ? 'active' : ''}
            onClick={() => setTab('toc')}
          >
            Mục lục{status === 'ready' ? ` (${chapters.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            id="library-book-tab-info"
            aria-selected={tab === 'info'}
            aria-controls="library-book-panel-info"
            className={tab === 'info' ? 'active' : ''}
            onClick={() => setTab('info')}
          >
            Thông tin
          </button>
        </div>

        <div
          className="library-book-section"
          role="tabpanel"
          id="library-book-panel-info"
          aria-labelledby="library-book-tab-info"
          hidden={tab !== 'info'}
        >
          <dl className="library-book-info">
            {item.genre && (
              <div>
                <dt>Thể loại</dt>
                <dd style={{ fontWeight: 600, color: 'var(--purple)' }}>{item.genre}</dd>
              </div>
            )}
            {item.description && (
              <div>
                <dt>Mô tả</dt>
                <dd style={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>{item.description}</dd>
              </div>
            )}
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

        <div
          className="library-book-section"
          role="tabpanel"
          id="library-book-panel-toc"
          aria-labelledby="library-book-tab-toc"
          hidden={tab !== 'toc'}
        >
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
                    <span className="library-book-toc-pages">{chapterPages(chapter, document_)} trang</span>
                    <ChevronRight size={14} className="library-book-toc-chevron" />
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
