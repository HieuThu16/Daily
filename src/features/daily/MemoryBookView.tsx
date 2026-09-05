import { useState, useMemo, useRef, useEffect } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, Clock,
  Play, Sparkles, X, Bookmark, Heart, BookOpen
} from 'lucide-react'
import type { SharedEvent } from '../../types'

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

export function MemoryBookView({ events, personName, onClose }: MemoryBookViewProps) {
  // 1. Nhóm kỷ niệm theo từng ngày và sắp xếp tăng dần theo thời gian (dòng thời gian kỷ niệm)
  const dayPages: BookDayPage[] = useMemo(() => {
    const map = new Map<string, SharedEvent[]>()
    for (const ev of events) {
      if (!ev.event_date) continue
      const list = map.get(ev.event_date) || []
      list.push(ev)
      map.set(ev.event_date, list)
    }

    const sortedDates = Array.from(map.keys()).sort((a, b) => a.localeCompare(b))
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
  }, [events])

  // currentPage: 0 là Bìa sách trước (Cover), 1..N là các ngày, N+1 là Bìa sau
  const [currentPage, setCurrentPage] = useState<number>(0)
  const totalPages = dayPages.length + 2 // Bìa trước + N ngày + Bìa sau
  const [isFlipping, setIsFlipping] = useState<'next' | 'prev' | null>(null)

  // Xem ảnh phóng to pop-up
  const [activePhoto, setActivePhoto] = useState<{
    url: string
    title?: string
    note?: string
    date?: string
    isVid?: boolean
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

    // Nếu vuốt ngang dứt khoát hơn vuốt dọc
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

  // Điều hướng bằng phím mũi tên
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activePhoto) {
        if (e.key === 'Escape') setActivePhoto(null)
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
  }, [currentPage, totalPages, activePhoto])

  const goNextPage = () => {
    if (currentPage >= totalPages - 1 || isFlipping) return
    setIsFlipping('next')
    setTimeout(() => {
      setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
      setIsFlipping(null)
    }, 450)
  }

  const goPrevPage = () => {
    if (currentPage <= 0 || isFlipping) return
    setIsFlipping('prev')
    setTimeout(() => {
      setCurrentPage((p) => Math.max(0, p - 1))
      setIsFlipping(null)
    }, 450)
  }

  // Dữ liệu ngày hiện tại (nếu đang ở trang nội dung 1..N)
  const currentDayData = currentPage >= 1 && currentPage <= dayPages.length
    ? dayPages[currentPage - 1]
    : null

  return (
    <div className="memory-book-fullscreen">
      {/* ── 1. Top floating bar ─────────────────────────────────────────── */}
      <div className="memory-book-topbar">
        <button
          type="button"
          className="memory-book-back-btn"
          onClick={onClose}
          title="Quay lại Kỷ niệm chung (Esc)"
          aria-label="Quay lại"
        >
          <ArrowLeft size={18} />
          <span>Quay lại</span>
        </button>

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
          {currentPage > 0 && (
            <button
              type="button"
              className="memory-book-pill-btn"
              onClick={() => setCurrentPage(0)}
              title="Về bìa sổ"
            >
              <Bookmark size={13} />
              <span>Bìa sổ</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. 3D Book Stage ────────────────────────────────────────────── */}
      <div
        className="memory-book-stage"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Nút lật trang trước */}
        <button
          type="button"
          className={`book-turn-arrow prev ${currentPage === 0 ? 'disabled' : ''}`}
          onClick={goPrevPage}
          disabled={currentPage === 0 || !!isFlipping}
          title="Lật về trang trước"
          aria-label="Trang trước"
        >
          <ChevronLeft size={28} />
        </button>

        {/* Khung quyển sổ 3D */}
        <div className={`book-3d-chassis ${isFlipping ? `flipping-${isFlipping}` : ''}`}>
          {/* Gáy sách nổi 3D */}
          <div className="book-spine-3d" />

          {/* ════════════ TRANG BÌA TRƯỚC (Cover) ════════════ */}
          {currentPage === 0 && (
            <div className="book-page-sheet cover-sheet" onClick={goNextPage}>
              <div className="cover-inner-border">
                <div className="cover-badge-top">
                  <Sparkles size={16} />
                  <span>KHOẢNH KHẮC LƯU GIỮ</span>
                </div>

                <div className="cover-center-content">
                  <div className="cover-icon-box">
                    <Heart size={36} fill="#f59e0b" color="#f59e0b" />
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
          )}

          {/* ════════════ TRANG NỘI DUNG (Scrapbook Day Page) ════════════ */}
          {currentDayData && (
            <div className="book-page-sheet scrapbook-sheet">
              {/* Trang trí gáy xoắn / gáy sổ */}
              <div className="scrapbook-binding-edge" />

              <div className="scrapbook-page-inner">
                {/* Tem bưu thiếp ngày tháng phong cách vintage */}
                <div className="scrapbook-header-row">
                  <div className="vintage-date-stamp">
                    <div className="stamp-day">{currentDayData.dayNum}</div>
                    <div className="stamp-sub">
                      <span>THÁNG {currentDayData.monthNum}</span>
                      <span className="stamp-year">{currentDayData.yearNum}</span>
                    </div>
                    <div className="stamp-weekday">{currentDayData.weekdayStr}</div>
                  </div>

                  <div className="scrapbook-corner-badge">
                    <span>{currentDayData.events.length} kỷ niệm</span>
                  </div>
                </div>

                {/* Danh sách kỷ niệm trong ngày theo phong cách Scrapbook dán ảnh */}
                <div className="scrapbook-body-scroll">
                  {currentDayData.events.map((ev, evIdx) => {
                    const evImages = (ev.images && ev.images.length > 0)
                      ? ev.images
                      : (ev.image_url ? [ev.image_url] : [])

                    return (
                      <section key={ev.id} className="scrapbook-entry-block">
                        {/* Tiêu đề & Thời gian / Địa điểm */}
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

                        {/* Lời ghi chú / nhật ký xúc cảm */}
                        {ev.note && (
                          <div className="scrapbook-handwritten-note">
                            <p>{ev.note}</p>
                          </div>
                        )}

                        {/* Khung ảnh dán Scrapbook (Polaroid / Băng dính Washi Tape) */}
                        {evImages.length > 0 && (
                          <div className={`scrapbook-photos-layout count-${Math.min(evImages.length, 4)}`}>
                            {evImages.map((mediaUrl, imgIdx) => {
                              const isVid = isVideo(mediaUrl)
                              const rotateDeg = (imgIdx % 2 === 0 ? -1.5 : 1.8) * (1 + (imgIdx * 0.3))

                              return (
                                <div
                                  key={imgIdx}
                                  className="polaroid-frame"
                                  style={{
                                    transform: `rotate(${rotateDeg}deg)`,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActivePhoto({
                                      url: mediaUrl,
                                      title: ev.title,
                                      note: ev.note || undefined,
                                      date: `${currentDayData.dayNum}/${currentDayData.monthNum}/${currentDayData.yearNum}`,
                                      isVid,
                                    })
                                  }}
                                  title="Chạm để mở ảnh to"
                                >
                                  {/* Băng dính washi tape ghim ảnh */}
                                  <div className={`washi-tape washi-tape-${(evIdx + imgIdx) % 3}`} />

                                  <div className="polaroid-photo-box">
                                    {isVid ? (
                                      <div className="polaroid-video-wrap">
                                        <video src={mediaUrl} preload="metadata" muted playsInline />
                                        <div className="polaroid-play-overlay">
                                          <Play size={20} fill="#ffffff" color="#ffffff" />
                                        </div>
                                      </div>
                                    ) : (
                                      <img src={mediaUrl} alt="" loading="lazy" />
                                    )}
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

                {/* Đáy trang: Số trang nhỏ */}
                <div className="scrapbook-page-footer">
                  <span>Trang {currentPage}</span>
                  <span className="scrapbook-hint">← Vuốt hoặc chạm mép để lật trang →</span>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ TRANG BÌA SAU (Back Cover) ════════════ */}
          {currentPage === totalPages - 1 && (
            <div className="book-page-sheet back-cover-sheet" onClick={() => setCurrentPage(0)}>
              <div className="back-cover-inner">
                <div className="back-cover-seal">
                  <Heart size={28} fill="#f59e0b" color="#f59e0b" />
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
                    setCurrentPage(0)
                  }}
                >
                  <span>Xem lại từ đầu</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nút lật trang sau */}
        <button
          type="button"
          className={`book-turn-arrow next ${currentPage >= totalPages - 1 ? 'disabled' : ''}`}
          onClick={goNextPage}
          disabled={currentPage >= totalPages - 1 || !!isFlipping}
          title="Lật sang trang tiếp theo"
          aria-label="Trang tiếp theo"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* ── 3. Modal Phóng to ảnh mượt mà (Photo Pop-up) ────────────────── */}
      {activePhoto && (
        <div
          className="scrapbook-photo-modal"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="scrapbook-photo-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="scrapbook-photo-close"
              onClick={() => setActivePhoto(null)}
              title="Đóng (Esc)"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>

            <div className="scrapbook-popup-media">
              {activePhoto.isVid ? (
                <video src={activePhoto.url} controls autoPlay playsInline />
              ) : (
                <img src={activePhoto.url} alt="" />
              )}
            </div>

            {(activePhoto.title || activePhoto.date || activePhoto.note) && (
              <div className="scrapbook-popup-info">
                {activePhoto.title && <h4>{activePhoto.title}</h4>}
                {activePhoto.date && (
                  <div className="scrapbook-popup-date">
                    📅 Ngày {activePhoto.date}
                  </div>
                )}
                {activePhoto.note && <p>{activePhoto.note}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
