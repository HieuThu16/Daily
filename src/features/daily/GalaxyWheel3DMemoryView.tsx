import { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import { ArrowLeft } from 'lucide-react'
import type { SharedEvent } from '../../types'

/* ---------------------------------------------------------
   Helpers: color, month names & canvas texture generation
--------------------------------------------------------- */

export const GALAXY_MONTH_NAMES = [
  'Tháng Một', 'Tháng Hai', 'Tháng Ba', 'Tháng Tư', 'Tháng Năm', 'Tháng Sáu',
  'Tháng Bảy', 'Tháng Tám', 'Tháng Chín', 'Tháng Mười', 'Tháng Mười Một', 'Tháng Mười Hai',
]

export function paletteForMonth(monthIndex: number, spin = 0) {
  const hue = (((monthIndex - 1) * 30) + spin) % 360
  return {
    hue,
    bgLight: `hsl(${hue}, 70%, 94%)`,
    bgDark: `hsl(${hue}, 60%, 14%)`,
    border: `hsl(${hue}, 75%, 62%)`,
    accent: `hsl(${hue}, 82%, 64%)`,
    accentDeep: `hsl(${hue}, 72%, 40%)`,
    glow: `hsla(${hue}, 92%, 66%, 0.55)`,
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Texture mặt trước của thẻ Tháng (Tarot Celestial Style)
 */
function makeMonthCardTexture(monthIndex: number, count: number): THREE.CanvasTexture {
  const palette = paletteForMonth(monthIndex)
  const c = document.createElement('canvas')
  c.width = 360
  c.height = 504
  const ctx = c.getContext('2d')
  if (ctx) {
    // 1. Nền thẻ bo góc với gradient huyền ảo
    roundRectPath(ctx, 8, 8, 344, 488, 28)
    const bgGrad = ctx.createLinearGradient(0, 0, 360, 504)
    bgGrad.addColorStop(0, '#ffffff')
    bgGrad.addColorStop(0.7, palette.bgLight)
    bgGrad.addColorStop(1, '#fefce8')
    ctx.fillStyle = bgGrad
    ctx.fill()

    // Viền kim loại óng ánh
    ctx.lineWidth = 10
    ctx.strokeStyle = palette.border
    ctx.stroke()

    ctx.lineWidth = 2.5
    ctx.strokeStyle = palette.accentDeep
    ctx.globalAlpha = 0.4
    roundRectPath(ctx, 18, 18, 324, 468, 20)
    ctx.stroke()
    ctx.globalAlpha = 1

    // 2. Vòng tròn huyền bí ở trung tâm
    ctx.beginPath()
    ctx.arc(180, 200, 92, 0, Math.PI * 2)
    ctx.fillStyle = palette.accentDeep
    ctx.globalAlpha = 0.12
    ctx.fill()
    ctx.globalAlpha = 1

    // Hào quang tia sao xoay tròn
    ctx.save()
    ctx.translate(180, 200)
    ctx.strokeStyle = palette.accentDeep
    ctx.lineWidth = 2.5
    ctx.globalAlpha = 0.75
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12)
      ctx.beginPath()
      ctx.moveTo(0, -32)
      ctx.lineTo(0, -72)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1

    // 3. Số tháng (01..12)
    ctx.font = '900 68px "Outfit", "Inter", Georgia, serif'
    ctx.fillStyle = palette.accentDeep
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(monthIndex).padStart(2, '0'), 180, 202)

    // 4. Tên tháng (Tháng Một, Tháng Hai...)
    ctx.font = '800 32px "Outfit", "Inter", Georgia, serif'
    ctx.fillStyle = palette.accentDeep
    ctx.fillText(GALAXY_MONTH_NAMES[monthIndex - 1], 180, 370)

    // 5. Huy hiệu số kỷ niệm (Memory pill badge)
    ctx.font = '700 20px "Outfit", "Inter", sans-serif'
    const countText = count > 0 ? `✨ ${count} kỷ niệm` : 'Chưa có kỷ niệm'
    const pillWidth = ctx.measureText(countText).width + 36

    ctx.save()
    ctx.translate(180, 422)
    roundRectPath(ctx, -pillWidth / 2, -18, pillWidth, 36, 18)
    ctx.fillStyle = count > 0 ? palette.accent : 'rgba(148, 163, 184, 0.25)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = count > 0 ? '#ffffff' : 'rgba(148, 163, 184, 0.5)'
    ctx.stroke()

    ctx.fillStyle = count > 0 ? '#ffffff' : '#64748b'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(countText, 0, 1)
    ctx.restore()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

/**
 * Texture mặt sau của thẻ (Ornate Starry Tarot Card Back)
 */
function makeCardBackTexture(palette: ReturnType<typeof paletteForMonth>, size = 320): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  const w = size
  const h = size * 1.4
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (ctx) {
    // Bo góc và nền tím huyền bí
    roundRectPath(ctx, w * 0.02, h * 0.014, w * 0.96, h * 0.97, w * 0.08)
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#13092b')
    grad.addColorStop(0.5, palette.accentDeep)
    grad.addColorStop(1, '#090518')
    ctx.fillStyle = grad
    ctx.fill()

    // Viền ngoài
    ctx.lineWidth = w * 0.035
    ctx.strokeStyle = palette.border
    ctx.stroke()

    // Đường vân sao chéo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.lineWidth = w * 0.016
    for (let i = -6; i < 10; i++) {
      ctx.beginPath()
      ctx.moveTo(i * (w * 0.18), 0)
      ctx.lineTo(i * (w * 0.18) + w * 1.4, h)
      ctx.stroke()
    }

    // Biểu tượng Mandala chiêm tinh trung tâm
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, w * 0.22, 0, Math.PI * 2)
    ctx.stroke()

    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4)
      ctx.beginPath()
      ctx.moveTo(0, -w * 0.14)
      ctx.lineTo(0, -w * 0.22)
      ctx.stroke()
    }

    // Trái tim vàng nhỏ ở giữa
    ctx.fillStyle = '#ffd700'
    ctx.beginPath()
    ctx.arc(0, 0, w * 0.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

/**
 * Texture cho thẻ Kỷ niệm cụ thể trong Trống ảnh 3D (hiển thị ảnh thật hoặc hoa kỷ niệm)
 */
function makeMemoryCardTexture(
  monthIndex: number,
  cardIndex: number,
  palette: ReturnType<typeof paletteForMonth>,
  eventTitle?: string,
  eventDate?: string,
  loadedImg?: HTMLImageElement
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 280
  c.height = 392
  const ctx = c.getContext('2d')

  if (ctx) {
    roundRectPath(ctx, 6, 6, 268, 380, 22)
    ctx.fillStyle = loadedImg ? '#0f172a' : palette.bgLight
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = palette.border
    ctx.stroke()

    if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
      // 1. Vẽ ảnh kỷ niệm thật đã crop chuẩn cover
      ctx.save()
      roundRectPath(ctx, 12, 12, 256, 280, 16)
      ctx.clip()

      const iw = loadedImg.naturalWidth
      const ih = loadedImg.naturalHeight
      const targetW = 256
      const targetH = 280
      const scale = Math.max(targetW / iw, targetH / ih)
      const sw = targetW / scale
      const sh = targetH / scale
      const sx = (iw - sw) / 2
      const sy = (ih - sh) / 2
      ctx.drawImage(loadedImg, sx, sy, sw, sh, 12, 12, targetW, targetH)
      ctx.restore()

      // Gradient mờ che chân ảnh
      const footGrad = ctx.createLinearGradient(0, 240, 0, 380)
      footGrad.addColorStop(0, 'rgba(15, 23, 42, 0)')
      footGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.85)')
      footGrad.addColorStop(1, 'rgba(15, 23, 42, 1)')
      ctx.fillStyle = footGrad
      roundRectPath(ctx, 12, 240, 256, 140, 16)
      ctx.fill()

      // Chữ tiêu đề & Ngày
      ctx.font = '800 20px "Outfit", "Inter", sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const displayTitle = eventTitle ? (eventTitle.length > 20 ? eventTitle.slice(0, 19) + '…' : eventTitle) : `Kỷ niệm #${cardIndex}`
      ctx.fillText(displayTitle, 140, 318)

      ctx.font = '600 15px "Outfit", sans-serif'
      ctx.fillStyle = palette.accent
      ctx.fillText(eventDate || GALAXY_MONTH_NAMES[monthIndex - 1], 140, 348)
    } else {
      // 2. Không có ảnh: vẽ đóa hoa ngũ sắc nghệ thuật
      ctx.beginPath()
      ctx.arc(140, 150, 70, 0, Math.PI * 2)
      ctx.fillStyle = palette.accentDeep
      ctx.globalAlpha = 0.15
      ctx.fill()
      ctx.globalAlpha = 1

      ctx.beginPath()
      const cx = 140
      const cy = 150
      const R = 44
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        ctx.ellipse(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55, 26, 18, a, 0, Math.PI * 2)
      }
      ctx.fillStyle = palette.accent
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx, cy, 14, 0, Math.PI * 2)
      ctx.fillStyle = '#FCD97A'
      ctx.fill()

      ctx.fillStyle = palette.accentDeep
      ctx.font = '800 22px "Outfit", Georgia, serif'
      ctx.textAlign = 'center'
      const displayTitle = eventTitle ? (eventTitle.length > 18 ? eventTitle.slice(0, 17) + '…' : eventTitle) : GALAXY_MONTH_NAMES[monthIndex - 1]
      ctx.fillText(displayTitle, 140, 280)

      ctx.font = '600 16px "Outfit", sans-serif'
      ctx.fillStyle = '#64748b'
      ctx.fillText(eventDate || `Khoảnh khắc #${String(cardIndex).padStart(2, '0')}`, 140, 314)
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

/**
 * Texture khuôn mặt Chibi dễ thương (mắt cười, má hồng)
 */
function makeChibiFaceTexture(isGirl = false): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 180
  c.height = 180
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 180, 180)

    // Đôi mắt cười tít hạt dưa hạnh phúc
    ctx.strokeStyle = '#331d16'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'

    // Mắt trái
    ctx.beginPath()
    ctx.arc(60, 84, 16, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()

    // Mắt phải
    ctx.beginPath()
    ctx.arc(120, 84, 16, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()

    // Lông mi duyên dáng cho bạn nữ
    if (isGirl) {
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(134, 82)
      ctx.lineTo(142, 74)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(46, 82)
      ctx.lineTo(38, 74)
      ctx.stroke()
    }

    // Đôi má ửng hồng e thẹn
    ctx.fillStyle = isGirl ? 'rgba(244, 114, 182, 0.7)' : 'rgba(251, 146, 60, 0.55)'
    ctx.beginPath()
    ctx.ellipse(44, 106, 14, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(136, 106, 14, 9, 0, 0, Math.PI * 2)
    ctx.fill()

    // Nụ cười chúm chím ngọt ngào
    ctx.strokeStyle = '#b91c1c'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(90, 106, 15, Math.PI * 0.12, Math.PI * 0.88)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

/**
 * Texture trái tim tình yêu phát sáng
 */
function makeHeartTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 140
  c.height = 140
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 140, 140)
    ctx.fillStyle = '#f43f5e'
    ctx.beginPath()
    const x = 70
    const y = 92
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x - 52, y - 52, x - 24, y - 92, x, y - 48)
    ctx.bezierCurveTo(x + 24, y - 92, x + 52, y - 52, x, y)
    ctx.closePath()
    ctx.fill()

    // Vệt sáng lấp lánh trên trái tim
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.beginPath()
    ctx.ellipse(x - 16, y - 55, 10, 5, -Math.PI / 4, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

/* ---------------------------------------------------------
   TRUNG TÂM: ĐÔI CHIBI NẮM TAY NHAU THẮM THIẾT (Holding Hands)
--------------------------------------------------------- */

function buildHandHoldingCouple() {
  const coupleGroup = new THREE.Group()

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe2c8, roughness: 0.45 })
  const boyClothMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.55 }) // Xanh lam năng động
  const girlClothMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.55 }) // Hồng phấn dịu dàng
  const boyHairMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6 }) // Nâu đen tự nhiên
  const girlHairMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.55 })

  // 1. BẠN NAM (Bên trái: x = -0.22)
  const boyGroup = new THREE.Group()
  boyGroup.position.set(-0.21, 0, 0)
  boyGroup.rotation.y = 0.25 // Hướng người nhẹ về phía bạn nữ
  boyGroup.rotation.z = -0.04

  // Thân áo bạn nam
  const boyBody = new THREE.Mesh(new THREE.ConeGeometry(0.155, 0.34, 20), boyClothMat)
  boyBody.position.y = 0.17
  boyGroup.add(boyBody)

  // Đầu bạn nam
  const boyHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 24), skinMat)
  boyHead.position.y = 0.43
  boyGroup.add(boyHead)

  // Tóc bạn nam ngắn sành điệu
  const boyHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.64),
    boyHairMat
  )
  boyHair.position.y = 0.47
  boyHair.rotation.x = Math.PI
  boyGroup.add(boyHair)

  // Mặt bạn nam
  const boyFaceSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeChibiFaceTexture(false), transparent: true, depthWrite: false }))
  boyFaceSprite.scale.set(0.23, 0.23, 1)
  boyFaceSprite.position.set(0.02, 0.43, 0.165)
  boyGroup.add(boyFaceSprite)

  // Tay ngoài bạn nam (bên trái)
  const boyOuterArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), skinMat)
  boyOuterArm.position.set(-0.13, 0.2, 0.02)
  boyOuterArm.rotation.z = 0.5
  boyGroup.add(boyOuterArm)

  // 2. BẠN NỮ (Bên phải: x = 0.21)
  const girlGroup = new THREE.Group()
  girlGroup.position.set(0.21, 0, 0)
  girlGroup.rotation.y = -0.25 // Hướng người nhẹ về phía bạn nam
  girlGroup.rotation.z = 0.04

  // Váy áo bạn nữ
  const girlBody = new THREE.Mesh(new THREE.ConeGeometry(0.165, 0.34, 20), girlClothMat)
  girlBody.position.y = 0.17
  girlGroup.add(girlBody)

  // Đầu bạn nữ
  const girlHead = new THREE.Mesh(new THREE.SphereGeometry(0.185, 24, 24), skinMat)
  girlHead.position.y = 0.43
  girlGroup.add(girlHead)

  // Tóc bạn nữ bồng bềnh
  const girlHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.68),
    girlHairMat
  )
  girlHair.position.y = 0.47
  girlHair.rotation.x = Math.PI
  girlGroup.add(girlHair)

  // Nơ cài tóc xinh xắn cho bạn nữ
  const bowMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 })
  const bow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), bowMat)
  bow.position.set(0.12, 0.54, 0.1)
  girlGroup.add(bow)

  // Mặt bạn nữ
  const girlFaceSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeChibiFaceTexture(true), transparent: true, depthWrite: false }))
  girlFaceSprite.scale.set(0.23, 0.23, 1)
  girlFaceSprite.position.set(-0.02, 0.43, 0.165)
  girlGroup.add(girlFaceSprite)

  // Tay ngoài bạn nữ (bên phải)
  const girlOuterArm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.18, 8), skinMat)
  girlOuterArm.position.set(0.13, 0.2, 0.02)
  girlOuterArm.rotation.z = -0.5
  girlGroup.add(girlOuterArm)

  coupleGroup.add(boyGroup, girlGroup)

  // 3. ĐÔI TAY NẮM CHẶT NHAU Ở CHÍNH GIỮA (Joined Hands Bridge)
  const handJoinGroup = new THREE.Group()
  handJoinGroup.position.set(0, 0.19, 0.07)

  // Cánh tay trong bạn nam chìa sang
  const boyInnerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), skinMat)
  boyInnerArm.position.set(-0.07, 0.02, 0)
  boyInnerArm.rotation.z = -Math.PI / 3.6
  handJoinGroup.add(boyInnerArm)

  // Cánh tay trong bạn nữ chìa sang
  const girlInnerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8), skinMat)
  girlInnerArm.position.set(0.07, 0.02, 0)
  girlInnerArm.rotation.z = Math.PI / 3.6
  handJoinGroup.add(girlInnerArm)

  // Điểm nắm tay ấm áp
  const claspGeo = new THREE.SphereGeometry(0.044, 10, 10)
  const clasp = new THREE.Mesh(claspGeo, skinMat)
  clasp.position.set(0, -0.01, 0)
  handJoinGroup.add(clasp)

  // Hạt phát sáng tình yêu ngay điểm nắm tay
  const handSparkle = new THREE.PointLight(0xfef08a, 1.2, 1.5)
  handSparkle.position.set(0, 0, 0.05)
  handJoinGroup.add(handSparkle)

  coupleGroup.add(handJoinGroup)

  // 4. TRÁI TIM TÌNH YÊU BAY LƠ LỬNG TRÊN ĐẦU
  const heartTex = makeHeartTexture()
  const mainHeart = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }))
  mainHeart.scale.set(0.18, 0.18, 1)
  mainHeart.position.set(0, 0.72, 0.1)
  coupleGroup.add(mainHeart)

  const subHeart = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false, opacity: 0.75 }))
  subHeart.scale.set(0.11, 0.11, 1)
  subHeart.position.set(0.14, 0.78, 0.08)
  coupleGroup.add(subHeart)

  return { coupleGroup, mainHeart, subHeart }
}

