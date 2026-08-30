import React, { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Star, Calendar,
  RotateCw, Heart, ExternalLink,
  BookOpen, Music, Youtube, BookMarked,
  NotebookPen, Trash2, Play
} from 'lucide-react'
import type { CollectionItem } from './collectionService'

export function formatCollectionDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function UniversalCollection3DCard({
  item,
  onRemove,
  onToggleFavorite,
}: {
  item: CollectionItem
  onRemove: (item: CollectionItem) => void
  onToggleFavorite: (item: CollectionItem) => void
}) {
  const navigate = useNavigate()
  const cardRef = useRef<HTMLDivElement>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [tilt, setTilt] = useState<{ x: number; y: number; sheenX: number; sheenY: number }>({
    x: 0,
    y: 0,
    sheenX: 50,
    sheenY: 50,
  })
  const [isHovered, setIsHovered] = useState(false)

  // Cấu hình theme theo loại hình sưu tầm
  const theme = useMemo(() => {
    switch (item.item_type) {
      case 'BOOK':
        return {
          label: 'SÁCH',
          icon: BookOpen,
          badgeBg: 'linear-gradient(135deg, #a855f7, #6366f1)',
          borderGradient: 'linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #6366f1 100%)',
          glowColor: 'rgba(168, 85, 247, 0.45)',
          cardBg: 'linear-gradient(145deg, rgba(29, 24, 38, 0.95), rgba(39, 32, 54, 0.95))',
          accent: '#a855f7',
        }
      case 'TRUYEN_H':
        return {
          label: 'TRUYỆN H',
          icon: Heart,
          badgeBg: 'linear-gradient(135deg, #f43f5e, #be123c)',
          borderGradient: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #be123c 100%)',
          glowColor: 'rgba(244, 63, 94, 0.45)',
          cardBg: 'linear-gradient(145deg, rgba(38, 22, 26, 0.95), rgba(54, 28, 35, 0.95))',
          accent: '#f43f5e',
        }
      case 'MANGA':
        return {
          label: 'MANGA / TRUYỆN',
          icon: BookMarked,
          badgeBg: 'linear-gradient(135deg, #10b981, #059669)',
          borderGradient: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)',
          glowColor: 'rgba(16, 185, 129, 0.45)',
          cardBg: 'linear-gradient(145deg, rgba(20, 36, 28, 0.95), rgba(28, 51, 40, 0.95))',
          accent: '#10b981',
        }
      case 'YOUTUBE':
        return {
          label: 'YOUTUBE',
          icon: Youtube,
          badgeBg: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          borderGradient: 'linear-gradient(135deg, #f87171 0%, #ef4444 50%, #b91c1c 100%)',
          glowColor: 'rgba(239, 68, 68, 0.45)',
          cardBg: 'linear-gradient(145deg, rgba(38, 22, 22, 0.95), rgba(54, 28, 28, 0.95))',
          accent: '#ef4444',
        }
      case 'MUSIC':
        return {
          label: 'NHẠC',
          icon: Music,
          badgeBg: 'linear-gradient(135deg, #06b6d4, #0284c7)',
          borderGradient: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #0284c7 100%)',
          glowColor: 'rgba(6, 182, 212, 0.45)',
          cardBg: 'linear-gradient(145deg, rgba(20, 34, 40, 0.95), rgba(26, 48, 58, 0.95))',
          accent: '#06b6d4',
        }
      case 'DIARY':
      default:
        return {
          label: item.category || 'NHẬT KÝ',
          icon: NotebookPen,
          badgeBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
          borderGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
          glowColor: 'rgba(245, 158, 11, 0.45)',
          cardBg: 'linear-gradient(145deg, rgba(38, 30, 20, 0.95), rgba(54, 42, 26, 0.95))',
          accent: '#f59e0b',
        }
    }
  }, [item])

  const Icon = theme.icon

  // Điều hướng khi bấm "Mở xem"
  const handleOpenItem = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.url) {
      if (item.url.startsWith('http')) {
        window.open(item.url, '_blank', 'noopener,noreferrer')
      } else {
        navigate(item.url)
      }
      return
    }

    switch (item.item_type) {
      case 'YOUTUBE':
        navigate(`/youtube/watch/${item.item_id}`)
        break
      case 'BOOK':
        navigate(`/read/${item.item_id}`)
        break
      case 'TRUYEN_H':
        navigate(`/truyenh/${item.item_id}`)
        break
      case 'MANGA':
        if (item.metadata?.genre === 'BL') {
          navigate(`/bl/${item.item_id}`)
        } else if (item.metadata?.genre === 'NGONTINH') {
          navigate(`/ngontinh/${item.item_id}`)
        } else {
          navigate(`/manga`)
        }
        break
      case 'MUSIC':
        navigate(`/music`)
        break
      case 'DIARY':
        navigate(`/daily`)
        break
      default:
        break
    }
  }

  // Hiệu ứng xoay 3D
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const rotateY = ((x - centerX) / centerX) * 14
    const rotateX = -((y - centerY) / centerY) * 14
    const sheenX = Math.round((x / rect.width) * 100)
    const sheenY = Math.round((y / rect.height) * 100)

    setTilt({ x: rotateX, y: rotateY, sheenX, sheenY })
  }

  return (
    <div
      style={{
        perspective: 1200,
        width: '100%',
        height: '100%',
        minHeight: 410,
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
        onClick={() => setIsFlipped(!isFlipped)}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 410,
          borderRadius: 20,
          cursor: 'pointer',
          transformStyle: 'preserve-3d',
          transform: isFlipped
            ? `rotateY(180deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`
            : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
          transition: isHovered && !isFlipped ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          boxShadow: isHovered
            ? `0 20px 40px ${theme.glowColor}, 0 0 25px ${theme.glowColor}`
            : '0 8px 24px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* KHUNG VIỀN 3D HOLOGRAPHIC */}
        <div
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 22,
            background: theme.borderGradient,
            zIndex: 0,
            opacity: isHovered ? 1 : 0.75,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* ════════════════ MẶT TRƯỚC (FRONT) ════════════════ */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 20,
            background: theme.cardBg,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '14px 12px',
            zIndex: isFlipped ? 1 : 2,
          }}
        >
          {/* Lớp phản quang Holographic Sheen */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(circle at ${tilt.sheenX}% ${tilt.sheenY}%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.04) 40%, transparent 70%)`,
              mixBlendMode: 'overlay',
              zIndex: 3,
            }}
          />

          {/* Header Mặt trước */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, zIndex: 4 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 99,
                background: theme.badgeBg,
                color: '#fff',
                fontSize: '0.64rem',
                fontWeight: 800,
                letterSpacing: '0.4px',
                boxShadow: `0 2px 8px ${theme.glowColor}`,
              }}
            >
              <Icon size={11} />
              <span>{theme.label}</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(item)
              }}
              style={{
                background: item.is_favorite ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: 26,
                height: 26,
                display: 'grid',
                placeItems: 'center',
                color: item.is_favorite ? '#f59e0b' : '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Star size={13} fill={item.is_favorite ? '#f59e0b' : 'none'} />
            </button>
          </div>

          {/* Thumbnail / Ảnh bìa dọc dáng dài */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 200,
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 10,
              background: '#000',
              zIndex: 4,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              flexShrink: 0,
            }}
          >
            {item.image_url ? (
              <img
                src={item.image_url}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  background: theme.cardBg,
                  color: theme.accent,
                }}
              >
                <Icon size={42} opacity={0.7} />
              </div>
            )}
          </div>

          {/* Tiêu đề & Subtitle */}
          <div style={{ flex: 1, minWidth: 0, zIndex: 4, display: 'flex', flexDirection: 'column' }}>
            <h3
              style={{
                fontSize: '0.84rem',
                fontWeight: 800,
                color: '#f8fafc',
                margin: '0 0 3px',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.title}
            </h3>
            {item.subtitle && (
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#94a3b8',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.subtitle}
              </div>
            )}
          </div>

          {/* Footer Mặt trước */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 6,
              paddingTop: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.68rem',
              color: '#94a3b8',
              zIndex: 4,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <RotateCw size={10} style={{ opacity: 0.7 }} /> Lật thẻ
            </span>

            <button
              type="button"
              onClick={handleOpenItem}
              style={{
                background: theme.badgeBg,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '4px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: `0 2px 6px ${theme.glowColor}`,
              }}
            >
              <Play size={9} fill="#fff" /> Mở xem
            </button>
          </div>
        </div>

        {/* ════════════════ MẶT SAU (BACK) ════════════════ */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 20,
            background: 'linear-gradient(145deg, #18181b, #09090b)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 16,
            zIndex: isFlipped ? 2 : 1,
          }}
        >
          {/* Header Mặt sau */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: theme.accent, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sparkles size={13} />
              <span>THÔNG TIN SƯU TẬP</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(item)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={11} /> Bỏ sưu tầm
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.82rem', lineHeight: 1.5, color: '#e4e4e7' }}>
            <div style={{ fontWeight: 800, color: '#f8fafc', marginBottom: 4 }}>{item.title}</div>
            {item.subtitle && <div style={{ color: theme.accent, fontSize: '0.76rem', marginBottom: 8 }}>{item.subtitle}</div>}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.74rem', color: '#a1a1aa', marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={12} />
                <span>Đã lưu: {formatCollectionDate(item.created_at)}</span>
              </div>
              {item.category && (
                <div>Phân loại: <span style={{ color: '#f8fafc' }}>{item.category}</span></div>
              )}
            </div>
          </div>

          {/* Action button mặt sau */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 10,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              marginTop: 10,
            }}
          >
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
              <RotateCw size={11} /> Chạm lật lại
            </span>

            <button
              type="button"
              onClick={handleOpenItem}
              style={{
                background: theme.badgeBg,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <ExternalLink size={12} /> Mở nội dung
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
