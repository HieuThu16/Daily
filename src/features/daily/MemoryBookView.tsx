import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, Clock,
  Play, Sparkles, X, Heart, BookOpen, Columns2,
  ArrowUpDown, Search, Volume2, VolumeX, Calendar,
  Download, TreePine, RotateCcw, List, Smartphone, Flower2,
  Menu, Eye, EyeOff, Maximize2
} from 'lucide-react'
import type { SharedEvent } from '../../types'
import { getVideoPosterUrl, SafeMediaImage } from './SharedEventsView'
import { getSeasonTheme } from './YearlyMemoryBook'
import { Interactive3DTreeCanvas } from './Interactive3DTreeThree'
import { GalaxyWheel3DMemoryView } from './GalaxyWheel3DMemoryView'
import './memory-book.css'

export interface MemoryBookViewProps {
  events: SharedEvent[]
  personName?: string
  roomCode?: string | null
  initialViewMode?: MemoryViewType
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

export type MemoryViewType = 'tree' | 'book' | 'month' | 'list' | 'wheel'
export type LayoutMode = 'spread' | 'single'

export interface SpreadSideContent {
  type: 'cover-intro' | 'cover-main' | 'day-primary' | 'day-secondary' | 'day-single' | 'back-summary' | 'back-cover'
  day?: BookDayPage
  events?: SharedEvent[]
  images?: string[]
  pageNumber?: number
  totalDays?: number
  totalMemories?: number
  totalPhotos?: number
  customTitle?: string
}

export interface SpreadItem {
  id: string
  spreadIndex: number
  left: SpreadSideContent
  right: SpreadSideContent
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

// Âm thanh lật giấy êm dịu
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
  } catch {}
}

/**
 * BƯỚM VÀNG PHÁT SÁNG BAY LƯỢN TỪ TRANG SÁCH
 */
