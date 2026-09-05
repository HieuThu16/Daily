import React, { useState, useRef, useMemo } from 'react'
import {
  Sparkles, Star, Calendar, Clock,
  ChevronRight, ChevronLeft, TreePine, BookOpen,
  Heart, Award, Pencil, Bookmark
} from 'lucide-react'
import { isEntryFirstTime, isEntrySpecial, type Entry } from '../../types'
import { formatCardDate, formatMemoryCardContent } from './Memory3DCard'

/* ═══════════════════════════════════════════════════════════════════
 * SEASON THEMES — Mỗi năm 1 mùa, cycle qua 4 mùa
 * ═══════════════════════════════════════════════════════════════════ */
type SeasonTheme = {
  name: string
  treeTrunk: string
  treeCanopy: string[]  // gradient stops
  flowers: string[]     // flower colors
  petalColor: string
  bgGradient: string
  groundColor: string
  glowColor: string
  accent: string
  leafColors?: string[]
}

const SEASONS: SeasonTheme[] = [
  {
    // SPRING — Xuân (hoa anh đào)
    name: 'Xuân',
    treeTrunk: '#5d4037',
    treeCanopy: ['#2e7d32', '#43a047', '#66bb6a'],
    flowers: ['#f8bbd0', '#f48fb1', '#ec407a', '#fff', '#fce4ec'],
    petalColor: '#f48fb1',
    bgGradient: 'linear-gradient(170deg, #1a1a2e 0%, #16213e 30%, #0f3d3e 60%, #1a3a2a 100%)',
    groundColor: 'rgba(46, 125, 50, 0.25)',
    glowColor: 'rgba(244, 143, 177, 0.4)',
    accent: '#f48fb1',
  },
  {
    // SUMMER — Hạ (hoa hướng dương)
    name: 'Hạ',
    treeTrunk: '#6d4c41',
    treeCanopy: ['#1b5e20', '#2e7d32', '#388e3c'],
    flowers: ['#ffeb3b', '#ffc107', '#ff9800', '#fff176', '#ffe082'],
    petalColor: '#ffc107',
    bgGradient: 'linear-gradient(170deg, #1a1a2e 0%, #1e2a3a 30%, #2a3a1a 60%, #3a3a1a 100%)',
    groundColor: 'rgba(139, 195, 74, 0.2)',
    glowColor: 'rgba(255, 193, 7, 0.4)',
    accent: '#ffc107',
    leafColors: ['#8bc34a', '#cddc39', '#4caf50'],
  },
  {
    // AUTUMN — Thu (lá đỏ vàng)
    name: 'Thu',
    treeTrunk: '#4e342e',
    treeCanopy: ['#e65100', '#f57c00', '#ff9800', '#d84315'],
    flowers: ['#ffcc80', '#ffe0b2', '#ffab40', '#ff6d00'],
    petalColor: '#ff9800',
    bgGradient: 'linear-gradient(170deg, #1a1a2e 0%, #2a1a0a 30%, #3a2a1a 60%, #2a1a1a 100%)',
    groundColor: 'rgba(230, 81, 0, 0.2)',
    glowColor: 'rgba(255, 152, 0, 0.4)',
    accent: '#ff9800',
    leafColors: ['#ff6d00', '#e65100', '#f4511e', '#d84315', '#ffab40'],
  },
  {
    // WINTER — Đông (tuyết tinh)
    name: 'Đông',
    treeTrunk: '#5d4037',
    treeCanopy: ['#37474f', '#455a64', '#546e7a'],
    flowers: ['#e3f2fd', '#bbdefb', '#90caf9', '#ffffff', '#b3e5fc'],
    petalColor: '#90caf9',
    bgGradient: 'linear-gradient(170deg, #0d1b2a 0%, #1b2838 30%, #1a2540 60%, #0a1628 100%)',
    groundColor: 'rgba(144, 202, 249, 0.15)',
    glowColor: 'rgba(144, 202, 249, 0.35)',
    accent: '#90caf9',
  },
]

function getSeasonTheme(year: number): SeasonTheme {
  return SEASONS[year % 4]
}

