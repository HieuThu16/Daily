import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, Clock,
  Play, Sparkles, X, Heart, BookOpen, Columns2,
  ArrowUpDown, Search, Volume2, VolumeX, Calendar,
  Download, TreePine, RotateCcw
} from 'lucide-react'
import type { SharedEvent } from '../../types'
import { getVideoPosterUrl, SafeMediaImage } from './SharedEventsView'
import { getSeasonTheme } from './YearlyMemoryBook'
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

export type LayoutMode = 'spread' | 'single'

export interface SpreadSideContent {
  type: 'cover-intro' | 'cover-main' | 'day-primary' | 'day-secondary' | 'day-single' | 'back-summary' | 'back-cover' | 'blank'
  day?: BookDayPage
  events?: SharedEvent[]
  images?: string[]
  pageNumber?: number
  totalDays?: number
  totalMemories?: number
  totalPhotos?: number
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

/**
 * ═══════════════════════════════════════════════════════════════════
 * BƯỚM VÀNG PHÁT SÁNG BAY LƯỢN TỪ TRANG SÁCH (TOAN.VN / SÁCH HUYỀN ẢO)
 * ═══════════════════════════════════════════════════════════════════
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

  // Chế độ xem: 'tree' (Cây 3D xoay 360 độ) | 'book' (Quyển sách 3D lật trang)
  const [viewMode, setViewMode] = useState<'tree' | 'book'>('tree')

  // Chế độ lật trang sách: 'spread' (Sách mở 2 bên nằm ngang) | 'single' (Trang đơn)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640 || window.innerWidth > window.innerHeight ? 'spread' : 'spread'
    }
    return 'spread'
  })

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

  // ═══════════════════════════════════════════════════════════════════
  // 4. XÂY DỰNG CÁC CẶP TRANG SÁCH MỞ 2 BÊN (TWO-PAGE SPREADS)
  // "Có ảnh 2 bên luôn nha": Đảm bảo cả trang Trái và trang Phải đều có ảnh!
  // ═══════════════════════════════════════════════════════════════════
  const spreads: SpreadItem[] = useMemo(() => {
    const list: SpreadItem[] = []

    // 4.1. SPREAD 0: Bìa mở đầu
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

    // 4.2. SPREADS KỶ NIỆM: Cả 2 bên đều có ảnh!
    let dayIdx = 0
    let pageNum = 1

    while (dayIdx < dayPages.length) {
      const day = dayPages[dayIdx]

      // Trường hợp ngày có từ 2 ảnh trở lên: chiếm trọn 1 Spread (Trang Trái: ảnh chính; Trang Phải: các ảnh phụ + note)
      if (day.allImages.length >= 2) {
        list.push({
          id: `spread-day-${day.dateStr}`,
          spreadIndex: list.length,
          left: {
            type: 'day-primary',
            day,
            images: [day.allImages[0]],
            pageNumber: pageNum++,
          },
          right: {
            type: 'day-secondary',
            day,
            images: day.allImages.slice(1),
            pageNumber: pageNum++,
          },
        })
        dayIdx++
      } else {
        // Ngày có 0 hoặc 1 ảnh: ghép Ngày A (Trang Trái) và Ngày B (Trang Phải)
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

    // 4.3. SPREAD CUỐI: Kết cuốn sổ
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

  // Chỉ số Spread hiện tại (trong chế độ 2 bên)
  const [currentSpread, setCurrentSpread] = useState<number>(0)
  const totalSpreads = spreads.length

  // Chỉ số Page đơn (trong chế độ 1 bên)
  const totalSinglePages = dayPages.length + 2
  const [currentPage, setCurrentPage] = useState<number>(0)

  // ═══════════════════════════════════════════════════════════════════
  // 5. ANIMATION THEO NGÓN TAY LẬT SÁCH THỜI GIAN THỰC (TOUCH/POINTER ENGINE)
  // ═══════════════════════════════════════════════════════════════════
  const chassisRef = useRef<HTMLDivElement | null>(null)
  const [dragState, setDragState] = useState<{
    isDragging: boolean
    direction: 'next' | 'prev' | null
    startX: number
    currentX: number
    ratio: number // 0 to 1
    animating?: boolean
  } | null>(null)

  // 6. Xem ảnh phóng to pop-up (Lightbox)
  const [activeGallery, setActiveGallery] = useState<{
    images: string[]
    currentIndex: number
    title?: string
    note?: string
    date?: string
  } | null>(null)

  // Lật tới spread tiếp theo
  const goNextSpread = useCallback(() => {
    if (currentSpread >= totalSpreads - 1 || dragState?.animating) return
    if (soundEnabled) playPaperTurnSound()
    setDragState({
      isDragging: false,
      direction: 'next',
      startX: 0,
      currentX: 0,
      ratio: 0,
      animating: true,
    })
    // Kích hoạt transition lật trang sang -180deg
    requestAnimationFrame(() => {
      setDragState((prev) => prev ? { ...prev, ratio: 1 } : null)
      setTimeout(() => {
        setCurrentSpread((s) => Math.min(s + 1, totalSpreads - 1))
        setDragState(null)
      }, 320)
    })
  }, [currentSpread, totalSpreads, dragState, soundEnabled])

  // Lật lùi spread trước
  const goPrevSpread = useCallback(() => {
    if (currentSpread <= 0 || dragState?.animating) return
    if (soundEnabled) playPaperTurnSound()
    setDragState({
      isDragging: false,
      direction: 'prev',
      startX: 0,
      currentX: 0,
      ratio: 0,
      animating: true,
    })
    requestAnimationFrame(() => {
      setDragState((prev) => prev ? { ...prev, ratio: 1 } : null)
      setTimeout(() => {
        setCurrentSpread((s) => Math.max(s - 1, 0))
        setDragState(null)
      }, 320)
    })
  }, [currentSpread, dragState, soundEnabled])

  // Điều hướng trang đơn
  const goNextPage = useCallback(() => {
    if (layoutMode === 'spread') {
      goNextSpread()
    } else {
      if (currentPage >= totalSinglePages - 1) return
      if (soundEnabled) playPaperTurnSound()
      setCurrentPage((p) => Math.min(p + 1, totalSinglePages - 1))
    }
  }, [layoutMode, goNextSpread, currentPage, totalSinglePages, soundEnabled])

  const goPrevPage = useCallback(() => {
    if (layoutMode === 'spread') {
      goPrevSpread()
    } else {
      if (currentPage <= 0) return
      if (soundEnabled) playPaperTurnSound()
      setCurrentPage((p) => Math.max(p - 1, 0))
    }
  }, [layoutMode, goPrevSpread, currentPage, soundEnabled])

  // Nhảy trực tiếp tới ngày
  const jumpToDay = useCallback((dateStr: string) => {
    const sIdx = spreads.findIndex(
      (s) => s.left.day?.dateStr === dateStr || s.right.day?.dateStr === dateStr
    )
    if (sIdx >= 0) {
      if (soundEnabled) playPaperTurnSound()
      setCurrentSpread(sIdx)
    }
    const pIdx = dayPages.findIndex((d) => d.dateStr === dateStr)
    if (pIdx >= 0) {
      setCurrentPage(pIdx + 1)
    }
    setIsSearchOpen(false)
  }, [spreads, dayPages, soundEnabled])

  // Xử lý sự kiện kéo vuốt bằng ngón tay trên màn hình cảm ứng & chuột
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button, input, a, .polaroid-hero-frame, .polaroid-frame, .search-input-field')) return

    const rect = chassisRef.current?.getBoundingClientRect()
    if (!rect) return

    const clickX = e.clientX - rect.left
    const isRightHalf = clickX >= rect.width * 0.45
    const isLeftHalf = clickX < rect.width * 0.55

    if (isRightHalf && currentSpread < totalSpreads - 1) {
      setDragState({
        isDragging: false,
        direction: 'next',
        startX: e.clientX,
        currentX: e.clientX,
        ratio: 0,
      })
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
    } else if (isLeftHalf && currentSpread > 0) {
      setDragState({
        isDragging: false,
        direction: 'prev',
        startX: e.clientX,
        currentX: e.clientX,
        ratio: 0,
      })
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || dragState.animating) return
    const rect = chassisRef.current?.getBoundingClientRect()
    if (!rect) return

    const halfW = (rect.width * 0.5) || 320
    let diff = 0
    if (dragState.direction === 'next') {
      diff = dragState.startX - e.clientX
    } else if (dragState.direction === 'prev') {
      diff = e.clientX - dragState.startX
    }

    if (diff > 8 || dragState.isDragging) {
      const ratio = Math.max(0, Math.min(1, diff / halfW))
      setDragState({
        ...dragState,
        isDragging: true,
        currentX: e.clientX,
        ratio,
      })
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState || dragState.animating) return
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}

    if (dragState.isDragging) {
      const shouldFlip = dragState.ratio >= 0.22
      setDragState({ ...dragState, animating: true, ratio: shouldFlip ? 1 : 0 })

      if (shouldFlip && soundEnabled) {
        playPaperTurnSound()
      }

      setTimeout(() => {
        if (shouldFlip) {
          if (dragState.direction === 'next') {
            setCurrentSpread((s) => Math.min(s + 1, totalSpreads - 1))
          } else if (dragState.direction === 'prev') {
            setCurrentSpread((s) => Math.max(s - 1, 0))
          }
        }
        setDragState(null)
      }, 280)
    } else {
      // Tap nhanh để lật
      const rect = chassisRef.current?.getBoundingClientRect()
      if (rect) {
        const clickX = e.clientX - rect.left
        if (clickX > rect.width * 0.6) {
          goNextSpread()
        } else if (clickX < rect.width * 0.4) {
          goPrevSpread()
        }
      }
      setDragState(null)
    }
  }

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
  }, [goNextPage, goPrevPage, activeGallery, isSearchOpen, viewMode, onClose])

  // Đảo thứ tự sắp xếp thời gian
  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    setCurrentSpread(0)
    setCurrentPage(0)
    if (soundEnabled) playPaperTurnSound()
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. RENDER NỘI DUNG TỪNG NỬA TRANG TRONG SPREAD (LEFT & RIGHT)
  // ═══════════════════════════════════════════════════════════════════
  const renderSpreadSide = (content: SpreadSideContent, side: 'left' | 'right') => {
    // 6.1. Trang Lót Mở Đầu (Cover Intro — Bên Trái)
    if (content.type === 'cover-intro') {
      return (
        <div className="spread-page-content" style={{ justifyContent: 'center', textAlign: 'center', padding: '24px 28px' }}>
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

          {/* Ảnh kỷ niệm tiêu biểu thu nhỏ */}
          {content.images && content.images.length > 0 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '8px auto' }}>
              {content.images.slice(0, 3).map((img, idx) => (
                <div
                  key={idx}
                  className="polaroid-frame"
                  style={{ width: 68, padding: '4px 4px 10px 4px', transform: `rotate(${idx === 1 ? 0 : idx === 0 ? -3 : 3}deg)` }}
                  onClick={() => setActiveGallery({ images: content.images || [], currentIndex: idx })}
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

    // 6.2. Trang Bìa Chính (Cover Main — Bên Phải)
    if (content.type === 'cover-main') {
      return (
        <div className="spread-page-content" style={{ justifyContent: 'center', textAlign: 'center', padding: '24px 28px' }}>
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
              onClick={goNextSpread}
            >
              <span>Mở lật trang sách</span>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className={`spread-page-number ${side}`}>II</div>
        </div>
      )
    }

    // 6.3. Trang Kết Sổ (Back Summary — Bên Trái)
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

    // 6.4. Trang Bìa Sau (Back Cover — Bên Phải)
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

    // 6.5. Trang Kỷ Niệm (Day Primary / Day Secondary / Day Single)
    const day = content.day
    if (!day) return <div className="spread-page-content" />

    const firstEvent = day.events[0]
    const heroImage = content.images && content.images[0]

    return (
      <div style={{ height: '100%', position: 'relative' }}>
        {/* Header ngày tinh tế, không rườm rà */}
        <div className="spread-day-header-clean">
          <div className="spread-date-title">
            <span className="spread-date-daynum">{day.dayNum}</span>
            <span className="spread-date-monthyear">THG {day.monthNum} · {day.yearNum}</span>
            <span className="spread-date-weekday">({day.weekdayStr})</span>
          </div>

          {firstEvent?.is_favorite && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#e11d48', fontSize: '0.72rem', fontWeight: 800 }}>
              <Heart size={13} fill="#e11d48" /> Yêu thích
            </span>
          )}
        </div>

        {/* Nội dung trang: Ảnh Polaroid & Ghi chú */}
        <div className="spread-page-content">
          {/* Tiêu đề kỷ niệm */}
          {firstEvent?.title && (
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

          {/* Ảnh Polaroid sắc nét dán băng dính hoa anh đào */}
          {heroImage && (
            <div
              className="polaroid-hero-frame"
              onClick={() =>
                setActiveGallery({
                  images: content.images || [heroImage],
                  currentIndex: 0,
                  title: firstEvent?.title,
                  note: firstEvent?.note || undefined,
                  date: `${day.dayNum}/${day.monthNum}/${day.yearNum}`,
                })
              }
              title="Chạm để mở ảnh to"
            >
              <div className="washi-tape-sakura" />
              {isVideo(heroImage) ? (
                <div style={{ position: 'relative' }}>
                  <video src={heroImage} poster={getVideoPosterUrl(heroImage)} playsInline muted style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.25)' }}>
                    <Play size={24} fill="#ffffff" color="#ffffff" />
                  </div>
                </div>
              ) : (
                <SafeMediaImage src={heroImage} alt="" className="polaroid-hero-photo" />
              )}
              {firstEvent?.title && (
                <div className="polaroid-hero-caption">
                  {firstEvent.title}
                </div>
              )}
            </div>
          )}

          {/* Các ảnh phụ Polaroid (nếu là trang secondary) */}
          {content.images && content.images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {content.images.slice(1).map((imgUrl, imgIdx) => (
                <div
                  key={imgIdx}
                  className="polaroid-frame"
                  style={{ width: '45%', minWidth: 100, padding: '5px 5px 12px 5px', transform: `rotate(${imgIdx % 2 === 0 ? -1.5 : 1.5}deg)` }}
                  onClick={() =>
                    setActiveGallery({
                      images: content.images || [],
                      currentIndex: imgIdx + 1,
                      title: firstEvent?.title,
                      date: `${day.dayNum}/${day.monthNum}/${day.yearNum}`,
                    })
                  }
                >
                  <SafeMediaImage src={imgUrl} alt="" style={{ width: '100%', height: 75, objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}

          {/* Ghi chú viết tay ấm áp */}
          {firstEvent?.note && (
            <div className="spread-handwritten-box">
              <p className="spread-handwritten-text">{firstEvent.note}</p>
            </div>
          )}

          {/* Nếu không có ảnh: Hiển thị thiệp lưu niệm thanh lịch */}
          {!heroImage && !firstEvent?.note && (
            <div className="scrapbook-empty-memo" style={{ margin: '20px auto', maxWidth: 260 }}>
              <div className="empty-memo-tape" />
              <div className="empty-memo-inner">
                <Sparkles size={18} style={{ color: activeYearTheme.accent }} />
                <span className="empty-memo-tag">Dấu ấn kỷ niệm</span>
                <p className="empty-memo-text">
                  Một ngày bình yên được lưu giữ trọn vẹn trong cuốn sổ.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Chỉ số trang */}
        {content.pageNumber && (
          <div className={`spread-page-number ${side}`}>
            {content.pageNumber}
          </div>
        )}
      </div>
    )
  }

  // Active photo trong gallery lightbox
  const currentPhoto = activeGallery
    ? activeGallery.images[activeGallery.currentIndex]
    : null
  const currentIsVid = currentPhoto ? isVideo(currentPhoto) : false

  const activeSpread = spreads[currentSpread] || spreads[0]
  const nextSpread = spreads[currentSpread + 1]
  const prevSpread = spreads[currentSpread - 1]

  return (
    <div className={`memory-book-fullscreen ${layoutMode === 'spread' ? 'spread-mode' : ''}`}>
      {/* ── TOP BAR (TỐI GIẢN, TRANG NHÃ, KHÔNG RƯỜM RÀ) ── */}
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
              <ChevronLeft size={16} />
              <span>Cây 3D</span>
            </button>
          ) : (
            <button
              type="button"
              className="memory-book-back-btn"
              onClick={onClose}
              title="Đóng"
            >
              <ArrowLeft size={16} />
              <span>Đóng</span>
            </button>
          )}
        </div>

        {/* Nhóm nút chuyển chế độ 2 bên / 1 bên & chỉ số trang */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {viewMode === 'book' && (
            <div className="book-mode-toggle-group">
              <button
                type="button"
                className={`book-mode-btn ${layoutMode === 'spread' ? 'active' : ''}`}
                onClick={() => {
                  if (soundEnabled) playPaperTurnSound()
                  setLayoutMode('spread')
                }}
                title="Sách mở 2 bên (Trang trái & Trang phải)"
              >
                <Columns2 size={13} />
                <span>Sách 2 bên</span>
              </button>
              <button
                type="button"
                className={`book-mode-btn ${layoutMode === 'single' ? 'active' : ''}`}
                onClick={() => {
                  if (soundEnabled) playPaperTurnSound()
                  setLayoutMode('single')
                }}
                title="Trang đơn"
              >
                <BookOpen size={13} />
                <span>1 trang</span>
              </button>
            </div>
          )}

          <div className="memory-book-page-indicator">
            {viewMode === 'tree' ? (
              <>
                <TreePine size={14} style={{ color: activeYearTheme.accent, flexShrink: 0 }} />
                <span className="indicator-title">
                  Năm {selectedYear} {personName ? `· ${personName}` : ''}
                </span>
              </>
            ) : (
              <>
                <BookOpen size={13} style={{ color: activeYearTheme.accent, flexShrink: 0 }} />
                <span className="indicator-title">
                  {layoutMode === 'spread'
                    ? `Năm ${selectedYear} · ${currentSpread + 1}/${totalSpreads}`
                    : `Năm ${selectedYear} · Trang ${currentPage}/${dayPages.length}`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="memory-book-top-actions">
          {/* Nút Đảo chiều sắp xếp */}
          {viewMode === 'book' && (
            <button
              type="button"
              className={`memory-book-circle-btn ${sortOrder === 'desc' ? 'active' : ''}`}
              onClick={toggleSortOrder}
              title={sortOrder === 'desc' ? 'Đang xếp Mới → Cũ (Chạm để đảo)' : 'Đang xếp Cũ → Mới (Chạm để đảo)'}
            >
              <ArrowUpDown size={15} />
            </button>
          )}

          {/* Nút Tìm kiếm nhanh */}
          {viewMode === 'book' && (
            <button
              type="button"
              className={`memory-book-circle-btn ${isSearchOpen ? 'active' : ''}`}
              onClick={() => setIsSearchOpen((v) => !v)}
              title="Tìm kiếm kỷ niệm"
            >
              <Search size={15} />
            </button>
          )}

          {/* Âm thanh lật giấy */}
          <button
            type="button"
            className="memory-book-circle-btn"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Tắt âm thanh lật trang' : 'Bật âm thanh lật trang'}
          >
            {soundEnabled ? <Volume2 size={15} style={{ color: '#d97706' }} /> : <VolumeX size={15} style={{ opacity: 0.5 }} />}
          </button>

          {/* Đóng */}
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

      {/* ══════════════════════════════════════════════════════════════
       * VIEW 1: CÂY KỶ NIỆM 3D (HOA ANH ĐÀO PLAY TOGETHER BỒNG BỀNH)
       * ══════════════════════════════════════════════════════════════ */}
      {viewMode === 'tree' ? (
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
                      setCurrentSpread(0)
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

          {/* Canvas Cây 3D Three.js */}
          <div className="tree-canvas-wrapper">
            <Interactive3DTreeCanvas
              year={selectedYear}
              events={activeYearEvents}
              theme={activeYearTheme}
              onOpenBook={() => {
                if (soundEnabled) playPaperTurnSound()
                setCurrentSpread(0)
                setCurrentPage(0)
                setViewMode('book')
              }}
              onSelectMonth={(m) => {
                const targetIdx = dayPages.findIndex((p) => parseInt(p.monthNum, 10) === m)
                if (targetIdx >= 0) {
                  jumpToDay(dayPages[targetIdx].dateStr)
                } else {
                  setCurrentSpread(0)
                  setCurrentPage(0)
                }
                if (soundEnabled) playPaperTurnSound()
                setViewMode('book')
              }}
            />
          </div>

          {/* Thẻ mở sách */}
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
              <span>🖼️ {activeYearMediaCount} ảnh</span>
              <span>·</span>
              <span>✨ 12 tháng nở hoa</span>
            </div>

            <button
              type="button"
              className="tree-open-book-btn"
              onClick={() => {
                if (soundEnabled) playPaperTurnSound()
                setCurrentSpread(0)
                setCurrentPage(0)
                setViewMode('book')
              }}
            >
              <BookOpen size={18} />
              <span>Mở Cuốn Sách Năm {selectedYear} (Lật Trang 3D) →</span>
            </button>
            <div className="tree-pedestal-hint">
              ✨ Vuốt xoay 360° cây hoa · Chạm hoa 12 tháng để mở nhanh
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
         * VIEW 2: CUỐN SÁCH 3D (CHẾ ĐỘ MỞ 2 BÊN VÀ LẬT THEO NGÓN TAY)
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
                    searchResults.map((p) => (
                      <div
                        key={p.dateStr}
                        className="search-result-item"
                        onClick={() => jumpToDay(p.dateStr)}
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
                          <span>Mở ngày này</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3D BOOK STAGE VỚI SÁCH MỞ 2 BÊN */}
          <div
            className="memory-book-stage"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
          >
            {/* Nút lật trang ngoài lề */}
            <button
              type="button"
              className={`book-turn-arrow prev ${(layoutMode === 'spread' ? currentSpread === 0 : currentPage === 0) || dragState?.animating ? 'disabled' : ''}`}
              onClick={goPrevPage}
              disabled={(layoutMode === 'spread' ? currentSpread === 0 : currentPage === 0) || dragState?.animating}
              title="Lật về trang trước"
              aria-label="Trang trước"
            >
              <ChevronLeft size={24} />
            </button>

            {/* CHẾ ĐỘ 1: SÁCH MỞ 2 BÊN TRẢI RỘNG (TWO-PAGE SPREAD) */}
            {layoutMode === 'spread' ? (
              <div ref={chassisRef} className="book-3d-chassis-spread">
                {/* Bìa cứng nằm ngang dưới đáy sách */}
                <div className="book-spread-hardcover" />
                <div className="book-spread-paper-stack-left" />
                <div className="book-spread-paper-stack-right" />
                <div className="book-spine-center-gutter" />

                {/* Hiệu ứng bướm vàng phát sáng bay lượn từ sách */}
                <GoldenButterflies />

                {/* NỀN TẢNG CƠ SỞ (BASE SPREAD) */}
                {/* Trang bên TRÁI */}
                <div className="book-spread-side left-side">
                  {dragState?.direction === 'prev' && prevSpread
                    ? renderSpreadSide(prevSpread.left, 'left')
                    : renderSpreadSide(activeSpread.left, 'left')}
                </div>

                {/* Trang bên PHẢI */}
                <div className="book-spread-side right-side">
                  {dragState?.direction === 'next' && nextSpread
                    ? renderSpreadSide(nextSpread.right, 'right')
                    : renderSpreadSide(activeSpread.right, 'right')}
                </div>

                {/* LỚP LẬT TRANG 3D THỜI GIAN THỰC (INTERACTIVE FLIPPING LEAF) */}
                {dragState && dragState.direction === 'next' && nextSpread && (
                  <div
                    className="spread-flipping-leaf flip-forward"
                    style={{
                      transform: `rotateY(${-dragState.ratio * 180}deg)`,
                      transition: dragState.animating ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
                    }}
                  >
                    {/* Mặt trước của tờ lật: hiển thị trang phải hiện tại */}
                    <div className="leaf-face leaf-face-front">
                      {renderSpreadSide(activeSpread.right, 'right')}
                      <div
                        className="dynamic-curl-shadow"
                        style={{ opacity: Math.sin(dragState.ratio * Math.PI) * 0.7 }}
                      />
                    </div>
                    {/* Mặt sau của tờ lật: hiển thị trang trái kế tiếp */}
                    <div className="leaf-face leaf-face-back">
                      {renderSpreadSide(nextSpread.left, 'left')}
                      <div
                        className="dynamic-curl-shadow"
                        style={{ opacity: Math.sin(dragState.ratio * Math.PI) * 0.7 }}
                      />
                    </div>
                  </div>
                )}

                {dragState && dragState.direction === 'prev' && prevSpread && (
                  <div
                    className="spread-flipping-leaf flip-backward"
                    style={{
                      transform: `rotateY(${-180 + dragState.ratio * 180}deg)`,
                      transition: dragState.animating ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
                    }}
                  >
                    {/* Mặt trước của tờ lật: hiển thị trang phải trước đó */}
                    <div className="leaf-face leaf-face-front">
                      {renderSpreadSide(prevSpread.right, 'right')}
                      <div
                        className="dynamic-curl-shadow"
                        style={{ opacity: Math.sin(dragState.ratio * Math.PI) * 0.7 }}
                      />
                    </div>
                    {/* Mặt sau của tờ lật: hiển thị trang trái hiện tại */}
                    <div className="leaf-face leaf-face-back">
                      {renderSpreadSide(activeSpread.left, 'left')}
                      <div
                        className="dynamic-curl-shadow"
                        style={{ opacity: Math.sin(dragState.ratio * Math.PI) * 0.7 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* CHẾ ĐỘ 2: TRANG ĐƠN */
              <div ref={chassisRef} className="book-3d-chassis">
                <div className="book-spine-3d" />
                <div className="book-hardcover-shadow" />
                <div className="book-page-layer active-layer">
                  {currentPage === 0
                    ? renderSpreadSide({ type: 'cover-main' }, 'right')
                    : currentPage === totalSinglePages - 1
                    ? renderSpreadSide({ type: 'back-cover' }, 'right')
                    : renderSpreadSide({ type: 'day-single', day: dayPages[currentPage - 1], images: dayPages[currentPage - 1]?.allImages }, 'right')}
                </div>
              </div>
            )}

            {/* Nút lật trang ngoài lề */}
            <button
              type="button"
              className={`book-turn-arrow next ${(layoutMode === 'spread' ? currentSpread >= totalSpreads - 1 : currentPage >= totalSinglePages - 1) || dragState?.animating ? 'disabled' : ''}`}
              onClick={goNextPage}
              disabled={(layoutMode === 'spread' ? currentSpread >= totalSpreads - 1 : currentPage >= totalSinglePages - 1) || dragState?.animating}
              title="Lật sang trang tiếp theo"
              aria-label="Trang tiếp theo"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* THANH ĐIỀU HƯỚNG ĐÁY GỌN GÀNG */}
          <div className="memory-book-bottom-nav">
            <button
              type="button"
              className="nav-arrow-btn prev"
              onClick={goPrevPage}
              disabled={(layoutMode === 'spread' ? currentSpread === 0 : currentPage === 0) || dragState?.animating}
              title="Lật về trang trước"
            >
              <ChevronLeft size={18} />
              <span className="nav-arrow-label">Trước</span>
            </button>

            <div className="nav-scrubber-center">
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
                className="scrubber-slider"
                aria-label="Thanh trượt trang sách"
              />
              <div className="nav-page-badge">
                <span>
                  {layoutMode === 'spread'
                    ? currentSpread === 0
                      ? `Bìa ${selectedYear}`
                      : currentSpread === totalSpreads - 1
                      ? `Hết sổ`
                      : `Cặp trang ${currentSpread} / ${totalSpreads - 1}`
                    : currentPage === 0
                    ? `Bìa ${selectedYear}`
                    : currentPage === totalSinglePages - 1
                    ? `Hết sổ`
                    : `Trang ${currentPage} / ${dayPages.length}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="nav-arrow-btn next"
              onClick={goNextPage}
              disabled={(layoutMode === 'spread' ? currentSpread >= totalSpreads - 1 : currentPage >= totalSinglePages - 1) || dragState?.animating}
              title="Lật sang trang tiếp theo"
            >
              <span className="nav-arrow-label">Sau</span>
              <ChevronRight size={18} />
            </button>
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