/* ---------------------------------------------------------
   PHASE 1: VÒNG XOAY 12 THÁNG 3D (MonthWheel3D)
--------------------------------------------------------- */

interface MonthWheel3DProps {
  events: SharedEvent[]
  onSelectMonth: (monthIndex: number) => void
}

function MonthWheel3D({ events, onSelectMonth }: MonthWheel3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  // Đếm kỷ niệm theo từng tháng 1..12
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let i = 1; i <= 12; i++) counts[i] = 0
    for (const ev of events) {
      const d = ev.event_date
      if (!d) continue
      const m = parseInt(d.slice(5, 7), 10)
      if (m >= 1 && m <= 12) counts[m] = (counts[m] || 0) + 1
    }
    return counts
  }, [events])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 420
    const height = mount.clientHeight || 520

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100)
    camera.position.set(0, 1.45, 8.6)
    camera.lookAt(0, 0.25, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    mount.appendChild(renderer.domElement)

    // Ánh sáng lãng mạn
    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0x1e1b4b, 1.3)
    scene.add(hemiLight)

    const pointLight = new THREE.PointLight(0xfde047, 1.5, 9)
    pointLight.position.set(0, 1.6, 2.5)
    scene.add(pointLight)

    // Vành sàn vàng ấm dưới chân
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.28, 48),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6 })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.92
    scene.add(ring)

    const floorCircle = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 48),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.08 })
    )
    floorCircle.rotation.x = -Math.PI / 2
    floorCircle.position.y = -0.93
    scene.add(floorCircle)

    // Đôi Chibi nắm tay nhau ở trung tâm
    const { coupleGroup, mainHeart, subHeart } = buildHandHoldingCouple()
    coupleGroup.scale.setScalar(1.5)
    coupleGroup.position.y = -0.18
    scene.add(coupleGroup)

    // 12 thẻ tháng xoay vòng xung quanh
    const cardsGroup = new THREE.Group()
    scene.add(cardsGroup)

    const cardW = 1.05
    const cardH = 1.47
    const radius = 3.4
    const count = 12
    const cardMeta: Array<{ group: THREE.Group; baseY: number; phase: number; monthIndex: number }> = []

    for (let i = 0; i < count; i++) {
      const monthIndex = i + 1
      const angle = (i / count) * Math.PI * 2
      const palette = paletteForMonth(monthIndex)
      const mCount = monthCounts[monthIndex] || 0

      const frontTex = makeMonthCardTexture(monthIndex, mCount)
      const backTex = makeCardBackTexture(palette)

      const cardGroup = new THREE.Group()
      cardGroup.userData = { monthIndex, count: mCount }

      // Mặt trước thẻ
      const front = new THREE.Mesh(
        new THREE.PlaneGeometry(cardW, cardH),
        new THREE.MeshBasicMaterial({ map: frontTex, transparent: true, side: THREE.FrontSide })
      )
      front.position.z = 0.005

      // Mặt sau thẻ
      const back = new THREE.Mesh(
        new THREE.PlaneGeometry(cardW, cardH),
        new THREE.MeshBasicMaterial({ map: backTex, transparent: true, side: THREE.FrontSide })
      )
      back.rotation.y = Math.PI
      back.position.z = -0.005

      cardGroup.add(front, back)

      // Vị trí vòng tròn
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      cardGroup.position.set(x, 0, z)
      cardGroup.rotation.y = angle
      cardsGroup.add(cardGroup)

      cardMeta.push({ group: cardGroup, baseY: 0, phase: i * 0.65, monthIndex })
    }

    // Bụi sao thiên hà lấp lánh (Particles)
    const starPositions: number[] = []
    for (let i = 0; i < 220; i++) {
      const r = 5.5 + Math.random() * 9.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        Math.abs(r * Math.cos(phi)) * 0.45,
        r * Math.sin(phi) * Math.sin(theta)
      )
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.75 })
    )
    scene.add(stars)

    // Raycasting & Tương tác vuốt xoay
    const raycaster = new THREE.Raycaster()
    const pointerNDC = new THREE.Vector2()

    let dragging = false
    let lastX = 0
    let downX = 0
    let downY = 0
    let moved = 0
    let idleTimer = 0
    let t = 0
    let selected = false

    const getXY = (e: MouseEvent | TouchEvent): [number, number] => {
      if ('touches' in e && e.touches.length > 0) {
        return [e.touches[0].clientX, e.touches[0].clientY]
      }
      const me = e as MouseEvent
      return [me.clientX, me.clientY]
    }

    const onDown = (e: MouseEvent | TouchEvent) => {
      const [x, y] = getXY(e)
      dragging = true
      lastX = x
      downX = x
      downY = y
      moved = 0
    }

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return
      const [x] = getXY(e)
      const dx = x - lastX
      lastX = x
      moved += Math.abs(dx)
      cardsGroup.rotation.y += dx * 0.008
      idleTimer = 0
    }

    const onUp = (e: MouseEvent | TouchEvent) => {
      dragging = false
      if (selected || moved > 6) return

      const rect = renderer.domElement.getBoundingClientRect()
      const [cx, cy] = 'changedTouches' in e && e.changedTouches.length > 0
        ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY]
        : [downX, downY]

      pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1
      pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNDC, camera)

      const hits = raycaster.intersectObjects(cardsGroup.children, true)
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object
        while (obj && obj.userData?.monthIndex === undefined && obj.parent) {
          obj = obj.parent
        }
        if (obj && obj.userData?.monthIndex) {
          selected = true
          onSelectMonth(obj.userData.monthIndex)
        }
      }
    }

    renderer.domElement.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)

    let rafId: number
    const animate = () => {
      rafId = requestAnimationFrame(animate)
      t += 0.016

      // Tự động xoay chậm rãi khi không vuốt
      if (!dragging) {
        idleTimer += 1
        if (idleTimer > 35) {
          cardsGroup.rotation.y += 0.0032
        }
      }

      // Thẻ tháng bồng bềnh uốn lượn
      cardMeta.forEach((m) => {
        m.group.position.y = m.baseY + Math.sin(t * 1.15 + m.phase) * 0.08
      })

      stars.rotation.y += 0.0006

      // Đôi bạn nắm tay nhau lắc lư đằm thắm
      coupleGroup.rotation.y = Math.sin(t * 0.65) * 0.085
      coupleGroup.position.y = -0.18 + Math.sin(t * 1.3) * 0.02

      // Trái tim đập nhịp nhàng
      const pulse = 1 + Math.sin(t * 2.4) * 0.16
      mainHeart.scale.set(0.18 * pulse, 0.18 * pulse, 1)
      mainHeart.position.y = 0.72 + Math.sin(t * 1.8) * 0.03
      subHeart.scale.set(0.11 * pulse, 0.11 * pulse, 1)
      subHeart.position.y = 0.78 + Math.sin(t * 1.8 + 0.5) * 0.03

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!mount) return
      const w = mount.clientWidth || 420
      const h = mount.clientHeight || 520
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('touchstart', onDown)
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose()
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat.dispose()
        }
      })
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [events, monthCounts, onSelectMonth])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 520, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', margin: '10px 0 4px', zIndex: 10, pointerEvents: 'none' }}>
        <p style={{
          color: 'rgba(244, 239, 255, 0.75)',
          fontFamily: "'Quicksand', sans-serif",
          fontSize: 13,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          margin: '0 0 2px',
          fontWeight: 700,
        }}>
          ✨ Vòng Quay Ký Ức 3D
        </p>
        <h2 style={{
          color: '#ffffff',
          fontFamily: "'Outfit', 'Playfair Display', serif",
          fontWeight: 800,
          fontSize: 20,
          margin: 0,
          textShadow: '0 2px 10px rgba(0,0,0,0.5)',
        }}>
          Chạm vào một tháng để giải phóng ký ức
        </h2>
      </div>

      <div ref={mountRef} style={{ position: 'relative', width: '100%', flex: 1, minHeight: 450, cursor: 'grab', touchAction: 'none' }} />

      <div style={{
        position: 'absolute',
        bottom: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(10px)',
        borderRadius: 24,
        padding: '5px 16px',
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: '0.78rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        ✨ Vuốt ngang xoay 360° quanh đôi bạn · Nhấn vào thẻ tháng để mở khóa
      </div>
    </div>
  )
}

