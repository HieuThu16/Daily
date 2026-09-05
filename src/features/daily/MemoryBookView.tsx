import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, Clock,
  Play, Sparkles, X, Heart, BookOpen,
  ArrowUpDown, Search, Volume2, VolumeX, Calendar,
  Download, TreePine
} from 'lucide-react'
import type { SharedEvent } from '../../types'
import { getVideoPosterUrl, SafeMediaImage } from './SharedEventsView'
import { getSeasonTheme, MemoryTreeCover } from './YearlyMemoryBook'
import { Interactive3DTreeCanvas } from './Interactive3DTreeThree'
import './memory-book.css'

export interface MemoryBookViewProps {
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

// Âm thanh lật giấy êm dịu bằng Web Audio API
function playPaperTurnSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const bufferSize = Math.floor(ctx.sampleRate * 0.26)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
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

/* ═══════════════════════════════════════════════════════════════════
 * THẺ SÁCH 3D VUỐT XOAY 360 ĐỘ TRÊN KỆ SÁCH (Three.js WebGL)
 * ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
 * MAIN COMPONENT: MemoryBookView
 * ═══════════════════════════════════════════════════════════════════ */
export function MemoryBookView({ events, personName, onClose }: MemoryBookViewProps) {
  // Phân nhóm toàn bộ kỷ niệm theo từng năm
  const yearlyGroups = useMemo(() => {
    const map = new Map<number, SharedEvent[]>()
    for (const ev of events) {
      if (!ev.event_date) continue
      const y = parseInt(ev.event_date.slice(0, 4), 10)
      if (!isNaN(y)) {
        const list = map.get(y) || []
        list.push(ev)
        map.set(y, list)
      }
    }
    if (map.size === 0) {
      map.set(new Date().getFullYear(), [])
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .map(([year, evs]) => {
        const mediaCount = evs.reduce((acc, cur) => acc + (cur.images?.length || (cur.image_url ? 1 : 0)), 0)
        return { year, events: evs, mediaCount }
      })
  }, [events])

  // Chế độ xem: 'tree' (Cây 3D xoay 360 độ có 12 hoa tháng) | 'book' (Quyển sách 3D lật trang chân thực)
  const [viewMode, setViewMode] = useState<'tree' | 'book'>('tree')

  // Chọn năm hiện tại để xem cây và lật sách
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return yearlyGroups[0]?.year || new Date().getFullYear()
  })

