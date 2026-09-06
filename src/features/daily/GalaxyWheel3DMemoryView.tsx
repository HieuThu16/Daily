import { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import {
  ArrowLeft, X, Sparkles, Calendar, MapPin, Clock,
  Maximize2, ChevronLeft, ChevronRight
} from 'lucide-react'
import type { SharedEvent } from '../../types'

/* ---------------------------------------------------------
   BẢNG MÀU THIÊN HÀ THEO NĂM (Celestial Year Palettes)
--------------------------------------------------------- */

export function paletteForYear(year: number, offset = 0) {
  // Tạo dải màu vũ trụ rực rỡ dựa theo số năm
  const baseHue = (((year - 2020) * 85) + 35 + offset) % 360
  return {
    hue: baseHue,
    bgLight: `hsl(${baseHue}, 75%, 93%)`,
    bgDark: `hsl(${baseHue}, 65%, 12%)`,
    border: `hsl(${baseHue}, 85%, 60%)`,
    accent: `hsl(${baseHue}, 90%, 62%)`,
    accentDeep: `hsl(${baseHue}, 80%, 38%)`,
    glow: `hsla(${baseHue}, 95%, 65%, 0.65)`,
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

/* ---------------------------------------------------------
   TEXTURE THẺ NĂM ĐỘ PHÂN GIẢI CAO (High-DPI Celestial Year Card)
--------------------------------------------------------- */

function makeYearCardTexture(
  year: number,
  count: number,
  photosCount: number,
  palette: ReturnType<typeof paletteForYear>
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  // Độ phân giải cao 540x756 (Retina 2x sắc nét trên mobile)
  c.width = 540
  c.height = 756
  const ctx = c.getContext('2d')

  if (ctx) {
    // 1. Nền thẻ bo góc với gradient huyền ảo
    roundRectPath(ctx, 12, 12, 516, 732, 40)
    const bgGrad = ctx.createLinearGradient(0, 0, 540, 756)
    bgGrad.addColorStop(0, '#ffffff')
    bgGrad.addColorStop(0.3, palette.bgLight)
    bgGrad.addColorStop(0.75, '#fff7ed')
    bgGrad.addColorStop(1, '#fef08a')
    ctx.fillStyle = bgGrad
    ctx.fill()

    // Viền kim loại mạ vàng óng ánh
    ctx.lineWidth = 14
    ctx.strokeStyle = palette.border
    ctx.stroke()

    // Viền chỉ đôi mảnh trang nhã
    ctx.lineWidth = 3
    ctx.strokeStyle = palette.accentDeep
    ctx.globalAlpha = 0.4
    roundRectPath(ctx, 28, 28, 484, 700, 30)
    ctx.stroke()
    ctx.globalAlpha = 1

    // 2. Vòng tròn chiêm tinh học ở trung tâm
    ctx.beginPath()
    ctx.arc(270, 300, 140, 0, Math.PI * 2)
    ctx.fillStyle = palette.accentDeep
    ctx.globalAlpha = 0.1
    ctx.fill()
    ctx.globalAlpha = 1

    // Hào quang tia sao tỏa sáng
    ctx.save()
    ctx.translate(270, 300)
    ctx.strokeStyle = palette.accentDeep
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.65
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16)
      ctx.beginPath()
      ctx.moveTo(0, -60)
      ctx.lineTo(0, -115)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = 1

    // 3. Chữ biểu tượng hành trình
    ctx.font = '800 24px "Outfit", "Inter", sans-serif'
    ctx.fillStyle = palette.accentDeep
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '3px'
    ctx.fillText('✨ HÀNH TRÌNH THỜI GIAN ✨', 270, 110)

    // 4. Con số năm siêu to, sắc nét uy nghi
    ctx.font = '900 106px "Outfit", "Playfair Display", Georgia, serif'
    ctx.fillStyle = palette.accentDeep
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(year), 270, 302)

    // Nhãn phụ: KỶ NIỆM NĂM
    ctx.font = '700 28px "Outfit", "Inter", sans-serif'
    ctx.fillStyle = '#78350f'
    ctx.fillText(`KỶ NIỆM NĂM ${year}`, 270, 520)

    // 5. Huy hiệu số kỷ niệm & ảnh (Pill badge)
    ctx.font = '800 26px "Outfit", "Inter", sans-serif'
    const countText = count > 0 ? `📖 ${count} kỷ niệm · 🖼️ ${photosCount} ảnh` : 'Chưa có kỷ niệm'
    const pillWidth = ctx.measureText(countText).width + 54

    ctx.save()
    ctx.translate(270, 600)
    roundRectPath(ctx, -pillWidth / 2, -26, pillWidth, 52, 26)
    ctx.fillStyle = count > 0 ? palette.accent : 'rgba(148, 163, 184, 0.3)'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = count > 0 ? '#ffffff' : 'rgba(148, 163, 184, 0.6)'
    ctx.stroke()

    ctx.fillStyle = count > 0 ? '#ffffff' : '#64748b'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(countText, 0, 2)
    ctx.restore()

    // 6. Gợi ý chạm mở ở đáy thẻ
    ctx.font = '600 20px "Outfit", sans-serif'
    ctx.fillStyle = '#b45309'
    ctx.fillText('Chạm để phóng phi thuyền khám phá →', 270, 685)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

/* ---------------------------------------------------------
   TEXTURE MẶT SAU THẺ (Tarot Cosmic Seal Back)
--------------------------------------------------------- */

function makeCardBackTexture(palette: ReturnType<typeof paletteForYear>, size = 480): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  const w = size
  const h = size * 1.4
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (ctx) {
    roundRectPath(ctx, w * 0.02, h * 0.014, w * 0.96, h * 0.97, w * 0.08)
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#100726')
    grad.addColorStop(0.5, palette.accentDeep)
    grad.addColorStop(1, '#080415')
    ctx.fillStyle = grad
    ctx.fill()

    ctx.lineWidth = w * 0.032
    ctx.strokeStyle = palette.border
    ctx.stroke()

    // Vân ánh sao thiên hà
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
    ctx.lineWidth = w * 0.015
    for (let i = -6; i < 12; i++) {
      ctx.beginPath()
      ctx.moveTo(i * (w * 0.16), 0)
      ctx.lineTo(i * (w * 0.16) + w * 1.4, h)
      ctx.stroke()
    }

    // Mandala chiêm tinh trung tâm
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 3.5
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

    // Trái tim vàng vĩnh cửu
    ctx.fillStyle = '#ffd700'
    ctx.beginPath()
    ctx.arc(0, 0, w * 0.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

/* ---------------------------------------------------------
   TEXTURE THẺ KỶ NIỆM SIÊU NÉT (High-DPI Memory Card)
--------------------------------------------------------- */

interface MemoryItemChunk {
  id: string
  event: SharedEvent
  photoUrl?: string
  photoIndex?: number
  totalPhotos: number
  title: string
  date?: string
  note?: string
  chunkLabel?: string
}

function makeMemoryCardTexture(
  item: MemoryItemChunk,
  cardIndex: number,
  palette: ReturnType<typeof paletteForYear>,
  loadedImg?: HTMLImageElement
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  // Độ nét cao 560x784 (gấp 4 lần số pixel trước đây)
  c.width = 560
  c.height = 784
  const ctx = c.getContext('2d')

  if (ctx) {
    // 1. Nền thẻ bo góc
    roundRectPath(ctx, 12, 12, 536, 760, 36)
    ctx.fillStyle = loadedImg ? '#0c0f17' : palette.bgLight
    ctx.fill()
    ctx.lineWidth = 12
    ctx.strokeStyle = palette.border
    ctx.stroke()

    if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
      // 2. Vẽ ảnh thật sắc nét
      ctx.save()
      roundRectPath(ctx, 22, 22, 516, 540, 26)
      ctx.clip()

      const iw = loadedImg.naturalWidth
      const ih = loadedImg.naturalHeight
      const targetW = 516
      const targetH = 540

      // Vẽ nền mờ phía sau để ảnh dọc không bị viền trống
      ctx.drawImage(loadedImg, 0, 0, iw, ih, 22, 22, targetW, targetH)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.fillRect(22, 22, targetW, targetH)

      // Vẽ ảnh chính giữa cân đối (Aspect contain / crop đẹp)
      const scale = Math.min(targetW / iw, targetH / ih)
      const dw = iw * scale
      const dh = ih * scale
      const dx = 22 + (targetW - dw) / 2
      const dy = 22 + (targetH - dh) / 2
      ctx.drawImage(loadedImg, 0, 0, iw, ih, dx, dy, dw, dh)

      ctx.restore()

      // Gradient mờ che chân ảnh cho chữ dễ đọc
      const footGrad = ctx.createLinearGradient(0, 440, 0, 760)
      footGrad.addColorStop(0, 'rgba(12, 15, 23, 0)')
      footGrad.addColorStop(0.35, 'rgba(12, 15, 23, 0.88)')
      footGrad.addColorStop(1, 'rgba(12, 15, 23, 1)')
      ctx.fillStyle = footGrad
      roundRectPath(ctx, 22, 440, 516, 320, 26)
      ctx.fill()

      // Huy hiệu số ảnh trên góc thẻ nếu có nhiều ảnh
      if (item.totalPhotos > 1) {
        ctx.save()
        roundRectPath(ctx, 36, 36, 170, 48, 24)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)'
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.font = '700 22px "Outfit", sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`📸 ${item.chunkLabel || `${item.totalPhotos} ảnh`}`, 121, 60)
        ctx.restore()
      }

      // Tiêu đề kỷ niệm
      ctx.font = '800 36px "Outfit", "Inter", sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const displayTitle = item.title
        ? (item.title.length > 22 ? item.title.slice(0, 21) + '…' : item.title)
        : `Khoảnh khắc #${cardIndex}`
      ctx.fillText(displayTitle, 280, 620)

      // Ngày kỷ niệm
      ctx.font = '700 26px "Outfit", sans-serif'
      ctx.fillStyle = palette.accent
      ctx.fillText(item.date || 'Kỷ niệm yêu thương', 280, 680)

      // Huy hiệu "Chạm để xem xoay 360°"
      ctx.font = '600 20px "Outfit", sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText('✨ Chạm để xoay 360° chi tiết', 280, 725)
    } else {
      // Khi chưa có ảnh: Vẽ đóa hoa vũ trụ lộng lẫy
      ctx.beginPath()
      ctx.arc(280, 280, 130, 0, Math.PI * 2)
      ctx.fillStyle = palette.accentDeep
      ctx.globalAlpha = 0.16
      ctx.fill()
      ctx.globalAlpha = 1

      ctx.beginPath()
      const cx = 280
      const cy = 280
      const R = 85
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        ctx.ellipse(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55, 48, 34, a, 0, Math.PI * 2)
      }
      ctx.fillStyle = palette.accent
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx, cy, 26, 0, Math.PI * 2)
      ctx.fillStyle = '#FCD97A'
      ctx.fill()

      ctx.fillStyle = palette.accentDeep
      ctx.font = '800 36px "Outfit", Georgia, serif'
      ctx.textAlign = 'center'
      const displayTitle = item.title
        ? (item.title.length > 20 ? item.title.slice(0, 19) + '…' : item.title)
        : `Kỷ niệm #${cardIndex}`
      ctx.fillText(displayTitle, 280, 520)

      ctx.font = '700 28px "Outfit", sans-serif'
      ctx.fillStyle = '#64748b'
      ctx.fillText(item.date || 'Ghi chép kỷ niệm', 280, 585)

      ctx.font = '600 22px "Outfit", sans-serif'
      ctx.fillStyle = palette.accent
      ctx.fillText('✨ Chạm để xoay 360° chi tiết', 280, 660)
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

/* ---------------------------------------------------------
   TRUNG TÂM: ĐÔI BẠN CHIBI NẮM TAY NHAU (Chibi Couple Holding Hands)
--------------------------------------------------------- */

function makeChibiFaceTexture(isGirl = false): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 240
  c.height = 240
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 240, 240)

    // Đôi mắt cười tít
    ctx.strokeStyle = '#2d150b'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.arc(75, 105, 20, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(165, 105, 20, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()

    if (isGirl) {
      ctx.lineWidth = 4.5
      ctx.beginPath()
      ctx.moveTo(182, 102)
      ctx.lineTo(194, 92)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(58, 102)
      ctx.lineTo(46, 92)
      ctx.stroke()
    }

    // Đôi má hồng
    ctx.fillStyle = isGirl ? 'rgba(244, 114, 182, 0.75)' : 'rgba(251, 146, 60, 0.65)'
    ctx.beginPath()
    ctx.ellipse(55, 136, 18, 11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(185, 136, 18, 11, 0, 0, Math.PI * 2)
    ctx.fill()

    // Nụ cười ngọt ngào
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(120, 136, 20, Math.PI * 0.12, Math.PI * 0.88)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

function makeHeartTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 160
  c.height = 160
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 160, 160)
    ctx.fillStyle = '#f43f5e'
    ctx.beginPath()
    const x = 80
    const y = 105
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x - 60, y - 60, x - 28, y - 105, x, y - 55)
    ctx.bezierCurveTo(x + 28, y - 105, x + 60, y - 60, x, y)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.beginPath()
    ctx.ellipse(x - 18, y - 65, 12, 6, -Math.PI / 4, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

function buildHandHoldingCouple() {
  const coupleGroup = new THREE.Group()

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe2c8, roughness: 0.45 })
  const boyClothMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.55 })
  const girlClothMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.55 })
  const boyHairMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6 })
  const girlHairMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.55 })

  // 1. BẠN NAM
  const boyGroup = new THREE.Group()
  boyGroup.position.set(-0.21, 0, 0)
  boyGroup.rotation.y = 0.25
  boyGroup.rotation.z = -0.04

  const boyBody = new THREE.Mesh(new THREE.ConeGeometry(0.155, 0.34, 20), boyClothMat)
  boyBody.position.y = 0.17
  boyGroup.add(boyBody)

  const boyHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 24), skinMat)
  boyHead.position.y = 0.43
  boyGroup.add(boyHead)

  const boyHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.64),
    boyHairMat
  )
  boyHair.position.y = 0.47
  boyHair.rotation.x = Math.PI
  boyGroup.add(boyHair)

  const boyFaceSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeChibiFaceTexture(false), transparent: true, depthWrite: false }))
  boyFaceSprite.scale.set(0.23, 0.23, 1)
  boyFaceSprite.position.set(0.02, 0.43, 0.165)
  boyGroup.add(boyFaceSprite)

  const boyOuterArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), skinMat)
  boyOuterArm.position.set(-0.13, 0.2, 0.02)
  boyOuterArm.rotation.z = 0.5
  boyGroup.add(boyOuterArm)

  // 2. BẠN NỮ
  const girlGroup = new THREE.Group()
  girlGroup.position.set(0.21, 0, 0)
  girlGroup.rotation.y = -0.25
  girlGroup.rotation.z = 0.04

  const girlBody = new THREE.Mesh(new THREE.ConeGeometry(0.165, 0.34, 20), girlClothMat)
  girlBody.position.y = 0.17
  girlGroup.add(girlBody)

  const girlHead = new THREE.Mesh(new THREE.SphereGeometry(0.185, 24, 24), skinMat)
  girlHead.position.y = 0.43
  girlGroup.add(girlHead)

  const girlHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.68),
    girlHairMat
  )
  girlHair.position.y = 0.47
  girlHair.rotation.x = Math.PI
  girlGroup.add(girlHair)

  const bowMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 })
  const bow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), bowMat)
  bow.position.set(0.12, 0.54, 0.1)
  girlGroup.add(bow)

  const girlFaceSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeChibiFaceTexture(true), transparent: true, depthWrite: false }))
  girlFaceSprite.scale.set(0.23, 0.23, 1)
  girlFaceSprite.position.set(-0.02, 0.43, 0.165)
  girlGroup.add(girlFaceSprite)

  const girlOuterArm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.18, 8), skinMat)
  girlOuterArm.position.set(0.13, 0.2, 0.02)
  girlOuterArm.rotation.z = -0.5
  girlGroup.add(girlOuterArm)

  coupleGroup.add(boyGroup, girlGroup)

  // 3. ĐÔI TAY NẮM CHẶT Ở CHÍNH GIỮA
  const handJoinGroup = new THREE.Group()
  handJoinGroup.position.set(0, 0.19, 0.07)

  const boyInnerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), skinMat)
  boyInnerArm.position.set(-0.07, 0.02, 0)
  boyInnerArm.rotation.z = -Math.PI / 3.6
  handJoinGroup.add(boyInnerArm)

  const girlInnerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8), skinMat)
  girlInnerArm.position.set(0.07, 0.02, 0)
  girlInnerArm.rotation.z = Math.PI / 3.6
  handJoinGroup.add(girlInnerArm)

  const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 10), skinMat)
  clasp.position.set(0, -0.01, 0)
  handJoinGroup.add(clasp)

  const handSparkle = new THREE.PointLight(0xfef08a, 1.2, 1.5)
  handSparkle.position.set(0, 0, 0.05)
  handJoinGroup.add(handSparkle)

  coupleGroup.add(handJoinGroup)

  // 4. TRÁI TIM TÌNH YÊU TRÊN ĐẦU
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
   PHASE 1: VÒNG XOAY CÁC NĂM 3D (YearWheel3D - Xoay xung quanh là các Năm)
