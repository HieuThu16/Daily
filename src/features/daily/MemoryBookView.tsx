import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, Clock,
  Play, Sparkles, X, Bookmark, Heart, BookOpen,
  ArrowUpDown, Search, Volume2, VolumeX, Calendar,
  Download
} from 'lucide-react'
import type { SharedEvent } from '../../types'
import { getVideoPosterUrl, SafeMediaImage } from './SharedEventsView'
import './memory-book.css'

interface MemoryBookViewProps {
  events: SharedEvent[]
  personName?: string
  roomCode?: string | null
  onClose: () => void
}

interface BookDayPage {
  dateStr: string
  dayNum: string
  monthNum: string
  yearNum: string
  weekdayStr: string
  events: SharedEvent[]
  allImages: string[]
}

function parseDayInfo(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return {
      dayNum: String(d.getDate()).padStart(2, '0'),
      monthNum: String(d.getMonth() + 1).padStart(2, '0'),
      yearNum: String(d.getFullYear()),
      weekdayStr: weekdays[d.getDay()] || '',
    }
  } catch {
    return {
      dayNum: dateStr.slice(8, 10),
      monthNum: dateStr.slice(5, 7),
      yearNum: dateStr.slice(0, 4),
      weekdayStr: 'Kỷ niệm',
    }
  }
}

function isVideo(url?: string | null): boolean {
  if (!url) return false
  if (url.startsWith('data:video/')) return true
  return /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(url.split('?')[0])
}

// Âm thanh lật giấy êm dịu bằng Web Audio API (không phụ thuộc mạng bên ngoài)
function playPaperTurnSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const bufferSize = Math.floor(ctx.sampleRate * 0.26)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      // Nhiễu âm dịu nhẹ mô phỏng ma sát trang giấy
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45))
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(650, ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(2600, ctx.currentTime + 0.12)
    filter.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.25)
    filter.Q.value = 1.4

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.07, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + 0.25)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    noise.start()
  } catch {
    // Không bắt buộc âm thanh nếu trình duyệt hạn chế
  }
}

