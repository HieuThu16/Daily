import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Highlighter, List, Quote, RotateCcw, Search, Type, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { loadLocal, saveLocal } from '../../lib/persistence'
import { loadBookDocument, loadChapterContent, loadChapterList, estimatePage } from '../../lib/book/repository'
import type { BookChapterMeta, BookDocument } from '../../types'
import { useBookReadingProgress } from './useBookReadingProgress'
import { useBookReadingSessionTracker, useBookReadingSessionLogs, summarizeBookSessions, saveLastReadBook, getLastReadBook } from '../../lib/bookReadingLog'
import { localDate } from '../../lib/date'
import { useToast } from '../ToastContext'
import { BookSearchModal } from './BookSearchModal'

type ReaderTheme = 'light' | 'sepia' | 'dark'
type ReaderFont = 'sans' | 'serif'

type ReaderSettings = {
  fontSize: number
  lineHeight: number
  font: ReaderFont
  theme: ReaderTheme
}

const SETTINGS_KEY = 'book-reader-settings'
const DEFAULT_SETTINGS: ReaderSettings = { fontSize: 17, lineHeight: 1.8, font: 'serif', theme: 'light' }
const COMPLETED_RATIO = 0.98

/** Chiều cao thanh nút trích dẫn, và khoảng hở với chữ. */
const QUOTE_BAR_HEIGHT = 52
const QUOTE_BAR_GAP = 10

/**
 * Đặt thanh nút ngay CẠNH chỗ bôi đen thay vì dưới đáy màn hình.
 *
 * Trên di động, bôi đen xong trình duyệt bật menu hệ thống ("Sao chép / Tìm
 * trên Google") ngay tại chỗ đó — thanh nút nằm dưới đáy vừa xa vừa dễ bị đè.
 *
 * Đặt phía TRÊN vùng chọn nếu còn chỗ; sát mép trên quá thì lật xuống dưới.
 */
export function quoteBarTop(
  selectionTop: number | null,
  viewportHeight: number,
  barHeight = QUOTE_BAR_HEIGHT,
): number {
  // Không đo được vùng chọn thì rơi về đáy như cũ.
  if (selectionTop === null || !Number.isFinite(selectionTop)) {
    return Math.max(0, viewportHeight - barHeight - 24)
  }
  const above = selectionTop - barHeight - QUOTE_BAR_GAP
  if (above >= 8) return above
  // Không đủ chỗ phía trên -> lật xuống dưới vùng chọn.
  return Math.min(selectionTop + QUOTE_BAR_GAP * 3, viewportHeight - barHeight - 8)
}