--------------------------------------------------------- */

interface YearInfo {
  year: number
  events: SharedEvent[]
  count: number
  photosCount: number
}

interface YearWheel3DProps {
  yearsList: YearInfo[]
  onSelectYear: (year: number) => void
}

function YearWheel3D({ yearsList, onSelectYear }: YearWheel3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 420
    const height = mount.clientHeight || 520

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100)
    camera.position.set(0, 1.45, 8.8)
    camera.lookAt(0, 0.25, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.2))
    mount.appendChild(renderer.domElement)

    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0x1e1b4b, 1.4)
    scene.add(hemiLight)

    const pointLight = new THREE.PointLight(0xfde047, 1.8, 10)
    pointLight.position.set(0, 1.6, 2.5)
    scene.add(pointLight)

    // Sàn vành thời gian
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.28, 48),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.65 })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.92
    scene.add(ring)

    const floorCircle = new THREE.Mesh(
      new THREE.CircleGeometry(4.4, 48),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.09 })
    )
    floorCircle.rotation.x = -Math.PI / 2
    floorCircle.position.y = -0.93
    scene.add(floorCircle)

    // Đôi Chibi ở trung tâm
    const { coupleGroup, mainHeart, subHeart } = buildHandHoldingCouple()
    coupleGroup.scale.setScalar(1.5)
    coupleGroup.position.y = -0.18
    scene.add(coupleGroup)

    // VÒNG CÁC NĂM XOAY XUNG QUANH
    const cardsGroup = new THREE.Group()
    scene.add(cardsGroup)

    const cardW = 1.15
    const cardH = 1.61
    const radius = 3.65

    // Đảm bảo tối thiểu 4-6 thẻ trên vòng để tạo độ tròn đều mắt
    const displayYears: YearInfo[] = []
    if (yearsList.length === 1) {
      displayYears.push(yearsList[0], yearsList[0], yearsList[0], yearsList[0])
    } else if (yearsList.length === 2) {
      displayYears.push(yearsList[0], yearsList[1], yearsList[0], yearsList[1])
    } else if (yearsList.length === 3) {
      displayYears.push(yearsList[0], yearsList[1], yearsList[2], yearsList[0], yearsList[1], yearsList[2])
    } else {
      displayYears.push(...yearsList)
    }

    const count = displayYears.length
    const cardMeta: Array<{ group: THREE.Group; baseY: number; phase: number; year: number }> = []

    for (let i = 0; i < count; i++) {
      const yInfo = displayYears[i]
      const angle = (i / count) * Math.PI * 2
      const palette = paletteForYear(yInfo.year, i * 20)

      const frontTex = makeYearCardTexture(yInfo.year, yInfo.count, yInfo.photosCount, palette)
      const backTex = makeCardBackTexture(palette)

      const cardGroup = new THREE.Group()
      cardGroup.userData = { year: yInfo.year }

      const front = new THREE.Mesh(
        new THREE.PlaneGeometry(cardW, cardH),
        new THREE.MeshBasicMaterial({ map: frontTex, transparent: true, side: THREE.FrontSide })
      )
      front.position.z = 0.005

      const back = new THREE.Mesh(
        new THREE.PlaneGeometry(cardW, cardH),
        new THREE.MeshBasicMaterial({ map: backTex, transparent: true, side: THREE.FrontSide })
      )
      back.rotation.y = Math.PI
      back.position.z = -0.005

      cardGroup.add(front, back)

      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      cardGroup.position.set(x, 0, z)
      cardGroup.rotation.y = angle
      cardsGroup.add(cardGroup)

      cardMeta.push({ group: cardGroup, baseY: 0, phase: i * 0.7, year: yInfo.year })
    }

    // Hạt sao vũ trụ
    const starPositions: number[] = []
    for (let i = 0; i < 240; i++) {
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
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.038, transparent: true, opacity: 0.78 })
    )
    scene.add(stars)

    // Raycast & cử chỉ vuốt xoay mượt mà
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
        while (obj && obj.userData?.year === undefined && obj.parent) {
          obj = obj.parent
        }
        if (obj && obj.userData?.year) {
          selected = true
          onSelectYear(obj.userData.year)
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
        if (idleTimer > 35) {
          cardsGroup.rotation.y += 0.003
        }
      }

      cardMeta.forEach((m) => {
        m.group.position.y = m.baseY + Math.sin(t * 1.15 + m.phase) * 0.08
      })

      stars.rotation.y += 0.0006
      coupleGroup.rotation.y = Math.sin(t * 0.65) * 0.085
      coupleGroup.position.y = -0.18 + Math.sin(t * 1.3) * 0.02

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
  }, [yearsList, onSelectYear])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 520, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', margin: '8px 0 2px', zIndex: 10, pointerEvents: 'none' }}>
        <p style={{
          color: 'rgba(254, 243, 199, 0.9)',
          fontFamily: "'Outfit', sans-serif",
          fontSize: 13,
          letterSpacing: 2,
          textTransform: 'uppercase',
          margin: '0 0 2px',
          fontWeight: 800,
        }}>
          🌌 VÒNG XOAY CÁC NĂM KỶ NIỆM 3D
        </p>
        <h2 style={{
          color: '#ffffff',
          fontFamily: "'Outfit', 'Playfair Display', serif",
          fontWeight: 900,
          fontSize: 21,
          margin: 0,
          textShadow: '0 2px 14px rgba(0,0,0,0.6)',
        }}>
          Chạm vào một năm để phóng phi thuyền thời gian ✨
        </h2>
      </div>

      <div ref={mountRef} style={{ position: 'relative', width: '100%', flex: 1, minHeight: 450, cursor: 'grab', touchAction: 'none' }} />

      <div style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 24,
        padding: '6px 18px',
        color: 'rgba(255, 255, 255, 0.92)',
        fontSize: '0.8rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
      }}>
        ✨ Vuốt xoay 360° quanh đôi bạn · Chạm vào thẻ Năm để mở cổng thời gian
      </div>
    </div>
  )
}

