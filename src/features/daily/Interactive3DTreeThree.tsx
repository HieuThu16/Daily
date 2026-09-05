import { useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import type { SeasonTheme } from './YearlyMemoryBook'

export interface Interactive3DTreeCanvasProps {
  year?: number
  events?: Array<{ event_date?: string; date?: string; [key: string]: any }>
  theme: SeasonTheme
  onOpenBook?: () => void
  onSelectMonth?: (monthNum: number) => void
  compact?: boolean
}

/**
 * Tạo hình dạng cánh hoa anh đào uốn cong tự nhiên có notch (khía chẻ sakura) chuẩn Play Together
 */
function createSakuraPetalGeometry(width = 0.16, height = 0.22): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(-width * 0.42, height * 0.24, -width * 0.58, height * 0.65, -width * 0.28, height * 0.98)
  // Khía chẻ notch hình tim đặc trưng của hoa anh đào
  shape.lineTo(-width * 0.08, height * 0.88)
  shape.lineTo(width * 0.08, height * 0.88)
  shape.bezierCurveTo(width * 0.28, height * 0.98, width * 0.58, height * 0.65, width * 0.42, height * 0.24)
  shape.lineTo(0, 0)

  const geo = new THREE.ShapeGeometry(shape, 8)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = -(x * x * 2.8 + (y - height * 0.5) ** 2 * 0.8) * 0.18
    pos.setZ(i, z)
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Tạo một đóa hoa anh đào 5 cánh sắc nét, nhụy tròn xinh xắn chuẩn phong cách Play Together
 */
function createSakuraFlowerMesh(
  petalGeo: THREE.BufferGeometry,
  petalMat: THREE.Material,
  pistilMat: THREE.Material,
  scale = 1
): THREE.Group {
  const group = new THREE.Group()
  const petalCount = 5
  for (let i = 0; i < petalCount; i++) {
    const pMesh = new THREE.Mesh(petalGeo, petalMat)
    const angle = (i / petalCount) * Math.PI * 2
    pMesh.position.set(Math.cos(angle) * 0.065, Math.sin(angle) * 0.065, 0)
    pMesh.rotation.z = angle - Math.PI / 2
    pMesh.rotation.x = 0.14
    group.add(pMesh)
  }
  const pistilGeo = new THREE.SphereGeometry(0.042, 10, 10)
  const pistil = new THREE.Mesh(pistilGeo, pistilMat)
  pistil.position.z = 0.018
  group.add(pistil)
  group.scale.set(scale, scale, scale)
  return group
}

/**
 * Tạo texture hình tròn sang trọng cho chữ Tháng (T1..T12) & Huy hiệu số kỷ niệm
 */
function createMonthBadgeTexture(label: string, count: number, accentColor?: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 160, 160)

    // Đổ bóng mềm
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4

    // Vòng tròn trung tâm
    ctx.beginPath()
    ctx.arc(80, 80, 56, 0, Math.PI * 2)
    const grad = ctx.createRadialGradient(70, 70, 10, 80, 80, 56)
    if (count > 0) {
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.8, '#fef3c7')
      grad.addColorStop(1, '#fde68a')
    } else {
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(1, '#f8fafc')
    }
    ctx.fillStyle = grad
    ctx.fill()

    ctx.shadowColor = 'transparent'
    ctx.lineWidth = 5
    ctx.strokeStyle = count > 0 ? (accentColor || '#f59e0b') : '#cbd5e1'
    ctx.stroke()

    // Chữ tháng (T1, T2...)
    ctx.font = '900 44px "Outfit", "Inter", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = count > 0 ? '#78350f' : '#334155'
    ctx.fillText(label, 80, 83)

    // Huy hiệu đếm số kỷ niệm nhỏ góc trên
    if (count > 0) {
      ctx.shadowColor = 'rgba(234, 88, 12, 0.4)'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(120, 42, 25, 0, Math.PI * 2)
      ctx.fillStyle = '#ea580c'
      ctx.fill()

      ctx.shadowColor = 'transparent'
      ctx.lineWidth = 3.5
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()

      ctx.font = '800 24px "Outfit", sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(count), 120, 43)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

export function Interactive3DTreeCanvas({
  events = [],
  theme,
  onOpenBook,
  onSelectMonth,
  compact = false,
}: Interactive3DTreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Đếm số kỷ niệm theo từng tháng 1..12
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (let i = 1; i <= 12; i++) counts[i] = 0
    for (const ev of events) {
      const d = ev.event_date || ev.date
      if (!d) continue
      const m = parseInt(d.slice(5, 7), 10)
      if (m >= 1 && m <= 12) {
        counts[m] = (counts[m] || 0) + 1
      }
    }
    return counts
  }, [events])

  // State tooltip khi hover hoa tháng
  const [hoveredFlower, setHoveredFlower] = useState<{
    month: number
    label: string
    count: number
    screenX: number
    screenY: number
  } | null>(null)

  const onOpenBookRef = useRef(onOpenBook)
  onOpenBookRef.current = onOpenBook
  const onSelectMonthRef = useRef(onSelectMonth)
  onSelectMonthRef.current = onSelectMonth
  const hoveredMonthRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let animId: number
    const rect = container.getBoundingClientRect()
    const width = rect.width || (compact ? 300 : 450)
    const height = rect.height || (compact ? 220 : 450)

    // 1. Scene & Renderer
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100)
    camera.position.set(0, 1.8, compact ? 9.5 : 8.4)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = false

    // 2. Hệ thống Ánh Sáng Điện Ảnh (Cinematic Luminous Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2)
    sunLight.position.set(6, 12, 7)
    scene.add(sunLight)

    // Ánh sáng viền tạo hào quang óng ánh trên cành & cánh hoa
    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.2)
    rimLight.position.set(-6, 8, -6)
    scene.add(rimLight)

    // Đèn ấm từ dưới chiếu lên tán hoa
    const groundBounceLight = new THREE.DirectionalLight(0xffedd5, 0.8)
    groundBounceLight.position.set(0, -5, 3)
    scene.add(groundBounceLight)

    // Ánh sáng ma thuật phát ra từ tâm thân cây
    const corePointLight = new THREE.PointLight(theme.accent, 2.2, 10)
    corePointLight.position.set(0, 2.4, 0)
    scene.add(corePointLight)

    // 3. Nhóm Cây Kỷ Niệm 3D
    const treeGroup = new THREE.Group()
    scene.add(treeGroup)

    // ── ĐẢO CỎ CÔNG VIÊN KAIA (Play Together Soft Grass Island) ──
    const islandGeo = new THREE.CylinderGeometry(2.3, 1.85, 0.42, 48)
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80, // Thảm cỏ xanh tươi sáng pastel
      roughness: 0.5,
      metalness: 0.02,
      emissive: 0x22c55e,
      emissiveIntensity: 0.14,
    })
    const island = new THREE.Mesh(islandGeo, islandMat)
    island.position.y = -0.72
    treeGroup.add(island)

    // Khối đá pha lê lơ lửng bên dưới
    const rockBaseGeo = new THREE.ConeGeometry(1.6, 1.1, 7)
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.75,
      metalness: 0.15,
      flatShading: true,
    })
    const rockBase = new THREE.Mesh(rockBaseGeo, rockMat)
    rockBase.position.y = -1.45
    rockBase.rotation.x = Math.PI
    treeGroup.add(rockBase)

    // Vành hào quang vàng ấm áp
    const ringGeo = new THREE.TorusGeometry(2.5, 0.035, 14, 64)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.85,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = -0.7
    treeGroup.add(ring)

    // Geometry cánh hoa anh đào có notch đặc trưng
    const petalGeo = createSakuraPetalGeometry(0.16, 0.22)

    // Những cánh hoa anh đào rụng rải rác trên thảm cỏ dưới gốc cây
    const fallenPetalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.petalColor),
      emissive: new THREE.Color(theme.petalColor),
      emissiveIntensity: 0.25,
      roughness: 0.4,
      side: THREE.DoubleSide,
    })
    for (let i = 0; i < 20; i++) {
      const fPetal = new THREE.Mesh(petalGeo, fallenPetalMat)
      const fAng = Math.random() * Math.PI * 2
      const fDist = 0.35 + Math.random() * 1.55
      fPetal.position.set(Math.cos(fAng) * fDist, -0.49, Math.sin(fAng) * fDist)
      fPetal.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.2
      fPetal.rotation.z = Math.random() * Math.PI * 2
      const fScale = 0.6 + Math.random() * 0.4
      fPetal.scale.set(fScale, fScale, fScale)
      treeGroup.add(fPetal)
    }

    // ── THÂN CÂY HOẠT HÌNH MỊN MÀNG (Play Together Smooth Stylized Trunk) ──
    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x7c4a3a, // Màu gỗ ấm áp, mịn màng, thân thiện
      roughness: 0.55,
      metalness: 0.04,
    })

    // Thân chính uốn cong nhẹ nhàng, thanh thoát
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(0.06, 0.35, 0.04),
      new THREE.Vector3(-0.06, 1.15, -0.02),
      new THREE.Vector3(0.05, 1.85, 0.03),
    ])
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 32, 0.24, 16, false)
    const trunk = new THREE.Mesh(trunkGeo, barkMat)
    treeGroup.add(trunk)

    // 3 cành chính vươn ra đỡ lấy các khối mây hoa bồng bềnh
    const boughs = [
      {
        curve: [
          new THREE.Vector3(0.05, 1.85, 0.03),
          new THREE.Vector3(-0.45, 2.35, 0.22),
          new THREE.Vector3(-0.95, 2.8, 0.38),
        ],
        r: 0.13,
      },
      {
        curve: [
          new THREE.Vector3(0.05, 1.85, 0.03),
          new THREE.Vector3(0.48, 2.3, 0.15),
          new THREE.Vector3(0.92, 2.75, 0.28),
        ],
        r: 0.13,
      },
      {
        curve: [
          new THREE.Vector3(0.05, 1.85, 0.03),
          new THREE.Vector3(-0.02, 2.5, -0.38),
          new THREE.Vector3(-0.05, 3.1, -0.72),
        ],
        r: 0.12,
      },
    ]
    for (const b of boughs) {
      const bCurve = new THREE.CatmullRomCurve3(b.curve)
      const bGeo = new THREE.TubeGeometry(bCurve, 18, b.r, 12, false)
      const bMesh = new THREE.Mesh(bGeo, barkMat)
      treeGroup.add(bMesh)
    }

    // 3 chân rễ mềm mại bám nhẹ vào mặt cỏ
    const rootAngles = [0.4, 2.4, 4.5]
    for (const rAng of rootAngles) {
      const rCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.2, 0),
        new THREE.Vector3(Math.cos(rAng) * 0.42, -0.45, Math.sin(rAng) * 0.42),
        new THREE.Vector3(Math.cos(rAng) * 0.85, -0.58, Math.sin(rAng) * 0.85),
      ])
      const rMesh = new THREE.Mesh(new THREE.TubeGeometry(rCurve, 12, 0.09, 8, false), barkMat)
      treeGroup.add(rMesh)
    }

    // ── TÁN HOA BỒNG BỀNH KẸO BÔNG (Play Together Fluffy Cloud Canopy) ──
    const canopyGroup = new THREE.Group()
    treeGroup.add(canopyGroup)

    // Bảng màu kẹo ngọt pastel cho các khối mây hoa
    const cloudShades = [
      theme.treeCanopy[0] || '#ffaec9', // Hồng sakura chính
      theme.treeCanopy[1] || '#ff9ebb', // Hồng cherry bóng đổ
      theme.treeCanopy[2] || '#ffd4e5', // Hồng phấn highlight
      '#ffeaf2',                        // Đỉnh mây trắng hồng bồng bềnh
    ]

    const cloudMaterials = cloudShades.map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(c),
          roughness: 0.38,
          metalness: 0.02,
          emissive: new THREE.Color(c),
          emissiveIntensity: 0.26,
        })
    )

    // 9 khối búp mây phồng to tròn mịn màng xếp tầng bồng bềnh
    const cloudLobes = [
      // Khối vòm trung tâm (Main Center Cloud)
      { pos: [0, 3.25, 0], r: 1.35, scale: [1.25, 0.95, 1.25], mat: cloudMaterials[0] },
      // Búp mây trước bên trái (Front-Left Lobe)
      { pos: [-0.95, 3.0, 0.68], r: 1.05, scale: [1.16, 0.88, 1.1], mat: cloudMaterials[1] },
      // Búp mây trước bên phải (Front-Right Lobe)
      { pos: [0.95, 2.95, 0.62], r: 1.1, scale: [1.16, 0.88, 1.1], mat: cloudMaterials[0] },
      // Búp mây sau bên trái (Back-Left Lobe)
      { pos: [-0.9, 3.2, -0.7], r: 1.02, scale: [1.1, 0.9, 1.15], mat: cloudMaterials[1] },
      // Búp mây sau bên phải (Back-Right Lobe)
      { pos: [0.85, 3.15, -0.65], r: 1.05, scale: [1.12, 0.9, 1.1], mat: cloudMaterials[2] },
      // Đỉnh vương miện mây trắng hồng (Top Crown Cloud)
      { pos: [0, 4.05, 0], r: 0.92, scale: [1.1, 0.86, 1.1], mat: cloudMaterials[3] },
      // Búp mây rủ mềm phía trước (Center-Front Accent Puff)
      { pos: [0.08, 2.8, 1.18], r: 0.72, scale: [1.08, 0.85, 1.08], mat: cloudMaterials[2] },
      // Búp mây rủ mềm bên trái
      { pos: [-1.32, 2.45, 0.2], r: 0.75, scale: [1.1, 0.85, 1.05], mat: cloudMaterials[1] },
      // Búp mây rủ mềm bên phải
      { pos: [1.35, 2.5, -0.2], r: 0.78, scale: [1.1, 0.85, 1.05], mat: cloudMaterials[0] },
    ]

    for (const lobe of cloudLobes) {
      const lobeGeo = new THREE.SphereGeometry(lobe.r, 26, 20)
      const lobeMesh = new THREE.Mesh(lobeGeo, lobe.mat)
      lobeMesh.position.set(lobe.pos[0], lobe.pos[1], lobe.pos[2])
      lobeMesh.scale.set(lobe.scale[0], lobe.scale[1], lobe.scale[2])
      canopyGroup.add(lobeMesh)
    }

    // ── HOA ANH ĐÀO 5 CÁNH SẮC NÉT NỞ TRÊN TÁN CÂY (Play Together Crisp Blossoms) ──
    const flowerPetalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Cánh hoa trắng tinh khôi
      emissive: 0xffe4e6,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.04,
      side: THREE.DoubleSide,
    })
    const flowerPistilMat = new THREE.MeshStandardMaterial({
      color: 0xff3b77, // Nhuỵ hồng san hô rực rỡ
      emissive: 0xf43f5e,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.2,
    })

    // 32 bông hoa anh đào đính rải rác trên khắp bề mặt mây hồng
    const canopyFlowerCount = compact ? 18 : 32
    for (let i = 0; i < canopyFlowerCount; i++) {
      const ang = (i / canopyFlowerCount) * Math.PI * 2 + (i % 3) * 0.2
      const radius = 1.35 + (i % 4) * 0.38
      const fY = 2.45 + (i % 5) * 0.35 + Math.sin(i * 1.5) * 0.35
      const fX = Math.cos(ang) * radius
      const fZ = Math.sin(ang) * radius

      const flowerMesh = createSakuraFlowerMesh(petalGeo, flowerPetalMat, flowerPistilMat, 0.85 + (i % 3) * 0.2)
      flowerMesh.position.set(fX, fY, fZ)

      // Xoay hoa hướng ra ngoài tâm cây
      flowerMesh.lookAt(fX * 2, fY + 0.1, fZ * 2)
      canopyGroup.add(flowerMesh)
    }

    // ── 12 BÔNG HOA THÁNG (12 Sacred Month Flowers — Lộng lẫy, có mạ vàng) ──
    const monthFlowerMeshes: Array<{
      group: THREE.Group
      month: number
      label: string
      count: number
      badgeSprite: THREE.Sprite
      glowMesh?: THREE.Mesh
      baseScale: number
    }> = []

    for (let m = 1; m <= 12; m++) {
      const ang = ((m - 1) / 12) * Math.PI * 2 - Math.PI / 2
      const radius = 2.42 + ((m % 2) === 0 ? 0.35 : -0.2)
      const fY = 2.65 + Math.sin(((m - 1) / 12) * Math.PI * 2) * 1.0
      const fX = Math.cos(ang) * radius
      const fZ = Math.sin(ang) * radius

      const flowerGroup = new THREE.Group()
      flowerGroup.position.set(fX, fY, fZ)

      const count = monthCounts[m] || 0
      const isStarred = count > 0

      // Bông hoa anh đào 5 cánh to đẹp
      const mFlowerMesh = createSakuraFlowerMesh(petalGeo, flowerPetalMat, flowerPistilMat, 1.25)
      flowerGroup.add(mFlowerMesh)

      // Vành hào quang vàng kim quay quanh nếu tháng có kỷ niệm
      let glowMesh: THREE.Mesh | undefined
      if (isStarred) {
        const glowGeo = new THREE.TorusGeometry(0.42, 0.026, 10, 36)
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xfbbf24,
          emissiveIntensity: 0.9,
          roughness: 0.15,
          metalness: 0.85,
        })
        glowMesh = new THREE.Mesh(glowGeo, glowMat)
        flowerGroup.add(glowMesh)
      }

      // Sprite huy hiệu Tháng T1..T12
      const badgeTex = createMonthBadgeTexture(`T${m}`, count, theme.accent)
      const spriteMat = new THREE.SpriteMaterial({
        map: badgeTex,
        depthTest: false,
        transparent: true,
      })
      const badgeSprite = new THREE.Sprite(spriteMat)
      badgeSprite.scale.set(0.68, 0.68, 1)
      badgeSprite.position.set(0, 0, 0.12)
      flowerGroup.add(badgeSprite)

      // Nhận diện raycasting
      flowerGroup.userData = {
        isMonthFlower: true,
        month: m,
        label: `Tháng ${m}`,
        count,
      }

      treeGroup.add(flowerGroup)
      monthFlowerMeshes.push({
        group: flowerGroup,
        month: m,
        label: `Tháng ${m}`,
        count,
        badgeSprite,
        glowMesh,
        baseScale: isStarred ? 1.2 : 1.0,
      })
    }

    // ── CÁNH HOA ANH ĐÀO RƠI RƠI BAY BAY (Drifting Sakura Petals) ──
    const petalCount = compact ? 18 : 34
    const fallingPetalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.petalColor),
      emissive: new THREE.Color(theme.petalColor),
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.42,
    })

    const petalsList: Array<{
      mesh: THREE.Mesh | THREE.Group
      vy: number
      vx: number
      vz: number
      rotSpeedX: number
      rotSpeedY: number
      rotSpeedZ: number
      seed: number
      isBlossom?: boolean
    }> = []

    for (let i = 0; i < petalCount; i++) {
      const pMesh = new THREE.Mesh(petalGeo, fallingPetalMat)
      pMesh.position.set(
        (Math.random() - 0.5) * 4.0,
        0.2 + Math.random() * 4.4,
        (Math.random() - 0.5) * 4.0
      )
      pMesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      )
      const pScale = 0.75 + Math.random() * 0.55
      pMesh.scale.set(pScale, pScale, pScale)
      scene.add(pMesh)

      petalsList.push({
        mesh: pMesh,
        vy: 0.012 + Math.random() * 0.016,
        vx: (Math.random() - 0.5) * 0.006,
        vz: (Math.random() - 0.5) * 0.006,
        rotSpeedX: 0.02 + Math.random() * 0.03,
        rotSpeedY: 0.025 + Math.random() * 0.035,
        rotSpeedZ: 0.015 + Math.random() * 0.02,
        seed: Math.random() * 10,
      })
    }

    // Những đóa hoa anh đào 5 cánh nguyên vẹn rơi chầm chậm
    const fullBlossomCount = compact ? 3 : 6
    for (let i = 0; i < fullBlossomCount; i++) {
      const blossomMesh = createSakuraFlowerMesh(petalGeo, flowerPetalMat, flowerPistilMat, 0.55)
      blossomMesh.position.set(
        (Math.random() - 0.5) * 3.4,
        1.0 + Math.random() * 3.6,
        (Math.random() - 0.5) * 3.4
      )
      scene.add(blossomMesh)

      petalsList.push({
        mesh: blossomMesh,
        vy: 0.01 + Math.random() * 0.012,
        vx: (Math.random() - 0.5) * 0.005,
        vz: (Math.random() - 0.5) * 0.005,
        rotSpeedX: 0.015 + Math.random() * 0.02,
        rotSpeedY: 0.025 + Math.random() * 0.025,
        rotSpeedZ: 0.01 + Math.random() * 0.02,
        seed: Math.random() * 10,
        isBlossom: true,
      })
    }

    // Đom đóm vàng ấm áp dập dờn
    const fireflyCount = compact ? 8 : 14
    const ffGeo = new THREE.SphereGeometry(0.045, 6, 6)
    const ffMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9,
    })
    const firefliesList: Array<{ mesh: THREE.Mesh; seed: number; baseY: number }> = []

    for (let i = 0; i < fireflyCount; i++) {
      const ff = new THREE.Mesh(ffGeo, ffMat)
      const bY = 0.8 + Math.random() * 3.4
      ff.position.set(
        (Math.random() - 0.5) * 3.6,
        bY,
        (Math.random() - 0.5) * 3.6
      )
      scene.add(ff)
      firefliesList.push({ mesh: ff, seed: Math.random() * 10, baseY: bY })
    }

    // ── XOAY 360 ĐỘ & RAYCASTING CHẠM HOA ──
    const raycaster = new THREE.Raycaster()
    const mousePos = new THREE.Vector2(-999, -999)

    let isDragging = false
    let hasMoved = false
    let startX = 0
    let startY = 0
    let targetRotY = 0
    let targetRotX = 0.1
    let curRotY = 0
    let curRotX = 0.1

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true
      hasMoved = false
      startX = e.clientX
      startY = e.clientY
    }

    const onPointerMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const clientX = e.clientX - r.left
      const clientY = e.clientY - r.top

      mousePos.x = (clientX / r.width) * 2 - 1
      mousePos.y = -(clientY / r.height) * 2 + 1

      if (isDragging) {
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          hasMoved = true
        }
        targetRotY += dx * 0.009
        targetRotX = Math.max(-0.32, Math.min(0.42, targetRotX + dy * 0.005))
        startX = e.clientX
        startY = e.clientY
      }

      // Raycast kiểm tra chạm vào 12 hoa tháng
      raycaster.setFromCamera(mousePos, camera)
      const clickableObjects = monthFlowerMeshes.map((m) => m.group)
      const intersects = raycaster.intersectObjects(clickableObjects, true)

      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object
        while (hitObj && !hitObj.userData?.isMonthFlower && hitObj.parent) {
          hitObj = hitObj.parent
        }

        if (hitObj && hitObj.userData?.isMonthFlower) {
          const m = hitObj.userData.month as number
          const count = hitObj.userData.count as number
          const screenPos = hitObj.position.clone().applyMatrix4(treeGroup.matrixWorld).project(camera)
          const sX = ((screenPos.x + 1) / 2) * r.width
          const sY = ((-screenPos.y + 1) / 2) * r.height

          if (hoveredMonthRef.current !== m) {
            hoveredMonthRef.current = m
            setHoveredFlower({
              month: m,
              label: `Tháng ${m}`,
              count,
              screenX: sX,
              screenY: sY,
            })
          }
          canvas.style.cursor = 'pointer'
          return
        }
      }

      if (hoveredMonthRef.current !== null) {
        hoveredMonthRef.current = null
        setHoveredFlower(null)
      }
      canvas.style.cursor = isDragging ? 'grabbing' : 'grab'
    }

    const onPointerUp = () => {
      if (!hasMoved) {
        const hovM = hoveredMonthRef.current
        if (hovM) {
          if (onSelectMonthRef.current) {
            onSelectMonthRef.current(hovM)
          } else if (onOpenBookRef.current) {
            onOpenBookRef.current()
          }
        } else if (onOpenBookRef.current) {
          onOpenBookRef.current()
        }
      }
      isDragging = false
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    const onResize = () => {
      const newRect = container.getBoundingClientRect()
      const w = newRect.width || (compact ? 300 : 450)
      const h = newRect.height || (compact ? 220 : 450)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    window.addEventListener('resize', onResize)

    // ── ANIMATION RENDER LOOP ──
    const clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const elapsedTime = clock.getElapsedTime()

      // Tự động xoay chậm rãi khi không vuốt
      if (!isDragging) {
        targetRotY += 0.0028
      }

      // Smooth Damping nội suy góc xoay
      curRotY += (targetRotY - curRotY) * 0.08
      curRotX += (targetRotX - curRotX) * 0.08
      treeGroup.rotation.y = curRotY
      treeGroup.rotation.x = curRotX

      // Gió thổi đung đưa tán hoa bồng bềnh
      canopyGroup.rotation.z = Math.sin(elapsedTime * 0.85) * 0.025
      canopyGroup.position.x = Math.sin(elapsedTime * 0.85) * 0.035

      // Vành hào quang xoay nhịp nhàng
      ring.rotation.z += 0.004

      // Cập nhật từng cánh hoa rơi uốn lượn theo gió
      for (const petal of petalsList) {
        petal.mesh.position.y -= petal.vy
        petal.mesh.position.x += Math.sin(elapsedTime * 1.6 + petal.seed) * 0.006
        petal.mesh.position.z += Math.cos(elapsedTime * 1.6 + petal.seed) * 0.006

        petal.mesh.rotation.x += petal.rotSpeedX
        petal.mesh.rotation.y += petal.rotSpeedY
        petal.mesh.rotation.z += petal.rotSpeedZ

        if (petal.mesh.position.y < -0.75) {
          petal.mesh.position.y = 4.2 + Math.random() * 0.6
          petal.mesh.position.x = (Math.random() - 0.5) * 3.8
          petal.mesh.position.z = (Math.random() - 0.5) * 3.8
        }
      }

      // Cập nhật đom đóm dập dờn
      for (const ff of firefliesList) {
        ff.mesh.position.y = ff.baseY + Math.sin(elapsedTime * 2.0 + ff.seed) * 0.18
        ff.mesh.position.x += Math.cos(elapsedTime * 0.9 + ff.seed) * 0.005
        ff.mesh.position.z += Math.sin(elapsedTime * 0.9 + ff.seed) * 0.005
      }

      // Cập nhật hiệu ứng hoa tháng (phóng to khi hover)
      for (const fl of monthFlowerMeshes) {
        const isHov = hoveredMonthRef.current === fl.month
        const targetScale = isHov ? fl.baseScale * 1.3 : fl.baseScale
        fl.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14)

        if (fl.glowMesh) {
          fl.glowMesh.rotation.z += 0.022
          const glowPulse = 1.0 + Math.sin(elapsedTime * 3.2 + fl.month) * 0.18
          fl.glowMesh.scale.set(glowPulse, glowPulse, glowPulse)
        }
      }

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }, [theme, monthCounts, compact])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: hoveredFlower ? 'pointer' : 'grab',
        }}
      />

      {/* Tooltip nổi bật khi chạm / hover vào 1 trong 12 hoa tháng */}
      {hoveredFlower && (
        <div
          className="tree-month-tooltip"
          style={{
            left: hoveredFlower.screenX,
            top: hoveredFlower.screenY,
          }}
        >
          <span>🌸 {hoveredFlower.label}:</span>
          <span>
            {hoveredFlower.count > 0 ? `${hoveredFlower.count} kỷ niệm` : 'Chưa có kỷ niệm'}
          </span>
          <span style={{ opacity: 0.6, fontSize: '0.68rem' }}>· Chạm để mở →</span>
        </div>
      )}
    </div>
  )
}