export function MemoryBookView({ events, personName, onClose }: MemoryBookViewProps) {
  // 1. Thứ tự thời gian: 'desc' = Mới nhất trước (Hiện tại -> Quá khứ), 'asc' = Cũ nhất trước (Quá khứ -> Hiện tại)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)

  // 2. Tìm kiếm nhanh & Bộ chọn tháng
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all')

  // 3. Nhóm kỷ niệm theo từng ngày và sắp xếp theo sortOrder
  const dayPages: BookDayPage[] = useMemo(() => {
    const map = new Map<string, SharedEvent[]>()
    for (const ev of events) {
      if (!ev.event_date) continue
      const list = map.get(ev.event_date) || []
      list.push(ev)
      map.set(ev.event_date, list)
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => {
      return sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
    })

    return sortedDates.map((dateStr) => {
      const dayEvs = map.get(dateStr) || []
      const dayInfo = parseDayInfo(dateStr)
      const images: string[] = []
      for (const ev of dayEvs) {
        if (Array.isArray(ev.images) && ev.images.length > 0) {
          images.push(...ev.images.filter(Boolean))
        } else if (ev.image_url) {
          images.push(ev.image_url)
        }
      }
      return {
        dateStr,
        ...dayInfo,
        events: dayEvs,
        allImages: images,
      }
    })
  }, [events, sortOrder])

  // Danh sách các tháng có kỷ niệm để lọc nhanh
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    for (const p of dayPages) {
      set.add(`${p.monthNum}/${p.yearNum}`)
    }
    return Array.from(set)
  }, [dayPages])

  // Danh sách kết quả tìm kiếm nhanh
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return dayPages.filter((p) => {
      // Lọc theo tháng nếu được chọn
      if (selectedMonthFilter !== 'all') {
        const pageMonth = `${p.monthNum}/${p.yearNum}`
        if (pageMonth !== selectedMonthFilter) return false
      }
      if (!q) return true
      // Tìm trong ngày/tháng/năm
      const dateMatch = p.dateStr.includes(q) ||
        `${p.dayNum}/${p.monthNum}/${p.yearNum}`.includes(q) ||
        p.weekdayStr.toLowerCase().includes(q)
      if (dateMatch) return true

      // Tìm trong tiêu đề, ghi chú, địa điểm sự kiện
      return p.events.some((ev) =>
        (ev.title && ev.title.toLowerCase().includes(q)) ||
        (ev.note && ev.note.toLowerCase().includes(q)) ||
        (ev.location && ev.location.toLowerCase().includes(q))
      )
    })
  }, [dayPages, searchQuery, selectedMonthFilter])

  // 4. Trạng thái trang hiện tại & Animation lật sách 3D
  // currentPage: 0 là Bìa trước, 1..N là các ngày, N+1 là Bìa sau
  const totalPages = dayPages.length + 2
  const [currentPage, setCurrentPage] = useState<number>(0)
  
  // Trạng thái lật trang thực thụ: leaf lật từ 0 -> 180deg hoặc ngược lại
  const [flipState, setFlipState] = useState<{
    direction: 'next' | 'prev'
    fromPage: number
    toPage: number
  } | null>(null)

  // 5. Xem ảnh phóng to pop-up với danh sách ảnh để lướt qua lại
  const [activeGallery, setActiveGallery] = useState<{
    images: string[]
    currentIndex: number
    title?: string
    note?: string
    date?: string
  } | null>(null)

  // Vuốt chạm cảm ứng trên di động
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
    touchStartYRef.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return
    const diffX = e.changedTouches[0].clientX - touchStartXRef.current
    const diffY = e.changedTouches[0].clientY - touchStartYRef.current

    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        goNextPage()
      } else {
        goPrevPage()
      }
    }
    touchStartXRef.current = null
    touchStartYRef.current = null
  }

  // Điều hướng lật trang TỚI với 3D Flip Leaf
  const goNextPage = useCallback(() => {
    if (currentPage >= totalPages - 1 || flipState) return
    const target = currentPage + 1
    if (soundEnabled) playPaperTurnSound()
    setFlipState({ direction: 'next', fromPage: currentPage, toPage: target })
    setTimeout(() => {
      setCurrentPage(target)
      setFlipState(null)
    }, 550)
  }, [currentPage, totalPages, flipState, soundEnabled])

  // Điều hướng lật trang LÙI với 3D Flip Leaf
  const goPrevPage = useCallback(() => {
    if (currentPage <= 0 || flipState) return
    const target = currentPage - 1
    if (soundEnabled) playPaperTurnSound()
    setFlipState({ direction: 'prev', fromPage: currentPage, toPage: target })
    setTimeout(() => {
      setCurrentPage(target)
      setFlipState(null)
    }, 550)
  }, [currentPage, flipState, soundEnabled])

  // Nhảy trang trực tiếp (từ tìm kiếm hoặc bộ chọn)
  const jumpToPage = useCallback((target: number) => {
    if (target === currentPage || flipState) return
    const dir = target > currentPage ? 'next' : 'prev'
    if (soundEnabled) playPaperTurnSound()
    setFlipState({ direction: dir, fromPage: currentPage, toPage: target })
    setTimeout(() => {
      setCurrentPage(target)
      setFlipState(null)
    }, 450)
    setIsSearchOpen(false)
  }, [currentPage, flipState, soundEnabled])

  // Phím tắt bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeGallery) {
        if (e.key === 'Escape') setActiveGallery(null)
        if (e.key === 'ArrowRight') {
          setActiveGallery((g) => g ? { ...g, currentIndex: (g.currentIndex + 1) % g.images.length } : null)
        }
        if (e.key === 'ArrowLeft') {
          setActiveGallery((g) => g ? { ...g, currentIndex: (g.currentIndex - 1 + g.images.length) % g.images.length } : null)
        }
        return
      }
      if (isSearchOpen) {
        if (e.key === 'Escape') setIsSearchOpen(false)
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        goNextPage()
      } else if (e.key === 'ArrowLeft') {
        goPrevPage()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages, activeGallery, isSearchOpen, goNextPage, goPrevPage, onClose])

  // Đổi thứ tự sắp xếp thời gian (Hiện tại -> Quá khứ / Quá khứ -> Hiện tại)
  const toggleSortOrder = () => {
    // Lưu lại ngày đang xem nếu có
    const currentDateStr = (currentPage >= 1 && currentPage <= dayPages.length)
      ? dayPages[currentPage - 1].dateStr
      : null

    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    setSortOrder(newOrder)

    // Sau khi đổi order, nếu đang ở trang ngày, nhảy đúng đến ngày đó trong order mới
    if (currentDateStr) {
      setTimeout(() => {
        // Tái định vị index
        const newDayPages = [...dayPages].reverse()
        const idx = newDayPages.findIndex((p) => p.dateStr === currentDateStr)
        if (idx >= 0) {
          setCurrentPage(idx + 1)
        }
      }, 50)
    }
  }

  // Render nội dung của 1 trang cụ thể (Bìa trước, Ngày kỷ niệm, hoặc Bìa sau)
  const renderPageContent = (pageIdx: number, isLeafBack = false) => {
    if (pageIdx === 0) {
      return (
        <div className="book-page-sheet cover-sheet" onClick={goNextPage}>
          <div className="cover-inner-border">
            <div className="cover-badge-top">
              <Sparkles size={15} />
              <span>KHOẢNH KHẮC LƯU GIỮ</span>
            </div>

            <div className="cover-center-content">
              <div className="cover-icon-box">
                <Heart size={38} fill="#f59e0b" color="#f59e0b" />
              </div>
              <h1 className="cover-book-title">
                CUỐN SỔ KỶ NIỆM
              </h1>
              {personName && (
                <div className="cover-author">
                  Kỷ niệm cùng <strong>{personName}</strong>
                </div>
              )}
              <p className="cover-sub-text">
                Từng trang kỷ niệm, từng khoảnh khắc đáng nhớ được gìn giữ vẹn nguyên qua năm tháng.
              </p>
            </div>

            <div className="cover-footer">
              <div className="cover-stats-pill">
                <span>📅 {dayPages.length} ngày kỷ niệm</span>
                <span>·</span>
                <span>🖼️ {events.reduce((acc, cur) => acc + (cur.images?.length || (cur.image_url ? 1 : 0)), 0)} ảnh/video</span>
              </div>
              <button
                type="button"
                className="cover-open-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  goNextPage()
                }}
              >
                <span>Mở cuốn sổ</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (pageIdx === totalPages - 1) {
      return (
        <div className="book-page-sheet back-cover-sheet" onClick={() => jumpToPage(0)}>
          <div className="back-cover-inner">
            <div className="back-cover-seal">
              <Heart size={30} fill="#f59e0b" color="#f59e0b" />
            </div>
            <h2>HẾT CUỐN SỔ</h2>
            <p>
              Mỗi ngày trôi qua là một trang sách mới được viết tiếp. Hãy cùng nhau lưu giữ thật nhiều nụ cười và kỷ niệm nhé!
            </p>
            <button
              type="button"
              className="cover-open-btn back-to-start"
              onClick={(e) => {
                e.stopPropagation()
                jumpToPage(0)
              }}
            >
              <span>Xem lại từ đầu</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )
    }

    // Trang nội dung ngày (1..N)
    const day = dayPages[pageIdx - 1]
    if (!day) return null

    // Nếu là mặt sau của trang lật (leaf back), ta render họa tiết trang giấy kraft cổ điển
    if (isLeafBack) {
      return (
        <div className="book-page-sheet leaf-back-vintage-sheet">
          <div className="leaf-back-watermark">
            <Heart size={64} color="rgba(180, 83, 9, 0.12)" strokeWidth={1} />
            <span>Kỷ Niệm Yêu Thương</span>
          </div>
        </div>
      )
    }

    return (
      <div className="book-page-sheet scrapbook-sheet">
        {/* Gáy xoắn cổ điển của trang sổ */}
        <div className="scrapbook-binding-edge" />

        <div className="scrapbook-page-inner">
          {/* Header ngày tháng vintage stamp */}
          <div className="scrapbook-header-row">
            <div className="vintage-date-stamp">
              <div className="stamp-day">{day.dayNum}</div>
              <div className="stamp-sub">
                <span>THÁNG {day.monthNum}</span>
                <span className="stamp-year">{day.yearNum}</span>
              </div>
              <div className="stamp-weekday">{day.weekdayStr}</div>
            </div>

            <div className="scrapbook-corner-badge">
              <span>{day.events.length} kỷ niệm</span>
            </div>
          </div>

          {/* Danh sách kỷ niệm & dán ảnh Scrapbook */}
          <div className="scrapbook-body-scroll">
            {day.events.map((ev, evIdx) => {
              const evImages = (ev.images && ev.images.length > 0)
                ? ev.images
                : (ev.image_url ? [ev.image_url] : [])

              return (
                <section key={ev.id} className="scrapbook-entry-block">
                  {/* Tiêu đề & meta */}
                  <div className="scrapbook-entry-head">
                    <h3 className="scrapbook-entry-title">
                      {ev.title || 'Kỷ niệm đẹp'}
                    </h3>
                    <div className="scrapbook-meta-line">
                      {ev.event_time && (
                        <span className="scrapbook-meta-pill">
                          <Clock size={11} /> {ev.event_time}
                        </span>
                      )}
                      {ev.location && (
                        <span className="scrapbook-meta-pill">
                          <MapPin size={11} /> {ev.location}
                        </span>
                      )}
                      {ev.is_favorite && (
                        <span className="scrapbook-meta-pill favorite">
                          <Heart size={11} fill="#e11d48" color="#e11d48" /> Yêu thích
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lời ghi chú / cảm xúc */}
                  {ev.note && (
                    <div className="scrapbook-handwritten-note">
                      <p>{ev.note}</p>
                    </div>
                  )}

                  {/* Khung ảnh Polaroid dán băng dính Washi Tape với micro-animation */}
                  {evImages.length > 0 && (
                    <div className={`scrapbook-photos-layout count-${Math.min(evImages.length, 4)}`}>
                      {evImages.map((mediaUrl, imgIdx) => {
                        const isVid = isVideo(mediaUrl)
                        const rotateDeg = (imgIdx % 2 === 0 ? -1.6 : 1.9) * (1 + (imgIdx * 0.2))

                        return (
                          <div
                            key={imgIdx}
                            className="polaroid-frame"
                            style={{
                              transform: `rotate(${rotateDeg}deg)`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveGallery({
                                images: evImages,
                                currentIndex: imgIdx,
                                title: ev.title,
                                note: ev.note || undefined,
                                date: `${day.dayNum}/${day.monthNum}/${day.yearNum}`,
                              })
                            }}
                            title="Chạm để mở ảnh to sống động"
                          >
                            {/* Băng dính Washi tape */}
                            <div className={`washi-tape washi-tape-${(evIdx + imgIdx) % 3}`} />

                            <div className="polaroid-photo-box">
                              {isVid ? (
                                <div className="polaroid-video-wrap">
                                  <video
                                    src={mediaUrl}
                                    poster={getVideoPosterUrl(mediaUrl)}
                                    preload="metadata"
                                    muted
                                    playsInline
                                  />
                                  <div className="polaroid-play-overlay">
                                    <Play size={22} fill="#ffffff" color="#ffffff" />
                                  </div>
                                </div>
                              ) : (
                                <SafeMediaImage src={mediaUrl} alt="" loading="lazy" />
                              )}
                              <div className="polaroid-shine-effect" />
                            </div>

                            <div className="polaroid-caption">
                              <span>{ev.title || `Khoảnh khắc #${imgIdx + 1}`}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          {/* Đáy trang */}
          <div className="scrapbook-page-footer">
            <span>Trang {pageIdx} / {dayPages.length}</span>
            <span className="scrapbook-hint">← Vuốt hoặc click mép để lật trang →</span>
          </div>
        </div>
      </div>
    )
  }

  // Active photo trong gallery
  const currentPhoto = activeGallery
    ? activeGallery.images[activeGallery.currentIndex]
    : null
  const currentIsVid = currentPhoto ? isVideo(currentPhoto) : false

  return (
    <div className="memory-book-fullscreen">
      {/* ── 1. Top floating bar ─────────────────────────────────────────── */}
      <div className="memory-book-topbar">
        <div className="memory-book-top-left">
          <button
            type="button"
            className="memory-book-back-btn"
            onClick={onClose}
            title="Quay lại Kỷ niệm chung (Esc)"
            aria-label="Quay lại"
          >
            <ArrowLeft size={18} />
            <span className="topbar-btn-text">Quay lại</span>
          </button>

          {/* Nút ĐẢO CHIỀU THỜI GIAN (Hiện tại -> Quá khứ hoặc ngược lại) */}
          <button
            type="button"
            className={`memory-book-sort-btn ${sortOrder === 'desc' ? 'active-desc' : 'active-asc'}`}
            onClick={toggleSortOrder}
            title={sortOrder === 'desc' ? 'Đang xem: Mới nhất đến cũ nhất. Nhấn để đảo ngược' : 'Đang xem: Cũ nhất đến mới nhất. Nhấn để đảo ngược'}
          >
            <ArrowUpDown size={15} />
            <span>
              {sortOrder === 'desc' ? 'Hiện tại → Quá khứ' : 'Quá khứ → Hiện tại'}
            </span>
          </button>
        </div>

        {/* Chỉ số trang ở giữa */}
        <div className="memory-book-page-indicator">
          <BookOpen size={15} style={{ color: '#eab308' }} />
          <span>
            {currentPage === 0
              ? 'Bìa cuốn sổ'
              : currentPage === totalPages - 1
              ? 'Trang kết'
              : `Trang ${currentPage} / ${dayPages.length}`}
          </span>
        </div>

        <div className="memory-book-top-actions">
          {/* Nút Tìm kiếm nhanh / Nhảy trang */}
          <button
            type="button"
            className={`memory-book-pill-btn ${isSearchOpen ? 'active' : ''}`}
            onClick={() => setIsSearchOpen((v) => !v)}
            title="Tìm kiếm nhanh kỷ niệm & nhảy trang"
          >
            <Search size={14} />
            <span className="topbar-btn-text">Tìm nhanh</span>
          </button>

          {/* Nút Bật/tắt âm thanh lật giấy */}
          <button
            type="button"
            className="memory-book-pill-btn icon-only"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Tắt âm thanh lật giấy' : 'Bật âm thanh lật giấy'}
            aria-label="Âm thanh"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} style={{ opacity: 0.5 }} />}
          </button>

          {currentPage > 0 && (
            <button
              type="button"
              className="memory-book-pill-btn icon-only"
              onClick={() => jumpToPage(0)}
              title="Về bìa sổ"
            >
              <Bookmark size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Thanh Tìm kiếm nhanh & Nhảy trang (Quick Search Modal / Drawer) ── */}
      {isSearchOpen && (
        <div className="memory-quick-search-backdrop" onClick={() => setIsSearchOpen(false)}>
          <div className="memory-quick-search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <div className="search-input-wrap">
                <Search size={18} className="search-input-icon" />
                <input
                  type="text"
                  placeholder="Tìm kỷ niệm, ngày (14/02), địa điểm, nội dung..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="search-input-field"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-input-clear"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="search-modal-close"
                onClick={() => setIsSearchOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Bộ lọc tháng nhanh */}
            {availableMonths.length > 0 && (
              <div className="search-months-filter">
                <button
                  type="button"
                  className={`month-chip ${selectedMonthFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedMonthFilter('all')}
                >
                  Tất cả ({dayPages.length})
                </button>
                {availableMonths.map((m) => {
                  const count = dayPages.filter((p) => `${p.monthNum}/${p.yearNum}` === m).length
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`month-chip ${selectedMonthFilter === m ? 'active' : ''}`}
                      onClick={() => setSelectedMonthFilter(m)}
                    >
                      Tháng {m} ({count})
                    </button>
                  )
                })}
              </div>
            )}

            {/* Danh sách kết quả */}
            <div className="search-results-list">
              {searchResults.length === 0 ? (
                <div className="search-empty-state">
                  <Calendar size={32} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                  <p>Không tìm thấy kỷ niệm nào phù hợp</p>
                </div>
              ) : (
                searchResults.map((p) => {
                  const pageIdx = dayPages.findIndex((d) => d.dateStr === p.dateStr) + 1
                  const isCurrent = currentPage === pageIdx

                  return (
                    <div
                      key={p.dateStr}
                      className={`search-result-item ${isCurrent ? 'current-page' : ''}`}
                      onClick={() => jumpToPage(pageIdx)}
                    >
                      <div className="result-date-badge">
                        <span className="r-day">{p.dayNum}</span>
                        <span className="r-m">{p.monthNum}/{p.yearNum}</span>
                      </div>
                      <div className="result-info">
                        <div className="result-titles">
                          {p.events.map((e, idx) => (
                            <span key={e.id || idx} className="result-title-pill">
                              {e.title || 'Kỷ niệm'}
                            </span>
                          ))}
                        </div>
                        <div className="result-meta">
                          <span>{p.weekdayStr}</span>
                          <span>·</span>
                          <span>{p.events.length} kỷ niệm</span>
                          {p.allImages.length > 0 && (
                            <>
                              <span>·</span>
                              <span>🖼️ {p.allImages.length} ảnh/video</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="result-jump-btn">
                        <span>Trang {pageIdx}</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. 3D Book Stage (Cơ chế lật 3D thực thụ xoay 180 độ quanh gáy sách) ── */}
      <div
        className="memory-book-stage"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Nút lật trang trước */}
        <button
          type="button"
          className={`book-turn-arrow prev ${currentPage === 0 || !!flipState ? 'disabled' : ''}`}
          onClick={goPrevPage}
          disabled={currentPage === 0 || !!flipState}
          title="Lật về trang trước"
          aria-label="Trang trước"
        >
          <ChevronLeft size={28} />
        </button>

        {/* Khung quyển sổ 3D với trục phối cảnh perspective */}
        <div className="book-3d-chassis">
          {/* Gáy sách nổi 3D (Spine) với độ cong và gân da cao cấp */}
          <div className="book-spine-3d" />

          {/* Vỏ bìa cứng dưới đáy sổ (Book Hardcover Edge) */}
          <div className="book-hardcover-shadow" />

          {/* 
            TRƯỜNG HỢP 1: KHI ĐANG LẬT TRANG (Flip Animation 3D):
            - Trang tĩnh bên dưới (Underneath Base Page): Là trang đích toPage.
            - Trang lật (Flipping Leaf): Quay quanh gáy trái (0% 50%) từ 0 đến -180 độ hoặc từ -180 về 0 độ.
            - Trang lật gồm 2 mặt: Mặt trước (fromPage) & Mặt sau (leaf-back vintage kraft).
          */}
          {flipState ? (
            <>
              {/* Trang tĩnh bên dưới đang chờ sẵn */}
              <div className="book-page-layer base-layer">
                {renderPageContent(flipState.toPage)}
              </div>

              {/* Tờ giấy 3D đang lật qua (Flipping Leaf) */}
              <div
                className={`flipping-leaf leaf-direction-${flipState.direction}`}
              >
                {/* Mặt trước của tờ giấy lật */}
                <div className="leaf-face leaf-face-front">
                  {renderPageContent(flipState.direction === 'next' ? flipState.fromPage : flipState.toPage)}
                  {/* Lớp bóng uốn cong động của trang giấy */}
                  <div className="leaf-shadow-curl front-shadow" />
                </div>

                {/* Mặt sau của tờ giấy lật (Hiển thị khi quay qua 90 độ) */}
                <div className="leaf-face leaf-face-back">
                  {renderPageContent(
                    flipState.direction === 'next' ? flipState.toPage : flipState.fromPage,
                    true
                  )}
                  {/* Lớp bóng phản chiếu mặt sau */}
                  <div className="leaf-shadow-curl back-shadow" />
                </div>
              </div>
            </>
          ) : (
            /* TRƯỜNG HỢP 2: TRẠNG THÁI BÌNH THƯỜNG KHÔNG LẬT */
            <div className="book-page-layer active-layer">
              {renderPageContent(currentPage)}
            </div>
          )}
        </div>

        {/* Nút lật trang sau */}
        <button
          type="button"
          className={`book-turn-arrow next ${currentPage >= totalPages - 1 || !!flipState ? 'disabled' : ''}`}
          onClick={goNextPage}
          disabled={currentPage >= totalPages - 1 || !!flipState}
          title="Lật sang trang tiếp theo"
          aria-label="Trang tiếp theo"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* ── 4. Thanh trượt Scrubber điều hướng trang nhanh ở đáy ─────────── */}
      <div className="memory-book-bottom-scrubber">
        <span className="scrubber-label">
          {sortOrder === 'desc' ? 'Mới nhất' : 'Cũ nhất'}
        </span>
        <input
          type="range"
          min={0}
          max={totalPages - 1}
          value={currentPage}
          onChange={(e) => jumpToPage(Number(e.target.value))}
          className="scrubber-slider"
          aria-label="Thanh trượt trang sách"
        />
        <span className="scrubber-label">
          {sortOrder === 'desc' ? 'Cũ nhất' : 'Mới nhất'}
        </span>
      </div>

      {/* ── 5. Modal Phóng to ảnh & Xem Gallery mượt mà với Micro-Animation ── */}
      {activeGallery && currentPhoto && (
        <div
          className="scrapbook-photo-modal"
          onClick={() => setActiveGallery(null)}
        >
          <div
            className="scrapbook-photo-popup"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thanh điều khiển trên modal */}
            <div className="popup-top-controls">
              <div className="popup-counter">
                🖼️ {activeGallery.currentIndex + 1} / {activeGallery.images.length}
              </div>
              <div className="popup-actions-right">
                <a
                  href={currentPhoto}
                  download={`ky-niem-${activeGallery.currentIndex + 1}`}
                  target="_blank"
                  rel="noreferrer"
                  className="popup-btn-icon"
                  title="Tải ảnh gốc"
                >
                  <Download size={17} />
                </a>
                <button
                  type="button"
                  className="popup-btn-icon close-btn"
                  onClick={() => setActiveGallery(null)}
                  title="Đóng (Esc)"
                  aria-label="Đóng"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            {/* Media chính (ảnh hoặc video) có nút Previous / Next trực tiếp */}
            <div className="scrapbook-popup-media">
              {activeGallery.images.length > 1 && (
                <button
                  type="button"
                  className="popup-nav-btn prev"
                  onClick={() => setActiveGallery((g) => g ? { ...g, currentIndex: (g.currentIndex - 1 + g.images.length) % g.images.length } : null)}
                  title="Ảnh trước (Mũi tên trái)"
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              <div className="popup-media-container">
                {currentIsVid ? (
                  <video
                    src={currentPhoto}
                    poster={getVideoPosterUrl(currentPhoto)}
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <SafeMediaImage src={currentPhoto} alt="" />
                )}
              </div>

              {activeGallery.images.length > 1 && (
                <button
                  type="button"
                  className="popup-nav-btn next"
                  onClick={() => setActiveGallery((g) => g ? { ...g, currentIndex: (g.currentIndex + 1) % g.images.length } : null)}
                  title="Ảnh tiếp theo (Mũi tên phải)"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>

            {/* Chú thích & cảm xúc dưới ảnh */}
            {(activeGallery.title || activeGallery.date || activeGallery.note) && (
              <div className="scrapbook-popup-info">
                {activeGallery.title && <h4>{activeGallery.title}</h4>}
                {activeGallery.date && (
                  <div className="scrapbook-popup-date">
                    📅 Ngày {activeGallery.date}
                  </div>
                )}
                {activeGallery.note && <p>{activeGallery.note}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