/* ---------------------------------------------------------
   PHASE 2: HIỆU ỨNG BẮN THÁNG LÊN TRỜI & PHÁO HOA (LaunchAnimation)
--------------------------------------------------------- */

function easeOutQuint(x: number): number {
  return 1 - Math.pow(1 - x, 5)
}

interface LaunchAnimationProps {
  monthIndex: number
}

function LaunchAnimation({ monthIndex }: LaunchAnimationProps) {
  const palette = paletteForMonth(monthIndex)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const glowRef = useRef<HTMLDivElement | null>(null)
  const [burstOn, setBurstOn] = useState(false)
  const [shockOn, setShockOn] = useState(false)

  // Khói / tia hạt bám theo thẻ bay lên
  const trail = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    id: i,
    delay: i * 0.038,
    drift: (Math.random() - 0.5) * 22,
    size: 4 + Math.random() * 5,
  })), [monthIndex])

  // Làn pháo hoa sóng 1 (Vàng kim rực rỡ)
  const burstWave1 = useMemo(() => Array.from({ length: 32 }, (_, i) => {
    const angle = (i / 32) * Math.PI * 2 + Math.random() * 0.15
    const dist = 65 + Math.random() * 85
    return {
      id: i,
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist * 0.85,
      delay: Math.random() * 0.08,
      size: 3 + Math.random() * 3.5,
      color: '#fde047',
    }
  }), [monthIndex])

  // Làn pháo hoa sóng 2 (Màu chủ đạo của tháng)
  const burstWave2 = useMemo(() => Array.from({ length: 38 }, (_, i) => {
    const angle = (i / 38) * Math.PI * 2 + Math.random() * 0.15
    const dist = 125 + Math.random() * 110
    return {
      id: i,
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist * 0.85,
      delay: 0.1 + Math.random() * 0.12,
      size: 2.5 + Math.random() * 3,
      color: palette.accent,
    }
  }), [monthIndex, palette.accent])

  useEffect(() => {
    let rafId: number
    const duration = 1100
    const startTime = performance.now()
    const originX = 0
    const peakX = (Math.random() - 0.5) * 50

    const step = (now: number) => {
      const elapsed = now - startTime
      const p = Math.min(elapsed / duration, 1)
      const ease = easeOutQuint(p)
      const bottom = 70 + ease * 340
      const x = originX + Math.sin(p * Math.PI) * peakX
      const scale = 1 - ease * 0.78
      const rot = ease * 16
      const opacity = p > 0.85 ? Math.max(0, 1 - (p - 0.85) / 0.15) : 1

      if (cardRef.current) {
        cardRef.current.style.transform = `translateX(calc(-50% + ${x}px)) scale(${scale}) rotate(${rot}deg)`
        cardRef.current.style.bottom = `${bottom}px`
        cardRef.current.style.opacity = String(opacity)
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translateX(calc(-50% + ${x}px)) scale(${1 + ease * 1.8})`
        glowRef.current.style.bottom = `${bottom - 10}px`
        glowRef.current.style.opacity = String(0.6 * (1 - ease * 0.5))
      }

      if (p < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        setBurstOn(true)
        window.setTimeout(() => setShockOn(true), 20)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [monthIndex])

  return (
    <div style={{ position: 'relative', width: '100%', height: 520, overflow: 'hidden' }}>
      {/* Vệt bụi sáng bay theo thẻ */}
      {trail.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            left: `calc(50% + ${p.drift}px)`,
            bottom: 68,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${palette.accent}, transparent 70%)`,
            animation: `galaxyTrailRise 1.0s cubic-bezier(0.2, 0.7, 0.4, 1) ${p.delay}s 1 both`,
          }}
        />
      ))}

      {/* Hào quang rực rỡ */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 60,
          width: 110,
          height: 110,
          marginLeft: -55,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.glow}, transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />

      {/* Thẻ tháng đang vút bay lên */}
      <div
        ref={cardRef}
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 70,
          width: 120,
          height: 168,
          marginLeft: -60,
          borderRadius: 18,
          background: `linear-gradient(160deg, ${palette.accentDeep}, ${palette.accent})`,
          border: `3px solid ${palette.border}`,
          boxShadow: `0 0 30px ${palette.glow}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          willChange: 'transform, bottom, opacity',
        }}
      >
        <span style={{ fontFamily: "'Outfit', 'Playfair Display', serif", fontSize: 36, fontWeight: 900, color: '#FFF7E8' }}>
          {String(monthIndex).padStart(2, '0')}
        </span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: '#fef08a' }}>
          {GALAXY_MONTH_NAMES[monthIndex - 1]}
        </span>
      </div>

      {/* Sóng xung kích bùng nổ */}
      {shockOn && (
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '22%',
          width: 24,
          height: 24,
          marginLeft: -12,
          marginTop: -12,
          borderRadius: '50%',
          border: `3px solid ${palette.accent}`,
          animation: 'galaxyShockRing 0.75s ease-out forwards',
        }} />
      )}

      {/* Tia pháo hoa sóng 1 */}
      {burstOn && burstWave1.map((s) => (
        <span
          key={'w1-' + s.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: '22%',
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: s.color,
            boxShadow: `0 0 8px ${s.color}`,
            animation: `galaxyBurstFly 0.9s cubic-bezier(0.15, 0.7, 0.3, 1) ${s.delay}s 1 both`,
            // @ts-ignore
            '--bx': `${s.tx}px`,
            '--by': `${s.ty}px`,
          }}
        />
      ))}

      {/* Tia pháo hoa sóng 2 */}
      {burstOn && burstWave2.map((s) => (
        <span
          key={'w2-' + s.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: '22%',
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: s.color,
            boxShadow: `0 0 10px ${s.color}`,
            animation: `galaxyBurstFly 1.1s cubic-bezier(0.15, 0.7, 0.3, 1) ${s.delay}s 1 both`,
            // @ts-ignore
            '--bx': `${s.tx}px`,
            '--by': `${s.ty}px`,
          }}
        />
      ))}

      <p style={{
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#ffffff',
        fontFamily: "'Outfit', 'Quicksand', sans-serif",
        fontSize: 16,
        fontWeight: 800,
        textShadow: `0 0 16px ${palette.glow}`,
        animation: 'galaxyTextGlow 1.2s ease-in-out infinite alternate',
      }}>
        ✨ Đang mở khóa kỷ niệm {GALAXY_MONTH_NAMES[monthIndex - 1]}…
      </p>
    </div>
  )
}

/* ---------------------------------------------------------
   PHASE 3: TRỐNG ẢNH KỶ NIỆM 3D (PhotoDrum3D)
--------------------------------------------------------- */

interface PhotoDrum3DProps {
  monthIndex: number
  events: SharedEvent[]
  onBack: () => void
  onOpenPhotoLightbox: (images: string[], index: number) => void
  onSelectEvent: (event: SharedEvent) => void
}

function PhotoDrum3D({ monthIndex, events, onBack, onOpenPhotoLightbox, onSelectEvent }: PhotoDrum3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const palette = paletteForMonth(monthIndex)

  // Lọc tất cả kỷ niệm & ảnh của tháng này
  const monthEvents = useMemo(() => {
    return events.filter((ev) => {
      const d = ev.event_date
      if (!d) return false
      return parseInt(d.slice(5, 7), 10) === monthIndex
    })
  }, [events, monthIndex])

  // Trích xuất danh sách tất cả các ảnh trong tháng
  const photoItems = useMemo(() => {
    const list: Array<{
      url?: string
      title: string
      date?: string
      note?: string
      event: SharedEvent
    }> = []

    for (const ev of monthEvents) {
      if (Array.isArray(ev.images) && ev.images.length > 0) {
        ev.images.forEach((img) => {
          if (img) list.push({ url: img, title: ev.title || 'Kỷ niệm', date: ev.event_date, note: ev.note || undefined, event: ev })
        })
      } else if (ev.image_url) {
        list.push({ url: ev.image_url, title: ev.title || 'Kỷ niệm', date: ev.event_date, note: ev.note || undefined, event: ev })
      } else {
        list.push({ title: ev.title || 'Kỷ niệm', date: ev.event_date, note: ev.note || undefined, event: ev })
      }
    }
    return list
  }, [monthEvents])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 420
    const height = mount.clientHeight || 530

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100)
    camera.position.set(0, 1.35, 9.0)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    mount.appendChild(renderer.domElement)

    // Ánh sáng lãng mạn
    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0x1e1b4b, 1.3)
    scene.add(hemiLight)

    const pointLight = new THREE.PointLight(0xfde047, 1.5, 9)
    pointLight.position.set(0, 1.5, 2.5)
    scene.add(pointLight)

    // Đôi Chibi nắm tay nhau ở giữa trống ảnh
    const { coupleGroup, mainHeart, subHeart } = buildHandHoldingCouple()
    coupleGroup.scale.setScalar(1.35)
    coupleGroup.position.y = -0.06
    scene.add(coupleGroup)

    // Trống ảnh 3D gồm 9 cột x 3 hàng (27 ô thẻ ảnh)
    const drumGroup = new THREE.Group()
    scene.add(drumGroup)

    const cols = 9
    const rows = 3
    const cardW = 0.88
    const cardH = 1.15
    const radius = 3.65
    const rowYs = [1.02, 0, -1.02]
    const cardMeta: Array<{ group: THREE.Group; baseY: number; phase: number; itemIndex: number }> = []

    let cardCounter = 0

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        cardCounter += 1
        const angle = (col / cols) * Math.PI * 2 + (r % 2 === 1 ? Math.PI / cols : 0)
        const itemIdx = (cardCounter - 1) % (photoItems.length || 1)
        const currentItem = photoItems[itemIdx]

        const cardPalette = paletteForMonth(monthIndex, (cardCounter * 11) % 60 - 30)

        // Texture mặt trước
        const frontTex = makeMemoryCardTexture(
          monthIndex,
          cardCounter,
          cardPalette,
          currentItem?.title,
          currentItem?.date
        )

        // Tải trước ảnh thật nếu có URL
        if (currentItem?.url) {
          const imgLoader = new Image()
          imgLoader.crossOrigin = 'anonymous'
          imgLoader.onload = () => {
            const realTex = makeMemoryCardTexture(
              monthIndex,
              cardCounter,
              cardPalette,
              currentItem.title,
              currentItem.date,
              imgLoader
            )
            frontMesh.material = new THREE.MeshBasicMaterial({ map: realTex, transparent: true, side: THREE.FrontSide })
          }
          imgLoader.src = currentItem.url
        }

        const backTex = makeCardBackTexture(cardPalette, 260)

        const cardGroup = new THREE.Group()
        cardGroup.userData = {
          isMemoryCard: true,
          item: currentItem,
          itemIndex: itemIdx,
        }

        const frontMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(cardW, cardH),
          new THREE.MeshBasicMaterial({ map: frontTex, transparent: true, side: THREE.FrontSide })
        )
        frontMesh.position.z = 0.005

        const backMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(cardW, cardH),
          new THREE.MeshBasicMaterial({ map: backTex, transparent: true, side: THREE.FrontSide })
        )
        backMesh.rotation.y = Math.PI
        backMesh.position.z = -0.005

        cardGroup.add(frontMesh, backMesh)

        // Vị trí trên hình trụ trống 3D
        const x = Math.sin(angle) * radius
        const z = Math.cos(angle) * radius
        cardGroup.position.set(x, rowYs[r], z)
        cardGroup.rotation.y = angle
        drumGroup.add(cardGroup)

        cardMeta.push({ group: cardGroup, baseY: rowYs[r], phase: cardCounter * 0.38, itemIndex: itemIdx })
      }
    }

    // Sàn vành màu chủ đạo
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.28, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.accent), transparent: true, opacity: 0.6 })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -1.15
    scene.add(ring)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(radius + 0.8, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.accent), transparent: true, opacity: 0.06 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.16
    scene.add(floor)

    // Bụi sao
    const starPositions: number[] = []
    for (let i = 0; i < 220; i++) {
      const rr = 5.5 + Math.random() * 9.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      starPositions.push(
        rr * Math.sin(phi) * Math.cos(theta),
        Math.abs(rr * Math.cos(phi)) * 0.45,
        rr * Math.sin(phi) * Math.sin(theta)
      )
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.75 })
    )
    scene.add(stars)

    // Raycast & xoay trống ảnh
    const raycaster = new THREE.Raycaster()
    const pointerNDC = new THREE.Vector2()

    let dragging = false
    let lastX = 0
    let downX = 0
    let downY = 0
    let moved = 0
    let idleTimer = 0
    let t = 0

    const getXY = (e: MouseEvent | TouchEvent): [number, number] => {
      if ('touches' in e && e.touches.length > 0) {
        return [e.touches[0].clientX, e.touches[0].clientY]
      }
      const me = e as MouseEvent
      return [me.clientX, me.clientY]
    }

    const onDown = (e: MouseEvent | TouchEvent) => {
      const [x, y] = getXY(e)
      dragging = true
      lastX = x
      downX = x
      downY = y
      moved = 0
    }

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return
      const [x] = getXY(e)
      const dx = x - lastX
      lastX = x
      moved += Math.abs(dx)
      drumGroup.rotation.y += dx * 0.008
      idleTimer = 0
    }

    const onUp = (e: MouseEvent | TouchEvent) => {
      dragging = false
      if (moved > 6) return

      const rect = renderer.domElement.getBoundingClientRect()
      const [cx, cy] = 'changedTouches' in e && e.changedTouches.length > 0
        ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY]
        : [downX, downY]

      pointerNDC.x = ((cx - rect.left) / rect.width) * 2 - 1
      pointerNDC.y = -((cy - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNDC, camera)

      const hits = raycaster.intersectObjects(drumGroup.children, true)
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object
        while (obj && !obj.userData?.isMemoryCard && obj.parent) {
          obj = obj.parent
        }
        if (obj && obj.userData?.item) {
          const clickedItem = obj.userData.item
          if (clickedItem.url) {
            // Mở gallery ảnh phóng to
            const allImages = photoItems.map((p) => p.url).filter(Boolean) as string[]
            const curIdx = allImages.indexOf(clickedItem.url)
            onOpenPhotoLightbox(allImages, Math.max(0, curIdx))
          } else if (clickedItem.event) {
            onSelectEvent(clickedItem.event)
          }
        }
      }
    }

    renderer.domElement.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)

    let rafId: number
    const animate = () => {
      rafId = requestAnimationFrame(animate)
      t += 0.016

      if (!dragging) {
        idleTimer += 1
        if (idleTimer > 35) drumGroup.rotation.y += 0.0028
      }

      cardMeta.forEach((m) => {
        m.group.position.y = m.baseY + Math.sin(t * 1.1 + m.phase) * 0.05
      })

      stars.rotation.y += 0.0006

      coupleGroup.rotation.y = Math.sin(t * 0.65) * 0.085
      coupleGroup.position.y = -0.06 + Math.sin(t * 1.3) * 0.02

      const pulse = 1 + Math.sin(t * 2.4) * 0.16
      mainHeart.scale.set(0.18 * pulse, 0.18 * pulse, 1)
      mainHeart.position.y = 0.72 + Math.sin(t * 1.8) * 0.03
      subHeart.scale.set(0.11 * pulse, 0.11 * pulse, 1)
      subHeart.position.y = 0.78 + Math.sin(t * 1.8 + 0.5) * 0.03

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (!mount) return
      const w = mount.clientWidth || 420
      const h = mount.clientHeight || 530
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('touchstart', onDown)
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose()
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat.dispose()
        }
      })
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [monthIndex, photoItems, onOpenPhotoLightbox, onSelectEvent, palette])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 520, display: 'flex', flexDirection: 'column' }}>
      {/* Nút quay lại chọn tháng & Nhãn tháng */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 14,
        right: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20,
      }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${palette.border}`,
            color: '#ffffff',
            borderRadius: 24,
            padding: '7px 16px',
            fontSize: '0.84rem',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          }}
        >
          <ArrowLeft size={15} />
          <span>Chọn tháng khác</span>
        </button>

        <span style={{
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${palette.border}`,
          borderRadius: 20,
          padding: '6px 14px',
          color: palette.accent,
          fontFamily: "'Outfit', 'Playfair Display', serif",
          fontWeight: 800,
          fontSize: '0.92rem',
        }}>
          🌸 {GALAXY_MONTH_NAMES[monthIndex - 1]} · {monthEvents.length} kỷ niệm
        </span>
      </div>

      <div ref={mountRef} style={{ position: 'relative', width: '100%', flex: 1, minHeight: 450, cursor: 'grab', touchAction: 'none' }} />

      <div style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
        background: 'rgba(0, 0, 0, 0.48)',
        backdropFilter: 'blur(10px)',
        borderRadius: 24,
        padding: '5px 16px',
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: '0.78rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        ✨ Vuốt xoay trống ảnh 360° quanh đôi bạn · Chạm vào thẻ để xem chi tiết
      </div>
    </div>
  )
}

/* ---------------------------------------------------------
   NỀN VŨ TRỤ NGÂN HÀ (Galaxy Starfield Backdrop)
--------------------------------------------------------- */

function GalaxyBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width: number
    let height: number
    let stars: Array<{ x: number; y: number; r: number; phase: number; speed: number }>
    let rafId: number

    function resize() {
      if (!canvas) return
      width = canvas.clientWidth || window.innerWidth
      height = canvas.clientHeight || window.innerHeight
      canvas.width = width * (window.devicePixelRatio || 1)
      canvas.height = height * (window.devicePixelRatio || 1)
      ctx?.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0)
      const count = Math.floor((width * height) / 2800)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.018 + Math.random() * 0.024,
      }))
    }
    resize()
    window.addEventListener('resize', resize)

    let t = 0
    function draw() {
      t += 1
      if (ctx) {
        ctx.clearRect(0, 0, width, height)
        stars.forEach((s) => {
          const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * s.speed + s.phase))
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(244, 239, 255, ${twinkle})`
          ctx.fill()
        })
      }
      rafId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <div className="galaxy-nebula-blob galaxy-nebula-a" />
      <div className="galaxy-nebula-blob galaxy-nebula-b" />
      <div className="galaxy-nebula-blob galaxy-nebula-c" />
    </>
  )
}