  // 1. Thứ tự thời gian: 'desc' = Mới nhất trước, 'asc' = Cũ nhất trước
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)

  // 2. Tìm kiếm nhanh & Bộ chọn tháng
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all')

  // Lọc danh sách sự kiện cho năm đang mở
  const activeYearEvents = useMemo(() => {
    const found = yearlyGroups.find((g) => g.year === selectedYear)
    return found ? found.events : []
  }, [selectedYear, yearlyGroups])

  const activeYearMediaCount = useMemo(() => {
    const found = yearlyGroups.find((g) => g.year === selectedYear)
    return found ? found.mediaCount : 0
  }, [selectedYear, yearlyGroups])

  // Theme của năm đang mở
  const activeYearTheme = useMemo(() => {
    return getSeasonTheme(selectedYear)
  }, [selectedYear])

  // 3. Nhóm kỷ niệm của năm đang mở theo từng ngày (Scrapbook Day Pages)
  const dayPages: BookDayPage[] = useMemo(() => {
    const map = new Map<string, SharedEvent[]>()
    for (const ev of activeYearEvents) {
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
  }, [activeYearEvents, sortOrder])

  // Danh sách các tháng có kỷ niệm trong năm đang mở để lọc nhanh
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
      if (selectedMonthFilter !== 'all') {
        const pageMonth = `${p.monthNum}/${p.yearNum}`
        if (pageMonth !== selectedMonthFilter) return false
      }
      if (!q) return true
      const dateMatch = p.dateStr.includes(q) ||
        `${p.dayNum}/${p.monthNum}/${p.yearNum}`.includes(q) ||
        p.weekdayStr.toLowerCase().includes(q)
      if (dateMatch) return true

      return p.events.some((ev) =>
        (ev.title && ev.title.toLowerCase().includes(q)) ||
        (ev.note && ev.note.toLowerCase().includes(q)) ||
        (ev.location && ev.location.toLowerCase().includes(q))
      )
    })
  }, [dayPages, searchQuery, selectedMonthFilter])

  // 4. Trạng thái trang hiện tại & Animation lật sách 3D
  const totalPages = dayPages.length + 2
  const [currentPage, setCurrentPage] = useState<number>(0)

  // Trạng thái lật trang 3D xoay 180 độ
  const [flipState, setFlipState] = useState<{
    direction: 'next' | 'prev'
    fromPage: number
    toPage: number
  } | null>(null)

  // 5. Xem ảnh phóng to pop-up (Lightbox)
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

  // Nhảy trang trực tiếp
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
        if (viewMode === 'book') {
          setViewMode('tree')
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages, activeGallery, isSearchOpen, viewMode, goNextPage, goPrevPage, onClose])

  // Đổi thứ tự sắp xếp thời gian
  const toggleSortOrder = () => {
    const currentDateStr = (currentPage >= 1 && currentPage <= dayPages.length)
      ? dayPages[currentPage - 1].dateStr
      : null
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    setSortOrder(newOrder)

    if (currentDateStr) {
      setTimeout(() => {
        const newDayPages = [...dayPages].reverse()
        const idx = newDayPages.findIndex((p) => p.dateStr === currentDateStr)
        if (idx >= 0) {
          setCurrentPage(idx + 1)
        }
      }, 50)
    }
  }

  // Render nội dung của 1 trang cụ thể (Bìa trước, Ngày kỷ niệm Scrapbook, hoặc Bìa sau)
  const renderPageContent = (pageIdx: number, isLeafBack = false) => {
    // 1. TRANG BÌA TRƯỚC (Trang 0) — Tích hợp Bìa Cây Kỷ Niệm 3D của Năm
    if (pageIdx === 0) {
      return (
        <div className="book-page-sheet cover-sheet" onClick={goNextPage}>
          <div className="cover-inner-border">
            <div className="cover-badge-top">
              <Sparkles size={14} style={{ color: activeYearTheme.accent }} />
              <span>KHOẢNH KHẮC LƯU GIỮ · NĂM {selectedYear}</span>
            </div>

            <div className="cover-center-content">
              {/* Bìa cây kỷ niệm thu nhỏ thanh lịch trên bìa sổ */}
              <div style={{ width: '100%', maxWidth: 320, margin: '0 auto 8px', borderRadius: 12, overflow: 'hidden' }}>
                <MemoryTreeCover
                  year={selectedYear || new Date().getFullYear()}
                  entryCount={activeYearEvents.length}
                  entries={activeYearEvents}
                />
              </div>

              <h1 className="cover-book-title" style={{ fontSize: '1.25rem', marginTop: 4 }}>
                CUỐN SỔ KỶ NIỆM {selectedYear}
              </h1>
              {personName && (
                <div className="cover-author">
                  Kỷ niệm cùng <strong>{personName}</strong>
                </div>
              )}
            </div>

            <div className="cover-footer">
              <div className="cover-stats-pill">
                <span>📅 {dayPages.length} ngày</span>
                <span>·</span>
                <span>📖 {activeYearEvents.length} kỷ niệm</span>
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
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </div>
      )
    }

    // 2. TRANG BÌA SAU (Trang cuối)
    if (pageIdx === totalPages - 1) {
      return (
        <div className="book-page-sheet back-cover-sheet" onClick={() => jumpToPage(0)}>
          <div className="back-cover-inner">
            <div className="back-cover-seal">
              <TreePine size={32} style={{ color: activeYearTheme.accent }} />
            </div>
            <h2>HẾT CUỐN SỔ NĂM {selectedYear}</h2>
            <p>
              Mỗi ngày trôi qua là một trang sách mới được viết tiếp. Hãy cùng nhau lưu giữ thật nhiều nụ cười và khoảnh khắc đẹp nhé!
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                className="cover-open-btn back-to-start"
                onClick={(e) => {
                  e.stopPropagation()
                  jumpToPage(0)
                }}
              >
                <span>Xem lại từ đầu</span>
                <ChevronRight size={15} />
              </button>
              <button
                type="button"
                className="cover-open-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  if (soundEnabled) playPaperTurnSound()
                  setViewMode('tree')
                }}
                style={{ background: 'rgba(255,255,255,0.9)', color: '#78350f', border: '1px solid rgba(245, 158, 11, 0.4)' }}
              >
                <span>Quay lại Cây 3D</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    // 3. TRANG NGÀY KỶ NIỆM (Trang 1..N) — Chuẩn hiệu ứng Scrapbook dán ảnh
    const day = dayPages[pageIdx - 1]
    if (!day) return null

    return (
      <div
        className={`book-page-sheet day-sheet scrapbook-sheet ${isLeafBack ? 'leaf-back-content' : ''}`}
        style={{ background: '#ffffff', color: '#0f172a' }}
      >
        <div className="page-paper-decor top-crease" />

        <div className="scrapbook-page-inner">
          {/* Header ngày */}
          <div className="scrapbook-page-header">
            <div className="scrapbook-date-stamp">
              <span className="stamp-day">{day.dayNum}</span>
              <span className="stamp-month">THG {day.monthNum}</span>
            </div>
            <div className="scrapbook-header-info">
              <div className="scrapbook-weekday">{day.weekdayStr}</div>
              <div className="scrapbook-year">{day.yearNum}</div>
            </div>
            <div className="scrapbook-event-count-badge">
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

                  {ev.note && (
                    <div className="scrapbook-handwritten-note">
                      <p>{ev.note}</p>
                    </div>
                  )}

                  {/* Khung ảnh Polaroid dán băng dính Washi Tape */}
                  {evImages.length > 0 && (
                    <div className={`scrapbook-photos-layout count-${Math.min(evImages.length, 4)}`}>
                      {evImages.map((mediaUrl, imgIdx) => {
                        const isVid = isVideo(mediaUrl)
                        const rotateDeg = (imgIdx % 2 === 0 ? -1.6 : 1.9) * (1 + (imgIdx * 0.2))

                        return (
                          <div
                            key={imgIdx}
                            className="polaroid-frame"
                            style={{ transform: `rotate(${rotateDeg}deg)` }}
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
                            title="Chạm để mở ảnh to"
                          >
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
      {/* ── TOP BAR (SÁNG BÓNG, FROSTED GLASS, GỌN GÀNG) ─────────────────── */}
      <div className="memory-book-topbar">
        <div className="memory-book-top-left">
          {viewMode === 'book' ? (
            <button
              type="button"
              className="memory-book-back-btn"
              onClick={() => {
                if (soundEnabled) playPaperTurnSound()
                setViewMode('tree')
              }}
              title="Quay lại Cây Kỷ Niệm 3D"
            >
              <TreePine size={16} />
              <span className="topbar-btn-text">Cây 3D</span>
            </button>
          ) : (
            <button
              type="button"
              className="memory-book-back-btn"
              onClick={onClose}
              title="Quay lại Kỷ niệm chung"
            >
              <ArrowLeft size={16} />
              <span className="topbar-btn-text">Quay lại</span>
            </button>
          )}

          {viewMode === 'book' && (
            <button
              type="button"
              className={`memory-book-sort-btn ${sortOrder === 'desc' ? 'active-desc' : 'active-asc'}`}
              onClick={toggleSortOrder}
              title={sortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}
            >
              <ArrowUpDown size={14} />
              <span>{sortOrder === 'desc' ? 'Mới → Cũ' : 'Cũ → Mới'}</span>
            </button>
          )}
        </div>

        {/* Chỉ số trang hoặc tiêu đề ở giữa */}
        <div className="memory-book-page-indicator">
          {viewMode === 'tree' ? (
            <>
              <TreePine size={16} style={{ color: activeYearTheme.accent }} />
              <span>
                Cây Kỷ Niệm 3D · Năm {selectedYear} {personName ? `· ${personName}` : ''}
              </span>
            </>
          ) : (
            <>
              <BookOpen size={15} style={{ color: activeYearTheme.accent }} />
              <span>
                {currentPage === 0
                  ? `Bìa sổ ${selectedYear}`
                  : currentPage === totalPages - 1
                  ? `Hết sổ ${selectedYear}`
                  : `Trang ${currentPage} / ${dayPages.length} (Năm ${selectedYear})`}
              </span>
            </>
          )}
        </div>

        <div className="memory-book-top-actions">
          {/* Nút Tìm kiếm nhanh khi đang đọc sách */}
          {viewMode === 'book' && (
            <button
              type="button"
              className={`memory-book-pill-btn ${isSearchOpen ? 'active' : ''}`}
              onClick={() => setIsSearchOpen((v) => !v)}
              title="Tìm kiếm nhanh kỷ niệm"
            >
              <Search size={14} />
              <span className="topbar-btn-text">Tìm</span>
            </button>
          )}

          {/* Âm thanh lật giấy */}
          <button
            type="button"
            className="memory-book-pill-btn icon-only"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Volume2 size={15} style={{ color: '#d97706' }} /> : <VolumeX size={15} style={{ opacity: 0.5 }} />}
          </button>

          {/* Đóng */}
          <button
            type="button"
            className="memory-book-pill-btn icon-only"
            onClick={onClose}
            title="Đóng (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
       * VIEW 1: CÂY KỶ NIỆM 3D (XOAY 360 ĐỘ — 12 HOA TƯỢNG TRƯNG 12 THÁNG)
       * ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'tree' ? (
        <div className="tree-explorer-stage">
          {/* Thanh chọn năm dạng viên thuốc (nếu có nhiều năm) */}
          {yearlyGroups.length > 1 && (
            <div className="tree-year-switcher">
              {yearlyGroups.map((g) => {
                const t = getSeasonTheme(g.year)
                const isActive = g.year === selectedYear
                return (
                  <button
                    key={g.year}
                    type="button"
                    className={`tree-year-pill ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      if (soundEnabled) playPaperTurnSound()
                      setSelectedYear(g.year)
                      setCurrentPage(0)
                    }}
                  >
                    <span>{t.name === 'Xuân' ? '🌸' : t.name === 'Hạ' ? '☀️' : t.name === 'Thu' ? '🍂' : '❄️'}</span>
                    <span>Năm {g.year}</span>
                    <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>({g.events.length})</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Khung Canvas Cây 3D xoay 360 độ */}
          <div className="tree-canvas-wrapper">
            <Interactive3DTreeCanvas
              year={selectedYear}
              events={activeYearEvents}
              theme={activeYearTheme}
              onOpenBook={() => {
                if (soundEnabled) playPaperTurnSound()
                setCurrentPage(0)
                setViewMode('book')
              }}
              onSelectMonth={(m) => {
                const targetIdx = dayPages.findIndex((p) => parseInt(p.monthNum, 10) === m)
                if (targetIdx >= 0) {
                  setCurrentPage(targetIdx + 1)
                } else {
                  setCurrentPage(0)
                }
                if (soundEnabled) playPaperTurnSound()
                setViewMode('book')
              }}
            />
          </div>

          {/* Bảng đế cây & Nút mở sách lật 3D */}
          <div className="tree-pedestal-card">
            <div className="tree-pedestal-title">
              <TreePine size={18} style={{ color: activeYearTheme.accent }} />
              <span>CÂY KỶ NIỆM 3D · NĂM {selectedYear}</span>
            </div>

            <div className="tree-pedestal-meta">
              <span>🌸 Mùa {activeYearTheme.name}</span>
              <span>·</span>
              <span>📖 {activeYearEvents.length} kỷ niệm</span>
              <span>·</span>
              <span>🖼️ {activeYearMediaCount} ảnh & video</span>
              <span>·</span>
              <span>✨ 12 tháng nở hoa</span>
            </div>

            <button
              type="button"
              className="tree-open-book-btn"
              onClick={() => {
                if (soundEnabled) playPaperTurnSound()
                setCurrentPage(0)
                setViewMode('book')
              }}
            >
              <BookOpen size={18} />
              <span>Mở Cuốn Sách Năm {selectedYear} (Lật Trang 3D) →</span>
            </button>

            <div className="tree-pedestal-hint">
              ✨ Kéo vuốt để xoay cây 360° · Chạm hoa 12 tháng để mở nhanh
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
         * VIEW 2: HIỆU ỨNG LẬT SÁCH 3D CHÂN THỰC TỪNG NĂM (Y CHANG HỒI XƯA)
         * ══════════════════════════════════════════════════════════════ */
        <>
          {/* Modal tìm kiếm & lọc tháng */}
          {isSearchOpen && (
            <div className="memory-quick-search-backdrop" onClick={() => setIsSearchOpen(false)}>
              <div className="memory-quick-search-modal" onClick={(e) => e.stopPropagation()}>
                <div className="search-modal-header">
                  <div className="search-input-wrap">
                    <Search size={18} className="search-input-icon" />
                    <input
                      type="text"
                      placeholder={`Tìm kỷ niệm năm ${selectedYear}...`}
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

                <div className="search-results-list">
                  {searchResults.length === 0 ? (
                    <div className="search-empty-state">
                      <Calendar size={32} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                      <p>Không tìm thấy kỷ niệm nào</p>
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

          {/* 3D Book Stage (Cơ chế lật 3D 180 độ chân thực quanh gáy sách) */}
          <div
            className="memory-book-stage"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
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

            <div className="book-3d-chassis">
              <div className="book-spine-3d" />
              <div className="book-hardcover-shadow" />

              {flipState ? (
                <>
                  <div className="book-page-layer base-layer">
                    {renderPageContent(flipState.toPage)}
                  </div>
                  <div className={`flipping-leaf leaf-direction-${flipState.direction}`}>
                    <div className="leaf-face leaf-face-front">
                      {renderPageContent(flipState.direction === 'next' ? flipState.fromPage : flipState.toPage)}
                      <div className="leaf-shadow-curl front-shadow" />
                    </div>
                    <div className="leaf-face leaf-face-back">
                      {renderPageContent(
                        flipState.direction === 'next' ? flipState.toPage : flipState.fromPage,
                        true
                      )}
                      <div className="leaf-shadow-curl back-shadow" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="book-page-layer active-layer">
                  {renderPageContent(currentPage)}
                </div>
              )}
            </div>

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

          {/* Thanh trượt điều hướng trang nhanh ở đáy */}
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
        </>
      )}

      {/* Lightbox xem ảnh / video phóng to */}
      {activeGallery && currentPhoto && (
        <div className="scrapbook-photo-modal" onClick={() => setActiveGallery(null)}>
          <div className="scrapbook-photo-popup" onClick={(e) => e.stopPropagation()}>
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

            <div className="scrapbook-popup-media">
              {activeGallery.images.length > 1 && (
                <button
                  type="button"
                  className="popup-nav-btn prev"
                  onClick={() => setActiveGallery((g) => g ? { ...g, currentIndex: (g.currentIndex - 1 + g.images.length) % g.images.length } : null)}
                  title="Ảnh trước"
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
                  title="Ảnh tiếp theo"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>

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
