import React, { useState, useRef, useMemo } from 'react'
import {
  Sparkles, Star, Calendar, Clock,
  Pencil, RotateCw, Heart, Award,
  BookOpen, Bookmark
} from 'lucide-react'
import { isEntryFirstTime, isEntrySpecial, type Entry } from '../../types'

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

function getBookTitle(content: string, fallback: string): string {
  if (!content) return fallback
  const firstLine = content.split('\n')[0].replace(/^Từ\s+.*?:/i, '').replace(/^(\[[^\]]+\]\s*)+/i, '').trim()
  if (!firstLine) return fallback
  const words = firstLine.split(/\s+/)
  if (words.length <= 6) return firstLine
  return words.slice(0, 6).join(' ') + '…'
}

export function formatMemoryCardContent(content: string): string {
  if (!content) return ''
  return content.replace(/^(\[[^\]]+\]\s*)+/, '')
}

/** Sinh mã băm từ chuỗi để chọn biến thể đồ họa ngẫu nhiên nhưng ổn định */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 * COMPONENT: BookCoverArt (Bìa sách nghệ thuật tự tạo hình chữ nhật nhỏ)
 * ══════════════════════════════════════════════════════════════════════════
 */
function BookCoverArt({
  entry,
  isFirstTime,
  isSpecial,
  isBoth,
}: {
  entry: Entry
  isFirstTime: boolean
  isSpecial: boolean
  isBoth: boolean
}) {
  const year = entry.entry_date ? entry.entry_date.slice(0, 4) : new Date().getFullYear().toString()
  const title = useMemo(() => {
    const defaultTitle = isBoth ? 'Kỷ Niệm Siêu Phẩm' : isSpecial ? 'Kỷ Niệm Đặc Biệt' : 'Cột Mốc Lần Đầu'
    return getBookTitle(entry.content, defaultTitle)
  }, [entry.content, isBoth, isSpecial])

  const variant = useMemo(() => hashString(entry.id || entry.content) % 3, [entry.id, entry.content])

  // Nếu người dùng đã upload ảnh hoặc video thực tế: Hiển thị ảnh bìa thực tế kèm khung viền sách
  if (entry.image_url) {
    const isVideo = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(entry.image_url)
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 185,
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 12,
          background: '#09090b',
          zIndex: 4,
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.45), inset 4px 0 8px rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        {/* Lớp gáy sách bên trái */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 12,
            background: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(255,255,255,0.12) 40%, rgba(0,0,0,0.4) 100%)',
            zIndex: 6,
            pointerEvents: 'none',
          }}
        />

        {isVideo ? (
          <video
            src={entry.image_url}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src={entry.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {/* Lớp vignette và dải ruy băng bìa */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.4) 100%)',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        />

        {/* Nhãn loại bìa sách ở góc trên */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 7,
            padding: '3px 8px',
            borderRadius: 6,
            background: isBoth
              ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.9), rgba(139, 92, 246, 0.9))'
              : isSpecial
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9))'
                : 'linear-gradient(135deg, rgba(6, 182, 212, 0.9), rgba(59, 130, 246, 0.9))',
            color: '#fff',
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {isBoth ? <Award size={10} /> : isSpecial ? <Sparkles size={10} /> : <Star size={10} />}
          <span>{isBoth ? 'SIÊU PHẨM' : isSpecial ? 'ĐẶC BIỆT' : 'LẦN ĐẦU'}</span>
        </div>

        {/* Tên tựa đề bìa sách ở góc dưới */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 16,
            right: 8,
            zIndex: 7,
          }}
        >
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.3,
              textShadow: '0 2px 4px rgba(0,0,0,0.8)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            ✦ BÌA KỶ NIỆM · {year} ✦
          </div>
        </div>
      </div>
    )
  }

  // ─── TỰ TẠO ẢNH BÌA SÁCH NGHỆ THUẬT (ARTISTIC BOOK COVER) ───────────────────
  // Khi người dùng không đính kèm ảnh, tạo bìa sách hình chữ nhật với gradient và hoa văn đồ họa sang trọng
  let coverBg = ''
  let foilColor = ''
  let emblemIcon = null
  let badgeLabel = ''
  let subtitle = ''

  if (isBoth) {
    coverBg =
      variant === 0
        ? 'linear-gradient(145deg, #4c0519 0%, #701a75 40%, #4338ca 100%)'
        : variant === 1
          ? 'linear-gradient(145deg, #2e1065 0%, #831843 50%, #0c4a6e 100%)'
          : 'linear-gradient(145deg, #581c87 0%, #be185d 50%, #1e1b4b 100%)'
    foilColor = '#f472b6'
    badgeLabel = '👑 SIÊU PHẨM KỶ NIỆM'
    subtitle = `MASTERPIECE EDITION · ${year}`
    emblemIcon = '👑'
  } else if (isSpecial) {
    coverBg =
      variant === 0
        ? 'linear-gradient(145deg, #1c1917 0%, #78350f 40%, #d97706 75%, #ea580c 100%)'
        : variant === 1
          ? 'linear-gradient(145deg, #292524 0%, #854d0e 45%, #b45309 80%, #7c2d12 100%)'
          : 'linear-gradient(145deg, #18181b 0%, #9a3412 40%, #c2410c 75%, #f59e0b 100%)'
    foilColor = '#fbbf24'
    badgeLabel = '🌟 KỶ NIỆM ĐẶC BIỆT'
    subtitle = `SPECIAL ARCHIVE · ${year}`
    emblemIcon = '🌟'
  } else if (isFirstTime) {
    // Lần đầu (First time milestone)
    coverBg =
      variant === 0
        ? 'linear-gradient(145deg, #030712 0%, #083344 35%, #0e7490 70%, #0284c7 100%)'
        : variant === 1
          ? 'linear-gradient(145deg, #022c22 0%, #0f766e 40%, #0284c7 75%, #3b82f6 100%)'
          : 'linear-gradient(145deg, #0f172a 0%, #0369a1 40%, #06b6d4 75%, #4f46e5 100%)'
    foilColor = '#22d3ee'
    badgeLabel = '✨ CỘT MỐC LẦN ĐẦU'
    subtitle = `FIRST MILESTONE · ${year}`
    emblemIcon = '✨'
  } else {
    coverBg = 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
    foilColor = '#94a3b8'
    badgeLabel = '📝 BÀI VIẾT KỶ NIỆM'
    subtitle = `DIARY ARCHIVE · ${year}`
    emblemIcon = '📖'
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 185,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 12,
        background: coverBg,
        zIndex: 4,
        boxShadow: `0 8px 24px rgba(0, 0, 0, 0.45), inset 5px 0 10px rgba(0, 0, 0, 0.7)`,
        border: `1px solid ${foilColor}40`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 14px 10px 18px',
      }}
    >
      {/* Lớp gáy sách 3D dập nổi ở mép trái */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 14,
          background: 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(255,255,255,0.18) 35%, rgba(0,0,0,0.5) 100%)',
          zIndex: 6,
          pointerEvents: 'none',
        }}
      />

      {/* Hoa văn hình học nghệ thuật nền (Decorative Vector Geometry) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.22,
          backgroundImage: `radial-gradient(circle at 80% 20%, ${foilColor} 0%, transparent 45%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.8) 0%, transparent 40%)`,
          zIndex: 1,
        }}
      />

      {/* Vòng tròn thiên hà & vạch kẻ ánh kim */}
      <svg
        style={{
          position: 'absolute',
          right: -20,
          top: -20,
          width: 170,
          height: 170,
          opacity: 0.25,
          zIndex: 1,
          pointerEvents: 'none',
        }}
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="45" fill="none" stroke="#fff" strokeWidth="0.75" strokeDasharray="3 3" />
        <circle cx="50" cy="50" r="35" fill="none" stroke={foilColor} strokeWidth="1" />
        <circle cx="50" cy="50" r="22" fill="none" stroke="#fff" strokeWidth="0.5" />
        <line x1="10" y1="50" x2="90" y2="50" stroke={foilColor} strokeWidth="0.5" />
        <line x1="50" y1="10" x2="50" y2="90" stroke={foilColor} strokeWidth="0.5" />
      </svg>

      {/* Header bìa sách: Ruy băng định danh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            border: `1px solid ${foilColor}60`,
            color: foilColor,
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.5px',
          }}
        >
          <span>{badgeLabel}</span>
        </div>

        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', fontWeight: 700, letterSpacing: '0.5px' }}>
          VOL. {year}
        </span>
      </div>

      {/* Trung tâm bìa sách: Huy hiệu 3D & Biểu tượng nghệ thuật */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 3,
          margin: '4px 0',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.3) 0%, rgba(0,0,0,0.6) 80%)`,
            border: `1.5px solid ${foilColor}`,
            boxShadow: `0 4px 12px ${foilColor}40, inset 0 2px 6px rgba(255,255,255,0.4)`,
            display: 'grid',
            placeItems: 'center',
            fontSize: '1.3rem',
            flexShrink: 0,
          }}
        >
          {emblemIcon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.92rem',
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.25,
              textShadow: '0 2px 6px rgba(0,0,0,0.9)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              letterSpacing: '-0.2px',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: '0.64rem', color: foilColor, fontWeight: 700, marginTop: 2, letterSpacing: '0.3px' }}>
            ✦ {entry.entry_time ? `Lúc ${entry.entry_time}` : 'Nhật ký tâm huyết'} ✦
          </div>
        </div>
      </div>

      {/* Footer bìa sách: Con dấu ấn bản */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255, 255, 255, 0.15)',
          paddingTop: 5,
          zIndex: 3,
        }}
      >
        <span style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <Bookmark size={10} color={foilColor} /> {subtitle}
        </span>

        <span style={{ fontSize: '0.58rem', fontWeight: 800, color: foilColor, background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: 4 }}>
          LIMITED
        </span>
      </div>
    </div>
  )
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 * COMPONENT CHÍNH: Memory3DCard (Thẻ sưu tập 3D xoay lật đa chiều)
 * ══════════════════════════════════════════════════════════════════════════
 */
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

  // Nhận diện chuẩn xác Lần đầu / Đặc biệt qua helper đa tầng
  const isFirstTime = isEntryFirstTime(entry)
  const isSpecial = isEntrySpecial(entry)
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
        cardBg: 'linear-gradient(145deg, rgba(24, 24, 27, 0.98), rgba(39, 39, 42, 0.98))',
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
        cardBg: 'linear-gradient(145deg, rgba(28, 25, 23, 0.98), rgba(41, 37, 36, 0.98))',
        accent: '#f59e0b',
      }
    }
    return {
      badgeText: '✨ CỘT MỐC LẦN ĐẦU',
      badgeBg: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      badgeColor: '#fff',
      borderGradient: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #3b82f6 100%)',
      glowColor: 'rgba(6, 182, 212, 0.45)',
      cardBg: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98))',
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

    // Góc xoay tối đa 12 độ
    const rotateY = ((x - centerX) / centerX) * 12
    const rotateX = -((y - centerY) / centerY) * 12

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

  const handleFlip = () => setIsFlipped(!isFlipped)

  return (
    <div
      style={{
        perspective: 1200,
        width: '100%',
        height: '100%',
        minHeight: 440,
        userSelect: 'none',
      }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleFlip}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: 440,
          borderRadius: 22,
          cursor: 'pointer',
          transformStyle: 'preserve-3d',
          transform: isFlipped
            ? `rotateY(180deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`
            : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
          transition: isHovered && !isFlipped ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          boxShadow: isHovered
            ? `0 20px 45px ${theme.glowColor}, 0 0 25px ${theme.glowColor}`
            : '0 8px 24px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* LỚP KHUNG VIỀN 3D HOLOGRAPHIC CHUNG */}
        <div
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 24,
            background: theme.borderGradient,
            zIndex: 0,
            opacity: isHovered ? 1 : 0.8,
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* ════════════════ MẶT TRƯỚC (FRONT) ════════════════ */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            background: theme.cardBg,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 14,
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
            {/* Badge Loại thẻ */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 11px',
                borderRadius: 99,
                background: theme.badgeBg,
                color: theme.badgeColor,
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.4px',
                boxShadow: `0 2px 10px ${theme.glowColor}`,
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
                background: entry.is_favorite ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.08)',
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
              title="Yêu thích thẻ"
            >
              <Star size={14} fill={entry.is_favorite ? '#f59e0b' : 'none'} />
            </button>
          </div>

          {/* Bìa sách nghệ thuật (Book Cover Art) */}
          <BookCoverArt
            entry={entry}
            isFirstTime={isFirstTime}
            isSpecial={isSpecial}
            isBoth={isBoth}
          />

          {/* Ngày tháng & Khung giờ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', color: '#cbd5e1', marginBottom: 8, zIndex: 4, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#f8fafc' }}>
              <Calendar size={12} color={theme.accent} />
              {formatCardDate(entry.entry_date)}
            </span>
            {entry.entry_time && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, opacity: 0.9, background: 'rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: 6, fontSize: '0.7rem' }}>
                <Clock size={11} color="var(--amber)" />
                {entry.entry_time}
              </span>
            )}
          </div>

          {/* Nội dung trích đoạn nhật ký */}
          <div
            style={{
              flex: 1,
              fontSize: '0.82rem',
              lineHeight: 1.5,
              color: '#e2e8f0',
              fontWeight: 500,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              zIndex: 4,
              fontStyle: 'normal',
            }}
          >
            {formatMemoryCardContent(entry.content)}
          </div>

          {/* Footer Mặt trước */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.72rem',
              color: '#94a3b8',
              zIndex: 4,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#a1a1aa' }}>
              <RotateCw size={11} style={{ opacity: 0.7 }} /> Chạm để lật thẻ 3D
            </span>

            <span style={{ fontWeight: 800, color: theme.accent, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 3 }}>
              <BookOpen size={11} /> THẺ SƯU TẬP
            </span>
          </div>
        </div>

        {/* ════════════════ MẶT SAU (BACK - FLIPPED 180 DEG) ════════════════ */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
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
              <span>TOÀN VĂN KỶ NIỆM</span>
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
          <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={12} color={theme.accent} />
            <span>{formatCardDate(entry.entry_date)} {entry.entry_time ? `· Lúc ${entry.entry_time}` : ''}</span>
          </div>

          {/* Toàn bộ nội dung nhật ký đầy đủ */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              fontSize: '0.84rem',
              lineHeight: 1.65,
              color: '#e4e4e7',
              whiteSpace: 'pre-wrap',
              paddingRight: 4,
              marginBottom: 10,
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 10,
              padding: 10,
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {formatMemoryCardContent(entry.content)}
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
              <RotateCw size={11} /> Chạm để quay lại bìa sách
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