/* ---------------------------------------------------------
   ROOT COMPONENT: GalaxyWheel3DMemoryView
--------------------------------------------------------- */

export interface GalaxyWheel3DMemoryViewProps {
  events: SharedEvent[]
  year: number
  onOpenPhotoLightbox?: (images: string[], index: number) => void
  onSelectEvent?: (event: SharedEvent) => void
}

export function GalaxyWheel3DMemoryView({
  events = [],
  year,
  onOpenPhotoLightbox,
  onSelectEvent,
}: GalaxyWheel3DMemoryViewProps) {
  const [phase, setPhase] = useState<'select' | 'launch' | 'gallery'>('select')
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  // Lọc sự kiện theo năm được chọn
  const yearEvents = useMemo(() => {
    return events.filter((ev) => {
      const d = ev.event_date
      if (!d) return true
      return parseInt(d.slice(0, 4), 10) === year
    })
  }, [events, year])

  const handleSelectMonth = (m: number) => {
    setSelectedMonth(m)
    setPhase('launch')
    window.setTimeout(() => {
      setPhase('gallery')
    }, 1800)
  }

  const handleBackToSelect = () => {
    setPhase('select')
    setSelectedMonth(null)
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: 'calc(100vh - 64px)',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #070719 0%, #150e2e 55%, #080617 100%)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        @keyframes galaxyDriftA { 0%,100% { transform: translate(0,0); } 50% { transform: translate(35px,-25px); } }
        @keyframes galaxyDriftB { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px,30px); } }
        @keyframes galaxyDriftC { 0%,100% { transform: translate(0,0); } 50% { transform: translate(20px,20px); } }
        .galaxy-nebula-blob { position: absolute; border-radius: 50%; filter: blur(60px); mix-blend-mode: screen; pointer-events: none; }
        .galaxy-nebula-a { width: 320px; height: 320px; top: -60px; left: -60px; background: radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%); animation: galaxyDriftA 16s ease-in-out infinite; }
        .galaxy-nebula-b { width: 360px; height: 360px; bottom: -80px; right: -60px; background: radial-gradient(circle, rgba(244,63,94,0.4), transparent 70%); animation: galaxyDriftB 18s ease-in-out infinite; }
        .galaxy-nebula-c { width: 260px; height: 260px; top: 40%; left: 55%; background: radial-gradient(circle, rgba(45,212,191,0.32), transparent 70%); animation: galaxyDriftC 14s ease-in-out infinite; }

        @keyframes galaxyTrailRise {
          0% { transform: translateY(0) scale(1); opacity: 0.95; }
          100% { transform: translateY(-330px) scale(0.15); opacity: 0; }
        }
        @keyframes galaxyBurstFly {
          0% { transform: translate(0,0) scale(0); opacity: 0; }
          14% { opacity: 1; }
          100% { transform: translate(var(--bx), var(--by)) scale(1); opacity: 0; }
        }
        @keyframes galaxyShockRing {
          0% { transform: scale(0.2); opacity: 0.95; }
          100% { transform: scale(10); opacity: 0; }
        }
        @keyframes galaxyTextGlow {
          from { opacity: 0.85; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1.02); }
        }
      `}</style>

      {/* Nền tinh tú & tinh vân vũ trụ */}
      <GalaxyBackdrop />

      {/* Nội dung 3D theo từng giai đoạn */}
      <div style={{ position: 'relative', zIndex: 5, width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {phase === 'select' && (
          <MonthWheel3D
            events={yearEvents}
            onSelectMonth={handleSelectMonth}
          />
        )}

        {phase === 'launch' && selectedMonth !== null && (
          <LaunchAnimation monthIndex={selectedMonth} />
        )}

        {phase === 'gallery' && selectedMonth !== null && (
          <PhotoDrum3D
            monthIndex={selectedMonth}
            events={yearEvents}
            onBack={handleBackToSelect}
            onOpenPhotoLightbox={(imgs, idx) => {
              if (onOpenPhotoLightbox) onOpenPhotoLightbox(imgs, idx)
            }}
            onSelectEvent={(ev) => {
              if (onSelectEvent) onSelectEvent(ev)
            }}
          />
        )}
      </div>
    </div>
  )
}
