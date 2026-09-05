import React, { useState, useRef, useMemo } from 'react'
import {
  Sparkles, Star, Calendar, Clock,
  ChevronRight, ChevronLeft, TreePine, BookOpen,
  Heart, Award, Pencil, Bookmark
} from 'lucide-react'
import { isEntryFirstTime, isEntrySpecial, type Entry } from '../../types'
import { formatCardDate, formatMemoryCardContent } from './Memory3DCard'
import { Interactive3DTreeCanvas } from './Interactive3DTreeThree'

/* ═══════════════════════════════════════════════════════════════════
 * SEASON THEMES — Mỗi năm 1 mùa, cycle qua 4 mùa (Theme Sáng & Rực Rỡ)
 * ═══════════════════════════════════════════════════════════════════ */
export type SeasonTheme = {
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

export const SEASONS: SeasonTheme[] = [
  {
    // SPRING — Xuân (hoa anh đào Play Together bồng bềnh kẹo ngọt)
    name: 'Xuân',
    treeTrunk: '#7c4a3a',
    treeCanopy: ['#ffaec9', '#ff9ebb', '#ffd4e5'],
    flowers: ['#ffffff', '#ff9ebb', '#ff4d8d', '#ffd4e5', '#ffaec9', '#ff758c'],
    petalColor: '#ff8fab',
    bgGradient: 'linear-gradient(160deg, #fff5f8 0%, #fce7f3 45%, #fef3c7 100%)',
    groundColor: 'rgba(74, 222, 128, 0.35)',
    glowColor: 'rgba(255, 174, 201, 0.45)',
    accent: '#ec4899',
  },
  {
    // SUMMER — Hạ (hoa hướng dương rực rỡ)
    name: 'Hạ',
    treeTrunk: '#6d4c41',
    treeCanopy: ['#10b981', '#34d399', '#facc15'],
    flowers: ['#f59e0b', '#fbbf24', '#facc15', '#10b981', '#f43f5e', '#ffffff'],
    petalColor: '#f59e0b',
    bgGradient: 'linear-gradient(160deg, #fefce8 0%, #fef08a 45%, #bbf7d0 100%)',
    groundColor: 'rgba(132, 204, 22, 0.25)',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    accent: '#d97706',
    leafColors: ['#84cc16', '#a3e635', '#22c55e'],
  },
  {
    // AUTUMN — Thu (lá phong đỏ vàng lộng lẫy)
    name: 'Thu',
    treeTrunk: '#4e342e',
    treeCanopy: ['#ea580c', '#f97316', '#fbbf24'],
    flowers: ['#dc2626', '#ea580c', '#f97316', '#fbbf24', '#fde047', '#ffffff'],
    petalColor: '#ea580c',
    bgGradient: 'linear-gradient(160deg, #fff7ed 0%, #ffedd5 45%, #fed7aa 100%)',
    groundColor: 'rgba(234, 88, 12, 0.2)',
    glowColor: 'rgba(234, 88, 12, 0.35)',
    accent: '#ea580c',
    leafColors: ['#ea580c', '#dc2626', '#f97316', '#fbbf24'],
  },
  {
    // WINTER — Đông (tuyết tinh & hoa mai trắng hồng)
    name: 'Đông',
    treeTrunk: '#5d4037',
    treeCanopy: ['#38bdf8', '#818cf8', '#e0e7ff'],
    flowers: ['#38bdf8', '#818cf8', '#f43f5e', '#ffffff', '#e0f2fe', '#bae6fd'],
    petalColor: '#38bdf8',
    bgGradient: 'linear-gradient(160deg, #f0fdf4 0%, #e0f2fe 45%, #e0e7ff 100%)',
    groundColor: 'rgba(56, 189, 248, 0.2)',
    glowColor: 'rgba(56, 189, 248, 0.35)',
    accent: '#0284c7',
  },
]

export function getSeasonTheme(year: number): SeasonTheme {
  return SEASONS[((year % 4) + 4) % 4]
}

/* ═══════════════════════════════════════════════════════════════════
 * SUB-COMPONENT: MemoryTreeCover — Bìa Cây Kỷ Niệm 3D tương tác
 * ═══════════════════════════════════════════════════════════════════ */
export function MemoryTreeCover({
  year,
  entryCount,
  firstTimeCount = 0,
  specialCount = 0,
  mediaCount,
  entries = [],
  onOpen,
}: {
  year: number
  entryCount: number
  firstTimeCount?: number
  specialCount?: number
  mediaCount?: number
  entries?: any[]
  onOpen?: () => void
}) {
  const theme = getSeasonTheme(year)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 220,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 10,
        background: theme.bgGradient,
        boxShadow: `0 8px 24px rgba(0,0,0,0.06), inset 4px 0 10px rgba(0,0,0,0.04)`,
        border: `1.5px solid ${theme.accent}35`,
      }}
    >
      {/* Spine/Gáy sách bên trái */}
      <div
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: 12,
          background: 'linear-gradient(to right, rgba(0,0,0,0.18) 0%, rgba(255,255,255,0.5) 40%, rgba(0,0,0,0.08) 100%)',
          zIndex: 10, pointerEvents: 'none',
        }}
      />

      {/* Cây 3D Three.js chân thực với hoa nở và cánh hoa rơi rơi */}
      <Interactive3DTreeCanvas
        compact
        year={year}
        events={entries}
        theme={theme}
        onOpenBook={onOpen}
      />

      {/* Year badge — top right */}
      <div
        style={{
          position: 'absolute', top: 8, right: 10, zIndex: 8,
          padding: '3px 9px',
          borderRadius: 8,
          background: `linear-gradient(135deg, ${theme.accent}ee, ${theme.accent}bb)`,
          color: '#fff',
          fontSize: '0.7rem',
          fontWeight: 900,
          letterSpacing: '0.4px',
          boxShadow: `0 2px 8px ${theme.glowColor}`,
          display: 'flex', alignItems: 'center', gap: 4,
          pointerEvents: 'none',
        }}
      >
        <TreePine size={11} />
        <span>{year}</span>
      </div>

      {/* Bottom info overlay */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '16px 12px 8px 16px',
          background: 'linear-gradient(to top, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.6) 60%, transparent 100%)',
          zIndex: 6,
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div style={{
          fontSize: '0.9rem', fontWeight: 900, color: '#0f172a',
          lineHeight: 1.2,
        }}>
          🌳 Cây Kỷ Niệm {year}
        </div>
        <div style={{
          display: 'flex', gap: 6, marginTop: 2,
          fontSize: '0.62rem', fontWeight: 700,
          color: '#475569',
          flexWrap: 'wrap',
        }}>
          <span>📖 {entryCount} kỷ niệm</span>
          {typeof mediaCount === 'number' && mediaCount > 0 && <span>🖼️ {mediaCount} ảnh/video</span>}
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
            background: 'linear-gradient(145deg, #ffffff, #fffdfa)',
            border: `2px solid ${theme.accent}50`,
            boxShadow: `0 12px 35px rgba(0,0,0,0.08), 0 2px 10px ${theme.glowColor}`,
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
              background: `radial-gradient(circle at 30% 20%, ${theme.accent}12, transparent 60%)`,
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
                background: '#f8fafc', border: `1px solid ${theme.accent}40`,
                color: theme.accent, fontSize: '0.72rem', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={12} /> Quay lại
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>
              <span style={{ color: theme.accent, fontWeight: 900 }}>{selectedIdx + 1}</span>
              <span>/</span>
              <span>{entries.length}</span>
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
                disabled={selectedIdx === 0}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: '1px solid #e2e8f0',
                  background: selectedIdx === 0 ? '#f8fafc' : '#ffffff',
                  color: selectedIdx === 0 ? '#cbd5e1' : '#334155',
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
                  width: 28, height: 28, borderRadius: 8, border: '1px solid #e2e8f0',
                  background: selectedIdx >= entries.length - 1 ? '#f8fafc' : '#ffffff',
                  color: selectedIdx >= entries.length - 1 ? '#cbd5e1' : '#334155',
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
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
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
            fontSize: '0.74rem', color: '#64748b',
            marginBottom: 8, zIndex: 3, flexWrap: 'wrap',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#0f172a' }}>
              <Calendar size={12} color={theme.accent} />
              {formatCardDate(entry.entry_date)}
            </span>
            {entry.entry_time && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: '#f1f5f9', padding: '2px 7px', borderRadius: 6, fontSize: '0.7rem',
                color: '#475569', fontWeight: 600,
              }}>
                <Clock size={11} color="#f59e0b" />
                {entry.entry_time}
              </span>
            )}
          </div>

          {/* Full content */}
          <div
            style={{
              flex: 1, overflowY: 'auto',
              fontSize: '0.84rem', lineHeight: 1.65,
              color: '#1e293b', whiteSpace: 'pre-wrap',
              paddingRight: 4, marginBottom: 10,
              background: '#f8fafc',
              borderRadius: 10, padding: 10,
              border: '1px solid #e2e8f0',
              zIndex: 3,
            }}
          >
            {formatMemoryCardContent(entry.content)}
          </div>

          {/* Action footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 8, borderTop: '1px solid #f1f5f9',
            zIndex: 3,
          }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8,
                background: entry.is_favorite ? '#fef3c7' : '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: entry.is_favorite ? '#b45309' : '#64748b',
                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Star size={12} fill={entry.is_favorite ? '#f59e0b' : 'none'} color="#f59e0b" />
              {entry.is_favorite ? 'Đã yêu thích' : 'Yêu thích'}
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(entry) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8,
                background: '#f8fafc',
                border: `1px solid ${theme.accent}40`,
                color: theme.accent, fontSize: '0.72rem', fontWeight: 700,
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
        onClick={() => setIsOpen(true)}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
          setTilt({ x: 0, y: 0, sheenX: 50, sheenY: 50 })
        }}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 380,
          borderRadius: 24,
          cursor: 'pointer',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: isHovered ? 'transform 0.1s ease-out' : 'transform 0.45s ease-out',
          boxShadow: isHovered
            ? `0 20px 40px rgba(0,0,0,0.12), 0 0 24px ${theme.glowColor}`
            : `0 8px 24px rgba(0,0,0,0.06)`,
        }}
      >
        {/* Glow border ring */}
        <div
          style={{
            position: 'absolute', inset: -2, borderRadius: 24,
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent}80 50%, ${theme.accent}40 100%)`,
            zIndex: 0,
            opacity: isHovered ? 0.9 : 0.4,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* Card face */}
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: 22,
            background: 'linear-gradient(145deg, #ffffff, #fffdfa)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', padding: 14,
            zIndex: 2,
            border: '1px solid #f1f5f9',
          }}
        >
          {/* Holographic sheen */}
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(circle at ${tilt.sheenX}% ${tilt.sheenY}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)`,
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
                background: `linear-gradient(135deg, ${theme.accent}ee, ${theme.accent}aa)`,
                color: '#fff', fontSize: '0.68rem', fontWeight: 800,
                letterSpacing: '0.4px',
                boxShadow: `0 2px 10px ${theme.glowColor}`,
              }}
            >
              <TreePine size={12} />
              <span>CÂY KỶ NIỆM · Mùa {theme.name}</span>
            </div>

            <span style={{
              fontSize: '0.65rem', color: '#64748b',
              fontWeight: 800, letterSpacing: '0.5px',
            }}>
              VOL. {year}
            </span>
          </div>

          {/* Tree Cover Art — Cây 3D Three.js thật xoay 360 độ */}
          <MemoryTreeCover
            year={year}
            entryCount={entries.length}
            firstTimeCount={firstTimeCount}
            specialCount={specialCount}
            entries={entries}
            onOpen={() => setIsOpen(true)}
          />

          {/* Year title */}
          <div style={{ zIndex: 4, marginBottom: 6 }}>
            <div style={{
              fontSize: '1.15rem', fontWeight: 900, color: '#0f172a',
              letterSpacing: '-0.3px',
            }}>
              🌳 Năm {year}
            </div>
            <div style={{
              fontSize: '0.74rem', fontWeight: 800, color: theme.accent,
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
                padding: '3px 8px', borderRadius: 6,
                background: '#ecfeff', border: '1px solid #a5f3fc',
                color: '#0891b2', fontSize: '0.65rem', fontWeight: 700,
              }}>
                ✨ {firstTimeCount} lần đầu
              </span>
            )}
            {specialCount > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '3px 8px', borderRadius: 6,
                background: '#fefce8', border: '1px solid #fef08a',
                color: '#ca8a04', fontSize: '0.65rem', fontWeight: 700,
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
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.72rem', color: '#64748b', zIndex: 4,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748b', fontWeight: 600 }}>
              <BookOpen size={11} style={{ opacity: 0.8 }} /> Chạm để mở sách
            </span>
            <span style={{
              fontWeight: 800, color: theme.accent,
              fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 3,
              background: '#f8fafc', padding: '3px 8px', borderRadius: 6,
              border: '1px solid #e2e8f0',
            }}>
              <Bookmark size={10} /> MEMORY TREE · {year}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