/* ---------------------------------------------------------
   PHASE 2: SIÊU HIỆU ỨNG BẮN LÊN & PHÁO HOA LƯỢNG TỬ (Quantum Supernova Launch)
--------------------------------------------------------- */

function easeOutQuint(x: number): number {
  return 1 - Math.pow(1 - x, 5)
}

interface LaunchAnimationProps {
  year: number
}

function LaunchAnimation({ year }: LaunchAnimationProps) {
  const palette = paletteForYear(year)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const glowRef = useRef<HTMLDivElement | null>(null)
  const [burstOn, setBurstOn] = useState(false)
  const [shockOn, setShockOn] = useState(false)

  // Vệt sao tốc độ ánh sáng (Warp Speed streaks)
  const warpStars = useMemo(() => Array.from({ length: 32 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    speed: 0.3 + Math.random() * 0.5,
    height: 60 + Math.random() * 110,
    opacity: 0.4 + Math.random() * 0.5,
  })), [])

  // Đuôi lửa bụi sao đa tầng
  const rocketSparks = useMemo(() => Array.from({ length: 38 }, (_, i) => ({
    id: i,
    delay: i * 0.024,
    drift: (Math.random() - 0.5) * 28,
    size: 4 + Math.random() * 6,
    color: i % 2 === 0 ? '#fde047' : palette.accent,
  })), [palette.accent])

  // Làn pháo hoa sóng 1: Kim cương vàng
  const burstWave1 = useMemo(() => Array.from({ length: 44 }, (_, i) => {
    const angle = (i / 44) * Math.PI * 2 + Math.random() * 0.12
    const dist = 75 + Math.random() * 110
    return {
      id: i,
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist * 0.88,
      delay: Math.random() * 0.08,
      size: 4 + Math.random() * 4,
      color: '#fde047',
    }
  }), [])

  // Làn pháo hoa sóng 2: Màu chủ đạo của Năm
  const burstWave2 = useMemo(() => Array.from({ length: 50 }, (_, i) => {
    const angle = (i / 50) * Math.PI * 2 + Math.random() * 0.12
    const dist = 145 + Math.random() * 135
    return {
      id: i,
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist * 0.88,
      delay: 0.08 + Math.random() * 0.12,
      size: 3 + Math.random() * 4,
      color: palette.accent,
    }
  }), [palette.accent])

  useEffect(() => {
    let rafId: number
    const duration = 1250
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const p = Math.min(elapsed / duration, 1)
      const ease = easeOutQuint(p)
      const bottom = 70 + ease * 380
      const scale = 1.05 - ease * 0.82
      const rot = ease * 25
      const opacity = p > 0.88 ? Math.max(0, 1 - (p - 0.88) / 0.12) : 1

      if (cardRef.current) {
        cardRef.current.style.transform = `translateX(-50%) scale(${scale}) rotate(${rot}deg)`
        cardRef.current.style.bottom = `${bottom}px`
        cardRef.current.style.opacity = String(opacity)
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translateX(-50%) scale(${1 + ease * 2.2})`
        glowRef.current.style.bottom = `${bottom - 10}px`
        glowRef.current.style.opacity = String(0.75 * (1 - ease * 0.4))
      }

      if (p < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        setBurstOn(true)
        window.setTimeout(() => setShockOn(true), 25)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [year])

  return (
    <div style={{ position: 'relative', width: '100%', height: 540, overflow: 'hidden' }}>
      {/* Các vệt sao tốc độ Warp Speed */}
      {warpStars.map((w) => (
        <span
          key={'warp-' + w.id}
          style={{
            position: 'absolute',
            left: `${w.left}%`,
            top: 0,
            width: 2,
            height: w.height,
            background: 'linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.8), transparent)',
            opacity: w.opacity,
            animation: `warpStream ${w.speed}s linear infinite`,
          }}
        />
      ))}

      {/* Đuôi lửa bụi sao bay theo thẻ */}
      {rocketSparks.map((p) => (
        <span
          key={'spark-' + p.id}
          style={{
            position: 'absolute',
            left: `calc(50% + ${p.drift}px)`,
            bottom: 72,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            boxShadow: `0 0 10px ${p.color}`,
            animation: `galaxyTrailRise 1.1s cubic-bezier(0.2, 0.7, 0.4, 1) ${p.delay}s 1 both`,
          }}
        />
      ))}

      {/* Hào quang bùng sáng */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 60,
          width: 140,
          height: 140,
          marginLeft: -70,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.glow}, transparent 70%)`,
          filter: 'blur(10px)',
        }}
      />

      {/* Thẻ Năm vút bay lên trời */}
      <div
        ref={cardRef}
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 70,
          width: 136,
          height: 190,
          marginLeft: -68,
          borderRadius: 22,
          background: `linear-gradient(160deg, ${palette.accentDeep}, ${palette.accent})`,
          border: `3.5px solid ${palette.border}`,
          boxShadow: `0 0 45px ${palette.glow}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          willChange: 'transform, bottom, opacity',
        }}
      >
        <span style={{ fontFamily: "'Outfit', 'Playfair Display', serif", fontSize: 42, fontWeight: 900, color: '#FFF7E8' }}>
          {year}
        </span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 800, color: '#fef08a', letterSpacing: 1 }}>
          KỶ NIỆM NĂM
        </span>
      </div>

      {/* Sóng xung kích bùng nổ */}
      {shockOn && (
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '20%',
          width: 30,
          height: 30,
          marginLeft: -15,
          marginTop: -15,
          borderRadius: '50%',
          border: `4px solid ${palette.accent}`,
          boxShadow: `0 0 25px ${palette.accent}`,
          animation: 'galaxyShockRing 0.85s ease-out forwards',
        }} />
      )}

      {/* Tia pháo hoa sóng 1 */}
      {burstOn && burstWave1.map((s) => (
        <span
          key={'w1-' + s.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: '20%',
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: s.color,
            boxShadow: `0 0 10px ${s.color}`,
            animation: `galaxyBurstFly 0.95s cubic-bezier(0.15, 0.7, 0.3, 1) ${s.delay}s 1 both`,
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
            top: '20%',
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: s.color,
            boxShadow: `0 0 14px ${s.color}`,
            animation: `galaxyBurstFly 1.2s cubic-bezier(0.15, 0.7, 0.3, 1) ${s.delay}s 1 both`,
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
        fontFamily: "'Outfit', sans-serif",
        fontSize: 17,
        fontWeight: 800,
        textShadow: `0 0 18px ${palette.glow}`,
        animation: 'galaxyTextGlow 1.2s ease-in-out infinite alternate',
      }}>
        🌌 Đang du hành tới Kỷ Niệm Năm {year}…
      </p>
    </div>
  )
}

/* ---------------------------------------------------------
   PHASE 3: TRỐNG ẢNH 3D NĂM ĐÓ (YearMemoriesDrum3D - Chia nhỏ nhiều ảnh & Xoay 360°)
--------------------------------------------------------- */

interface YearMemoriesDrum3DProps {
  year: number
  events: SharedEvent[]
  onBackToYears: () => void
  onOpenCardDetail: (item: MemoryItemChunk) => void
}

function YearMemoriesDrum3D({
  year,
  events,
  onBackToYears,
  onOpenCardDetail,
}: YearMemoriesDrum3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const palette = paletteForYear(year)

  // 1. TÁCH CÁC KỶ NIỆM NHIỀU ẢNH THÀNH CÁC Ô THẺ RIÊNG BIỆT TRONG TRỐNG ẢNH 3D
  const memoryChunks: MemoryItemChunk[] = useMemo(() => {
    const list: MemoryItemChunk[] = []

    for (const ev of events) {
      const allImgs: string[] = []
      if (Array.isArray(ev.images) && ev.images.length > 0) {
        allImgs.push(...ev.images.filter(Boolean))
      } else if (ev.image_url) {
        allImgs.push(ev.image_url)
      }

      const totalPhotos = allImgs.length

      if (totalPhotos > 1) {
        // Kỷ niệm nhiều ảnh: Tạo các thẻ liên hoàn (Ảnh 1/N, Ảnh 2/N...)
        allImgs.forEach((img, idx) => {
          list.push({
            id: `${ev.id || ev.event_date}-${idx}`,
            event: ev,
            photoUrl: img,
            photoIndex: idx,
            totalPhotos,
            title: ev.title || 'Kỷ niệm',
            date: ev.event_date,
            note: ev.note || undefined,
            chunkLabel: `${idx + 1}/${totalPhotos}`,
          })
        })
      } else if (totalPhotos === 1) {
        list.push({
          id: `${ev.id || ev.event_date}-0`,
          event: ev,
          photoUrl: allImgs[0],
          photoIndex: 0,
          totalPhotos: 1,
          title: ev.title || 'Kỷ niệm',
          date: ev.event_date,
          note: ev.note || undefined,
        })
      } else {
        // Không có ảnh: Thẻ đóa hoa kỷ niệm
        list.push({
          id: `${ev.id || ev.event_date}-text`,
          event: ev,
          totalPhotos: 0,
          title: ev.title || 'Kỷ niệm',
          date: ev.event_date,
          note: ev.note || undefined,
        })
      }
    }

    // Nếu không có kỷ niệm nào, tạo 1 placeholder ấm áp
    if (list.length === 0) {
      list.push({
        id: 'empty',
        event: {} as any,
        totalPhotos: 0,
        title: `Năm ${year}`,
        date: `${year}-01-01`,
        note: 'Chưa có ghi chép kỷ niệm cho năm này',
      })
    }

    return list
  }, [events, year])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 420
    const height = mount.clientHeight || 530

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100)
    camera.position.set(0, 1.35, 9.2)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.2))
    mount.appendChild(renderer.domElement)

    const hemiLight = new THREE.HemisphereLight(0xffedd5, 0x1e1b4b, 1.4)
    scene.add(hemiLight)

    const pointLight = new THREE.PointLight(0xfde047, 1.8, 10)
    pointLight.position.set(0, 1.5, 2.5)
    scene.add(pointLight)

    // Đôi Chibi ở giữa trống ảnh
    const { coupleGroup, mainHeart, subHeart } = buildHandHoldingCouple()
    coupleGroup.scale.setScalar(1.35)
    coupleGroup.position.y = -0.06
    scene.add(coupleGroup)

    // TRỐNG ẢNH 3D: 10 CỘT X 3 HÀNG (30 Ô THẺ)
    const drumGroup = new THREE.Group()
    scene.add(drumGroup)

    const cols = 10
    const rows = 3
    const cardW = 0.88
    const cardH = 1.18
    const radius = 3.8
    const rowYs = [1.08, 0, -1.08]
    const cardMeta: Array<{ group: THREE.Group; baseY: number; phase: number; item: MemoryItemChunk }> = []

    let cardCounter = 0

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        cardCounter += 1
        const angle = (col / cols) * Math.PI * 2 + (r % 2 === 1 ? Math.PI / cols : 0)
        const itemIdx = (cardCounter - 1) % memoryChunks.length
        const currentItem = memoryChunks[itemIdx]

        const cardPalette = paletteForYear(year, (cardCounter * 13) % 60 - 30)

        // Tạo texture mặt trước
        const frontTex = makeMemoryCardTexture(currentItem, cardCounter, cardPalette)

        const frontMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(cardW, cardH),
          new THREE.MeshBasicMaterial({ map: frontTex, transparent: true, side: THREE.FrontSide })
        )
        frontMesh.position.z = 0.005

        // Tải ảnh thật sắc nét (HD Image Loader)
        if (currentItem.photoUrl) {
          const imgLoader = new Image()
          imgLoader.crossOrigin = 'anonymous'
          imgLoader.onload = () => {
            const realTex = makeMemoryCardTexture(currentItem, cardCounter, cardPalette, imgLoader)
            frontMesh.material = new THREE.MeshBasicMaterial({ map: realTex, transparent: true, side: THREE.FrontSide })
          }
          imgLoader.src = currentItem.photoUrl
        }

        const backTex = makeCardBackTexture(cardPalette, 260)
        const backMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(cardW, cardH),
          new THREE.MeshBasicMaterial({ map: backTex, transparent: true, side: THREE.FrontSide })
        )
        backMesh.rotation.y = Math.PI
        backMesh.position.z = -0.005

        const cardGroup = new THREE.Group()
        cardGroup.userData = {
          isMemoryCard: true,
          item: currentItem,
          initialRotY: angle,
        }

        cardGroup.add(frontMesh, backMesh)

        const x = Math.sin(angle) * radius
        const z = Math.cos(angle) * radius
        cardGroup.position.set(x, rowYs[r], z)
        cardGroup.rotation.y = angle
        drumGroup.add(cardGroup)

        cardMeta.push({ group: cardGroup, baseY: rowYs[r], phase: cardCounter * 0.35, item: currentItem })
      }
    }

    // Sàn vành ánh sáng
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.28, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.accent), transparent: true, opacity: 0.65 })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -1.18
    scene.add(ring)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(radius + 0.9, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.accent), transparent: true, opacity: 0.08 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.19
    scene.add(floor)

    // Bụi sao
    const starPositions: number[] = []
    for (let i = 0; i < 240; i++) {
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
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.038, transparent: true, opacity: 0.78 })
    )
    scene.add(stars)

    // XỬ LÝ CLICK -> XOAY 360 ĐỘ TRONG KHÔNG GIAN 3D
    let spinningCardObj: {
      group: THREE.Group
      item: MemoryItemChunk
      startTime: number
      startRotY: number
      startZ: number
      startScale: number
    } | null = null

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
      if (moved > 6 || spinningCardObj) return

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
          const cardGrp = obj as THREE.Group
          // Khởi động hiệu ứng xoay 360 độ cực đẹp
          spinningCardObj = {
            group: cardGrp,
            item: obj.userData.item,
            startTime: performance.now(),
            startRotY: cardGrp.rotation.y,
            startZ: cardGrp.position.z,
            startScale: cardGrp.scale.x,
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

      if (!dragging && !spinningCardObj) {
        idleTimer += 1
        if (idleTimer > 35) drumGroup.rotation.y += 0.0028
      }

      // Xoay 360 độ mượt mà khi người dùng chạm vào thẻ
      if (spinningCardObj) {
        const elapsed = performance.now() - spinningCardObj.startTime
        const dur = 520
        const progress = Math.min(1, elapsed / dur)
        // Easing mượt
        const ease = 1 - Math.pow(1 - progress, 3)

        // Xoay đủ 360 độ (2 * PI)
        spinningCardObj.group.rotation.y = spinningCardObj.startRotY + ease * Math.PI * 2
        // Nhấc nhẹ lên phía trước
        spinningCardObj.group.position.z = spinningCardObj.startZ + Math.sin(progress * Math.PI) * 0.4
        // Nở nhẹ
        const sc = spinningCardObj.startScale * (1 + Math.sin(progress * Math.PI) * 0.25)
        spinningCardObj.group.scale.setScalar(sc)

        if (progress >= 1) {
          const itemToOpen = spinningCardObj.item
          spinningCardObj.group.rotation.y = spinningCardObj.startRotY
          spinningCardObj.group.position.z = spinningCardObj.startZ
          spinningCardObj.group.scale.setScalar(spinningCardObj.startScale)
          spinningCardObj = null
          // Kích hoạt mở modal chi tiết sau khi xoay 360 độ
          onOpenCardDetail(itemToOpen)
        }
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
  }, [year, memoryChunks, onOpenCardDetail, palette])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 520, display: 'flex', flexDirection: 'column' }}>
      {/* Nút quay lại chọn năm khác & Nhãn năm */}
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
          onClick={onBackToYears}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: `1.5px solid ${palette.border}`,
            color: '#fef08a',
            borderRadius: 24,
            padding: '7px 16px',
            fontSize: '0.84rem',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <ArrowLeft size={15} />
          <span>Chọn năm khác</span>
        </button>

        <span style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(14px)',
          border: `1.5px solid ${palette.border}`,
          borderRadius: 20,
          padding: '6px 16px',
          color: palette.accent,
          fontFamily: "'Outfit', 'Playfair Display', serif",
          fontWeight: 900,
          fontSize: '0.94rem',
        }}>
          🌌 Năm {year} · {events.length} kỷ niệm ({memoryChunks.length} ô ảnh)
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
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 24,
        padding: '6px 18px',
        color: 'rgba(255, 255, 255, 0.92)',
        fontSize: '0.8rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}>
        ✨ Vuốt xoay trống ảnh 360° · Chạm vào thẻ để xoay 360° mở chi tiết
      </div>
    </div>
  )
}

/* ---------------------------------------------------------
   MODAL CHI TIẾT KỶ NIỆM 3D (Celestial 3D Memory Detail Modal)
   - Xoay 360 độ nhẹ nhàng khi nở ra, không giật, giữ nguyên không gian 3D
--------------------------------------------------------- */

interface CelestialMemoryModalProps {
  item: MemoryItemChunk
  palette: ReturnType<typeof paletteForYear>
  onClose: () => void
  onOpenLightbox: (images: string[], index: number) => void
}

function CelestialMemoryModal({ item, palette, onClose, onOpenLightbox }: CelestialMemoryModalProps) {
  const ev = item.event
  const allImages = useMemo(() => {
    const list: string[] = []
    if (Array.isArray(ev.images) && ev.images.length > 0) {
      list.push(...ev.images.filter(Boolean))
    } else if (ev.image_url) {
      list.push(ev.image_url)
    }
    return list
  }, [ev])

  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(() => item.photoIndex || 0)

  const currentPhoto = allImages[activePhotoIdx] || allImages[0]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(10, 8, 24, 0.78)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 70%, #030712 100%)',
          border: `2px solid ${palette.border}`,
          borderRadius: 24,
          boxShadow: `0 25px 60px rgba(0,0,0,0.6), 0 0 35px ${palette.glow}`,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          color: '#ffffff',
          animation: 'modal360Blossom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          transformOrigin: 'center center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          background: 'rgba(255, 255, 255, 0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: palette.accent }} />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.05rem', fontWeight: 900, color: '#fef08a' }}>
              {ev.title || 'Chi Tiết Kỷ Niệm'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nội dung ảnh: 100% FULL không cắt xén */}
        {allImages.length > 0 && (
          <div style={{ padding: '16px 20px 8px' }}>
            <div style={{
              position: 'relative',
              width: '100%',
              height: 320,
              borderRadius: 16,
              overflow: 'hidden',
              background: '#090d16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}>
              {/* Nền mờ nghệ thuật */}
              <div
                style={{
                  position: 'absolute',
                  inset: -20,
                  backgroundImage: `url(${currentPhoto})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(22px) brightness(0.65)',
                  opacity: 0.6,
                  transform: 'scale(1.1)',
                  pointerEvents: 'none',
                }}
              />

              {/* Ảnh chính full 100% */}
              <img
                src={currentPhoto}
                alt=""
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: 12,
                  position: 'relative',
                  zIndex: 2,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              />

              {/* Nút phóng to toàn màn hình */}
              <button
                type="button"
                onClick={() => onOpenLightbox(allImages, activePhotoIdx)}
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 12,
                  zIndex: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: 'rgba(15, 23, 42, 0.78)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Maximize2 size={13} />
                <span>Phóng to</span>
              </button>

              {/* Nút chuyển ảnh trước/sau nếu có nhiều ảnh */}
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActivePhotoIdx((p) => (p > 0 ? p - 1 : allImages.length - 1))}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 10,
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: '#ffffff',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePhotoIdx((p) => (p < allImages.length - 1 ? p + 1 : 0))}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 10,
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: '#ffffff',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>

            {/* Băng chuyền các ảnh thu nhỏ (Thumbnails Carousel) */}
            {allImages.length > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10, paddingBottom: 4 }}>
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    style={{
                      width: 58,
                      height: 58,
                      flexShrink: 0,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: activePhotoIdx === idx ? `2.5px solid ${palette.accent}` : '1px solid rgba(255, 255, 255, 0.2)',
                      padding: 0,
                      background: '#090d16',
                      cursor: 'pointer',
                      transform: activePhotoIdx === idx ? 'scale(1.05)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Thông tin ngày giờ, địa điểm */}
        <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: '0.84rem', color: '#cbd5e1' }}>
            {ev.event_date && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#fef08a', fontWeight: 700 }}>
                <Calendar size={15} />
                <span>{ev.event_date}</span>
              </span>
            )}
            {ev.event_time && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Clock size={14} />
                <span>{ev.event_time}</span>
              </span>
            )}
            {ev.location && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={14} />
                <span>{ev.location}</span>
              </span>
            )}
          </div>

          {/* Ghi chú cảm xúc viết tay */}
          {ev.note && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.07)',
              borderLeft: `3px solid ${palette.accent}`,
              borderRadius: '0 12px 12px 0',
              padding: '12px 16px',
              fontStyle: 'italic',
              fontSize: '0.92rem',
              lineHeight: 1.6,
              color: '#f8fafc',
            }}>
              "{ev.note}"
            </div>
          )}
        </div>
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
  onYearChange?: (year: number) => void
  onOpenPhotoLightbox?: (images: string[], index: number) => void
  onSelectEvent?: (event: SharedEvent) => void
}