export function BookReaderPage() {
  const { mediaItemId = '' } = useParams()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const requestedChapter = searchParams.get('chapter')
  const requestedTargetText = searchParams.get('text')
  const requestedHlText = searchParams.get('hl')
  const nav = useNavigate()
  const scroller = useRef<HTMLDivElement>(null)
  const pendingRatio = useRef<number | null>(null)

  const [bookDocument, setBookDocument] = useState<BookDocument | null>(null)
  const [chapters, setChapters] = useState<BookChapterMeta[]>([])
  const [bookName, setBookName] = useState('')
  const [bookAuthor, setBookAuthor] = useState<string | null>(null)
  const [bookCover, setBookCover] = useState<string | null>(null)
  /** Đoạn đang bôi đen, để hiện nút "Lưu trích dẫn". */
  const [selection, setSelection] = useState('')
  /** Mép trên của vùng bôi đen (toạ độ màn hình); null nghĩa là không đo được. */
  const [selectionTop, setSelectionTop] = useState<number | null>(null)
  const [savingQuote, setSavingQuote] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [contentByIdx, setContentByIdx] = useState<Record<number, string>>({})
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [percent, setPercent] = useState(0)
  const [tocOpen, setTocOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [settings, setSettings] = useState<ReaderSettings>(() => loadLocal(SETTINGS_KEY, DEFAULT_SETTINGS))
  const [targetHighlight, setTargetHighlight] = useState<string | null>(requestedTargetText || requestedHlText || null)

  // Quản lý chế độ xem kết quả tìm kiếm (KHÔNG LƯU TIẾN TRÌNH ĐỌC)
  const [isSearchPreview, setIsSearchPreview] = useState(false)
  const [lastSearchQuery, setLastSearchQuery] = useState('')
  const [originalReadingPos, setOriginalReadingPos] = useState<{ chapterIdx: number; ratio: number } | null>(null)

  const activeChapter = chapters[activeIdx]
  const content = contentByIdx[activeIdx]

  const { report, flush } = useBookReadingProgress({
    documentId: bookDocument?.id ?? null,
    mediaItemId,
    totalChars: bookDocument?.total_chars ?? 0,
    pageCount: bookDocument?.page_count ?? null,
    enabled: !isSearchPreview,
  })

  // Tính toán trang hiện tại đang đọc
  const currentPage = useMemo(() => {
    if (!bookDocument || !activeChapter) return 1
    const offset = activeChapter.char_offset + ((percent || 0) / 100) * (bookDocument.total_chars || 1)
    return estimatePage(offset, bookDocument.total_chars, bookDocument.page_count)
  }, [bookDocument, activeChapter, percent])

  // Theo dõi phiên đọc sách theo thời gian thực (start -> end, pages, streak)
  useBookReadingSessionTracker({
    mediaItemId,
    bookTitle: bookName,
    bookAuthor,
    currentPage,
    isActive: status === 'ready' && !isSearchPreview,
    isCompleted: completed,
  })

  // Tự động đồng bộ vị trí đọc gần nhất để khi chuyển tab quay lại có thể tiếp tục ngay
  useEffect(() => {
    if (status === 'ready' && bookName && mediaItemId && !isSearchPreview) {
      saveLastReadBook({
        mediaItemId,
        title: bookName,
        author: bookAuthor,
        coverUrl: bookCover,
        chapterIdx: activeIdx,
        chapterTitle: activeChapter?.title ?? null,
        percent: Math.round(percent || 0),
        page: currentPage,
        pageCount: bookDocument?.page_count ?? null,
        lastReadAt: new Date().toISOString(),
        lastScrollRatio: pendingRatio.current ?? 0,
      })
    }
  }, [status, bookName, mediaItemId, isSearchPreview, bookAuthor, bookCover, activeIdx, activeChapter, percent, currentPage, bookDocument])

  const sessionLogs = useBookReadingSessionLogs()
  const bookStats = useMemo(() => summarizeBookSessions(sessionLogs, localDate()), [sessionLogs])

  useEffect(() => {
    saveLocal(SETTINGS_KEY, settings)
  }, [settings])

  // Nạp tài liệu, mục lục và tên sách.
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!supabase || !mediaItemId) {
        setStatus('missing')
        return
      }
      try {
        const doc = await loadBookDocument(mediaItemId)
        if (!doc) {
          if (!cancelled) setStatus('missing')
          return
        }
        const list = await loadChapterList(doc.id)
        const { data: item } = await supabase
          .from('media_items')
          .select('name, status, author, cover_url')
          .eq('id', mediaItemId)
          .single()
        if (cancelled) return

        const media = item as { name?: string; status?: string; author?: string | null; cover_url?: string | null } | null
        setBookDocument(doc)
        setChapters(list)
        setBookName(media?.name ?? 'Đang đọc')
        setBookAuthor(media?.author ?? null)
        setBookCover(media?.cover_url ?? null)
        // Mục lục ở màn chi tiết truyền ?chapter=. Người dùng chủ động chọn chương thì
        // phải vào đầu chương, không phải cuộn tới vị trí đã lưu của chương trước đó.
        // Loại cả chuỗi rỗng: `Number('')` ra 0, sẽ nhảy nhầm về chương đầu.
        const parsed = Number(requestedChapter)
        const jumping =
          requestedChapter !== null && requestedChapter !== '' && Number.isInteger(parsed) && parsed >= 0
        const localLast = getLastReadBook()
        const isThisBook = localLast?.mediaItemId === mediaItemId
        const fallbackIdx = isThisBook && typeof localLast?.chapterIdx === 'number' ? localLast.chapterIdx : 0
        const fallbackRatio = isThisBook && typeof localLast?.lastScrollRatio === 'number' ? localLast.lastScrollRatio : 0

        const startIdx = jumping ? parsed : (doc.last_chapter_idx ?? fallbackIdx)
        setActiveIdx(Math.min(startIdx, Math.max(0, list.length - 1)))
        setPercent(doc.percent ?? (isThisBook ? (localLast?.percent ?? 0) : 0))
        pendingRatio.current = jumping ? 0 : (doc.last_scroll_ratio ?? fallbackRatio)
        setStatus('ready')

        if (media?.status === 'PLANNED') {
          void supabase.from('media_items').update({ status: 'IN_PROGRESS' }).eq('id', mediaItemId)
        }
      } catch {
        if (!cancelled) setStatus('missing')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [mediaItemId, requestedChapter])

  const fetchChapter = useCallback(
    async (idx: number) => {
      const chapter = chapters[idx]
      if (!chapter) return
      setLoadError('')
      try {
        const text = await loadChapterContent(chapter.id)
        setContentByIdx((prev) => ({ ...prev, [idx]: text }))
      } catch {
        setLoadError('Không tải được nội dung chương này.')
      }
    },
    [chapters],
  )

  useEffect(() => {
    if (chapters.length > 0 && contentByIdx[activeIdx] === undefined) void fetchChapter(activeIdx)
  }, [activeIdx, chapters, contentByIdx, fetchChapter])

  // Lắng nghe phím tắt Ctrl+F / Cmd+F để mở tìm kiếm nhanh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Khôi phục vị trí cuộn sau khi nội dung chương đã render hoặc cuộn tới đoạn trích dẫn/highlight.
  useEffect(() => {
    if (!content) return
    const node = scroller.current
    if (!node) return

    if (targetHighlight) {
      setTimeout(() => {
        const markElement = node.querySelector('.target-reader-hl')
        if (markElement) {
          markElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
        // Fallback: tìm đoạn văn chứa từ khoá
        const cleanTarget = targetHighlight.trim().slice(0, 50).toLowerCase()
        const pTags = node.querySelectorAll('p')
        for (const p of pTags) {
          if (p.textContent?.toLowerCase().includes(cleanTarget)) {
            p.scrollIntoView({ behavior: 'smooth', block: 'center' })
            p.style.transition = 'background-color 0.5s ease'
            p.style.backgroundColor = 'rgba(251, 191, 36, 0.25)'
            p.style.borderRadius = '6px'
            setTimeout(() => {
              p.style.backgroundColor = 'transparent'
            }, 3000)
            break
          }
        }
      }, 100)
      return
    }

    const ratio = pendingRatio.current
    if (ratio === null) return
    pendingRatio.current = null
    requestAnimationFrame(() => {
      node.scrollTop = ratio * Math.max(0, node.scrollHeight - node.clientHeight)
    })
  }, [content, targetHighlight])

  const onScroll = () => {
    const node = scroller.current
    if (!node || !activeChapter || !bookDocument) return

    const scrollable = Math.max(1, node.scrollHeight - node.clientHeight)
    const ratio = Math.min(1, Math.max(0, node.scrollTop / scrollable))

    const offset = activeChapter.char_offset + ratio * activeChapter.char_count
    setPercent(bookDocument.total_chars > 0 ? Math.min(100, (offset / bookDocument.total_chars) * 100) : 0)
    setCompleted(activeIdx === chapters.length - 1 && ratio > COMPLETED_RATIO)

    // Khi đang xem kết quả tìm kiếm (chưa xác nhận tiếp tục đọc), không lưu tiến trình
    if (!isSearchPreview) {
      report({
        chapterIdx: activeIdx,
        charOffset: activeChapter.char_offset,
        charCount: activeChapter.char_count,
        ratio,
      })
    }
  }

  const goToChapter = (idx: number) => {
    if (idx < 0 || idx >= chapters.length) return
    if (!isSearchPreview) {
      void flush()
    }
    setActiveIdx(idx)
    setTocOpen(false)
    setCompleted(false)
    setTargetHighlight(null)
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: 0 }))
  }

  const leave = () => {
    if (!isSearchPreview) {
      void flush()
    }
    nav('/library')
  }

  const markCompleted = async () => {
    if (supabase) await supabase.from('media_items').update({ status: 'COMPLETED' }).eq('id', mediaItemId)
    nav('/library')
  }

  // Xử lý khi nhấn vào kết quả tìm kiếm (KHÔNG LƯU TIẾN TRÌNH ĐỌC)
  const onSelectSearchResult = (result: {
    chapterIdx: number
    matchText: string
    snippet: string
    chapterContent?: string
  }) => {
    // Lưu lại vị trí đọc trước đó để người dùng có thể quay lại bất cứ lúc nào
    if (!isSearchPreview && originalReadingPos === null) {
      const node = scroller.current
      const scrollable = node ? Math.max(1, node.scrollHeight - node.clientHeight) : 1
      const ratio = node ? Math.min(1, Math.max(0, node.scrollTop / scrollable)) : 0
      setOriginalReadingPos({ chapterIdx: activeIdx, ratio })
    }

    setIsSearchPreview(true)
    setLastSearchQuery(result.matchText)

    if (result.chapterContent && contentByIdx[result.chapterIdx] === undefined) {
      setContentByIdx((prev) => ({ ...prev, [result.chapterIdx]: result.chapterContent! }))
    }

    setActiveIdx(result.chapterIdx)
    setTargetHighlight(result.matchText)
    setTocOpen(false)
    setCompleted(false)
  }

  const restoreOriginalReadingPos = () => {
    if (!originalReadingPos) return
    setActiveIdx(originalReadingPos.chapterIdx)
    pendingRatio.current = originalReadingPos.ratio
    setIsSearchPreview(false)
    setTargetHighlight(null)
    setOriginalReadingPos(null)
    showToast('↩ Đã quay lại vị trí đọc trước đó')
  }

  const resumeProgressFromHere = () => {
    setIsSearchPreview(false)
    setOriginalReadingPos(null)
    showToast('✓ Đã kích hoạt lưu tiến trình từ đây')
  }

  const paragraphs = useMemo(() => (content ? content.split('\n\n') : []), [content])

  const renderParagraph = (paragraph: string, index: number) => {
    if (!targetHighlight || !targetHighlight.trim()) {
      return <p key={index}>{paragraph}</p>
    }

    const hl = targetHighlight.trim()
    const lowerPara = paragraph.toLowerCase()
    const lowerHl = hl.toLowerCase()

    const matchIdx = lowerPara.indexOf(lowerHl)
    if (matchIdx === -1) {
      const shorterHl = hl.slice(0, 35).toLowerCase()
      const shorterIdx = lowerPara.indexOf(shorterHl)
      if (shorterIdx === -1) {
        return <p key={index}>{paragraph}</p>
      }
      const before = paragraph.slice(0, shorterIdx)
      const matched = paragraph.slice(shorterIdx, shorterIdx + shorterHl.length)
      const after = paragraph.slice(shorterIdx + shorterHl.length)
      return (
        <p key={index}>
          {before}
          <mark className="reader-hl target-reader-hl search-target-hl">
            {matched}
          </mark>
          {after}
        </p>
      )
    }

    const parts: (string | JSX.Element)[] = []
    let cursor = 0
    let occurrence = 0

    while (cursor < paragraph.length) {
      const idx = lowerPara.indexOf(lowerHl, cursor)
      if (idx === -1) {
        parts.push(paragraph.slice(cursor))
        break
      }
      if (idx > cursor) {
        parts.push(paragraph.slice(cursor, idx))
      }
      parts.push(
        <mark
          key={`hl-${index}-${occurrence++}`}
          className="reader-hl target-reader-hl search-target-hl"
        >
          {paragraph.slice(idx, idx + hl.length)}
        </mark>,
      )
      cursor = idx + hl.length
    }

    return <p key={index}>{parts}</p>
  }

  /*
   * Bôi đen trong nội dung -> ghi lại đoạn VÀ vị trí để hiện thanh nút ngay đó.
   *
   * Trước đây chỉ nghe onTouchEnd/onMouseUp: trên di động, chạm nhả tay xong
   * trình duyệt còn đang chỉnh vùng chọn nên nhiều lúc bắt hụt. `selectionchange`
   * bắn đúng mỗi lần vùng chọn đổi nên đáng tin hơn.
   */
  const captureSelection = useCallback(() => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() ?? ''
    if (!text) {
      setSelection('')
      setSelectionTop(null)
      return
    }
    setSelection(text)
    try {
      const rect = sel?.getRangeAt(0).getBoundingClientRect()
      setSelectionTop(rect && rect.height > 0 ? rect.top : null)
    } catch {
      setSelectionTop(null)
    }
  }, [])

  useEffect(() => {
    // Hoãn một nhịp: lúc selectionchange bắn, vùng chọn có thể chưa chốt xong.
    let timer: number | undefined
    const onChange = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(captureSelection, 120)
    }
    document.addEventListener('selectionchange', onChange)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('selectionchange', onChange)
    }
  }, [captureSelection])

  const saveQuote = async () => {
    if (!selection) return
    setSavingQuote(true)
    const payload = {
      media_item_id: mediaItemId || null,
      book_name: bookName || 'Đang đọc',
      author: bookAuthor,
      chapter_title: activeChapter?.title ?? null,
      chapter_idx: activeIdx,
      quote: selection,
    }

    if (supabase) {
      const { error } = await supabase.from('book_quotes').insert(payload)
      if (error) {
        const local = loadLocal<any[]>('book_quotes_local', [])
        saveLocal('book_quotes_local', [{ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() }, ...local])
      }
    } else {
      const local = loadLocal<any[]>('book_quotes_local', [])
      saveLocal('book_quotes_local', [{ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() }, ...local])
    }

    setSavingQuote(false)
    showToast('❝ Đã lưu trích dẫn')
    setSelection('')
    window.getSelection()?.removeAllRanges()
  }

  /** Tô sáng đoạn đang chọn và lưu vào danh sách highlight. */
  const highlightSelection = async () => {
    const textToHighlight = selection
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      const mark = document.createElement('mark')
      mark.className = 'reader-hl'
      try {
        range.surroundContents(mark)
      } catch {
        // Đoạn trải nhiều thẻ: gói cả nội dung trích ra rồi chèn lại.
        mark.appendChild(range.extractContents())
        range.insertNode(mark)
      }
      sel.removeAllRanges()
    }
    setSelection('')

    if (!textToHighlight) return

    const payload = {
      media_item_id: mediaItemId || null,
      book_name: bookName || 'Đang đọc',
      author: bookAuthor,
      chapter_title: activeChapter?.title ?? null,
      chapter_idx: activeIdx,
      highlight: textToHighlight,
    }

    if (supabase) {
      const { error } = await supabase.from('book_highlights').insert(payload)
      if (error) {
        const local = loadLocal<any[]>('book_highlights_local', [])
        saveLocal('book_highlights_local', [{ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() }, ...local])
      }
    } else {
      const local = loadLocal<any[]>('book_highlights_local', [])
      saveLocal('book_highlights_local', [{ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() }, ...local])
    }

    showToast('🖍️ Đã lưu highlight')
  }

  if (status === 'loading') return <div className="center">Đang mở sách…</div>

  if (status === 'missing') {
    return (
      <div className="center" style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
        <p style={{ margin: 0 }}>Sách này chưa có nội dung đã nhập.</p>
        <button className="primary" onClick={() => nav('/library')}>
          Quay lại thư viện
        </button>
      </div>
    )
  }

  return (
    <div className="book-reader" data-reader-theme={settings.theme}>
      <div className="book-reader-bar">
        <button aria-label="Quay lại thư viện" onClick={leave}>
          <ArrowLeft size={20} />
        </button>
        <span className="book-reader-title">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookName}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 8 }}>
            <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }} title={`Chuỗi ${bookStats.streak} ngày đọc sách`}>
              🔥 {bookStats.streak}
            </span>
            <span>Trang {currentPage}{bookDocument?.page_count ? `/${bookDocument.page_count}` : ''}</span>
          </span>
        </span>
        <button
          aria-label="Tìm kiếm trong sách"
          title="Tìm kiếm văn bản trong sách (Ctrl+F)"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={20} />
        </button>
        <button aria-label="Xem trích dẫn" title="Xem trích dẫn" onClick={() => nav(`/quotes/${mediaItemId}?tab=quotes`)}>
          <Quote size={20} />
        </button>
        <button aria-label="Xem highlight" title="Xem highlight" onClick={() => nav(`/quotes/${mediaItemId}?tab=highlights`)}>
          <Highlighter size={20} />
        </button>
        <button aria-label="Mục lục" onClick={() => setTocOpen(true)}>
          <List size={20} />
        </button>
        <button aria-label="Cỡ chữ và giao diện" onClick={() => setSettingsOpen((open) => !open)}>
          <Type size={20} />
        </button>
      </div>

      <div className="book-reader-progress">
        <div style={{ width: `${percent.toFixed(1)}%` }} />
      </div>

      {/* Banner thông báo đang xem kết quả tìm kiếm (không lưu tiến trình) */}
      {isSearchPreview && (
        <div className="book-reader-search-banner">
          <div className="book-reader-banner-info">
            <Search size={15} className="book-reader-banner-icon" />
            <span>
              Đang xem kết quả {lastSearchQuery ? <strong>&ldquo;{lastSearchQuery}&rdquo;</strong> : ''} — <em>Không lưu tiến trình đọc</em>
            </span>
          </div>
          <div className="book-reader-banner-actions">
            {originalReadingPos !== null && (
              <button
                type="button"
                className="book-reader-banner-btn is-return"
                onClick={restoreOriginalReadingPos}
                title="Quay lại vị trí và chương đang đọc dở"
              >
                <RotateCcw size={13} /> Vị trí cũ (Chương {originalReadingPos.chapterIdx + 1})
              </button>
            )}
            <button
              type="button"
              className="book-reader-banner-btn is-continue"
              onClick={resumeProgressFromHere}
              title="Kích hoạt lưu tiến trình đọc từ vị trí này"
            >
              Lưu từ đây
            </button>
            <button
              type="button"
              className="book-reader-banner-close"
              onClick={() => setIsSearchPreview(false)}
              aria-label="Đóng thông báo"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="book-reader-settings">
          <label>
            Cỡ chữ — {settings.fontSize}px
            <input
              type="range"
              min={14}
              max={24}
              step={1}
              value={settings.fontSize}
              onChange={(event) => setSettings({ ...settings, fontSize: Number(event.target.value) })}
            />
          </label>
          <label>
            Giãn dòng — {settings.lineHeight.toFixed(1)}
            <input
              type="range"
              min={1.5}
              max={2.1}
              step={0.1}
              value={settings.lineHeight}
              onChange={(event) => setSettings({ ...settings, lineHeight: Number(event.target.value) })}
            />
          </label>
          <label>
            Kiểu chữ
            <span className="book-reader-choices">
              {(['sans', 'serif'] as ReaderFont[]).map((font) => (
                <button key={font} aria-pressed={settings.font === font} onClick={() => setSettings({ ...settings, font })}>
                  {font === 'sans' ? 'Sans' : 'Serif'}
                </button>
              ))}
            </span>
          </label>
          <label>
            Nền
            <span className="book-reader-choices">
              {(['light', 'sepia', 'dark'] as ReaderTheme[]).map((theme) => (
                <button key={theme} aria-pressed={settings.theme === theme} onClick={() => setSettings({ ...settings, theme })}>
                  {theme === 'light' ? 'Sáng' : theme === 'sepia' ? 'Sepia' : 'Tối'}
                </button>
              ))}
            </span>
          </label>
        </div>
      )}

      {tocOpen && (
        <div className="book-reader-drawer">
          <nav aria-label="Mục lục">
            {chapters.map((chapter, idx) => (
              <button
                key={chapter.id}
                className="book-reader-toc-item"
                aria-current={idx === activeIdx}
                onClick={() => goToChapter(idx)}
              >
                {idx + 1}. {chapter.title}
              </button>
            ))}
          </nav>
          <button aria-label="Đóng mục lục" onClick={() => setTocOpen(false)} />
        </div>
      )}

      <BookSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        documentId={bookDocument?.id ?? null}
        chapters={chapters}
        activeChapterIdx={activeIdx}
        currentChapterContent={content}
        onSelectResult={onSelectSearchResult}
      />

      <div
        className="book-reader-content"
        ref={scroller}
        onScroll={onScroll}
        onMouseUp={captureSelection}
        /*
         * Chặn menu ngữ cảnh của trình duyệt: giữ lâu trên chữ ở Android/iOS sẽ
         * bật "Sao chép / Tìm trên Google" đè lên thanh nút của app, khiến không
         * bấm đánh dấu được. Vùng chọn vẫn hoạt động bình thường.
         */
        onContextMenu={(e) => e.preventDefault()}
        style={{
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight,
          fontFamily: settings.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'inherit',
        }}
      >
        <article className="book-reader-page">
          <h1>{activeChapter?.title}</h1>

          {loadError && (
            <p className="book-reader-load-error">
              {loadError} <button onClick={() => void fetchChapter(activeIdx)}>Tải lại</button>
            </p>
          )}

          {content === undefined && !loadError && <p style={{ opacity: 0.6 }}>Đang tải chương…</p>}

          {paragraphs.map((paragraph, index) => renderParagraph(paragraph, index))}

          {completed && (
            <div className="book-reader-finished">
              <strong>🎉 Bạn đã đọc hết cuốn sách này</strong>
              <button className="primary" onClick={() => void markCompleted()}>
                <CheckCircle2 size={16} /> Đánh dấu đã đọc xong
              </button>
            </div>
          )}

          <div className="book-reader-nav">
            <button disabled={activeIdx === 0} onClick={() => goToChapter(activeIdx - 1)}>
              ‹ Chương trước
            </button>
            <span>
              {activeIdx + 1}/{chapters.length}
            </span>
            <button disabled={activeIdx >= chapters.length - 1} onClick={() => goToChapter(activeIdx + 1)}>
              Chương sau ›
            </button>
          </div>
        </article>
      </div>

      {selection && (
        <div
          className="quote-bar"
          style={{
            top: quoteBarTop(selectionTop, typeof window === 'undefined' ? 800 : window.innerHeight),
          }}
        >
          <button
            className="primary"
            onClick={saveQuote}
            disabled={savingQuote}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Quote size={16} /> {savingQuote ? 'Đang lưu…' : 'Lưu trích dẫn'}
          </button>
          <button
            onClick={highlightSelection}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fde68a', color: '#78350f', border: 0, fontWeight: 700 }}
          >
            <Highlighter size={16} /> Tô sáng
          </button>
        </div>
      )}
    </div>
  )
}

