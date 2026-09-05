import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ArrowLeft, ChevronLeft, ChevronRight, MapPin, Clock,
  Calendar, Sparkles, X, Bookmark, BookOpen,
  Volume2, VolumeX, Download, TreePine, Star
} from 'lucide-react'
import type { SharedEvent } from '../../types'
import { getVideoPosterUrl, SafeMediaImage } from './SharedEventsView'
import { getSeasonTheme, MemoryTreeCover, type SeasonTheme } from './YearlyMemoryBook'
import { formatCardDate } from './Memory3DCard'
import './memory-book.css'

export interface MemoryBookViewProps {
  events: SharedEvent[]
  personName?: string
  roomCode?: string | null
  onClose: () => void
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
    // Không bắt buộc âm thanh nếu trình duyệt chặn
  }
}

/* ═══════════════════════════════════════════════════════════════════
 * SUB-COMPONENT: YearlyBookCard (Cuốn sách 3D trên kệ sách các năm)
 * ═══════════════════════════════════════════════════════════════════ */
function YearlyBookCard({
  year,
  events,
  mediaCount,
  onOpen,
}: {
  year: number
  events: SharedEvent[]
  mediaCount: number
  onOpen: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0, sheenX: 50, sheenY: 50 })
  const [isHovered, setIsHovered] = useState(false)
  const theme = getSeasonTheme(year)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    setTilt({
      x: -((y - cy) / cy) * 9,
      y: ((x - cx) / cx) * 9,
      sheenX: Math.round((x / rect.width) * 100),
      sheenY: Math.round((y / rect.height) * 100),
    })
  }

  const firstTimeCount = useMemo(() => {
    return events.filter(e => {
      const t = (e.title || '').toLowerCase()
      const n = (e.note || '').toLowerCase()
      return t.includes('lần đầu') || n.includes('lần đầu') || t.includes('first time')
    }).length
  }, [events])

  const specialCount = useMemo(() => {
    return events.filter(e => {
      const t = (e.title || '').toLowerCase()
      const n = (e.note || '').toLowerCase()
      return t.includes('đặc biệt') || n.includes('đặc biệt') || t.includes('kỷ niệm') || e.is_favorite
    }).length
  }, [events])

  return (
    <div
      style={{
        perspective: 1200,
        width: '100%',
        userSelect: 'none',
      }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
          setTilt({ x: 0, y: 0, sheenX: 50, sheenY: 50 })
        }}
        onClick={onOpen}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 410,
          borderRadius: 22,
          cursor: 'pointer',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${isHovered ? 1.025 : 1}, ${isHovered ? 1.025 : 1}, 1)`,
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          boxShadow: isHovered
            ? `0 22px 50px ${theme.glowColor}, 0 0 25px ${theme.glowColor}`
            : '0 10px 28px rgba(0,0,0,0.45)',
        }}
      >
        {/* Border gradient frame */}
        <div
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 24,
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent}80 50%, ${theme.accent}30 100%)`,
            zIndex: 0,
            opacity: isHovered ? 1 : 0.65,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* Card face */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            background: 'linear-gradient(155deg, rgba(22,20,26,0.98), rgba(15,14,18,0.98))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 14,
            zIndex: 2,
          }}
        >
          {/* Holographic sheen */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(circle at ${tilt.sheenX}% ${tilt.sheenY}%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 45%, transparent 70%)`,
              mixBlendMode: 'overlay',
              zIndex: 5,
            }}
          />

          {/* Header chip: Season */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, zIndex: 4 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 11px',
                borderRadius: 99,
                background: `linear-gradient(135deg, ${theme.accent}dd, ${theme.accent}88)`,
                color: '#fff',
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.4px',
                boxShadow: `0 2px 10px ${theme.glowColor}`,
              }}
            >
              <TreePine size={12} />
              <span>CÂY KỶ NIỆM · Mùa {theme.name}</span>
            </div>

            <span
              style={{
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.6)',
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}
            >
              VOL. {year}
            </span>
          </div>

          {/* Animated 3D Tree Cover Art */}
          <MemoryTreeCover
            year={year}
            entryCount={events.length}
            firstTimeCount={firstTimeCount}
            specialCount={specialCount}
            mediaCount={mediaCount}
          />

          {/* Year Title */}
          <div style={{ zIndex: 4, marginTop: 4, marginBottom: 6 }}>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 900,
                color: '#fff',
                textShadow: '0 2px 6px rgba(0,0,0,0.6)',
                letterSpacing: '-0.3px',
              }}
            >
              🌳 Cuốn sổ năm {year}
            </div>
            <div
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: theme.accent,
                marginTop: 2,
              }}
            >
              ✦ {events.length} kỷ niệm đáng nhớ ✦
            </div>
          </div>

          {/* Badges / Stats */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, zIndex: 4 }}>
            {mediaCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#f8fafc',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                }}
              >
                🖼️ {mediaCount} ảnh & video
              </span>
            )}
            {firstTimeCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(6,182,212,0.12)',
                  border: '1px solid rgba(6,182,212,0.3)',
                  color: '#22d3ee',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                }}
              >
                ✨ {firstTimeCount} lần đầu
              </span>
            )}
            {specialCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#fbbf24',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                }}
              >
                🌟 {specialCount} đặc biệt
              </span>
            )}
          </div>

          {/* Footer Call to Action */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 'auto',
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.72rem',
              color: '#94a3b8',
              zIndex: 4,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#fef08a', fontWeight: 800 }}>
              <BookOpen size={13} style={{ color: theme.accent }} /> Mở cuốn sách →
            </span>
            <span
              style={{
                fontWeight: 800,
                color: theme.accent,
                fontSize: '0.66rem',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                background: 'rgba(0,0,0,0.35)',
                padding: '3px 8px',
                borderRadius: 6,
              }}
            >
              <Bookmark size={10} /> MÙA {theme.name.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════
 * MAIN EXPORT: MemoryBookView
 * ═══════════════════════════════════════════════════════════════════ */
export function MemoryBookView({ events, personName, onClose }: MemoryBookViewProps) {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedEntryIdx, setSelectedEntryIdx] = useState(0)

  // Media preview popup (Lightbox)
  const [activeGallery, setActiveGallery] = useState<{
    images: string[]
    currentIndex: number
    title?: string
    note?: string
    date?: string
  } | null>(null)

  // State vuốt chạm trên mobile
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)

  // Nhóm kỷ niệm theo năm
  const yearlyBooks = useMemo(() => {
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
        const sortedEvs = [...evs].sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
        const mediaCount = sortedEvs.reduce((acc, cur) => acc + (cur.images?.length || (cur.image_url ? 1 : 0)), 0)
        return {
          year,
          events: sortedEvs,
          mediaCount,
        }
      })
  }, [events])

  // Lấy cuốn sách của năm đang mở
  const currentBook = useMemo(() => {
    if (selectedYear === null) return null
    return yearlyBooks.find((b) => b.year === selectedYear) || yearlyBooks[0]
  }, [selectedYear, yearlyBooks])

  const currentYearEvents = currentBook ? currentBook.events : []
  const currentEntry = currentYearEvents[selectedEntryIdx]
  const currentTheme: SeasonTheme = currentBook ? getSeasonTheme(currentBook.year) : getSeasonTheme(new Date().getFullYear())

  // Đổi sang entry trước
  const handlePrevEntry = useCallback(() => {
    if (selectedEntryIdx <= 0) return
    if (soundEnabled) playPaperTurnSound()
    setSelectedEntryIdx((idx) => Math.max(0, idx - 1))
  }, [selectedEntryIdx, soundEnabled])

  // Đổi sang entry kế tiếp
  const handleNextEntry = useCallback(() => {
    if (selectedEntryIdx >= currentYearEvents.length - 1) return
    if (soundEnabled) playPaperTurnSound()
    setSelectedEntryIdx((idx) => Math.min(currentYearEvents.length - 1, idx + 1))
  }, [selectedEntryIdx, currentYearEvents.length, soundEnabled])

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

      if (e.key === 'Escape') {
        if (selectedYear !== null) {
          setSelectedYear(null)
        } else {
          onClose()
        }
        return
      }

      if (selectedYear !== null) {
        if (e.key === 'ArrowRight' || e.key === 'Space') {
          handleNextEntry()
        } else if (e.key === 'ArrowLeft') {
          handlePrevEntry()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeGallery, selectedYear, handleNextEntry, handlePrevEntry, onClose])

  // Vuốt chạm cảm ứng trên di động
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
        handleNextEntry()
      } else {
        handlePrevEntry()
      }
    }
    touchStartXRef.current = null
    touchStartYRef.current = null
  }

  // Tổng số media
  const totalMedia = useMemo(() => {
    return events.reduce((acc, cur) => acc + (cur.images?.length || (cur.image_url ? 1 : 0)), 0)
  }, [events])

  return (
    <div className="memory-book-fullscreen">
      {/* ── TOP BAR ── */}
      <div className="memory-book-topbar">
        <div className="memory-book-top-left">
          {selectedYear !== null ? (
            <button
              type="button"
              className="memory-book-back-btn"
              onClick={() => {
                if (soundEnabled) playPaperTurnSound()
                setSelectedYear(null)
              }}
              title="Quay lại danh sách các năm"
            >
              <ArrowLeft size={16} />
              <span>Kệ sách các năm</span>
            </button>
          ) : (
            <button
              type="button"
              className="memory-book-back-btn"
              onClick={onClose}
              title="Đóng sách 3D và quay về kỷ niệm chung"
            >
              <ArrowLeft size={16} />
              <span>Kỷ niệm chung</span>
            </button>
          )}

          {selectedYear !== null && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                background: `linear-gradient(135deg, ${currentTheme.accent}30, rgba(0,0,0,0.5))`,
                border: `1px solid ${currentTheme.accent}60`,
                color: currentTheme.accent,
                fontSize: '0.78rem',
                fontWeight: 800,
              }}
            >
              <TreePine size={13} />
              <span>Năm {selectedYear} · Mùa {currentTheme.name}</span>
            </div>
          )}
        </div>

        {/* Center: Title / Counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedYear !== null && currentYearEvents.length > 0 ? (
            <div className="memory-book-page-indicator">
              <BookOpen size={14} style={{ color: currentTheme.accent }} />
              <span>Kỷ niệm {selectedEntryIdx + 1} / {currentYearEvents.length}</span>
            </div>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#fef08a',
                fontSize: '0.85rem',
                fontWeight: 800,
                letterSpacing: '0.5px',
              }}
            >
              <Sparkles size={15} style={{ color: '#f59e0b' }} />
              <span>SÁCH KỶ NIỆM 3D</span>
              {personName && (
                <span style={{ color: '#cbd5e1', fontWeight: 600, fontSize: '0.78rem' }}>
                  · cùng <strong style={{ color: '#f8fafc' }}>{personName}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Sound + Close */}
        <div className="memory-book-top-actions">
          {selectedYear !== null && yearlyBooks.length > 1 && (
            <select
              value={selectedYear}
              onChange={(e) => {
                if (soundEnabled) playPaperTurnSound()
                setSelectedYear(Number(e.target.value))
                setSelectedEntryIdx(0)
              }}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: `1px solid ${currentTheme.accent}50`,
                color: '#fff',
                borderRadius: 14,
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {yearlyBooks.map((b) => (
                <option key={b.year} value={b.year} style={{ background: '#1e1e24', color: '#fff' }}>
                  Năm {b.year} ({b.events.length})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="memory-book-pill-btn icon-only"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Tắt âm thanh lật sách' : 'Bật âm thanh lật sách'}
          >
            {soundEnabled ? <Volume2 size={15} style={{ color: '#fbbf24' }} /> : <VolumeX size={15} style={{ opacity: 0.5 }} />}
          </button>

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
       * VIEW 1: KỆ SÁCH CÁC NĂM (Mỗi năm là 1 cuốn sách 3D)
       * ══════════════════════════════════════════════════════════════ */}
      {selectedYear === null ? (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 20px 60px',
            background: 'radial-gradient(ellipse at 50% 15%, #251d18 0%, #120e0c 100%)',
          }}
        >
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Header Banner */}
            <div
              style={{
                textAlign: 'center',
                padding: '24px 20px 28px',
                marginBottom: 28,
                borderRadius: 24,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(236,72,153,0.08), rgba(0,0,0,0.4))',
                border: '1px solid rgba(245,158,11,0.25)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Season Chips Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 10,
                  marginBottom: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(244,143,177,0.15)', color: '#f48fb1', fontSize: '0.72rem', fontWeight: 800 }}>
                  🌸 Xuân
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>→</span>
                <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(255,193,7,0.15)', color: '#ffc107', fontSize: '0.72rem', fontWeight: 800 }}>
                  ☀️ Hạ
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>→</span>
                <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(255,152,0,0.15)', color: '#ff9800', fontSize: '0.72rem', fontWeight: 800 }}>
                  🍂 Thu
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>→</span>
                <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(144,202,249,0.15)', color: '#90caf9', fontSize: '0.72rem', fontWeight: 800 }}>
                  ❄️ Đông
                </span>
              </div>

              <h1
                style={{
                  fontSize: 'clamp(1.4rem, 4vw, 2.1rem)',
                  fontWeight: 900,
                  color: '#fff',
                  marginBottom: 8,
                  textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <span>🌳</span>
                <span>KỆ SÁCH CÂY KỶ NIỆM 3D</span>
                <span>🌳</span>
              </h1>

              <p
                style={{
                  maxWidth: 620,
                  margin: '0 auto 16px',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: '0.85rem',
                  lineHeight: 1.55,
                }}
              >
                Mỗi năm là một cuốn sách cuộc đời với bìa cây kỷ niệm 3D hoa nở theo 4 mùa.
                Chạm vào bất kỳ cuốn sách nào để lật mở từng kỷ niệm quý giá bên trong!
              </p>

              {/* Stats pill */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '6px 18px',
                  borderRadius: 99,
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#fef08a',
                  flexWrap: 'wrap',
                }}
              >
                <span>📚 {yearlyBooks.length} cuốn sách (năm)</span>
                <span>·</span>
                <span>📖 {events.length} kỷ niệm chung</span>
                <span>·</span>
                <span>🖼️ {totalMedia} ảnh & video</span>
              </div>
            </div>

            {/* Books Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 24,
                paddingBottom: 40,
              }}
            >
              {yearlyBooks.map(({ year, events: yearEvents, mediaCount }) => (
                <YearlyBookCard
                  key={year}
                  year={year}
                  events={yearEvents}
                  mediaCount={mediaCount}
                  onOpen={() => {
                    if (soundEnabled) playPaperTurnSound()
                    setSelectedYear(year)
                    setSelectedEntryIdx(0)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
         * VIEW 2: DUYỆT TỪNG ENTRY TRONG NĂM VỚI NÚT PREV / NEXT
         * ══════════════════════════════════════════════════════════════ */
        <div
          className="memory-book-stage"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 12px 20px',
            overflow: 'hidden',
          }}
        >
          {/* Nút Prev ở bên trái */}
          <button
            type="button"
            className={`book-turn-arrow prev ${selectedEntryIdx === 0 ? 'disabled' : ''}`}
            onClick={handlePrevEntry}
            disabled={selectedEntryIdx === 0}
            title={selectedEntryIdx > 0 ? `Kỷ niệm trước (${selectedEntryIdx}/${currentYearEvents.length})` : 'Đang ở kỷ niệm đầu tiên'}
            aria-label="Kỷ niệm trước"
            style={{
              zIndex: 30,
              opacity: selectedEntryIdx === 0 ? 0.3 : 1,
              cursor: selectedEntryIdx === 0 ? 'default' : 'pointer',
            }}
          >
            <ChevronLeft size={28} />
          </button>

          {/* Nút Next ở bên phải */}
          <button
            type="button"
            className={`book-turn-arrow next ${selectedEntryIdx >= currentYearEvents.length - 1 ? 'disabled' : ''}`}
            onClick={handleNextEntry}
            disabled={selectedEntryIdx >= currentYearEvents.length - 1}
            title={selectedEntryIdx < currentYearEvents.length - 1 ? `Kỷ niệm tiếp (${selectedEntryIdx + 2}/${currentYearEvents.length})` : 'Đang ở kỷ niệm cuối'}
            aria-label="Kỷ niệm tiếp"
            style={{
              zIndex: 30,
              opacity: selectedEntryIdx >= currentYearEvents.length - 1 ? 0.3 : 1,
              cursor: selectedEntryIdx >= currentYearEvents.length - 1 ? 'default' : 'pointer',
            }}
          >
            <ChevronRight size={28} />
          </button>

          {/* Khung nội dung trang sách kỷ niệm 3D */}
          <div
            style={{
              width: '100%',
              maxWidth: 760,
              maxHeight: 'calc(100vh - 120px)',
              borderRadius: 24,
              background: 'linear-gradient(150deg, rgba(26,22,20,0.98), rgba(16,13,11,0.98))',
              border: `2px solid ${currentTheme.accent}50`,
              boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 35px ${currentTheme.glowColor}`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* Gáy sách mạ vàng ánh kim bên trái */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: 14,
                background: 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(255,255,255,0.15) 45%, rgba(0,0,0,0.5) 100%)',
                zIndex: 20,
                pointerEvents: 'none',
              }}
            />

            {/* Khung nội dung có thể cuộn nếu kỷ niệm dài */}
            {currentYearEvents.length === 0 ? (
              <div style={{ padding: '60px 30px', textAlign: 'center', color: '#cbd5e1' }}>
                <TreePine size={48} style={{ color: currentTheme.accent, margin: '0 auto 16px', opacity: 0.8 }} />
                <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: 8 }}>Năm {selectedYear} chưa có kỷ niệm nào</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 20 }}>
                  Hãy quay lại kệ sách để khám phá những năm kỷ niệm khác nhé!
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedYear(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 12,
                    background: currentTheme.accent,
                    color: '#fff',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Quay lại kệ sách
                </button>
              </div>
            ) : (
              (() => {
                const entry = currentEntry
                const images: string[] = []
                if (Array.isArray(entry.images) && entry.images.length > 0) {
                  images.push(...entry.images.filter(Boolean))
                } else if (entry.image_url) {
                  images.push(entry.image_url)
                }

                const hasLocation = Boolean(entry.location)
                const hasTime = Boolean(entry.event_time)

                return (
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '24px 26px 20px 36px',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* Top Metadata Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                        paddingBottom: 14,
                        borderBottom: '1px solid rgba(255,255,255,0.09)',
                        marginBottom: 16,
                      }}
                    >
                      {/* Date & Time & Location */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 11px',
                            borderRadius: 10,
                            background: `linear-gradient(135deg, ${currentTheme.accent}30, rgba(0,0,0,0.4))`,
                            border: `1px solid ${currentTheme.accent}50`,
                            color: '#fff',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                          }}
                        >
                          <Calendar size={13} style={{ color: currentTheme.accent }} />
                          {formatCardDate(entry.event_date)}
                        </span>

                        {hasTime && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 9px',
                              borderRadius: 8,
                              background: 'rgba(255,255,255,0.06)',
                              color: '#fef08a',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            <Clock size={12} />
                            {entry.event_time}
                          </span>
                        )}

                        {hasLocation && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 9px',
                              borderRadius: 8,
                              background: 'rgba(255,255,255,0.06)',
                              color: '#93c5fd',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            <MapPin size={12} />
                            {entry.location}
                          </span>
                        )}
                      </div>

                      {/* Badges: Favorite, Special, Counter */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {entry.is_favorite && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '3px 8px',
                              borderRadius: 8,
                              background: 'rgba(245,158,11,0.2)',
                              color: '#fbbf24',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                            }}
                          >
                            <Star size={12} fill="#f59e0b" /> Yêu thích
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: currentTheme.accent,
                            padding: '3px 9px',
                            borderRadius: 99,
                            background: 'rgba(0,0,0,0.4)',
                            border: `1px solid ${currentTheme.accent}40`,
                          }}
                        >
                          Trang {selectedEntryIdx + 1} / {currentYearEvents.length}
                        </span>
                      </div>
                    </div>

                    {/* Entry Title */}
                    <h2
                      style={{
                        fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
                        fontWeight: 900,
                        color: '#fff',
                        lineHeight: 1.35,
                        marginBottom: 16,
                        textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                      }}
                    >
                      {entry.title || 'Khoảnh khắc kỷ niệm'}
                    </h2>

                    {/* Media / Photos Section */}
                    {images.length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        {/* Main Media Preview */}
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            maxHeight: 340,
                            borderRadius: 16,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: '#09080b',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                          onClick={() => {
                            setActiveGallery({
                              images,
                              currentIndex: 0,
                              title: entry.title,
                              note: entry.note || undefined,
                              date: formatCardDate(entry.event_date),
                            })
                          }}
                        >
                          {isVideo(images[0]) ? (
                            <div style={{ position: 'relative', width: '100%', height: 260 }}>
                              <video
                                src={images[0]}
                                poster={getVideoPosterUrl(images[0])}
                                controls
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            </div>
                          ) : (
                            <SafeMediaImage
                              src={images[0]}
                              alt={entry.title || 'Kỷ niệm'}
                              style={{
                                width: '100%',
                                maxHeight: 340,
                                objectFit: 'contain',
                                display: 'block',
                                margin: '0 auto',
                              }}
                            />
                          )}

                          {images.length > 1 && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 10,
                                right: 12,
                                padding: '4px 10px',
                                borderRadius: 12,
                                background: 'rgba(0,0,0,0.75)',
                                color: '#fff',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              🖼️ +{images.length - 1} ảnh khác · Bấm để xem album
                            </div>
                          )}
                        </div>

                        {/* Thumbnails Row if multiple images */}
                        {images.length > 1 && (
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              overflowX: 'auto',
                              paddingTop: 10,
                              paddingBottom: 4,
                            }}
                          >
                            {images.map((img, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setActiveGallery({
                                    images,
                                    currentIndex: idx,
                                    title: entry.title,
                                    note: entry.note || undefined,
                                    date: formatCardDate(entry.event_date),
                                  })
                                }}
                                style={{
                                  width: 60,
                                  height: 60,
                                  borderRadius: 10,
                                  overflow: 'hidden',
                                  border: idx === 0 ? `2px solid ${currentTheme.accent}` : '1px solid rgba(255,255,255,0.2)',
                                  background: '#000',
                                  padding: 0,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                {isVideo(img) ? (
                                  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#222', color: '#fff', fontSize: '0.65rem' }}>
                                    VIDEO
                                  </div>
                                ) : (
                                  <SafeMediaImage src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Note / Text Content */}
                    {entry.note ? (
                      <div
                        style={{
                          background: 'rgba(255,255,255,0.035)',
                          borderRadius: 14,
                          padding: '16px 18px',
                          border: '1px solid rgba(255,255,255,0.07)',
                          color: '#e2e8f0',
                          fontSize: '0.92rem',
                          lineHeight: 1.75,
                          whiteSpace: 'pre-wrap',
                          marginBottom: 16,
                          fontFamily: 'inherit',
                        }}
                      >
                        {entry.note}
                      </div>
                    ) : (
                      <div
                        style={{
                          color: 'rgba(255,255,255,0.4)',
                          fontSize: '0.82rem',
                          fontStyle: 'italic',
                          marginBottom: 16,
                        }}
                      >
                        (Không có ghi chú chi tiết cho kỷ niệm này)
                      </div>
                    )}

                    {/* Bottom In-Page Navigation Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 'auto',
                        paddingTop: 16,
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        gap: 12,
                      }}
                    >
                      <button
                        type="button"
                        onClick={handlePrevEntry}
                        disabled={selectedEntryIdx === 0}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 14px',
                          borderRadius: 12,
                          background: selectedEntryIdx === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)',
                          border: 'none',
                          color: selectedEntryIdx === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: selectedEntryIdx === 0 ? 'default' : 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <ChevronLeft size={16} />
                        <span>Kỷ niệm trước</span>
                      </button>

                      <div
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {selectedEntryIdx + 1} trên {currentYearEvents.length}
                      </div>

                      <button
                        type="button"
                        onClick={handleNextEntry}
                        disabled={selectedEntryIdx >= currentYearEvents.length - 1}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 14px',
                          borderRadius: 12,
                          background: selectedEntryIdx >= currentYearEvents.length - 1 ? 'rgba(255,255,255,0.04)' : currentTheme.accent,
                          border: 'none',
                          color: selectedEntryIdx >= currentYearEvents.length - 1 ? 'rgba(255,255,255,0.3)' : '#fff',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: selectedEntryIdx >= currentYearEvents.length - 1 ? 'default' : 'pointer',
                          boxShadow: selectedEntryIdx < currentYearEvents.length - 1 ? `0 2px 10px ${currentTheme.glowColor}` : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>Kỷ niệm tiếp</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )
              })()
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
       * LIGHTBOX POPUP PHÓNG TO ẢNH / ALBUM
       * ══════════════════════════════════════════════════════════════ */}
      {activeGallery && (
        <div className="scrapbook-photo-popup-backdrop" onClick={() => setActiveGallery(null)}>
          <div className="scrapbook-photo-popup-card" onClick={(e) => e.stopPropagation()}>
            <div className="scrapbook-popup-header">
              <span className="popup-photo-badge">
                Ảnh {activeGallery.currentIndex + 1} / {activeGallery.images.length}
              </span>
              <div className="popup-actions">
                <a
                  href={activeGallery.images[activeGallery.currentIndex]}
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
                {isVideo(activeGallery.images[activeGallery.currentIndex]) ? (
                  <video
                    src={activeGallery.images[activeGallery.currentIndex]}
                    poster={getVideoPosterUrl(activeGallery.images[activeGallery.currentIndex])}
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <SafeMediaImage src={activeGallery.images[activeGallery.currentIndex]} alt="" />
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
