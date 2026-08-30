import React, { useState, useRef, useMemo } from 'react'
import {
  Sparkles, Star, Calendar, Clock,
  Pencil, RotateCw, Heart, Award
} from 'lucide-react'
import type { Entry } from '../../types'

export function formatCardDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function Memory3DCard({
  entry,
  onEdit,
  onToggleFavorite,
}: {
  entry: Entry
  onEdit: (entry: Entry) => void
  onToggleFavorite: (entry: Entry) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [tilt, setTilt] = useState<{ x: number; y: number; sheenX: number; sheenY: number }>({
    x: 0,
    y: 0,
    sheenX: 50,
    sheenY: 50,
  })
  const [isHovered, setIsHovered] = useState(false)

  const isFirstTime = Boolean(entry.is_first_time)
  const isSpecial = Boolean(entry.is_special)
  const isBoth = isFirstTime && isSpecial

  // Theme màu sắc theo loại thẻ
  const theme = useMemo(() => {
    if (isBoth) {
      return {
        badgeText: '👑 SIÊU PHẨM KỶ NIỆM',
        badgeBg: 'linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6)',
        badgeColor: '#fff',
        borderGradient: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 25%, #8b5cf6 50%, #3b82f6 75%, #10b981 100%)',
        glowColor: 'rgba(236, 72, 153, 0.45)',
        cardBg: 'linear-gradient(145deg, rgba(24, 24, 27, 0.95), rgba(39, 39, 42, 0.95))',
        accent: '#ec4899',
      }
    }
    if (isSpecial) {
      return {
        badgeText: '🌟 KỶ NIỆM ĐẶC BIỆT',
        badgeBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
        badgeColor: '#fff',
        borderGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #b45309 100%)',
        glowColor: 'rgba(245, 158, 11, 0.45)',
        cardBg: 'linear-gradient(145deg, rgba(28, 25, 23, 0.95), rgba(41, 37, 36, 0.95))',
        accent: '#f59e0b',
      }
    }
    return {
      badgeText: '✨ CỘT MỐC LẦN ĐẦU',
      badgeBg: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      badgeColor: '#fff',
      borderGradient: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #3b82f6 100%)',
      glowColor: 'rgba(6, 182, 212, 0.45)',
      cardBg: 'linear-gradient(145deg, rgba(23, 23, 30, 0.95), rgba(30, 41, 59, 0.95))',
      accent: '#06b6d4',
    }
  }, [isBoth, isSpecial])

  // Xử lý hiệu ứng 3D Tilt khi rê chuột
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Góc xoay tối đa 14 độ
    const rotateY = ((x - centerX) / centerX) * 14
    const rotateX = -((y - centerY) / centerY) * 14

    // Tọa độ ánh kim phản quang
    const sheenX = Math.round((x / rect.width) * 100)
    const sheenY = Math.round((y / rect.height) * 100)

    setTilt({ x: rotateX, y: rotateY, sheenX, sheenY })
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTilt({ x: 0, y: 0, sheenX: 50, sheenY: 50 })
  }

  return (
    <div
      style={{
        perspective: 1200,
        width: '100%',
        minHeight: 340,
        userSelect: 'none',
      }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsFlipped(!isFlipped)}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 340,
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
        {/* LỚP KHUNG VIỀN 3D HOLOGRAPHIC CHUNG */}
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
            padding: 16,
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, zIndex: 4 }}>
            {/* Badge Loại thẻ */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 99,
                background: theme.badgeBg,
                color: theme.badgeColor,
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.4px',
                boxShadow: `0 2px 8px ${theme.glowColor}`,
              }}
            >
              {isBoth ? <Award size={12} /> : isSpecial ? <Sparkles size={12} /> : <Heart size={12} />}
              <span>{theme.badgeText}</span>
            </div>

            {/* Nút Yêu thích */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(entry)
              }}
              style={{
                background: entry.is_favorite ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'grid',
                placeItems: 'center',
                color: entry.is_favorite ? '#f59e0b' : '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Star size={14} fill={entry.is_favorite ? '#f59e0b' : 'none'} />
            </button>
          </div>

          {/* Ngày tháng & Khung giờ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.74rem', color: '#cbd5e1', marginBottom: 12, zIndex: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#f8fafc' }}>
              <Calendar size={13} color={theme.accent} />
              {formatCardDate(entry.entry_date)}
            </span>
            {entry.entry_time && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, opacity: 0.85, background: 'rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: 6 }}>
                <Clock size={11} />
                {entry.entry_time}
              </span>
            )}
          </div>

          {/* Hình ảnh đính kèm (nếu có) */}
          {entry.image_url && (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 120,
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 12,
                background: '#000',
                zIndex: 4,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              }}
            >
              <img
                src={entry.image_url}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Nội dung trích đoạn nhật ký */}
          <div
            style={{
              flex: 1,
              fontSize: '0.86rem',
              lineHeight: 1.5,
              color: '#f1f5f9',
              fontWeight: 500,
              display: '-webkit-box',
              WebkitLineClamp: entry.image_url ? 3 : 6,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              zIndex: 4,
              fontStyle: 'normal',
            }}
          >
            {entry.content}
          </div>

          {/* Footer Mặt trước */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 12,
              paddingTop: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.72rem',
              color: '#94a3b8',
              zIndex: 4,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <RotateCw size={11} style={{ opacity: 0.7 }} /> Chạm để lật thẻ 3D
            </span>

            <span style={{ fontWeight: 700, color: theme.accent, fontSize: '0.7rem' }}>
              ✦ THẺ SƯU TẬP
            </span>
          </div>
        </div>

        {/* ════════════════ MẶT SAU (BACK - FLIPPED 180 DEG) ════════════════ */}
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
              <span>CHI TIẾT KỶ NIỆM</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(entry)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Pencil size={11} /> Sửa bài
            </button>
          </div>

          {/* Ngày & giờ chi tiết */}
          <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginBottom: 10 }}>
            {formatCardDate(entry.entry_date)} {entry.entry_time ? `· Lúc ${entry.entry_time}` : ''}
          </div>

          {/* Toàn bộ nội dung nhật ký đầy đủ */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              fontSize: '0.84rem',
              lineHeight: 1.6,
              color: '#e4e4e7',
              whiteSpace: 'pre-wrap',
              paddingRight: 4,
              marginBottom: 10,
            }}
          >
            {entry.content}
          </div>

          {/* Footer Mặt sau: nút quay lại mặt trước */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.72rem',
              color: '#a1a1aa',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <RotateCw size={11} /> Chạm để quay lại mặt trước
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
