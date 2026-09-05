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
 * THẺ SÁCH 3D VUỐT XOAY 360 ĐỘ TRÊN KỆ SÁCH
 * ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
 * COMPONENT: Interactive3DTreeCanvas
 * CÂY KỶ NIỆM 3D ĐÍCH THỰC — XOAY 360 ĐỘ — 12 HOA TƯỢNG TRƯNG 12 THÁNG
 * ═══════════════════════════════════════════════════════════════════ */
interface MonthFlower3D {
  month: number
  label: string
  x: number
  y: number
  z: number
  count: number
  baseRadius: number
}

interface Interactive3DTreeCanvasProps {
  year?: number
  events: SharedEvent[]
  theme: ReturnType<typeof getSeasonTheme>
  onOpenBook: () => void
  onSelectMonth?: (monthNum: number) => void
}

function Interactive3DTreeCanvas({
  events,
  theme,
  onOpenBook,
  onSelectMonth,
}: Interactive3DTreeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Đếm số kỷ niệm theo từng tháng 1..12
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let i = 1; i <= 12; i++) counts[i] = 0
    for (const ev of events) {
      if (!ev.event_date) continue
      const m = parseInt(ev.event_date.slice(5, 7), 10)
      if (m >= 1 && m <= 12) {
        counts[m] = (counts[m] || 0) + 1
      }
    }
    return counts
  }, [events])

  // Dữ liệu 12 bông hoa tượng trưng 12 tháng phân bổ trên không gian 3D quanh tán cây
  const monthFlowers = useMemo<MonthFlower3D[]>(() => {
    const list: MonthFlower3D[] = []
    for (let m = 1; m <= 12; m++) {
      const angle = ((m - 1) / 12) * Math.PI * 2 - Math.PI / 2
      const radius = 96 + ((m % 2 === 0) ? 14 : -10)
      const y = -140 - Math.sin(((m - 1) / 12) * Math.PI * 2) * 48
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const count = monthCounts[m] || 0
      list.push({
        month: m,
        label: `T${m}`,
        x,
        y,
        z,
        count,
        baseRadius: count > 0 ? 19 : 15,
      })
    }
    return list
  }, [monthCounts])

  // Cấu trúc cành cây 3D cố định
  const branches = useMemo(() => {
    const list: Array<{ start: [number, number, number]; end: [number, number, number]; width: number }> = []
    for (let i = 0; i < 6; i++) {
      const ang = i * (Math.PI / 3) + 0.2
      const bx = Math.cos(ang) * 65
      const bz = Math.sin(ang) * 65
      const by = -125 + (i % 2 === 0 ? 14 : -14)
      list.push({ start: [0, -70, 0], end: [bx, by, bz], width: 8.5 })

      // Nhánh nhỏ 1
      const s1x = bx + Math.cos(ang - 0.45) * 32
      const s1z = bz + Math.sin(ang - 0.45) * 32
      list.push({ start: [bx, by, bz], end: [s1x, by - 36, s1z], width: 4.2 })

      // Nhánh nhỏ 2
      const s2x = bx + Math.cos(ang + 0.45) * 32
      const s2z = bz + Math.sin(ang + 0.45) * 32
      list.push({ start: [bx, by, bz], end: [s2x, by - 40, s2z], width: 3.8 })
    }
    return list
  }, [])

  // Các cụm tán lá 3D bồng bềnh
  const canopyPuffs = useMemo(() => {
    const list: Array<{ x: number; y: number; z: number; r: number; colorIdx: number }> = []
    list.push({ x: 0, y: -180, z: 0, r: 58, colorIdx: 0 })
    list.push({ x: 0, y: -148, z: 0, r: 52, colorIdx: 1 })
    list.push({ x: 0, y: -206, z: 0, r: 44, colorIdx: 2 })

    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2
      const dist = 52 + (i % 3) * 12
      const cy = -158 + Math.sin(i * 1.5) * 28
      list.push({
        x: Math.cos(ang) * dist,
        y: cy,
        z: Math.sin(ang) * dist,
        r: 38 + (i % 3) * 8,
        colorIdx: i % 3,
      })
    }
    return list
  }, [])

  // Hạt cánh hoa rơi và đom đóm 3D
  const particlesRef = useRef({
    petals: Array.from({ length: 22 }, () => ({
      x: (Math.random() - 0.5) * 220,
      y: -220 + Math.random() * 260,
      z: (Math.random() - 0.5) * 220,
      speed: 0.55 + Math.random() * 0.65,
      seed: Math.random() * 10,
      size: 4 + Math.random() * 3.5,
      rot: Math.random() * Math.PI * 2,
    })),
    fireflies: Array.from({ length: 12 }, () => ({
      x: (Math.random() - 0.5) * 160,
      y: -210 + Math.random() * 170,
      z: (Math.random() - 0.5) * 160,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03,
      radius: 1.5 + Math.random() * 1.5,
    })),
  })

  // Góc xoay 3D
  const rotYRef = useRef(0)
  const rotXRef = useRef(0.08)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number; startRotY: number; startRotX: number } | null>(null)
  const hasMovedRef = useRef(false)

  // Tooltip hoa được hover
  const [hoveredFlower, setHoveredFlower] = useState<{
    month: number
    label: string
    count: number
    screenX: number
    screenY: number
  } | null>(null)

  // Vòng lặp vẽ Canvas 3D
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let lastTime = performance.now()

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    const render = (time: number) => {
      animId = requestAnimationFrame(render)
      const dt = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      // Tự động xoay nhẹ khi người dùng không kéo
      if (!isDraggingRef.current) {
        rotYRef.current += 0.22 * dt
      }

      const dpr = window.devicePixelRatio || 1
      const w = canvas.width
      const h = canvas.height
      if (w === 0 || h === 0) return

      ctx.clearRect(0, 0, w, h)

      const centerX = w / 2
      const centerY = h * 0.72

      const cosY = Math.cos(rotYRef.current)
      const sinY = Math.sin(rotYRef.current)
      const cosX = Math.cos(rotXRef.current)
      const sinX = Math.sin(rotXRef.current)

      const fov = 440 * dpr
      const cameraDist = 410

      // Hàm chiếu 3D sang 2D
      const project = (x: number, y: number, z: number) => {
        const x1 = x * cosY + z * sinY
        const y1 = y
        const z1 = -x * sinY + z * cosY

        const x2 = x1
        const y2 = y1 * cosX - z1 * sinX
        const z2 = y1 * sinX + z1 * cosX

        const scale = fov / (cameraDist + z2)
        return {
          screenX: centerX + x2 * scale,
          screenY: centerY + y2 * scale,
          scale,
          depth: z2,
        }
      }

      // Danh sách các phần tử vẽ theo thứ tự chiều sâu Depth
      type DrawItem = {
        depth: number
        draw: () => void
      }
      const drawItems: DrawItem[] = []

      // 1. Đế đảo đất phát sáng dưới chân cây
      drawItems.push({
        depth: 95,
        draw: () => {
          const p = project(0, 36, 0)
          const rx = 105 * p.scale
          const ry = 30 * p.scale

          // Bóng mờ chân đế
          const shadowGrad = ctx.createRadialGradient(p.screenX, p.screenY + 6 * p.scale, rx * 0.3, p.screenX, p.screenY + 6 * p.scale, rx * 1.1)
          shadowGrad.addColorStop(0, 'rgba(217, 119, 6, 0.25)')
          shadowGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.08)')
          shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
          ctx.beginPath()
          ctx.ellipse(p.screenX, p.screenY + 6 * p.scale, rx * 1.1, ry * 1.1, 0, 0, Math.PI * 2)
          ctx.fillStyle = shadowGrad
          ctx.fill()

          // Đảo cỏ ngọc ấm áp
          const moundGrad = ctx.createLinearGradient(p.screenX - rx, p.screenY - ry, p.screenX + rx, p.screenY + ry)
          moundGrad.addColorStop(0, '#fef08a')
          moundGrad.addColorStop(0.4, '#86efac')
          moundGrad.addColorStop(1, '#22c55e')

          ctx.beginPath()
          ctx.ellipse(p.screenX, p.screenY, rx, ry, 0, 0, Math.PI * 2)
          ctx.fillStyle = moundGrad
          ctx.fill()
          ctx.lineWidth = 2 * dpr
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)'
          ctx.stroke()
        },
      })

      // 2. Rễ cây tỏa ra 4 hướng
      const roots = [
        { start: [0, 32, 0], end: [-35, 38, -20] },
        { start: [0, 32, 0], end: [35, 38, 20] },
        { start: [0, 32, 0], end: [25, 38, -30] },
        { start: [0, 32, 0], end: [-25, 38, 30] },
      ]
      for (const r of roots) {
        const p1 = project(r.start[0], r.start[1], r.start[2])
        const p2 = project(r.end[0], r.end[1], r.end[2])
        drawItems.push({
          depth: (p1.depth + p2.depth) / 2,
          draw: () => {
            ctx.beginPath()
            ctx.moveTo(p1.screenX, p1.screenY)
            ctx.lineTo(p2.screenX, p2.screenY)
            ctx.lineWidth = 6.5 * p1.scale
            ctx.lineCap = 'round'
            ctx.strokeStyle = '#5d4037'
            ctx.stroke()
          },
        })
      }

      // 3. Thân cây chính (Trunk) với gradient vỏ gỗ 3D
      const trunkPoints: Array<[number, number, number]> = [
        [0, 34, 0],
        [3, 5, 0],
        [-2, -32, 0],
        [0, -75, 0],
      ]
      for (let i = 0; i < trunkPoints.length - 1; i++) {
        const pA = project(trunkPoints[i][0], trunkPoints[i][1], trunkPoints[i][2])
        const pB = project(trunkPoints[i + 1][0], trunkPoints[i + 1][1], trunkPoints[i + 1][2])
        const width = (18 - i * 3.5) * pA.scale
        drawItems.push({
          depth: (pA.depth + pB.depth) / 2,
          draw: () => {
            ctx.beginPath()
            ctx.moveTo(pA.screenX, pA.screenY)
            ctx.lineTo(pB.screenX, pB.screenY)
            ctx.lineWidth = width
            ctx.lineCap = 'round'
            ctx.strokeStyle = '#6d4c41'
            ctx.stroke()

            // Highlight bóng sáng trên thân cây
            ctx.beginPath()
            ctx.moveTo(pA.screenX - width * 0.2, pA.screenY)
            ctx.lineTo(pB.screenX - width * 0.2, pB.screenY)
            ctx.lineWidth = width * 0.3
            ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)'
            ctx.stroke()
          },
        })
      }

      // 4. Các nhánh cây vươn ra không gian 3D
      for (const b of branches) {
        const pS = project(b.start[0], b.start[1], b.start[2])
        const pE = project(b.end[0], b.end[1], b.end[2])
        drawItems.push({
          depth: (pS.depth + pE.depth) / 2,
          draw: () => {
            ctx.beginPath()
            ctx.moveTo(pS.screenX, pS.screenY)
            ctx.lineTo(pE.screenX, pE.screenY)
            ctx.lineWidth = b.width * pS.scale
            ctx.lineCap = 'round'
            ctx.strokeStyle = '#5d4037'
            ctx.stroke()
          },
        })
      }

      // 5. Các cụm tán lá 3D (Canopy Puffs)
      const sway = Math.sin(time * 0.002) * 2
      for (const puff of canopyPuffs) {
        const p = project(puff.x + sway, puff.y, puff.z)
        const radius = puff.r * p.scale
        drawItems.push({
          depth: p.depth,
          draw: () => {
            const grad = ctx.createRadialGradient(
              p.screenX - radius * 0.25,
              p.screenY - radius * 0.25,
              radius * 0.1,
              p.screenX,
              p.screenY,
              radius
            )
            const baseColor = theme.treeCanopy[puff.colorIdx % theme.treeCanopy.length] || '#43a047'
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.65)')
            grad.addColorStop(0.2, baseColor)
            grad.addColorStop(0.85, baseColor)
            grad.addColorStop(1, 'rgba(0,0,0,0.12)')

            ctx.beginPath()
            ctx.arc(p.screenX, p.screenY, radius, 0, Math.PI * 2)
            ctx.fillStyle = grad
            ctx.fill()
          },
        })
      }

      // 6. Cánh hoa rơi (Falling Petals)
      const particles = particlesRef.current
      for (const petal of particles.petals) {
        petal.y += petal.speed * 60 * dt
        petal.rot += 1.5 * dt
        if (petal.y > 45) {
          petal.y = -220
          petal.x = (Math.random() - 0.5) * 200
          petal.z = (Math.random() - 0.5) * 200
        }
        const px = petal.x + Math.sin(time * 0.0015 + petal.seed) * 15
        const p = project(px, petal.y, petal.z)
        const pSize = petal.size * p.scale
        drawItems.push({
          depth: p.depth,
          draw: () => {
            ctx.save()
            ctx.translate(p.screenX, p.screenY)
            ctx.rotate(petal.rot)
            ctx.beginPath()
            ctx.ellipse(0, 0, pSize, pSize * 0.55, 0, 0, Math.PI * 2)
            ctx.fillStyle = theme.petalColor
            ctx.globalAlpha = 0.8
            ctx.fill()
            ctx.restore()
          },
        })
      }

      // 7. Đom đóm phát sáng (Fireflies)
      for (const ff of particles.fireflies) {
        const fy = ff.y + Math.sin(time * 0.003 + ff.phase) * 10
        const p = project(ff.x, fy, ff.z)
        const alpha = 0.35 + 0.55 * Math.sin(time * 0.005 + ff.phase)
        drawItems.push({
          depth: p.depth,
          draw: () => {
            const rad = ff.radius * p.scale
            ctx.beginPath()
            ctx.arc(p.screenX, p.screenY, rad * 2.8, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.4})`
            ctx.fill()

            ctx.beginPath()
            ctx.arc(p.screenX, p.screenY, rad, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
            ctx.fill()
          },
        })
      }

      // 8. ĐẶC BIỆT: 12 BÔNG HOA TƯỢNG TRƯNG 12 THÁNG NỞ RỰC RỠ TRÊN TÁN CÂY
      for (const fl of monthFlowers) {
        const p = project(fl.x, fl.y, fl.z)
        const isHovered = hoveredFlower?.month === fl.month
        const baseR = (fl.baseRadius + (isHovered ? 4 : 0)) * p.scale

        drawItems.push({
          depth: p.depth,
          draw: () => {
            const { screenX: sx, screenY: sy } = p

            // Vòng hào quang sáng vàng nếu tháng đó có kỷ niệm
            if (fl.count > 0 || isHovered) {
              const pulse = Math.sin(time * 0.006 + fl.month) * 3 * p.scale
              ctx.beginPath()
              ctx.arc(sx, sy, baseR + 7 * p.scale + pulse, 0, Math.PI * 2)
              ctx.fillStyle = isHovered ? 'rgba(245, 158, 11, 0.45)' : 'rgba(254, 240, 138, 0.35)'
              ctx.fill()
            }

            // 5 cánh hoa bung nở lộng lẫy
            const petalCount = 5
            const petalDist = baseR * 0.58
            const petalR = baseR * 0.52
            for (let i = 0; i < petalCount; i++) {
              const pAng = (i / petalCount) * Math.PI * 2 + (fl.month * 0.3)
              const px = sx + Math.cos(pAng) * petalDist
              const py = sy + Math.sin(pAng) * petalDist

              ctx.beginPath()
              ctx.arc(px, py, petalR, 0, Math.PI * 2)
              const petalColor = theme.flowers[i % theme.flowers.length] || theme.petalColor
              ctx.fillStyle = petalColor
              ctx.fill()
              ctx.lineWidth = 1 * dpr
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
              ctx.stroke()
            }

            // Nhuỵ hoa trung tâm mạ vàng / trắng ngọc
            ctx.beginPath()
            ctx.arc(sx, sy, baseR * 0.58, 0, Math.PI * 2)
            ctx.fillStyle = fl.count > 0 ? '#fef08a' : '#ffffff'
            ctx.fill()
            ctx.lineWidth = 1.5 * dpr
            ctx.strokeStyle = '#f59e0b'
            ctx.stroke()

            // Chữ tên tháng (T1, T2, ..., T12)
            ctx.font = `900 ${Math.max(10, Math.floor(10.5 * p.scale))}px Inter, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#78350f'
            ctx.fillText(fl.label, sx, sy + 0.5 * dpr)

            // Badge số lượng kỷ niệm nếu có
            if (fl.count > 0) {
              const badgeX = sx + baseR * 0.7
              const badgeY = sy - baseR * 0.7
              const badgeR = 7.5 * p.scale

              ctx.beginPath()
              ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2)
              ctx.fillStyle = '#ea580c'
              ctx.fill()
              ctx.lineWidth = 1 * dpr
              ctx.strokeStyle = '#ffffff'
              ctx.stroke()

              ctx.font = `800 ${Math.max(7, Math.floor(8 * p.scale))}px Inter, sans-serif`
              ctx.fillStyle = '#ffffff'
              ctx.fillText(String(fl.count), badgeX, badgeY)
            }
          },
        })
      }

      // SẮP XẾP VÀ VẼ THEO THỨ TỰ CHIỀU SÂU (Depth-sorting Painter's Algorithm)
      drawItems.sort((a, b) => b.depth - a.depth)
      for (const item of drawItems) {
        item.draw()
      }
    }

    animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [theme, monthFlowers, branches, canopyPuffs, hoveredFlower])

  // Xử lý kéo xoay 360 độ bằng chuột / cảm ứng
  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    hasMovedRef.current = false
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startRotY: rotYRef.current,
      startRotX: rotXRef.current,
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const pointerX = (e.clientX - rect.left) * (canvas.width / rect.width)
    const pointerY = (e.clientY - rect.top) * (canvas.height / rect.height)

    // Nếu đang kéo vuốt
    if (isDraggingRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMovedRef.current = true
      }
      rotYRef.current = dragStartRef.current.startRotY + dx * 0.011
      rotXRef.current = Math.max(-0.28, Math.min(0.28, dragStartRef.current.startRotX - dy * 0.007))
    }

    // Kiểm tra xem con trỏ chuột có đang trỏ vào 1 trong 12 bông hoa tháng không
    const dpr = window.devicePixelRatio || 1
    const centerX = canvas.width / 2
    const centerY = canvas.height * 0.72
    const cosY = Math.cos(rotYRef.current)
    const sinY = Math.sin(rotYRef.current)
    const cosX = Math.cos(rotXRef.current)
    const sinX = Math.sin(rotXRef.current)
    const fov = 440 * dpr
    const cameraDist = 410

    let hitFlower: typeof hoveredFlower = null
    for (const fl of monthFlowers) {
      const x1 = fl.x * cosY + fl.z * sinY
      const y1 = fl.y
      const z1 = -fl.x * sinY + fl.z * cosY
      const x2 = x1
      const y2 = y1 * cosX - z1 * sinX
      const z2 = y1 * sinX + z1 * cosX
      const scale = fov / (cameraDist + z2)
      const sx = centerX + x2 * scale
      const sy = centerY + y2 * scale

      const dist = Math.hypot(pointerX - sx, pointerY - sy)
      if (dist <= 24 * scale) {
        hitFlower = {
          month: fl.month,
          label: fl.label,
          count: fl.count,
          screenX: (sx / canvas.width) * rect.width,
          screenY: (sy / canvas.height) * rect.height,
        }
        break
      }
    }
    setHoveredFlower(hitFlower)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
    isDraggingRef.current = false
    dragStartRef.current = null

    // Nếu chỉ chạm click (không kéo di chuyển)
    if (!hasMovedRef.current) {
      if (hoveredFlower) {
        if (onSelectMonth) {
          onSelectMonth(hoveredFlower.month)
        } else {
          onOpenBook()
        }
      } else {
        onOpenBook()
      }
    }
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: hoveredFlower ? 'pointer' : 'grab',
        touchAction: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        className="tree-canvas-element"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* Tooltip nổi thông minh khi chạm/hover hoa 12 tháng */}
      {hoveredFlower && (
        <div
          className="tree-month-tooltip"
          style={{
            left: hoveredFlower.screenX,
            top: hoveredFlower.screenY,
          }}
        >
          <span>🌸 Tháng {hoveredFlower.month}:</span>
          <span>
            {hoveredFlower.count > 0 ? `${hoveredFlower.count} kỷ niệm` : 'Chưa có kỷ niệm'}
          </span>
          <span style={{ opacity: 0.6, fontSize: '0.68rem' }}>· Chạm để mở →</span>
        </div>
      )}
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
              <div style={{ width: '100%', maxWidth: 300, margin: '0 auto 8px', borderRadius: 12, overflow: 'hidden' }}>
                <MemoryTreeCover
                  year={selectedYear || new Date().getFullYear()}
                  entryCount={activeYearEvents.length}
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
      <div className={`book-page-sheet day-sheet ${isLeafBack ? 'leaf-back-content' : ''}`}>
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