/* ═══════════════════════════════════════════════════════════════════
 * SUB-COMPONENT: MemoryTreeCover — Bìa cây kỷ niệm SVG + CSS effects
 * ═══════════════════════════════════════════════════════════════════ */
function MemoryTreeCover({
  year,
  entryCount,
  firstTimeCount,
  specialCount,
}: {
  year: number
  entryCount: number
  firstTimeCount: number
  specialCount: number
}) {
  const theme = getSeasonTheme(year)

  // Stable random positions for flowers & petals using year as seed
  const seed = year * 31
  const pseudoRand = (i: number) => {
    const x = Math.sin(seed + i * 127.1) * 43758.5453
    return x - Math.floor(x)
  }

  // Generate 6 flower positions on the canopy
  const flowers = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => ({
      cx: 28 + pseudoRand(i) * 44,      // spread across canopy width
      cy: 18 + pseudoRand(i + 50) * 28,  // upper half  
      r: 2 + pseudoRand(i + 100) * 2.5,
      color: theme.flowers[i % theme.flowers.length],
      delay: pseudoRand(i + 200) * 3,
      dur: 2 + pseudoRand(i + 300) * 2,
    }))
  }, [year])

  // Generate 8 falling petals
  const petals = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => ({
      startX: 25 + pseudoRand(i + 400) * 50,
      startY: 25 + pseudoRand(i + 450) * 15,
      dx: -20 + pseudoRand(i + 500) * 40,
      dy: 40 + pseudoRand(i + 550) * 50,
      rot: 200 + pseudoRand(i + 600) * 400,
      size: 3 + pseudoRand(i + 650) * 3,
      delay: pseudoRand(i + 700) * 5,
      dur: 3 + pseudoRand(i + 750) * 3,
      color: theme.flowers[i % theme.flowers.length],
    }))
  }, [year])

  // Generate fireflies / sparkle particles
  const fireflies = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => ({
      cx: 15 + pseudoRand(i + 800) * 70,
      cy: 15 + pseudoRand(i + 850) * 50,
      delay: pseudoRand(i + 900) * 4,
      dur: 2 + pseudoRand(i + 950) * 2,
    }))
  }, [year])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 200,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 10,
        background: theme.bgGradient,
        boxShadow: `0 8px 24px rgba(0,0,0,0.5), inset 4px 0 10px rgba(0,0,0,0.6)`,
        border: `1px solid ${theme.accent}30`,
      }}
    >
      {/* Spine/Gáy sách bên trái */}
      <div
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: 12,
          background: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(255,255,255,0.12) 40%, rgba(0,0,0,0.45) 100%)',
          zIndex: 10, pointerEvents: 'none',
        }}
      />

      {/* Ground gradient */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
          background: `linear-gradient(to top, ${theme.groundColor}, transparent)`,
          zIndex: 1, pointerEvents: 'none',
        }}
      />

      {/* The Tree SVG — animated sway */}
      <svg
        viewBox="0 0 100 80"
        style={{
          position: 'absolute',
          bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '85%', height: '88%',
          animation: 'mtree-sway 6s ease-in-out infinite',
          zIndex: 2,
          filter: `drop-shadow(0 4px 12px rgba(0,0,0,0.4))`,
        }}
      >
        {/* Trunk with gradient */}
        <defs>
          <linearGradient id={`trunk-${year}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={theme.treeTrunk} stopOpacity="0.9" />
            <stop offset="40%" stopColor={theme.treeTrunk} />
            <stop offset="100%" stopColor={theme.treeTrunk} stopOpacity="0.7" />
          </linearGradient>
          <radialGradient id={`canopy-${year}`} cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor={theme.treeCanopy[0]} />
            <stop offset="50%" stopColor={theme.treeCanopy[1] || theme.treeCanopy[0]} />
            <stop offset="100%" stopColor={theme.treeCanopy[2] || theme.treeCanopy[0]} stopOpacity="0.8" />
          </radialGradient>
        </defs>

        {/* Trunk */}
        <rect x="46" y="48" width="8" height="28" rx="2" fill={`url(#trunk-${year})`} />
        {/* Root lines */}
        <path d="M46 74 Q40 78 35 76" fill="none" stroke={theme.treeTrunk} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M54 74 Q60 78 65 76" fill="none" stroke={theme.treeTrunk} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

        {/* Main canopy — large ellipse */}
        <ellipse cx="50" cy="34" rx="26" ry="22" fill={`url(#canopy-${year})`} opacity="0.9" />
        {/* Secondary canopy bumps */}
        <ellipse cx="36" cy="38" rx="14" ry="12" fill={theme.treeCanopy[1] || theme.treeCanopy[0]} opacity="0.55" />
        <ellipse cx="64" cy="38" rx="14" ry="12" fill={theme.treeCanopy[1] || theme.treeCanopy[0]} opacity="0.55" />
        <ellipse cx="50" cy="24" rx="16" ry="13" fill={theme.treeCanopy[0]} opacity="0.45" />

        {/* Flowers blooming on canopy */}
        {flowers.map((f, i) => (
          <circle
            key={`f-${i}`}
            cx={f.cx}
            cy={f.cy}
            r={f.r}
            fill={f.color}
            opacity="0.9"
            style={{
              animation: `mtree-bloom ${f.dur}s ease-in-out ${f.delay}s infinite`,
              transformOrigin: `${f.cx}px ${f.cy}px`,
            }}
          />
        ))}
      </svg>

      {/* Falling petals — pure CSS animation */}
      {petals.map((p, i) => (
        <div
          key={`p-${i}`}
          style={{
            position: 'absolute',
            left: `${p.startX}%`,
            top: `${p.startY}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50% 0 50% 0',
            background: p.color,
            opacity: 0,
            zIndex: 3,
            pointerEvents: 'none',
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            ['--rot' as string]: `${p.rot}deg`,
            animation: `mtree-petal-fall ${p.dur}s ease-in ${p.delay}s infinite`,
          }}
        />
      ))}

      {/* Firefly sparkles */}
      {fireflies.map((ff, i) => (
        <div
          key={`ff-${i}`}
          style={{
            position: 'absolute',
            left: `${ff.cx}%`,
            top: `${ff.cy}%`,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: theme.accent,
            boxShadow: `0 0 6px ${theme.accent}`,
            opacity: 0,
            zIndex: 4,
            pointerEvents: 'none',
            animation: `mtree-firefly ${ff.dur}s ease-in-out ${ff.delay}s infinite`,
          }}
        />
      ))}

      {/* Year badge — top right */}
      <div
        style={{
          position: 'absolute', top: 8, right: 12, zIndex: 8,
          padding: '3px 10px',
          borderRadius: 8,
          background: `linear-gradient(135deg, ${theme.accent}dd, ${theme.accent}99)`,
          color: '#fff',
          fontSize: '0.72rem',
          fontWeight: 900,
          letterSpacing: '0.5px',
          boxShadow: `0 2px 8px ${theme.glowColor}`,
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <TreePine size={11} />
        <span>{year}</span>
      </div>

      {/* Bottom info overlay */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '20px 14px 10px 18px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
          zIndex: 6,
        }}
      >
        <div style={{
          fontSize: '0.95rem', fontWeight: 900, color: '#fff',
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          lineHeight: 1.3,
        }}>
          🌳 Cây Kỷ Niệm {year}
        </div>
        <div style={{
          display: 'flex', gap: 8, marginTop: 3,
          fontSize: '0.62rem', fontWeight: 700,
          color: 'rgba(255,255,255,0.75)',
        }}>
          <span>📖 {entryCount} kỷ niệm</span>
          {firstTimeCount > 0 && <span>✨ {firstTimeCount} lần đầu</span>}
          {specialCount > 0 && <span>🌟 {specialCount} đặc biệt</span>}
        </div>
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════
 * MAIN: YearlyMemoryBook — 1 năm = 1 cuốn sách với bìa cây kỷ niệm
 * ═══════════════════════════════════════════════════════════════════ */
export function YearlyMemoryBook({
  year,
  entries,
  onEdit,
  onToggleFavorite,
}: {
  year: number
  entries: Entry[]
  onEdit: (entry: Entry) => void
  onToggleFavorite: (entry: Entry) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [tilt, setTilt] = useState({ x: 0, y: 0, sheenX: 50, sheenY: 50 })
  const [isHovered, setIsHovered] = useState(false)

  const theme = getSeasonTheme(year)

  const firstTimeCount = useMemo(() => entries.filter(e => isEntryFirstTime(e)).length, [entries])
  const specialCount = useMemo(() => entries.filter(e => isEntrySpecial(e)).length, [entries])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isOpen) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    setTilt({
      x: -((y - cy) / cy) * 10,
      y: ((x - cx) / cx) * 10,
      sheenX: Math.round((x / rect.width) * 100),
      sheenY: Math.round((y / rect.height) * 100),
    })
  }

  const selectedEntry = entries[selectedIdx] || entries[0]

  // If book is open, show entry detail view
  if (isOpen) {
    const entry = selectedEntry
    const entryIsFirst = isEntryFirstTime(entry)
    const entryIsSpecial = isEntrySpecial(entry)
    const entryIsBoth = entryIsFirst && entryIsSpecial

    return (
      <div
        style={{
          perspective: 1200,
          width: '100%',
          minHeight: 440,
          userSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: 440,
            borderRadius: 22,
            background: 'linear-gradient(145deg, rgba(18,18,22,0.98), rgba(30,30,38,0.98))',
            border: `2px solid ${theme.accent}50`,
            boxShadow: `0 12px 35px ${theme.glowColor}, 0 0 20px ${theme.glowColor}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: 14,
          }}
        >
          {/* Holographic sheen */}
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(circle at 30% 20%, ${theme.accent}15, transparent 60%)`,
              zIndex: 0,
            }}
          />

          {/* Top bar: back + nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, zIndex: 3 }}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.08)', border: `1px solid ${theme.accent}40`,
                color: theme.accent, fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={12} /> Quay lại
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ color: theme.accent }}>{selectedIdx + 1}</span>
              <span>/</span>
              <span>{entries.length}</span>
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
                disabled={selectedIdx === 0}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: selectedIdx === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)',
                  color: selectedIdx === 0 ? 'rgba(255,255,255,0.2)' : '#fff',
                  cursor: selectedIdx === 0 ? 'default' : 'pointer',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setSelectedIdx(Math.min(entries.length - 1, selectedIdx + 1))}
                disabled={selectedIdx >= entries.length - 1}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none',
                  background: selectedIdx >= entries.length - 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)',
                  color: selectedIdx >= entries.length - 1 ? 'rgba(255,255,255,0.2)' : '#fff',
                  cursor: selectedIdx >= entries.length - 1 ? 'default' : 'pointer',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, zIndex: 3 }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 99,
                background: entryIsBoth
                  ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' 
                  : entryIsSpecial
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                color: '#fff', fontSize: '0.65rem', fontWeight: 800,
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              }}
            >
              {entryIsBoth ? <Award size={10} /> : entryIsSpecial ? <Sparkles size={10} /> : <Heart size={10} />}
              <span>{entryIsBoth ? 'SIÊU PHẨM' : entryIsSpecial ? 'ĐẶC BIỆT' : 'LẦN ĐẦU'}</span>
            </div>
            
            {entry.is_favorite && (
              <Star size={14} fill="#f59e0b" color="#f59e0b" />
            )}
          </div>

          {/* Date & time */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: '0.74rem', color: '#cbd5e1',
            marginBottom: 8, zIndex: 3, flexWrap: 'wrap',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#f8fafc' }}>
              <Calendar size={12} color={theme.accent} />
              {formatCardDate(entry.entry_date)}
            </span>
            {entry.entry_time && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: 'rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: 6, fontSize: '0.7rem',
              }}>
                <Clock size={11} color="#fbbf24" />
                {entry.entry_time}
              </span>
            )}
          </div>

          {/* Full content */}
          <div
            style={{
              flex: 1, overflowY: 'auto',
              fontSize: '0.84rem', lineHeight: 1.65,
              color: '#e4e4e7', whiteSpace: 'pre-wrap',
              paddingRight: 4, marginBottom: 10,
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 10, padding: 10,
              border: '1px solid rgba(255,255,255,0.05)',
              zIndex: 3,
            }}
          >
            {formatMemoryCardContent(entry.content)}
          </div>

          {/* Action footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)',
            zIndex: 3,
          }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8,
                background: entry.is_favorite ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: entry.is_favorite ? '#f59e0b' : '#94a3b8',
                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Star size={12} fill={entry.is_favorite ? '#f59e0b' : 'none'} />
              {entry.is_favorite ? 'Đã yêu thích' : 'Yêu thích'}
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(entry) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.08)',
                border: `1px solid ${theme.accent}30`,
                color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Pencil size={11} /> Sửa bài
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════ CLOSED BOOK VIEW (Bìa sách) ═══════════════════
  return (
    <div
      style={{
        perspective: 1200,
        width: '100%',
        minHeight: 380,
        userSelect: 'none',
      }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setTilt({ x: 0, y: 0, sheenX: 50, sheenY: 50 }) }}
        onClick={() => { setIsOpen(true); setSelectedIdx(0) }}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 380,
          borderRadius: 22,
          cursor: 'pointer',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
          transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          boxShadow: isHovered
            ? `0 20px 45px ${theme.glowColor}, 0 0 25px ${theme.glowColor}`
            : '0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        {/* Border gradient frame */}
        <div
          style={{
            position: 'absolute', inset: -2, borderRadius: 24,
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent}80 50%, ${theme.accent}40 100%)`,
            zIndex: 0,
            opacity: isHovered ? 1 : 0.7,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* Card face */}
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: 22,
            background: 'linear-gradient(145deg, rgba(18,18,22,0.98), rgba(28,28,35,0.98))',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', padding: 14,
            zIndex: 2,
          }}
        >
          {/* Holographic sheen */}
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(circle at ${tilt.sheenX}% ${tilt.sheenY}%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 40%, transparent 70%)`,
              mixBlendMode: 'overlay',
              zIndex: 5,
            }}
          />

          {/* Header: Season badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, zIndex: 4 }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 11px', borderRadius: 99,
                background: `linear-gradient(135deg, ${theme.accent}dd, ${theme.accent}88)`,
                color: '#fff', fontSize: '0.68rem', fontWeight: 800,
                letterSpacing: '0.4px',
                boxShadow: `0 2px 10px ${theme.glowColor}`,
              }}
            >
              <TreePine size={12} />
              <span>CÂY KỶ NIỆM · Mùa {theme.name}</span>
            </div>

            <span style={{
              fontSize: '0.62rem', color: 'rgba(255,255,255,0.6)',
              fontWeight: 700, letterSpacing: '0.5px',
            }}>
              VOL. {year}
            </span>
          </div>

          {/* Tree Cover Art */}
          <MemoryTreeCover
            year={year}
            entryCount={entries.length}
            firstTimeCount={firstTimeCount}
            specialCount={specialCount}
          />

          {/* Year title */}
          <div style={{ zIndex: 4, marginBottom: 6 }}>
            <div style={{
              fontSize: '1.1rem', fontWeight: 900, color: '#fff',
              textShadow: '0 2px 6px rgba(0,0,0,0.5)',
              letterSpacing: '-0.3px',
            }}>
              🌳 Năm {year}
            </div>
            <div style={{
              fontSize: '0.72rem', fontWeight: 700, color: theme.accent,
              marginTop: 2,
            }}>
              ✦ {entries.length} kỷ niệm đáng nhớ ✦
            </div>
          </div>

          {/* Stats summary row */}
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap',
            marginBottom: 8, zIndex: 4,
          }}>
            {firstTimeCount > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 6,
                background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)',
                color: '#22d3ee', fontSize: '0.65rem', fontWeight: 700,
              }}>
                ✨ {firstTimeCount} lần đầu
              </span>
            )}
            {specialCount > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 6,
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                color: '#fbbf24', fontSize: '0.65rem', fontWeight: 700,
              }}>
                🌟 {specialCount} đặc biệt
              </span>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 'auto',
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.72rem', color: '#94a3b8', zIndex: 4,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#a1a1aa' }}>
              <BookOpen size={11} style={{ opacity: 0.7 }} /> Chạm để mở sách
            </span>
            <span style={{
              fontWeight: 800, color: theme.accent,
              fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 3,
              background: 'rgba(0,0,0,0.3)', padding: '2px 7px', borderRadius: 5,
            }}>
              <Bookmark size={10} /> MEMORY TREE · {year}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
