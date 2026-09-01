import { useEffect, useMemo, useState } from 'react'
import {
  Headphones,
  Search,
  Sparkles,
  Play,
  BookOpen,
  Trash2,
  BarChart3,
} from 'lucide-react'
import type { Audiobook } from '../../types/audiobook'
import { loadAudiobooks, deleteAudiobook, cleanUnplayableAudiobooks } from '../../lib/audiobookRepository'
import { useAudiobookProgressMap } from '../../lib/audiobookProgress'
import { formatDurationHuman } from '../../lib/dilibCrawler'
import { DilibCrawlerModal } from './DilibCrawlerModal'
import { AudiobookPlayerModal } from './AudiobookPlayerModal'
import { InAppBookReaderModal } from './InAppBookReaderModal'
import { WatchTogetherButton } from '../watch/WatchTogetherButton'
import { useToast } from '../ToastContext'
import './audiobook.css'

export function AudiobooksPage() {
  const { showToast } = useToast()
  const progressMap = useAudiobookProgressMap()

  const [audiobooks, setAudiobooks] = useState<Audiobook[]>([])
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'PLANNED' | 'COMPLETED'>('ALL')

  // Modals
  const [showCrawlerModal, setShowCrawlerModal] = useState(false)
  const [crawlerInitialTab, setCrawlerInitialTab] = useState<'COUNT' | 'CATEGORY' | 'AUTHOR' | 'SEARCH' | 'HISTORY'>('COUNT')
  const [activePlayerBook, setActivePlayerBook] = useState<Audiobook | null>(null)
  const [activeReaderBook, setActiveReaderBook] = useState<Audiobook | null>(null)

  const reload = async () => {
    setLoading(true)
    const list = await loadAudiobooks()
    setAudiobooks(list)
    setLoading(false)
  }

  const handleCleanBrokenBooks = async () => {
    if (cleaning) return
    if (!window.confirm('Bạn có chắc chắn muốn quét và xóa toàn bộ các cuốn sách không phát được âm thanh?')) return
    setCleaning(true)
    try {
      const res = await cleanUnplayableAudiobooks()
      setAudiobooks(res.remaining)
      if (res.removedCount > 0) {
        showToast(`🧹 Đã xóa thành công ${res.removedCount} cuốn sách không có âm thanh!`)
      } else {
        showToast('✨ Thư viện sạch sẽ! Không phát hiện sách nào bị lỗi âm thanh.', 'info')
      }
    } catch (err) {
      showToast('Lỗi khi dọn dẹp sách: ' + String(err), 'error')
    } finally {
      setCleaning(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  // Cuốn sách được nghe gần đây nhất
  const continueListeningBook = useMemo(() => {
    let latest: { book: Audiobook; progress: any; time: number } | null = null

    for (const book of audiobooks) {
      const p = progressMap[book.id]
      if (p && p.currentSeconds > 0 && !p.completed) {
        const time = new Date(p.updatedAt).getTime()
        if (!latest || time > latest.time) {
          latest = { book, progress: p, time }
        }
      }
    }
    return latest
  }, [audiobooks, progressMap])

  // Lọc thể loại
  const allGenres = useMemo(() => {
    const set = new Set<string>()
    audiobooks.forEach((b) => {
      if (b.genre) {
        b.genre.split(',').forEach((g) => {
          const trimmed = g.trim()
          if (trimmed) set.add(trimmed)
        })
      }
    })
    return Array.from(set)
  }, [audiobooks])

  // Lọc danh sách sách nói
  const filteredBooks = useMemo(() => {
    return audiobooks.filter((b) => {
      const p = progressMap[b.id]
      const isCompleted = p?.completed || b.status === 'COMPLETED'
      const isInProgress = (p?.percent || 0) > 0 && !isCompleted

      // Lọc status
      if (statusFilter === 'IN_PROGRESS' && !isInProgress) return false
      if (statusFilter === 'COMPLETED' && !isCompleted) return false
      if (statusFilter === 'PLANNED' && (isInProgress || isCompleted)) return false

      // Lọc thể loại
      if (selectedGenre !== 'ALL' && !b.genre?.toLowerCase().includes(selectedGenre.toLowerCase())) return false

      // Tìm kiếm
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matchTitle = b.title.toLowerCase().includes(q)
        const matchAuthor = b.author.toLowerCase().includes(q)
        const matchGenre = b.genre?.toLowerCase().includes(q)
        if (!matchTitle && !matchAuthor && !matchGenre) return false
      }

      return true
    })
  }, [audiobooks, progressMap, statusFilter, selectedGenre, search])

  const handleDelete = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation()
    if (confirm('Bạn có chắc muốn xóa sách nói này khỏi thư viện?')) {
      await deleteAudiobook(bookId)
      setAudiobooks((prev) => prev.filter((b) => b.id !== bookId))
      showToast('🗑️ Đã xóa sách nói thành công.')
    }
  }

  return (
    <div className="audiobooks-page-container">
      {/* 1. Header Banner */}
      <div className="audiobooks-hero-card">
        <div className="audiobooks-hero-header">
          <div className="audiobooks-hero-title-group">
            <div className="audiobooks-hero-icon-wrap">
              <Headphones size={22} className="audiobooks-hero-sparkle" />
            </div>
            <div>
              <h1 className="audiobooks-hero-title">Thư Viện Sách Nói</h1>
              <p className="audiobooks-hero-subtitle">
                Sách nói & Radio chất lượng cao từ Dilib.vn + DTV-eBook · Tự động đồng bộ tiến độ nghe
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="audiobooks-crawl-btn"
              onClick={() => {
                setCrawlerInitialTab('COUNT')
                setShowCrawlerModal(true)
              }}
              title="Cào sách nói & ebook từ Dilib.vn + DTV-eBook"
            >
              <Sparkles size={16} />
              <span>Cào Sách Đa Nguồn</span>
            </button>
            <button
              type="button"
              className="audiobooks-crawl-btn"
              onClick={() => {
                setCrawlerInitialTab('HISTORY')
                setShowCrawlerModal(true)
              }}
              title="Báo cáo & thống kê sách đã cào trong 1h, 24h và toàn bộ"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: 'inherit',
              }}
            >
              <BarChart3 size={16} />
              <span>Báo Cáo Cào Sách</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Hero Card: Tiếp tục nghe gần nhất */}
      {continueListeningBook && (
        <div
          className="audiobooks-continue-card"
          onClick={() => setActivePlayerBook(continueListeningBook.book)}
          style={{ cursor: 'pointer' }}
        >
          <div className="audiobooks-continue-cover">
            {continueListeningBook.book.cover ? (
              <img src={continueListeningBook.book.cover} alt={continueListeningBook.book.title} />
            ) : (
              <Headphones size={32} />
            )}
            <div className="audiobooks-play-overlay">
              <Play size={20} />
            </div>
          </div>

          <div className="audiobooks-continue-info">
            <span className="audiobooks-continue-badge">🎧 Tiếp tục nghe</span>
            <h3 className="audiobooks-continue-title">{continueListeningBook.book.title}</h3>
            <p className="audiobooks-continue-sub">
              {continueListeningBook.book.author} · Phần {continueListeningBook.progress.trackIndex + 1} /{' '}
              {continueListeningBook.book.tracks.length}
              {(continueListeningBook.book.durationFormatted || continueListeningBook.book.totalDuration) && (
                <> · ⏱️ {continueListeningBook.book.durationFormatted || formatDurationHuman(continueListeningBook.book.totalDuration)}</>
              )}
            </p>

            <div className="audiobooks-continue-bar-wrap">
              <div className="audiobooks-continue-bar">
                <div
                  className="audiobooks-continue-fill"
                  style={{ width: `${Math.min(100, continueListeningBook.progress.percent)}%` }}
                />
              </div>
              <span className="audiobooks-continue-pct">{continueListeningBook.progress.percent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Toolbar & Search & Filters */}
      <div className="audiobooks-toolbar">
        <div className="audiobooks-search-wrap">
          <Search size={16} className="audiobooks-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên sách, tác giả, thể loại..."
            className="audiobooks-search-input"
          />
        </div>

        <div className="audiobooks-status-segmented">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'IN_PROGRESS', label: '⏳ Đang nghe' },
            { id: 'PLANNED', label: '📌 Sẽ nghe' },
            { id: 'COMPLETED', label: '✅ Đã nghe' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              className={`audiobooks-status-tab ${statusFilter === s.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(s.id as any)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="audiobooks-clean-btn"
          onClick={handleCleanBrokenBooks}
          disabled={cleaning}
          title="Tự động quét và xóa tất cả sách nói không phát được âm thanh trong thư viện"
        >
          <Trash2 size={14} />
          <span>{cleaning ? 'Đang quét...' : 'Dọn sách lỗi'}</span>
        </button>
      </div>

      {/* Filter Chips Thể Loại */}
      {allGenres.length > 0 && (
        <div className="audiobooks-genres-scroll">
          <button
            type="button"
            className={`audiobooks-genre-chip ${selectedGenre === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedGenre('ALL')}
          >
            Tất cả ({audiobooks.length})
          </button>
          {allGenres.map((g) => (
            <button
              key={g}
              type="button"
              className={`audiobooks-genre-chip ${selectedGenre === g ? 'active' : ''}`}
              onClick={() => setSelectedGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* 4. Grid Danh Sách Sách Nói */}
      {loading ? (
        <div className="audiobooks-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="audiobooks-skeleton-card" />
          ))}
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="audiobooks-empty-state">
          <Headphones size={48} color="var(--primary, #8b5cf6)" />
          <h3>Chưa có sách nói nào trong thư viện</h3>
          <p>Nhấn nút “Cào Sách Đa Nguồn” để tìm kiếm và thêm hàng ngàn sách & sách nói miễn phí từ Dilib và DTV eBook!</p>
          <button type="button" className="audiobooks-crawl-btn" onClick={() => setShowCrawlerModal(true)}>
            <Sparkles size={16} /> Cào Sách Đa Nguồn
          </button>
        </div>
      ) : (
        <div className="audiobooks-grid">
          {filteredBooks.map((book) => {
            const p = progressMap[book.id]
            const percent = p?.percent || 0
            const isDone = p?.completed

            return (
              <div
                key={book.id}
                className="audiobook-card"
                onClick={() => setActivePlayerBook(book)}
              >
                {/* Thumbnail & Badges */}
                <div className="audiobook-card-thumb-wrap">
                  {book.cover ? (
                    <img src={book.cover} alt={book.title} className="audiobook-card-thumb" loading="lazy" />
                  ) : (
                    <div className="audiobook-card-thumb-empty">
                      <Headphones size={32} />
                    </div>
                  )}

                  <div className="audiobook-thumb-play-btn">
                    <Play size={20} />
                  </div>

                  <div className="audiobook-card-badge-top">
                    <span className="audiobook-parts-chip">🎧 {book.tracks.length} phần</span>
                    {(book.durationFormatted || (book.totalDuration && book.totalDuration > 0)) && (
                      <span className="audiobook-duration-chip">
                        ⏱️ {book.durationFormatted || formatDurationHuman(book.totalDuration)}
                      </span>
                    )}
                    {book.hasPdf && <span className="audiobook-pdf-chip">📖 PDF</span>}
                  </div>
                </div>

                {/* Info */}
                <div className="audiobook-card-info">
                  <h4 className="audiobook-card-title" title={book.title}>
                    {book.title}
                  </h4>
                  <p className="audiobook-card-author">{book.author}</p>

                  {/* Progress Bar */}
                  {percent > 0 && (
                    <div className="audiobook-card-prog-wrap">
                      <div className="audiobook-card-prog-bar">
                        <div
                          className={`audiobook-card-prog-fill ${isDone ? 'done' : ''}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="audiobook-card-prog-pct">{isDone ? 'Đã nghe xong' : `${percent}%`}</span>
                    </div>
                  )}

                  {/* Action Row */}
                  <div className="audiobook-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="audiobook-btn-play"
                      onClick={() => setActivePlayerBook(book)}
                      title="Nghe sách nói"
                    >
                      <Play size={14} /> <span>Nghe</span>
                    </button>

                    <WatchTogetherButton
                      item={{
                        kind: 'OTHER',
                        refId: book.id,
                        title: book.title,
                        subtitle: book.author,
                        thumbnail: book.cover,
                        url: `/audiobooks`,
                      }}
                      className="audiobook-btn-sub"
                      label={null}
                      size={15}
                      title="Xem chung cùng người thân"
                    />

                    {(book.readbookUrl || book.pdfUrl) && (
                      <button
                        type="button"
                        className="audiobook-btn-sub"
                        onClick={() => setActiveReaderBook(book)}
                        title="Đọc sách PDF trực tiếp trong app"
                      >
                        <BookOpen size={15} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="audiobook-btn-sub del"
                      onClick={(e) => void handleDelete(e, book.id)}
                      title="Xóa sách nói"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Crawler Modal */}
      <DilibCrawlerModal
        isOpen={showCrawlerModal}
        initialMode={crawlerInitialTab}
        onClose={() => setShowCrawlerModal(false)}
        onFinished={() => void reload()}
      />

      {/* Audiobook Player Modal */}
      <AudiobookPlayerModal
        audiobook={activePlayerBook}
        isOpen={Boolean(activePlayerBook)}
        onClose={() => setActivePlayerBook(null)}
        onDeleted={(id) => setAudiobooks((prev) => prev.filter((b) => b.id !== id))}
      />

      {/* In-App Book & PDF Reader Modal (Đọc sách trực tiếp trong app không chuyển ra web ngoài) */}
      <InAppBookReaderModal
        book={activeReaderBook}
        isOpen={Boolean(activeReaderBook)}
        onClose={() => setActiveReaderBook(null)}
      />
    </div>
  )
}