function GoldenButterflies() {
  const butterflies = useMemo(() => [
    { id: 1, left: '46%', top: '24%', scale: 0.95, delay: '0s', dur: '5.2s' },
    { id: 2, left: '53%', top: '16%', scale: 1.15, delay: '1.1s', dur: '4.6s' },
    { id: 3, left: '38%', top: '30%', scale: 0.8, delay: '2.3s', dur: '5.8s' },
    { id: 4, left: '60%', top: '22%', scale: 0.75, delay: '0.7s', dur: '5s' },
    { id: 5, left: '49%', top: '38%', scale: 0.7, delay: '1.8s', dur: '6s' },
    { id: 6, left: '42%', top: '12%', scale: 0.85, delay: '3.1s', dur: '4.9s' },
  ], [])

  return (
    <div className="golden-butterflies-container" aria-hidden="true">
      {butterflies.map((b) => (
        <div
          key={b.id}
          className="golden-butterfly"
          style={{
            left: b.left,
            top: b.top,
            animationDelay: b.delay,
            animationDuration: b.dur,
            ['--b-scale' as any]: b.scale,
          }}
        >
          <div className="butterfly-wing wing-left" />
          <div className="butterfly-body" />
          <div className="butterfly-wing wing-right" />
          <div className="butterfly-glow" />
        </div>
      ))}
      <div className="fairy-dust p1" />
      <div className="fairy-dust p2" />
      <div className="fairy-dust p3" />
      <div className="fairy-dust p4" />
      <div className="fairy-dust p5" />
    </div>
  )
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * MODAL HOA 2D RỰC RỠ SẮC MÀU (CHI TIẾT KHI NHẤN VÀO CÂY/HOA)
 * ═══════════════════════════════════════════════════════════════════
 */
function Flower2DDetailModal({
  month,
  year,
  events,
  onClose,
  onOpenInBook,
}: {
  month: number
  year: number
  events: SharedEvent[]
  onClose: () => void
  onOpenInBook: (dateStr?: string) => void
}) {
  const monthImages = useMemo(() => {
    const list: Array<{ url: string; title?: string; date?: string; note?: string }> = []
    for (const ev of events) {
      if (Array.isArray(ev.images) && ev.images.length > 0) {
        for (const img of ev.images) {
          if (img) list.push({ url: img, title: ev.title, date: ev.event_date, note: ev.note || undefined })
        }
      } else if (ev.image_url) {
        list.push({ url: ev.image_url, title: ev.title, date: ev.event_date, note: ev.note || undefined })
      }
    }
    return list
  }, [events])

  const petalColors = [
    '#ff4d8d', '#ff758c', '#ffaec9', '#f43f5e',
    '#fb7185', '#f59e0b', '#fbbf24', '#f472b6',
    '#ec4899', '#db2777', '#f87171', '#fb923c'
  ]

  return (
    <div className="flower-2d-modal-backdrop" onClick={onClose}>
      <div className="flower-2d-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flower-2d-header">
          <div className="flower-2d-title-wrap">
            <Flower2 size={22} style={{ color: '#f43f5e' }} />
            <h3 className="flower-2d-title">
              Đoá Hoa Tháng {month} · Năm {year}
            </h3>
          </div>
          <button
            type="button"
            className="memory-book-circle-btn close-circle"
            onClick={onClose}
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flower-2d-body">
          {/* ĐOÁ HOA 2D BỪNG NỞ NGHỆ THUẬT VỚI 12 CÁNH HOA SẮC MÀU */}
          <div className="blooming-flower-2d-art">
            <svg viewBox="0 0 200 200" className="blooming-flower-svg">
              <defs>
                <radialGradient id="flowerCenterGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#fef08a" />
                  <stop offset="90%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </radialGradient>
                <radialGradient id="petalGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fff5f8" />
                  <stop offset="60%" stopColor="#ff758c" />
                  <stop offset="100%" stopColor="#e11d48" />
                </radialGradient>
              </defs>

              {/* 12 Cánh hoa xòe tròn rực rỡ sắc màu */}
              {Array.from({ length: 12 }).map((_, i) => {
                const c = petalColors[i % petalColors.length]
                return (
                  <g key={i} transform={`rotate(${i * 30} 100 100)`}>
                    <path
                      d="M 100 100 C 88 65, 82 25, 100 12 C 118 25, 112 65, 100 100 Z"
                      fill={c}
                      opacity={0.88}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </g>
                )
              })}

              {/* Lõi nhụy hoa vàng kim phát sáng */}
              <circle cx="100" cy="100" r="28" fill="url(#flowerCenterGrad)" stroke="#f59e0b" strokeWidth="2.5" />
              <text x="100" y="104" textAnchor="middle" fontSize="13" fontWeight="900" fill="#78350f">
                T{month}
              </text>
            </svg>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#92400e' }}>
              🌸 {events.length} kỷ niệm · 🖼️ {monthImages.length} khoảnh khắc rạng ngời
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '4px 0 0', fontStyle: 'italic' }}>
              {events.length > 0
                ? 'Những đóa hoa nở rực rỡ đại diện cho từng ngày hạnh phúc trong tháng.'
                : 'Tháng này chưa có kỷ niệm, hãy tiếp tục lưu lại những phút giây ngọt ngào nhé!'}
            </p>
          </div>

          {/* Danh sách kỷ niệm của tháng */}
          {events.length > 0 && (
            <div className="flower-2d-memories-list">
              {events.map((ev, idx) => {
                const thumb = (ev.images && ev.images[0]) || ev.image_url
                const dayInfo = ev.event_date ? parseDayInfo(ev.event_date) : null

                return (
                  <div
                    key={ev.id || idx}
                    className="flower-2d-memory-card"
                    onClick={() => {
                      onOpenInBook(ev.event_date)
                      onClose()
                    }}
                  >
                    {thumb ? (
                      <SafeMediaImage src={thumb} alt="" className="flower-2d-card-thumb" />
                    ) : (
                      <div className="flower-2d-card-thumb" style={{ display: 'grid', placeItems: 'center', background: '#fef3c7' }}>
                        <Heart size={20} style={{ color: '#f59e0b' }} />
                      </div>
                    )}
                    <div className="flower-2d-card-info">
                      <div className="flower-2d-card-title">
                        {ev.title || 'Kỷ niệm đẹp'}
                      </div>
                      <div className="flower-2d-card-meta">
                        {dayInfo && <span>📅 {dayInfo.dayNum}/{dayInfo.monthNum}</span>}
                        {ev.location && <span>· 📍 {ev.location}</span>}
                        {ev.is_favorite && <span style={{ color: '#e11d48' }}>· ❤️ Yêu thích</span>}
                      </div>
                      {ev.note && (
                        <p style={{ fontSize: '0.74rem', color: '#475569', margin: '4px 0 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          "{ev.note}"
                        </p>
                      )}
                    </div>
                    <ChevronRight size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6, width: '100%', justifyContent: 'center' }}>
            <button
              type="button"
              className="tree-open-book-btn"
              style={{ maxWidth: 260, padding: '9px 18px', fontSize: '0.82rem' }}
              onClick={() => {
                const firstDate = events[0]?.event_date
                onOpenInBook(firstDate)
                onClose()
              }}
            >
              <BookOpen size={16} />
              <span>Mở Xem Trong Cuốn Sách →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
 * MAIN COMPONENT: MemoryBookView
 * ═══════════════════════════════════════════════════════════════════ */
export function MemoryBookView({ events, personName, roomCode: _roomCode, initialViewMode, onClose }: MemoryBookViewProps) {
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

  // 4 CHẾ ĐỘ XEM ĐỘC LẬP: 'tree' | 'book' | 'month' | 'list'
  const [viewMode, setViewMode] = useState<MemoryViewType>(initialViewMode || 'book')

  // Chế độ toàn màn hình ảnh (Zen mode — ẩn thanh tiến độ & nút quay về để toàn bộ màn hình là ảnh)
  const [isZenMode, setIsZenMode] = useState<boolean>(false)

  // Chế độ lật trang trong 'book': 'spread' (Sách 2 bên) | 'single' (Trang đơn)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('spread')

  // Cảnh báo xoay ngang điện thoại khi vào chế độ 2 trang
  const [showRotateGuide, setShowRotateGuide] = useState<boolean>(false)

  // Modal chi tiết đóa hoa 2D màu sắc
  const [selectedFlowerMonth, setSelectedFlowerMonth] = useState<number | null>(null)

  // Chọn năm hiện tại
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return yearlyGroups[0]?.year || new Date().getFullYear()
  })

  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)

  // Tìm kiếm nhanh & Bộ chọn tháng
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all')

  // Kỷ niệm năm đang mở
  const activeYearEvents = useMemo(() => {
    const found = yearlyGroups.find((g) => g.year === selectedYear)
    return found ? found.events : []
  }, [selectedYear, yearlyGroups])

  const activeYearMediaCount = useMemo(() => {
    const found = yearlyGroups.find((g) => g.year === selectedYear)
    return found ? found.mediaCount : 0
  }, [selectedYear, yearlyGroups])

  const activeYearTheme = useMemo(() => {
    return getSeasonTheme(selectedYear)
  }, [selectedYear])

  // Nhóm theo ngày
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

  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    for (const p of dayPages) {
      set.add(`${p.monthNum}/${p.yearNum}`)
    }
    return Array.from(set)
  }, [dayPages])

  // ═══════════════════════════════════════════════════════════════════
  // CÂN BẰNG 2 BÊN TRANG SÁCH (ẢNH PHÂN BỔ ĐỀU 50/50, KHÔNG BỊ LỆCH)
  // ═══════════════════════════════════════════════════════════════════
  const spreads: SpreadItem[] = useMemo(() => {
    const list: SpreadItem[] = []

    // 1. SPREAD 0: Bìa mở đầu
    const previewImages: string[] = []
    for (const p of dayPages) {
      if (p.allImages.length > 0) {
        previewImages.push(...p.allImages)
        if (previewImages.length >= 4) break
      }
    }

    list.push({
      id: 'spread-cover',
      spreadIndex: 0,
      left: {
        type: 'cover-intro',
        images: previewImages,
        totalDays: dayPages.length,
        totalMemories: activeYearEvents.length,
        totalPhotos: activeYearMediaCount,
      },
      right: {
        type: 'cover-main',
        totalDays: dayPages.length,
        totalMemories: activeYearEvents.length,
        totalPhotos: activeYearMediaCount,
      },
    })

    // 2. CÁC CẶP TRANG KỶ NIỆM: Phân bổ ảnh đều cả 2 bên
    let dayIdx = 0
    let pageNum = 1

    while (dayIdx < dayPages.length) {
      const day = dayPages[dayIdx]
      const totalImgs = day.allImages.length

      if (totalImgs >= 2) {
        // Ngày có từ 2 ảnh trở lên: CHIA ĐỀU 50/50 CHO CẢ 2 BÊN TRÁI & PHẢI!
        const mid = Math.ceil(totalImgs / 2)
        const leftImgs = day.allImages.slice(0, mid)
        const rightImgs = day.allImages.slice(mid)

        list.push({
          id: `spread-day-${day.dateStr}`,
          spreadIndex: list.length,
          left: {
            type: 'day-primary',
            day,
            images: leftImgs,
            pageNumber: pageNum++,
            customTitle: 'Khoảnh khắc mở đầu',
          },
          right: {
            type: 'day-secondary',
            day,
            images: rightImgs,
            pageNumber: pageNum++,
            customTitle: 'Dấu ấn tiếp nối',
          },
        })
        dayIdx++
      } else {
        // Ngày có 0 hoặc 1 ảnh: Ghép Ngày A (Trái) và Ngày B (Phải)
        const leftDay = day
        const rightDay = dayPages[dayIdx + 1]

        list.push({
          id: `spread-pair-${leftDay.dateStr}`,
          spreadIndex: list.length,
          left: {
            type: 'day-single',
            day: leftDay,
            images: leftDay.allImages,
            pageNumber: pageNum++,
          },
          right: {
            type: 'day-single',
            day: rightDay,
            images: rightDay ? rightDay.allImages : [],
            pageNumber: rightDay ? pageNum++ : undefined,
          },
        })
        dayIdx += 2
      }
    }

    // 3. SPREAD CUỐI: Kết cuốn sổ
    list.push({
      id: 'spread-back',
      spreadIndex: list.length,
      left: {
        type: 'back-summary',
        totalDays: dayPages.length,
        totalMemories: activeYearEvents.length,
        totalPhotos: activeYearMediaCount,
      },
      right: {
        type: 'back-cover',
      },
    })

    return list
  }, [dayPages, activeYearEvents.length, activeYearMediaCount])

  // Menu tuỳ chọn ẩn trong nút 3 gạch
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)

  // Mở thẳng vào Trang 1 kỷ niệm (Spread 1) nếu có dữ liệu để thấy ngay ảnh
  const [currentSpread, setCurrentSpread] = useState<number>(() => {
    return dayPages.length > 0 ? 1 : 0
  })
  const totalSpreads = spreads.length

  const totalSinglePages = dayPages.length + 2
  const [currentPage, setCurrentPage] = useState<number>(() => {
    return dayPages.length > 0 ? 1 : 0
  })

  // ═══════════════════════════════════════════════════════════════════
  // CHUYỂN ĐỔI CHẾ ĐỘ 2 TRANG ↔ 1 TRANG ĐỒNG BỘ VÀ TỰ ĐỘNG XOAY MÀN HÌNH
  // ═══════════════════════════════════════════════════════════════════
  const switchToSpreadMode = async () => {
    if (layoutMode === 'spread') return
    const nextSpreadIdx = Math.min(Math.floor(currentPage / 2), totalSpreads - 1)
    setCurrentSpread(Math.max(0, nextSpreadIdx))
    setLayoutMode('spread')
    if (soundEnabled) playPaperTurnSound()

    if (typeof window !== 'undefined' && window.innerWidth < window.innerHeight) {
      setShowRotateGuide(true)
      setTimeout(() => setShowRotateGuide(false), 3800)
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen().catch(() => {})
        }
        if (screen.orientation && 'lock' in screen.orientation) {
          await (screen.orientation as any).lock('landscape').catch(() => {})
        }
      } catch {}
    }
  }

  const switchToSingleMode = () => {
    if (layoutMode === 'single') return
    const nextPageIdx = Math.min(currentSpread * 2, totalSinglePages - 1)
    setCurrentPage(Math.max(0, nextPageIdx))
    setLayoutMode('single')
    if (soundEnabled) playPaperTurnSound()
  }

  // ═══════════════════════════════════════════════════════════════════
  // HIỆU ỨNG LẬT TRANG 3D PHẦN CỨNG GPU SIÊU MƯỢT MÀ, KHÔNG LAG
  // ═══════════════════════════════════════════════════════════════════
  const chassisRef = useRef<HTMLDivElement | null>(null)
  const [turningState, setTurningState] = useState<{
    direction: 'next' | 'prev'
    progress: number
    isSettling?: boolean
  } | null>(null)

  const dragTrackingRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastTime: number
    isDragging: boolean
    direction: 'next' | 'prev' | null
    velocity: number
  } | null>(null)

  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  const animateTurnProgress = useCallback(
    (
      fromProgress: number,
      toProgress: number,
      direction: 'next' | 'prev',
      onComplete: (completed: boolean) => void
    ) => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current)
      }

      const startTime = performance.now()
      const distance = Math.abs(toProgress - fromProgress)
      const duration = Math.max(140, Math.min(360, distance * 360))

      const step = (now: number) => {
        const elapsed = now - startTime
        const t = Math.min(1, elapsed / duration)
        const easedT = 1 - Math.pow(1 - t, 3)
        const currentProgress = fromProgress + (toProgress - fromProgress) * easedT

        setTurningState({
          direction,
          progress: currentProgress,
          isSettling: true,
        })

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(step)
        } else {
          animFrameRef.current = null
          onComplete(toProgress === 1.0)
        }
      }

      animFrameRef.current = requestAnimationFrame(step)
    },
    []
  )

  const [activeGallery, setActiveGallery] = useState<{
    images: string[]
    currentIndex: number
    title?: string
    note?: string
    date?: string
  } | null>(null)
  const [isClosingGallery, setIsClosingGallery] = useState(false)

  const openGallery = useCallback((images: string[], currentIndex: number, title?: string, date?: string) => {
    setIsClosingGallery(false)
    setActiveGallery({ images, currentIndex, title, date })
  }, [])

  const closeGallery = useCallback(() => {
    setIsClosingGallery(true)
    setTimeout(() => {
      setActiveGallery(null)
      setIsClosingGallery(false)
    }, 220)
  }, [])

  const goNextSpread = useCallback(() => {
    if (currentSpread >= totalSpreads - 1 || turningState) return
    if (soundEnabled) playPaperTurnSound()
    animateTurnProgress(0, 1, 'next', (completed) => {
      if (completed) {
        setCurrentSpread((s) => Math.min(s + 1, totalSpreads - 1))
      }
      setTurningState(null)
    })
  }, [currentSpread, totalSpreads, turningState, soundEnabled, animateTurnProgress])

  const goPrevSpread = useCallback(() => {
    if (currentSpread <= 0 || turningState) return
    if (soundEnabled) playPaperTurnSound()
    animateTurnProgress(0, 1, 'prev', (completed) => {
      if (completed) {
        setCurrentSpread((s) => Math.max(s - 1, 0))
      }
      setTurningState(null)
    })
  }, [currentSpread, turningState, soundEnabled, animateTurnProgress])

  const goNextPage = useCallback(() => {
    if (layoutMode === 'spread') {
      goNextSpread()
    } else {
      if (currentPage >= totalSinglePages - 1 || turningState) return
      if (soundEnabled) playPaperTurnSound()
      animateTurnProgress(0, 1, 'next', (completed) => {
        if (completed) {
          setCurrentPage((p) => Math.min(p + 1, totalSinglePages - 1))
        }
        setTurningState(null)
      })
    }
  }, [layoutMode, goNextSpread, currentPage, totalSinglePages, turningState, soundEnabled, animateTurnProgress])

  const goPrevPage = useCallback(() => {
    if (layoutMode === 'spread') {
      goPrevSpread()
    } else {
      if (currentPage <= 0 || turningState) return
      if (soundEnabled) playPaperTurnSound()
      animateTurnProgress(0, 1, 'prev', (completed) => {
        if (completed) {
          setCurrentPage((p) => Math.max(p - 1, 0))
        }
        setTurningState(null)
      })
    }
  }, [layoutMode, goPrevSpread, currentPage, turningState, soundEnabled, animateTurnProgress])

  const jumpToDay = useCallback((dateStr: string) => {
    const sIdx = spreads.findIndex(
      (s) => s.left.day?.dateStr === dateStr || s.right.day?.dateStr === dateStr
    )
    if (sIdx >= 0) {
      setCurrentSpread(sIdx)
    }
    const pIdx = dayPages.findIndex((d) => d.dateStr === dateStr)
    if (pIdx >= 0) {
      setCurrentPage(pIdx + 1)
    }
    if (soundEnabled) playPaperTurnSound()
    setViewMode('book')
    setIsSearchOpen(false)
  }, [spreads, dayPages, soundEnabled])

  // Phím tắt bàn phím
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeGallery) {
        if (e.key === 'Escape') closeGallery()
        return
      }
      if (selectedFlowerMonth !== null) {
        if (e.key === 'Escape') setSelectedFlowerMonth(null)
        return
      }
      if (isSearchOpen) {
        if (e.key === 'Escape') setIsSearchOpen(false)
        return
      }
      if (isMenuOpen) {
        if (e.key === 'Escape') setIsMenuOpen(false)
        return
      }
      if (e.key === 'ArrowRight') {
        goNextPage()
      } else if (e.key === 'ArrowLeft') {
        goPrevPage()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeGallery, selectedFlowerMonth, isSearchOpen, isMenuOpen, goNextPage, goPrevPage, onClose])

  // Cử chỉ vuốt chạm 3D thời gian thực (Interactive Hand Gesture Drag-to-Curl)
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (
      target.closest(
        'button, input, a, .search-input-field, .polaroid-zoom-badge, .popup-btn-icon, .month-card, video, audio'
      )
    ) {
      return
    }

    if (turningState?.isSettling) return

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    dragTrackingRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastTime: performance.now(),
      isDragging: false,
      direction: null,
      velocity: 0,
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const tracker = dragTrackingRef.current
    if (!tracker || tracker.pointerId !== e.pointerId) return

    const dx = e.clientX - tracker.startX
    const dy = e.clientY - tracker.startY
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    const now = performance.now()
    const dt = Math.max(1, now - tracker.lastTime)
    tracker.velocity = (e.clientX - tracker.lastX) / dt
    tracker.lastX = e.clientX
    tracker.lastTime = now

    // Bắt đầu chế độ kéo vuốt lật trang khi ngón tay di chuyển ngang rõ rệt
    if (!tracker.isDragging) {
      if (absX > 10 && absX > absY * 0.6) {
        if (dx < 0) {
          // Vuốt sang trái -> Lật tới trang tiếp theo (Next)
          const canGoNext =
            layoutMode === 'spread'
              ? currentSpread < totalSpreads - 1
              : currentPage < totalSinglePages - 1
          if (canGoNext) {
            tracker.isDragging = true
            tracker.direction = 'next'
            try {
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            } catch {}
            if (soundEnabled) playPaperTurnSound()
          }
        } else {
          // Vuốt sang phải -> Lật ngược về trang trước (Prev)
          const canGoPrev =
            layoutMode === 'spread' ? currentSpread > 0 : currentPage > 0
          if (canGoPrev) {
            tracker.isDragging = true
            tracker.direction = 'prev'
            try {
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            } catch {}
            if (soundEnabled) playPaperTurnSound()
          }
        }
      }
    }

    // Khi đang kéo: Trang sách 3D uốn cong và bám sát tuyệt đối theo ngón tay (có thể giữ giữa chừng)
    if (tracker.isDragging && tracker.direction) {
      const bookWidth = chassisRef.current?.clientWidth || window.innerWidth
      const turnSpan = Math.max(140, bookWidth * 0.45)

      let progress = 0
      if (tracker.direction === 'next') {
        progress = Math.min(1, Math.max(0, -dx / turnSpan))
      } else {
        progress = Math.min(1, Math.max(0, dx / turnSpan))
      }

      setTurningState({
        direction: tracker.direction,
        progress,
        isSettling: false,
      })
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const tracker = dragTrackingRef.current
    if (!tracker || tracker.pointerId !== e.pointerId) return

    dragTrackingRef.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}

    // TRƯỜNG HỢP 1: Người dùng đang vuốt dở và buông tay
    if (tracker.isDragging && tracker.direction && turningState) {
      const currentProgress = turningState.progress
      const vel = tracker.velocity

      // Nếu kéo qua 35% hoặc quẹt nhanh (flick) thì hoàn tất lật trang
      let shouldComplete = false
      if (tracker.direction === 'next') {
        shouldComplete = currentProgress > 0.35 || vel < -0.35
      } else {
        shouldComplete = currentProgress > 0.35 || vel > 0.35
      }

      if (shouldComplete) {
        animateTurnProgress(currentProgress, 1.0, tracker.direction, (completed) => {
          if (completed) {
            if (layoutMode === 'spread') {
              if (tracker.direction === 'next') {
                setCurrentSpread((s) => Math.min(s + 1, totalSpreads - 1))
              } else {
                setCurrentSpread((s) => Math.max(s - 1, 0))
              }
            } else {
              if (tracker.direction === 'next') {
                setCurrentPage((p) => Math.min(p + 1, totalSinglePages - 1))
              } else {
                setCurrentPage((p) => Math.max(p - 1, 0))
              }
            }
          }
          setTurningState(null)
        })
      } else {
        // Kéo chưa đủ xa thì lò xo đàn hồi trả trang về vị trí cũ (snap back)
        animateTurnProgress(currentProgress, 0.0, tracker.direction, () => {
          setTurningState(null)
        })
      }
      return
    }

    // TRƯỜNG HỢP 2: Chạm nhẹ (Tap) - Không được lật bậy khi chạm vào giữa trang đọc sách / xem ảnh!
    const target = e.target as HTMLElement
    if (
      target.closest(
        'button, input, a, .search-input-field, .polaroid-zoom-badge, .popup-btn-icon, video, audio'
      )
    ) {
      return
    }

    const dx = Math.abs(e.clientX - tracker.startX)
    const dy = Math.abs(e.clientY - tracker.startY)

    if (dx <= 14 && dy <= 14) {
      const rect = chassisRef.current?.getBoundingClientRect()
      if (rect) {
        const clickRelX = (e.clientX - rect.left) / rect.width
        // Chỉ khi chạm hẳn vào mép rìa sách (ngoài cùng 15% trái hoặc 15% phải) mới tự lật trang
        if (clickRelX > 0.85) {
          goNextPage()
        } else if (clickRelX < 0.15) {
          goPrevPage()
        }
      }
    }
  }

  // Render từng nửa trang
  const renderSpreadSide = (content: SpreadSideContent, side: 'left' | 'right') => {
    if (content.type === 'cover-intro') {
      return (
        <div
          className="spread-page-content"
          style={{ justifyContent: 'center', textAlign: 'center', padding: '24px 28px', cursor: 'pointer' }}
          onClick={goNextSpread}
          title="Chạm để mở trang kỷ niệm"
        >
          <div className="cover-art-crest" style={{ margin: '0 auto 12px' }}>
            <div className="cover-art-glow" style={{ background: activeYearTheme.glowColor }} />
            <div className="cover-art-tree-circle" style={{ borderColor: activeYearTheme.accent, width: 70, height: 70 }}>
              <TreePine size={40} style={{ color: activeYearTheme.accent }} />
            </div>
            <div className="cover-art-season-pill" style={{ background: activeYearTheme.accent, fontSize: '0.72rem' }}>
              <span>{activeYearTheme.name === 'Xuân' ? '🌸 Mùa Xuân' : activeYearTheme.name === 'Hạ' ? '☀️ Mùa Hạ' : activeYearTheme.name === 'Thu' ? '🍂 Mùa Thu' : '❄️ Mùa Đông'}</span>
            </div>
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#78350f', margin: '6px 0 4px' }}>
            HÀNH TRÌNH {selectedYear}
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#451a03', fontStyle: 'italic', maxWidth: 320, margin: '0 auto 12px', lineHeight: 1.5 }}>
            "Mỗi khoảnh khắc ghi lại đều là một đóa hoa thơm ngát trên cây đời."
          </p>

          {content.images && content.images.length > 0 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '8px auto' }}>
              {content.images.slice(0, 3).map((img, idx) => (
                <div
                  key={idx}
                  className="polaroid-frame"
                  style={{ width: 68, padding: '4px 4px 10px 4px', transform: `rotate(${idx === 1 ? 0 : idx === 0 ? -3 : 3}deg)` }}
                  onClick={(e) => {
                    e.stopPropagation()
                    openGallery(content.images || [], idx)
                  }}
                >
                  <SafeMediaImage src={img} alt="" style={{ width: '100%', height: 48, objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', fontSize: '0.72rem', color: '#92400e', fontWeight: 800, marginTop: 10 }}>
            <span>📅 {content.totalDays} ngày</span>
            <span>·</span>
            <span>📖 {content.totalMemories} kỷ niệm</span>
            <span>·</span>
            <span>🖼️ {content.totalPhotos} ảnh</span>
          </div>
          <div className={`spread-page-number ${side}`}>I</div>
        </div>
      )
    }

    if (content.type === 'cover-main') {
      return (
        <div
          className="spread-page-content"
          style={{ justifyContent: 'center', textAlign: 'center', padding: '24px 28px', cursor: 'pointer' }}
          onClick={goNextSpread}
          title="Chạm để mở trang kỷ niệm"
        >
          <div className="cover-inner-border" style={{ height: '90%', margin: '0 auto', width: '100%', justifyContent: 'center', gap: 16 }}>
            <div className="cover-badge-top" style={{ justifyContent: 'center' }}>
              <Sparkles size={14} style={{ color: activeYearTheme.accent }} />
              <span>LƯU NIỆM NĂM {selectedYear}</span>
            </div>

            <h1 className="cover-book-title" style={{ fontSize: '1.5rem', margin: '4px 0' }}>
              CUỐN SỔ KỶ NIỆM {selectedYear}
            </h1>

            {personName && (
              <div className="cover-author" style={{ fontSize: '0.84rem' }}>
                Kỷ niệm cùng <strong>{personName}</strong>
              </div>
            )}

            <button
              type="button"
              className="tree-open-book-btn"
              style={{ margin: '14px auto 0', maxWidth: 220, padding: '9px 18px', fontSize: '0.82rem' }}
              onClick={(e) => {
                e.stopPropagation()
                goNextSpread()
              }}
            >
              <span>Mở lật trang sách</span>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className={`spread-page-number ${side}`}>II</div>
        </div>
      )
    }

    if (content.type === 'back-summary') {
      return (
        <div className="spread-page-content" style={{ justifyContent: 'center', textAlign: 'center', padding: '24px 28px' }}>
          <TreePine size={44} style={{ color: activeYearTheme.accent, margin: '0 auto 8px' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#78350f', margin: '4px 0' }}>
            KHÉP LẠI NĂM {selectedYear}
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#451a03', fontStyle: 'italic', maxWidth: 300, margin: '8px auto', lineHeight: 1.6 }}>
            Cảm ơn vì một năm tuyệt vời bên nhau. Hãy cùng đón chờ thật nhiều niềm vui và hạnh phúc trong chặng đường phía trước!
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
            <button
              type="button"
              className="book-mode-btn active"
              onClick={() => setCurrentSpread(0)}
              style={{ padding: '7px 14px' }}
            >
              <RotateCcw size={14} />
              <span>Xem lại từ đầu</span>
            </button>
          </div>
          <div className={`spread-page-number ${side}`}>Fin</div>
        </div>
      )
    }

    if (content.type === 'back-cover') {
      return (
        <div className="spread-page-content" style={{ justifyContent: 'center', textAlign: 'center', padding: '24px 28px' }}>
          <div className="cover-inner-border" style={{ height: '90%', margin: '0 auto', width: '100%', justifyContent: 'center', gap: 14 }}>
            <div className="back-cover-seal" style={{ margin: '0 auto' }}>
              <TreePine size={32} style={{ color: activeYearTheme.accent }} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#78350f' }}>
              DAILY MEMORY BOOK
            </h3>
            <button
              type="button"
              className="tree-open-book-btn"
              style={{ margin: '6px auto 0', maxWidth: 190, padding: '8px 16px', fontSize: '0.8rem' }}
              onClick={() => setViewMode('tree')}
            >
              <span>Quay lại Cây 3D</span>
            </button>
          </div>
          <div className={`spread-page-number ${side}`}>End</div>
        </div>
      )
    }

    // Trang kỷ niệm: Cân bằng đẹp mắt cho cả 2 bên
    const day = content.day
    if (!day) return <div className="spread-page-content" />

    const firstEvent = day.events[0]
    const pageImages = content.images || []

    return (
      <div style={{ height: '100%', position: 'relative' }}>
        {/* Header tinh tế, cân đối 2 bên */}
        <div className="spread-day-header-clean">
          <div className="spread-date-title">
            <span className="spread-date-daynum">{day.dayNum}</span>
            <span className="spread-date-monthyear">THG {day.monthNum} · {day.yearNum}</span>
            {content.customTitle ? (
              <span className="spread-date-weekday">({content.customTitle})</span>
            ) : (
              <span className="spread-date-weekday">({day.weekdayStr})</span>
            )}
          </div>

          {firstEvent?.is_favorite && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#e11d48', fontSize: '0.72rem', fontWeight: 800 }}>
              <Heart size={13} fill="#e11d48" /> Yêu thích
            </span>
          )}
        </div>

        {/* Nội dung trang: Ảnh phân bổ đều và đẹp */}
        <div className="spread-page-content">
          {firstEvent?.title && side === 'left' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                {firstEvent.title}
              </h3>
              <div style={{ display: 'flex', gap: 6, fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>
                {firstEvent.event_time && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={11} /> {firstEvent.event_time}
                  </span>
                )}
                {firstEvent.location && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={11} /> {firstEvent.location}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Khung ảnh Polaroid cân bằng, ảnh to rực rỡ chiếm trọn trang */}
          {pageImages.length > 0 && (
            <div className={`spread-images-stage ${pageImages.length === 1 ? 'single' : 'dual'}`}>
              {pageImages.map((imgUrl, imgIdx) => {
                const isSingle = pageImages.length === 1
                const imgOrder = day.allImages.indexOf(imgUrl) >= 0 ? day.allImages.indexOf(imgUrl) : 0
                return (
                  <div
                    key={imgIdx}
                    className={`polaroid-hero-frame ${isSingle ? 'single-photo' : 'dual-photo'}`}
                  >
                    <div className="washi-tape-sakura" />
                    
                    <div className="polaroid-media-box">
                      {/* Ambient Blurred Backdrop: Đảm bảo ảnh dù tỷ lệ dọc hay ngang đều không bị cắt, có nền mờ nghệ thuật */}
                      <div
                        className="polaroid-media-blur-bg"
                        style={{ backgroundImage: `url(${imgUrl})` }}
                      />

                      {isVideo(imgUrl) ? (
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2,
                          }}
                        >
                          <video
                            src={imgUrl}
                            poster={getVideoPosterUrl(imgUrl)}
                            playsInline
                            muted
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              width: 'auto',
                              height: 'auto',
                              objectFit: 'contain',
                              borderRadius: 4,
                              boxShadow: '0 4px 18px rgba(0,0,0,0.45)',
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'grid',
                              placeItems: 'center',
                              background: 'rgba(0,0,0,0.25)',
                              cursor: 'pointer',
                              borderRadius: 4,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openGallery(
                                day.allImages,
                                imgOrder,
                                firstEvent?.title,
                                `${day.dayNum}/${day.monthNum}/${day.yearNum}`
                              )
                            }}
                          >
                            <Play size={28} fill="#ffffff" color="#ffffff" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <SafeMediaImage src={imgUrl} alt="" className="polaroid-hero-photo" />
                          <div className="polaroid-gloss-glare" />
                        </>
                      )}

                      {/* Nút phóng to ảnh mượt mà có animation kéo mở & thu nhỏ */}
                      <button
                        type="button"
                        className="polaroid-zoom-badge"
                        onClick={(e) => {
                          e.stopPropagation()
                          openGallery(
                            day.allImages,
                            imgOrder,
                            firstEvent?.title,
                            `${day.dayNum}/${day.monthNum}/${day.yearNum}`
                          )
                        }}
                        title="Chạm để phóng to ảnh toàn màn hình"
                      >
                        <Maximize2 size={11} />
                        <span>Phóng to</span>
                      </button>
                    </div>

                    {firstEvent?.title && isSingle && (
                      <div className="polaroid-hero-caption">
                        {firstEvent.title}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Ghi chú viết tay */}
          {firstEvent?.note && (
            <div className="spread-handwritten-box">
              <p className="spread-handwritten-text">{firstEvent.note}</p>
            </div>
          )}
        </div>

        {content.pageNumber && (
          <div className={`spread-page-number ${side}`}>
            {content.pageNumber}
          </div>
        )}
      </div>
    )
  }

  const activeSpread = spreads[currentSpread] || spreads[0]
  const nextSpread = spreads[currentSpread + 1]
  const prevSpread = spreads[currentSpread - 1]

  const currentPhoto = activeGallery
    ? activeGallery.images[activeGallery.currentIndex]
    : null
  const currentIsVid = currentPhoto ? isVideo(currentPhoto) : false

  return (
    <div className={`memory-book-fullscreen ${layoutMode === 'spread' && viewMode === 'book' ? 'spread-mode' : ''} ${isZenMode ? 'zen-mode' : ''}`}>
      {/* Nút khôi phục thanh công cụ khi đang ở chế độ toàn màn hình ảnh (Zen mode) */}
      {isZenMode && (
        <button
          type="button"
          className="zen-restore-floating-btn"
          onClick={() => setIsZenMode(false)}
          title="Hiện lại thanh tiến độ & nút điều khiển"
        >
          <Eye size={15} />
          <span>Hiện thanh công cụ</span>
        </button>
      )}

      {/* ── TOP BAR: TIẾN ĐỘ & NÚT 3 GẠCH MENU (KHÔNG VƯỚNG TAY) ── */}
      <div className="memory-book-topbar">
        <div className="memory-book-top-left">
          <button
            type="button"
            className="memory-book-back-btn"
            onClick={onClose}
            title="Quay lại"
          >
            <ArrowLeft size={16} />
            <span>Quay lại</span>
          </button>
        </div>

        {/* PHẦN GIỮA: THANH TIẾN ĐỘ SCRUBBER Ở TRÊN KHI Ở CHẾ ĐỘ SÁCH */}
        {viewMode === 'book' ? (
          <div className="topbar-scrubber-wrap">
            <input
              type="range"
              min={0}
              max={layoutMode === 'spread' ? totalSpreads - 1 : totalSinglePages - 1}
              value={layoutMode === 'spread' ? currentSpread : currentPage}
              onChange={(e) => {
                const val = Number(e.target.value)
                if (layoutMode === 'spread') {
                  setCurrentSpread(val)
                } else {
                  setCurrentPage(val)
                }
                if (soundEnabled) playPaperTurnSound()
              }}
              className="topbar-slider"
              aria-label="Tiến độ lật sách"
            />
            <span className="topbar-page-label">
              {layoutMode === 'spread'
                ? currentSpread === 0
                  ? `Bìa`
                  : currentSpread === totalSpreads - 1
                  ? `Hết`
                  : `${currentSpread}/${totalSpreads - 1}`
                : currentPage === 0
                ? `Bìa`
                : `${currentPage}/${dayPages.length}`}
            </span>
          </div>
        ) : (
          <div className="topbar-title-pill">
            {viewMode === 'tree' && <span>🌸 Cây 3D · Năm {selectedYear}</span>}
            {viewMode === 'wheel' && <span>🌌 Vòng Xoay 3D · Năm {selectedYear}</span>}
            {viewMode === 'month' && <span>📅 Vườn 12 Tháng · Năm {selectedYear}</span>}
            {viewMode === 'list' && <span>📋 Dòng Kỷ Niệm · Năm {selectedYear}</span>}
          </div>
        )}

        {/* PHẦN PHẢI: NÚT TOÀN MÀN HÌNH ẢNH + NÚT 3 GẠCH MENU & NÚT ĐÓNG */}
        <div className="memory-book-top-actions">
          <button
            type="button"
            className="memory-book-zen-btn"
            onClick={() => setIsZenMode(true)}
            title="Ẩn toàn bộ thanh tiến độ & nút quay về để toàn bộ màn hình là 3D/ảnh"
          >
            <EyeOff size={15} />
            <span className="zen-btn-text">Toàn cảnh 3D</span>
          </button>

          <button
            type="button"
            className={`memory-book-menu-trigger-btn ${isMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMenuOpen((v) => !v)}
            title="Menu tuỳ chọn"
          >
            <Menu size={16} />
            <span className="menu-btn-text">Menu</span>
          </button>

          <button
            type="button"
            className="memory-book-circle-btn close-circle"
            onClick={onClose}
            title="Đóng (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── DROPDOWN MENU 3 GẠCH (ẨN CÁC NÚT VÀO ĐÂY, NHẤN MỚI HIỆN) ── */}
      {isMenuOpen && (
        <div className="memory-menu-backdrop" onClick={() => setIsMenuOpen(false)}>
          <div className="memory-menu-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="menu-dropdown-header">
              <span className="menu-dropdown-title">⚙️ Tuỳ Chọn Kỷ Niệm</span>
              <button
                type="button"
                className="memory-book-circle-btn close-circle"
                style={{ width: 28, height: 28, minWidth: 28 }}
                onClick={() => setIsMenuOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            {/* 1. 4 CHẾ ĐỘ XEM */}
            <div className="menu-dropdown-section">
              <span className="menu-section-label">Chế độ xem</span>
              <div className="menu-buttons-grid">
                <button
                  type="button"
                  className={`menu-option-btn ${viewMode === 'tree' ? 'active' : ''}`}
                  onClick={() => {
                    if (soundEnabled) playPaperTurnSound()
                    setViewMode('tree')
                    setIsMenuOpen(false)
                  }}
                >
                  <TreePine size={14} />
                  <span>🌸 Cây 3D</span>
                </button>

                <button
                  type="button"
                  className={`menu-option-btn ${viewMode === 'wheel' ? 'active' : ''}`}
                  onClick={() => {
                    if (soundEnabled) playPaperTurnSound()
                    setViewMode('wheel')
                    setIsMenuOpen(false)
                  }}
                >
                  <Sparkles size={14} />
                  <span>🌌 Vòng Xoay 3D</span>
                </button>

                <button
                  type="button"
                  className={`menu-option-btn ${viewMode === 'book' ? 'active' : ''}`}
                  onClick={() => {
                    if (soundEnabled) playPaperTurnSound()
                    setViewMode('book')
                    setIsMenuOpen(false)
                  }}
                >
                  <BookOpen size={14} />
                  <span>📖 Đọc Sách</span>
                </button>

                <button
                  type="button"
                  className={`menu-option-btn ${viewMode === 'month' ? 'active' : ''}`}
                  onClick={() => {
                    if (soundEnabled) playPaperTurnSound()
                    setViewMode('month')
                    setIsMenuOpen(false)
                  }}
                >
                  <Calendar size={14} />
                  <span>📅 12 Tháng</span>
                </button>

                <button
                  type="button"
                  className={`menu-option-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => {
                    if (soundEnabled) playPaperTurnSound()
                    setViewMode('list')
                    setIsMenuOpen(false)
                  }}
                >
                  <List size={14} />
                  <span>📋 Danh Sách</span>
                </button>
              </div>
            </div>

            {/* 2. BỐ CỤC TRANG SÁCH */}
            {viewMode === 'book' && (
              <div className="menu-dropdown-section">
                <span className="menu-section-label">Bố cục sách</span>
                <div className="menu-buttons-grid">
                  <button
                    type="button"
                    className={`menu-option-btn ${layoutMode === 'spread' ? 'active' : ''}`}
                    onClick={() => {
                      switchToSpreadMode()
                      setIsMenuOpen(false)
                    }}
                  >
                    <Columns2 size={14} />
                    <span>📖 Sách 2 bên</span>
                  </button>

                  <button
                    type="button"
                    className={`menu-option-btn ${layoutMode === 'single' ? 'active' : ''}`}
                    onClick={() => {
                      switchToSingleMode()
                      setIsMenuOpen(false)
                    }}
                  >
                    <BookOpen size={14} />
                    <span>📄 1 Trang</span>
                  </button>
                </div>
              </div>
            )}

            {/* CHẾ ĐỘ TOÀN CẢNH 3D: ẨN TOÀN BỘ HEADER NÚT */}
            <div className="menu-dropdown-section">
              <span className="menu-section-label">Giao diện xem</span>
              <div className="menu-buttons-grid">
                <button
                  type="button"
                  className={`menu-option-btn ${isZenMode ? 'active' : ''}`}
                  onClick={() => {
                    setIsZenMode((v) => !v)
                    setIsMenuOpen(false)
                  }}
                  title="Ẩn toàn bộ header nút, chỉ để lại không gian 3D tràn viền màn hình"
                >
                  {isZenMode ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span>{isZenMode ? '👁️ Hiện thanh công cụ' : '🌌 Toàn cảnh 3D (Ẩn nút)'}</span>
                </button>
              </div>
            </div>

            {/* 3. TIỆN ÍCH */}
            <div className="menu-dropdown-section">
              <span className="menu-section-label">Tiện ích</span>
              <div className="menu-list-items">
                <button
                  type="button"
                  className="menu-list-item-btn"
                  onClick={() => {
                    setIsSearchOpen(true)
                    setIsMenuOpen(false)
                  }}
                >
                  <Search size={15} style={{ color: '#f59e0b' }} />
                  <span>Tìm kiếm kỷ niệm...</span>
                </button>

                <button
                  type="button"
                  className="menu-list-item-btn"
                  onClick={() => {
                    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                    if (soundEnabled) playPaperTurnSound()
                  }}
                >
                  <ArrowUpDown size={15} style={{ color: '#f59e0b' }} />
                  <span>Thứ tự: {sortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}</span>
                </button>

                <button
                  type="button"
                  className="menu-list-item-btn"
                  onClick={() => setSoundEnabled((prev) => !prev)}
                >
                  {soundEnabled ? (
                    <Volume2 size={15} style={{ color: '#10b981' }} />
                  ) : (
                    <VolumeX size={15} style={{ color: '#94a3b8' }} />
                  )}
                  <span>Âm thanh lật giấy: {soundEnabled ? 'Đang bật' : 'Đã tắt'}</span>
                </button>

                {yearlyGroups.length > 1 && (
                  <div style={{ marginTop: 4 }}>
                    <span className="menu-section-label" style={{ display: 'block', marginBottom: 6 }}>
                      Chọn năm
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {yearlyGroups.map((g) => (
                        <button
                          key={g.year}
                          type="button"
                          className={`menu-option-btn ${g.year === selectedYear ? 'active' : ''}`}
                          style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                          onClick={() => {
                            setSelectedYear(g.year)
                            if (soundEnabled) playPaperTurnSound()
                            setIsMenuOpen(false)
                          }}
                        >
                          {g.year} ({g.events.length})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CẢNH BÁO XOAY NGANG ĐIỆN THOẠI */}
      {showRotateGuide && (
        <div className="rotate-phone-notice">
          <Smartphone size={20} className="phone-rotate-icon" style={{ color: '#f59e0b' }} />
          <span>📱 Hãy xoay ngang điện thoại để đọc sách 2 trang tốt nhất ✨</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
       * VIEW 1: CÂY KỶ NIỆM 3D (HOA ANH ĐÀO PLAY TOGETHER)
       * ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'tree' && (
        <div className="tree-explorer-stage">
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

          <div className="tree-canvas-wrapper">
            <Interactive3DTreeCanvas
              year={selectedYear}
              events={activeYearEvents}
              theme={activeYearTheme}
              onOpenBook={() => {
                if (soundEnabled) playPaperTurnSound()
                setViewMode('book')
              }}
              onOpenFlower2D={(m) => {
                setSelectedFlowerMonth(m)
              }}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
       * VIEW 2: ĐỌC SÁCH 3D (CHẾ ĐỘ 2 TRANG & 1 TRANG)
       * ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'book' && (
        <div
          className="memory-book-stage"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          <button
            type="button"
            className={`book-turn-arrow prev ${(layoutMode === 'spread' ? currentSpread === 0 : currentPage === 0) || turningState ? 'disabled' : ''}`}
            onClick={goPrevPage}
            disabled={(layoutMode === 'spread' ? currentSpread === 0 : currentPage === 0) || !!turningState}
            title="Lật về trang trước"
          >
            <ChevronLeft size={24} />
          </button>

          {layoutMode === 'spread' ? (
            <div ref={chassisRef} className="book-3d-chassis-spread">
              <div className="book-spread-hardcover" />
              <div className="book-spread-paper-stack-left" />
              <div className="book-spread-paper-stack-right" />
              <div className="book-spine-center-gutter" />

              <GoldenButterflies />

              <div className="book-spread-side left-side">
                {turningState?.direction === 'prev' && prevSpread
                  ? renderSpreadSide(prevSpread.left, 'left')
                  : renderSpreadSide(activeSpread.left, 'left')}
              </div>

              <div className="book-spread-side right-side">
                {turningState?.direction === 'next' && nextSpread
                  ? renderSpreadSide(nextSpread.right, 'right')
                  : renderSpreadSide(activeSpread.right, 'right')}
              </div>

              {turningState?.direction === 'next' && nextSpread && (
                <div
                  className="spread-flipping-leaf flip-forward"
                  style={{
                    transform: `perspective(2400px) rotateY(${-turningState.progress * 180}deg) translateZ(${Math.sin(turningState.progress * Math.PI) * 36}px) rotateZ(${Math.sin(turningState.progress * Math.PI) * -1.5}deg) skewY(${Math.sin(turningState.progress * Math.PI) * (turningState.progress < 0.5 ? -2.5 : 2.5)}deg)`,
                    transformOrigin: '0% 50%',
                    left: '50%',
                  }}
                >
                  <div className="leaf-face leaf-face-front">
                    {renderSpreadSide(activeSpread.right, 'right')}
                    <div
                      className="dynamic-curl-shadow"
                      style={{
                        opacity: Math.sin(turningState.progress * Math.PI) * 0.8,
                        background: `linear-gradient(${90 + (turningState.progress - 0.5) * 20}deg, rgba(0,0,0,0.4) 0%, rgba(255,255,255,0.18) 40%, rgba(0,0,0,0.5) 100%)`,
                      }}
                    />
                  </div>
                  <div className="leaf-face leaf-face-back">
                    {renderSpreadSide(nextSpread.left, 'left')}
                    <div
                      className="dynamic-curl-shadow"
                      style={{
                        opacity: Math.sin(turningState.progress * Math.PI) * 0.8,
                        background: `linear-gradient(${90 + (turningState.progress - 0.5) * 20}deg, rgba(0,0,0,0.4) 0%, rgba(255,255,255,0.18) 40%, rgba(0,0,0,0.5) 100%)`,
                      }}
                    />
                  </div>
                </div>
              )}

              {turningState?.direction === 'prev' && prevSpread && (
                <div
                  className="spread-flipping-leaf flip-backward"
                  style={{
                    transform: `perspective(2400px) rotateY(${turningState.progress * 180}deg) translateZ(${Math.sin(turningState.progress * Math.PI) * 36}px) rotateZ(${Math.sin(turningState.progress * Math.PI) * 1.5}deg) skewY(${Math.sin(turningState.progress * Math.PI) * (turningState.progress < 0.5 ? 2.5 : -2.5)}deg)`,
                    transformOrigin: '100% 50%',
                    left: 0,
                  }}
                >
                  <div className="leaf-face leaf-face-front">
                    {renderSpreadSide(activeSpread.left, 'left')}
                    <div
                      className="dynamic-curl-shadow"
                      style={{
                        opacity: Math.sin(turningState.progress * Math.PI) * 0.8,
                        background: `linear-gradient(${90 - (turningState.progress - 0.5) * 20}deg, rgba(0,0,0,0.5) 0%, rgba(255,255,255,0.18) 60%, rgba(0,0,0,0.4) 100%)`,
                      }}
                    />
                  </div>
                  <div className="leaf-face leaf-face-back">
                    {renderSpreadSide(prevSpread.right, 'right')}
                    <div
                      className="dynamic-curl-shadow"
                      style={{
                        opacity: Math.sin(turningState.progress * Math.PI) * 0.8,
                        background: `linear-gradient(${90 - (turningState.progress - 0.5) * 20}deg, rgba(0,0,0,0.5) 0%, rgba(255,255,255,0.18) 60%, rgba(0,0,0,0.4) 100%)`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div ref={chassisRef} className="book-3d-chassis">
              <div className="book-spine-3d" />
              <div className="book-hardcover-shadow" />
              <div
                className="book-page-layer active-layer"
                style={
                  turningState
                    ? {
                        transform:
                          turningState.direction === 'next'
                            ? `perspective(1600px) rotateY(${-turningState.progress * 65}deg) translateX(${-turningState.progress * 30}%)`
                            : `perspective(1600px) rotateY(${(1 - turningState.progress) * 65}deg) translateX(${(1 - turningState.progress) * 30}%)`,
                        opacity:
                          turningState.direction === 'next'
                            ? 1 - turningState.progress * 0.35
                            : 0.65 + turningState.progress * 0.35,
                        transformOrigin: '0% 50%',
                        willChange: 'transform, opacity',
                      }
                    : undefined
                }
              >
                {currentPage === 0
                  ? renderSpreadSide({ type: 'cover-main' }, 'right')
                  : currentPage === totalSinglePages - 1
                  ? renderSpreadSide({ type: 'back-cover' }, 'right')
                  : renderSpreadSide({ type: 'day-single', day: dayPages[currentPage - 1], images: dayPages[currentPage - 1]?.allImages }, 'right')}
              </div>
            </div>
          )}

          <button
            type="button"
            className={`book-turn-arrow next ${(layoutMode === 'spread' ? currentSpread >= totalSpreads - 1 : currentPage >= totalSinglePages - 1) || turningState ? 'disabled' : ''}`}
            onClick={goNextPage}
            disabled={(layoutMode === 'spread' ? currentSpread >= totalSpreads - 1 : currentPage >= totalSinglePages - 1) || !!turningState}
            title="Lật sang trang tiếp theo"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
       * VIEW 3: CHẾ ĐỘ 12 THÁNG NỞ HOA
       * ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'month' && (
        <div className="month-view-container">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#78350f', margin: 0 }}>
              🌸 Vườn Hoa 12 Tháng · Năm {selectedYear}
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
              Chạm vào từng tháng để xem chi tiết đóa hoa 2D rực rỡ và các kỷ niệm
            </p>
          </div>

          <div className="month-view-grid">
            {Array.from({ length: 12 }).map((_, i) => {
              const mNum = i + 1
              const monthDays = dayPages.filter((p) => parseInt(p.monthNum, 10) === mNum)
              const count = monthDays.reduce((acc, cur) => acc + cur.events.length, 0)
              const firstImg = monthDays.find((p) => p.allImages.length > 0)?.allImages[0]

              return (
                <div
                  key={mNum}
                  className="month-card"
                  onClick={() => setSelectedFlowerMonth(mNum)}
                >
                  <div className="month-card-header">
                    <div className="month-badge-pill">
                      <span>🌸 Tháng {mNum}</span>
                    </div>
                    <span className="month-card-count">
                      {count > 0 ? `${count} kỷ niệm` : 'Chưa có'}
                    </span>
                  </div>

                  {firstImg ? (
                    <SafeMediaImage src={firstImg} alt="" className="month-card-preview-thumb" />
                  ) : (
                    <div className="month-card-empty">
                      <span>Chưa có hình ảnh</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>
                      {monthDays.length} ngày ghi nhớ
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 800 }}>
                      Xem hoa 2D →
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
       * VIEW 4: CHẾ ĐỘ DANH SÁCH (TIMELINE FEED)
       * ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'list' && (
        <div className="list-view-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#78350f', margin: 0 }}>
              Dòng Thời Gian Kỷ Niệm ({dayPages.length} ngày)
            </h2>
            <button
              type="button"
              className="memory-book-circle-btn"
              onClick={() => setSortOrder((o) => o === 'desc' ? 'asc' : 'desc')}
              title="Đảo thứ tự"
            >
              <ArrowUpDown size={15} />
            </button>
          </div>

          <div className="list-view-feed">
            {dayPages.map((day) => (
              <div key={day.dateStr} className="list-day-card">
                <div className="spread-day-header-clean" style={{ padding: '0 0 10px', background: 'transparent' }}>
                  <div className="spread-date-title">
                    <span className="spread-date-daynum">{day.dayNum}</span>
                    <span className="spread-date-monthyear">THG {day.monthNum} · {day.yearNum}</span>
                    <span className="spread-date-weekday">({day.weekdayStr})</span>
                  </div>
                  <button
                    type="button"
                    className="book-mode-btn active"
                    onClick={() => jumpToDay(day.dateStr)}
                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                  >
                    <BookOpen size={12} />
                    <span>Xem ở Sách</span>
                  </button>
                </div>

                {day.events.map((ev, eIdx) => (
                  <div key={ev.id || eIdx} style={{ marginTop: 8 }}>
                    <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                      {ev.title || 'Kỷ niệm'}
                    </h4>
                    {ev.note && (
                      <p style={{ fontSize: '0.84rem', color: '#475569', fontStyle: 'italic', margin: '4px 0' }}>
                        "{ev.note}"
                      </p>
                    )}
                  </div>
                ))}

                {day.allImages.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0 4px' }}>
                    {day.allImages.map((img, iIdx) => (
                      <div
                        key={iIdx}
                        className="polaroid-frame"
                        style={{ width: 110, padding: '4px 4px 14px 4px', flexShrink: 0 }}
                        onClick={() => openGallery(day.allImages, iIdx)}
                      >
                        <SafeMediaImage src={img} alt="" style={{ width: '100%', height: 80, objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
       * VIEW 5: VÒNG XOAY KÝ ỨC 3D (ĐÔI CHIBI NẮM TAY & 12 THÁNG)
       * ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'wheel' && (
        <div style={{ position: 'relative', width: '100%', height: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {yearlyGroups.length > 1 && (
            <div className="tree-year-switcher" style={{ zIndex: 30 }}>
              {yearlyGroups.map((g) => {
                const isActive = g.year === selectedYear
                return (
                  <button
                    key={g.year}
                    type="button"
                    className={`tree-year-pill ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      if (soundEnabled) playPaperTurnSound()
                      setSelectedYear(g.year)
                    }}
                  >
                    <span>🌌</span>
                    <span>Năm {g.year}</span>
                    <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>({g.events.length})</span>
                  </button>
                )
              })}
            </div>
          )}

          <GalaxyWheel3DMemoryView
            year={selectedYear}
            events={events}
            onYearChange={(y) => setSelectedYear(y)}
            onOpenPhotoLightbox={(imgs, idx) => {
              openGallery(imgs, idx)
            }}
            onSelectEvent={(ev) => {
              if (ev.event_date) {
                jumpToDay(ev.event_date)
              }
            }}
          />
        </div>
      )}

      {/* MODAL CHI TIẾT HOA 2D */}
      {selectedFlowerMonth !== null && (
        <Flower2DDetailModal
          month={selectedFlowerMonth}
          year={selectedYear}
          events={activeYearEvents.filter((e) => {
            if (!e.event_date) return false
            return parseInt(e.event_date.slice(5, 7), 10) === selectedFlowerMonth
          })}
          onClose={() => setSelectedFlowerMonth(null)}
          onOpenInBook={(dStr) => {
            if (dStr) {
              jumpToDay(dStr)
            } else {
              setViewMode('book')
            }
          }}
        />
      )}

      {/* Modal tìm kiếm nhanh */}
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
              <div className="search-months-filter" style={{ padding: '8px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
                <button
                  type="button"
                  className={`month-chip ${selectedMonthFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedMonthFilter('all')}
                >
                  Tất cả ({dayPages.length})
                </button>
                {availableMonths.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`month-chip ${selectedMonthFilter === m ? 'active' : ''}`}
                    onClick={() => setSelectedMonthFilter(m)}
                  >
                    Tháng {m}
                  </button>
                ))}
              </div>
            )}

            <div className="search-results-list">
              {dayPages
                .filter((p) => {
                  if (selectedMonthFilter !== 'all' && `${p.monthNum}/${p.yearNum}` !== selectedMonthFilter) return false
                  if (!searchQuery) return true
                  return p.dateStr.includes(searchQuery) || p.events.some((e) => e.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                })
                .map((p) => (
                  <div key={p.dateStr} className="search-result-item" onClick={() => jumpToDay(p.dateStr)}>
                    <div className="result-date-badge">
                      <span className="r-day">{p.dayNum}</span>
                      <span className="r-m">{p.monthNum}/{p.yearNum}</span>
                    </div>
                    <div className="result-info">
                      <div className="result-titles">
                        {p.events.map((e, idx) => (
                          <span key={idx} className="result-title-pill">{e.title || 'Kỷ niệm'}</span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={16} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox xem ảnh phóng to mượt mà có animation mở dần và thu nhỏ khi tắt */}
      {activeGallery && currentPhoto && (
        <div
          className={`scrapbook-photo-modal ${isClosingGallery ? 'closing' : 'opening'}`}
          onClick={closeGallery}
        >
          <div
            className={`scrapbook-photo-popup ${isClosingGallery ? 'closing' : 'opening'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="popup-top-controls">
              <div className="popup-counter">
                🖼️ {activeGallery.currentIndex + 1} / {activeGallery.images.length}
                {activeGallery.date && <span style={{ opacity: 0.85, marginLeft: 6, fontWeight: 500 }}>· {activeGallery.date}</span>}
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
                  onClick={closeGallery}
                  title="Đóng (Esc)"
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
                  onClick={() =>
                    setActiveGallery((g) =>
                      g ? { ...g, currentIndex: (g.currentIndex - 1 + g.images.length) % g.images.length } : null
                    )
                  }
                  title="Ảnh trước"
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              <div className="popup-media-container">
                {currentIsVid ? (
                  <video src={currentPhoto} poster={getVideoPosterUrl(currentPhoto)} controls autoPlay playsInline />
                ) : (
                  <SafeMediaImage src={currentPhoto} alt="" />
                )}
              </div>

              {activeGallery.images.length > 1 && (
                <button
                  type="button"
                  className="popup-nav-btn next"
                  onClick={() =>
                    setActiveGallery((g) =>
                      g ? { ...g, currentIndex: (g.currentIndex + 1) % g.images.length } : null
                    )
                  }
                  title="Ảnh tiếp theo"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