export function GalaxyWheel3DMemoryView({
  events = [],
  year,
  onYearChange,
  onOpenPhotoLightbox,
}: GalaxyWheel3DMemoryViewProps) {
  const [phase, setPhase] = useState<'select' | 'launch' | 'gallery'>('select')
  const [currentYear, setCurrentYear] = useState<number>(year)
  const [activeDetailItem, setActiveDetailItem] = useState<MemoryItemChunk | null>(null)

  // Danh sách các Năm thực tế từ dữ liệu kỷ niệm
  const yearsList: YearInfo[] = useMemo(() => {
    const map = new Map<number, { events: SharedEvent[]; photosCount: number }>()

    for (const ev of events) {
      if (!ev.event_date) continue
      const y = parseInt(ev.event_date.slice(0, 4), 10)
      if (!isNaN(y)) {
        if (!map.has(y)) map.set(y, { events: [], photosCount: 0 })
        const item = map.get(y)!
        item.events.push(ev)
        const pCount = Array.isArray(ev.images) && ev.images.length > 0 ? ev.images.length : (ev.image_url ? 1 : 0)
        item.photosCount += pCount
      }
    }

    if (map.size === 0) {
      const curY = new Date().getFullYear()
      map.set(curY, { events: [], photosCount: 0 })
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .map(([yearNum, data]) => ({
        year: yearNum,
        events: data.events,
        count: data.events.length,
        photosCount: data.photosCount,
      }))
  }, [events])

  // Lọc kỷ niệm của năm đang mở trong trống 3D
  const selectedYearEvents = useMemo(() => {
    return events.filter((ev) => {
      if (!ev.event_date) return true
      return parseInt(ev.event_date.slice(0, 4), 10) === currentYear
    })
  }, [events, currentYear])

  const handleSelectYear = (y: number) => {
    setCurrentYear(y)
    if (onYearChange) onYearChange(y)
    setPhase('launch')
    window.setTimeout(() => {
      setPhase('gallery')
    }, 1900)
  }

  const handleBackToYears = () => {
    setPhase('select')
    setActiveDetailItem(null)
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
        .galaxy-nebula-a { width: 340px; height: 340px; top: -60px; left: -60px; background: radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%); animation: galaxyDriftA 16s ease-in-out infinite; }
        .galaxy-nebula-b { width: 380px; height: 380px; bottom: -80px; right: -60px; background: radial-gradient(circle, rgba(244,63,94,0.45), transparent 70%); animation: galaxyDriftB 18s ease-in-out infinite; }
        .galaxy-nebula-c { width: 280px; height: 280px; top: 40%; left: 55%; background: radial-gradient(circle, rgba(45,212,191,0.35), transparent 70%); animation: galaxyDriftC 14s ease-in-out infinite; }

        @keyframes warpStream {
          0% { transform: translateY(-100%); opacity: 0; }
          40% { opacity: 0.9; }
          100% { transform: translateY(550px); opacity: 0; }
        }
        @keyframes galaxyTrailRise {
          0% { transform: translateY(0) scale(1); opacity: 0.95; }
          100% { transform: translateY(-370px) scale(0.12); opacity: 0; }
        }
        @keyframes galaxyBurstFly {
          0% { transform: translate(0,0) scale(0); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate(var(--bx), var(--by)) scale(1); opacity: 0; }
        }
        @keyframes galaxyShockRing {
          0% { transform: scale(0.2); opacity: 1; }
          100% { transform: scale(14); opacity: 0; }
        }
        @keyframes galaxyTextGlow {
          from { opacity: 0.85; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1.02); }
        }
        @keyframes modal360Blossom {
          0% { transform: scale(0.7) rotateY(180deg); opacity: 0; }
          100% { transform: scale(1) rotateY(0deg); opacity: 1; }
        }
      `}</style>

      {/* Nền tinh vân vũ trụ */}
      <GalaxyBackdrop />

      {/* Nội dung 3D theo từng giai đoạn */}
      <div style={{ position: 'relative', zIndex: 5, width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {phase === 'select' && (
          <YearWheel3D
            yearsList={yearsList}
            onSelectYear={handleSelectYear}
          />
        )}

        {phase === 'launch' && (
          <LaunchAnimation year={currentYear} />
        )}

        {phase === 'gallery' && (
          <YearMemoriesDrum3D
            year={currentYear}
            events={selectedYearEvents}
            onBackToYears={handleBackToYears}
            onOpenCardDetail={(item) => setActiveDetailItem(item)}
          />
        )}
      </div>

      {/* Modal chi tiết kỷ niệm 3D nở ra sau khi xoay 360 độ */}
      {activeDetailItem && (
        <CelestialMemoryModal
          item={activeDetailItem}
          palette={paletteForYear(currentYear)}
          onClose={() => setActiveDetailItem(null)}
          onOpenLightbox={(imgs, idx) => {
            if (onOpenPhotoLightbox) onOpenPhotoLightbox(imgs, idx)
          }}
        />
      )}
    </div>
  )
}
