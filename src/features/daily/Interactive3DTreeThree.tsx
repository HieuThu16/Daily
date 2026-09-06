import { useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import type { SeasonTheme } from './YearlyMemoryBook'

export interface Interactive3DTreeCanvasProps {
  year?: number
  events?: Array<{ event_date?: string; date?: string; [key: string]: any }>
  theme: SeasonTheme
  onOpenBook?: () => void
  onSelectMonth?: (monthNum: number) => void
  onOpenFlower2D?: (monthNum: number) => void
  compact?: boolean
}

/**
 * Tạo hình dạng cánh hoa anh đào uốn cong tự nhiên có khía chẻ notch đặc trưng
 */
function createSakuraPetalGeometry(width = 0.18, height = 0.25): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(-width * 0.45, height * 0.24, -width * 0.6, height * 0.65, -width * 0.3, height * 0.98)
  shape.lineTo(-width * 0.08, height * 0.86)
  shape.lineTo(width * 0.08, height * 0.86)
  shape.bezierCurveTo(width * 0.3, height * 0.98, width * 0.6, height * 0.65, width * 0.45, height * 0.24)
  shape.lineTo(0, 0)

  const geo = new THREE.ShapeGeometry(shape, 8)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = -(x * x * 2.6 + (y - height * 0.5) ** 2 * 0.7) * 0.2
    pos.setZ(i, z)
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Tạo đóa hoa anh đào 5 cánh sắc nét, nhụy tròn xinh xắn
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
    pMesh.position.set(Math.cos(angle) * 0.07, Math.sin(angle) * 0.07, 0)
    pMesh.rotation.z = angle - Math.PI / 2
    pMesh.rotation.x = 0.15
    group.add(pMesh)
  }
  const pistilGeo = new THREE.SphereGeometry(0.048, 10, 10)
  const pistil = new THREE.Mesh(pistilGeo, pistilMat)
  pistil.position.z = 0.02
  group.add(pistil)
  group.scale.set(scale, scale, scale)
  return group
}

/**
 * Tạo texture hình tròn sắc nét cho huy hiệu Tháng (T1..T12) & số kỷ niệm
 */
function createMonthBadgeTexture(label: string, count: number, accentColor?: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256)

    // Đổ bóng mềm sang trọng
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 6

    // Vòng tròn trung tâm
    ctx.beginPath()
    ctx.arc(128, 128, 92, 0, Math.PI * 2)
    const grad = ctx.createRadialGradient(110, 110, 16, 128, 128, 92)
    if (count > 0) {
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.75, '#fef3c7')
      grad.addColorStop(1, '#fde68a')
    } else {
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(1, '#f1f5f9')
    }
    ctx.fillStyle = grad
    ctx.fill()

    ctx.shadowColor = 'transparent'
    ctx.lineWidth = 8
    ctx.strokeStyle = count > 0 ? (accentColor || '#f59e0b') : '#94a3b8'
    ctx.stroke()

    // Viền kim loại óng ánh bên trong
    ctx.beginPath()
    ctx.arc(128, 128, 82, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.strokeStyle = count > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(148, 163, 184, 0.3)'
    ctx.stroke()

    // Chữ tháng (T1, T2...)
    ctx.font = '900 72px "Outfit", "Inter", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = count > 0 ? '#78350f' : '#334155'
    ctx.fillText(label, 128, 132)

    // Huy hiệu đếm số kỷ niệm nhỏ góc trên bên phải
    if (count > 0) {
      ctx.shadowColor = 'rgba(234, 88, 12, 0.45)'
      ctx.shadowBlur = 10
      ctx.shadowOffsetY = 4

      ctx.beginPath()
      ctx.arc(194, 62, 40, 0, Math.PI * 2)
      ctx.fillStyle = '#ea580c'
      ctx.fill()

      ctx.shadowColor = 'transparent'
      ctx.lineWidth = 5
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()

      ctx.font = '900 38px "Outfit", sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(count), 194, 64)
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
  onOpenFlower2D,
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
  const onOpenFlower2DRef = useRef(onOpenFlower2D)
  onOpenFlower2DRef.current = onOpenFlower2D
  const hoveredMonthRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let animId: number
    const rect = container.getBoundingClientRect()
    const width = rect.width || (compact ? 320 : 600)
    const height = rect.height || (compact ? 240 : 600)

    // 1. Scene & Renderer
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100)
    camera.position.set(0, 2.1, compact ? 9.6 : 8.8)

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.outputColorSpace = THREE.SRGBColorSpace

    // 2. Hệ thống Ánh Sáng Thiên Nhiên (Sunlight & Atmospheric Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4)
    scene.add(ambientLight)

    // Ánh sáng bầu trời và đất phản xạ
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x86efac, 1.1)
    scene.add(hemiLight)

    // Ánh sáng chính từ Mặt Trời
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.5)
    sunLight.position.set(5.5, 8.5, -6.5)
    scene.add(sunLight)

    // Ánh sáng viền tạo hào quang lấp lánh trên tán hoa và cành cây
    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.3)
    rimLight.position.set(-6, 7, 5)
    scene.add(rimLight)

    // Ánh sáng ấm từ tâm thân cây
    const corePointLight = new THREE.PointLight(theme.accent, 2.0, 10)
    corePointLight.position.set(0, 2.2, 0)
    scene.add(corePointLight)

    // ══════════════════════════════════════════════════════════════════
    // 3. NHÓM BACKGROUND CỐ ĐỊNH (BẦU TRỜI, MẶT TRỜI, NÚI NON, MÂY, CHIM)
    // ══════════════════════════════════════════════════════════════════
    const bgGroup = new THREE.Group()
    scene.add(bgGroup)

    // ── MẶT TRỜI 3D RỰC RỠ TRÊN KHÔNG TRUNG (3D Luminous Sun) ──
    const sunPos = new THREE.Vector3(5.6, 7.6, -9.2)
    const sunMeshGroup = new THREE.Group()
    sunMeshGroup.position.copy(sunPos)

    // Lõi mặt trời sáng chói
    const sunCoreGeo = new THREE.SphereGeometry(1.05, 24, 24)
    const sunCoreMat = new THREE.MeshBasicMaterial({ color: 0xfffde0 })
    const sunCore = new THREE.Mesh(sunCoreGeo, sunCoreMat)
    sunMeshGroup.add(sunCore)

    // Vành hào quang corona trong
    const innerCoronaGeo = new THREE.RingGeometry(1.05, 1.9, 36)
    const innerCoronaMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
    const innerCorona = new THREE.Mesh(innerCoronaGeo, innerCoronaMat)
    sunMeshGroup.add(innerCorona)

    // Vành hào quang corona ngoài
    const outerCoronaGeo = new THREE.RingGeometry(1.8, 3.2, 36)
    const outerCoronaMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    })
    const outerCorona = new THREE.Mesh(outerCoronaGeo, outerCoronaMat)
    sunMeshGroup.add(outerCorona)

    // 4 luồng tia nắng mặt trời (Sunbeams / God rays) tỏa xuống
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    })
    const sunbeamGroup = new THREE.Group()
    for (let r = 0; r < 4; r++) {
      const beamGeo = new THREE.ConeGeometry(0.9 + r * 0.2, 14, 8, 1, true)
      const beam = new THREE.Mesh(beamGeo, rayMat)
      beam.position.set(-2.5 + r * 0.8, -5.5, 3.5 - r * 0.7)
      beam.rotation.z = 0.38 + r * 0.04
      beam.rotation.x = -0.32
      sunbeamGroup.add(beam)
    }
    sunMeshGroup.add(sunbeamGroup)
    bgGroup.add(sunMeshGroup)

    // ── DÃY NÚI MỜ XA XĂM (Layered Horizon Rolling Mountains) ──
    const mountainsMat1 = new THREE.MeshStandardMaterial({
      color: 0x93c5fd, // Xanh lam mờ sương
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    })
    const mountainsMat2 = new THREE.MeshStandardMaterial({
      color: 0x86efac, // Xanh lục đồi xa
      roughness: 0.92,
      metalness: 0.02,
      flatShading: true,
    })

    // Dãy núi phía sau
    const mtnGroup = new THREE.Group()
    mtnGroup.position.set(0, -0.4, -13)
    const mtnPeaks = [
      { x: -9, y: 1.8, r: 4.8, mat: mountainsMat1 },
      { x: -4, y: 2.3, r: 5.5, mat: mountainsMat1 },
      { x: 2, y: 2.6, r: 6.0, mat: mountainsMat1 },
      { x: 8, y: 2.0, r: 5.2, mat: mountainsMat1 },
      // Lớp đồi trước
      { x: -6.5, y: 0.9, r: 4.2, mat: mountainsMat2 },
      { x: -1, y: 1.1, r: 4.6, mat: mountainsMat2 },
      { x: 5.5, y: 0.95, r: 4.0, mat: mountainsMat2 },
    ]
    for (const p of mtnPeaks) {
      const pMesh = new THREE.Mesh(new THREE.ConeGeometry(p.r, p.y * 2, 7), p.mat)
      pMesh.position.set(p.x, p.y - 0.6, 0)
      mtnGroup.add(pMesh)
    }
    bgGroup.add(mtnGroup)

    // ── NHỮNG ĐÁM MÂY 3D BỒNG BỀNH BAY (Drifting Fluffy Clouds) ──
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.05,
      emissive: 0xfff7ed,
      emissiveIntensity: 0.2,
    })

    const cloudConfigs = [
      { x: -7, y: 5.4, z: -6.5, s: 0.95, speed: 0.0035 },
      { x: -2, y: 6.2, z: -8.0, s: 1.15, speed: 0.0042 },
      { x: 4, y: 5.1, z: -5.8, s: 0.85, speed: 0.003 },
      { x: 9, y: 6.5, z: -7.5, s: 1.05, speed: 0.0038 },
      { x: -11, y: 4.8, z: -7.0, s: 0.8, speed: 0.0032 },
    ]

    const cloudsList: Array<{ group: THREE.Group; speed: number; startX: number }> = []

    for (const cfg of cloudConfigs) {
      const cGroup = new THREE.Group()
      cGroup.position.set(cfg.x, cfg.y, cfg.z)
      cGroup.scale.set(cfg.s, cfg.s, cfg.s)

      // Cụm 5-6 quả cầu xếp thành búp mây bồng bềnh
      const puffOffsets = [
        [0, 0, 0, 0.7],
        [-0.6, -0.15, 0.1, 0.55],
        [0.65, -0.12, -0.05, 0.58],
        [-0.3, 0.35, 0, 0.52],
        [0.35, 0.3, 0.05, 0.5],
      ]
      for (const [px, py, pz, pr] of puffOffsets) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(pr, 14, 12), cloudMat)
        puff.position.set(px, py, pz)
        cGroup.add(puff)
      }
      bgGroup.add(cGroup)
      cloudsList.push({ group: cGroup, speed: cfg.speed, startX: cfg.x })
    }

    // ── ĐÀN CHIM 3D BAY VƯỢN QUA BẦU TRỜI (3D Flying Birds with Flapping Wings) ──
    const birdMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })

    // Hình dạng cánh chim gập tự nhiên
    const wingShape = new THREE.Shape()
    wingShape.moveTo(0, 0)
    wingShape.bezierCurveTo(0.1, 0.05, 0.35, 0.18, 0.52, 0.28)
    wingShape.bezierCurveTo(0.35, 0.02, 0.15, -0.08, 0, -0.05)
    wingShape.closePath()
    const wingGeo = new THREE.ShapeGeometry(wingShape)

    const birdCount = compact ? 3 : 6
    const birdsList: Array<{
      group: THREE.Group
      leftWing: THREE.Mesh
      rightWing: THREE.Mesh
      orbitRadiusX: number
      orbitRadiusZ: number
      centerX: number
      centerZ: number
      altitude: number
      speed: number
      angle: number
      wingOffset: number
    }> = []

    for (let b = 0; b < birdCount; b++) {
      const birdGroup = new THREE.Group()

      // Thân chim thuôn gọn
      const bodyGeo = new THREE.ConeGeometry(0.065, 0.36, 6)
      bodyGeo.rotateX(Math.PI / 2)
      const body = new THREE.Mesh(bodyGeo, birdMat)
      birdGroup.add(body)

      // Cánh trái
      const leftWing = new THREE.Mesh(wingGeo, birdMat)
      leftWing.position.set(-0.04, 0.02, 0.04)
      leftWing.rotation.y = Math.PI / 2
      birdGroup.add(leftWing)

      // Cánh phải
      const rightWing = new THREE.Mesh(wingGeo, birdMat)
      rightWing.position.set(0.04, 0.02, 0.04)
      rightWing.rotation.y = -Math.PI / 2
      rightWing.scale.set(-1, 1, 1)
      birdGroup.add(rightWing)

      const bScale = 0.55 + Math.random() * 0.35
      birdGroup.scale.set(bScale, bScale, bScale)

      bgGroup.add(birdGroup)

      birdsList.push({
        group: birdGroup,
        leftWing,
        rightWing,
        orbitRadiusX: 4.8 + (b % 3) * 1.6,
        orbitRadiusZ: 3.2 + (b % 2) * 1.8,
        centerX: (b % 2 === 0 ? 0.8 : -1.2),
        centerZ: -4.5 - (b % 3) * 1.5,
        altitude: 4.2 + (b % 4) * 0.75,
        speed: 0.006 + (b % 3) * 0.003,
        angle: (b / birdCount) * Math.PI * 2,
        wingOffset: b * 1.2,
      })
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. SÂN CÔNG VIÊN RỘNG LỚN & CỐ ĐỊNH (Large Fixed Courtyard Platform)
    // ══════════════════════════════════════════════════════════════════
    // CHÚ Ý: stageGroup được thêm trực tiếp vào scene (KHÔNG thêm vào treeGroup).
    // Vì vậy, khi người dùng vuốt/xoay, SÂN HOÀN TOÀN CỐ ĐỊNH VÀ VỮNG CHÃI!
    const stageGroup = new THREE.Group()
    scene.add(stageGroup)

    // Thảm cỏ công viên xanh mướt, rộng lớn (bán kính 5.2)
    const islandRadius = compact ? 3.6 : 5.2
    const islandGeo = new THREE.CylinderGeometry(islandRadius, islandRadius * 0.86, 0.6, 64)
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80, // Thảm cỏ xanh tươi sáng pastel
      roughness: 0.45,
      metalness: 0.02,
      emissive: 0x16a34a,
      emissiveIntensity: 0.16,
    })
    const island = new THREE.Mesh(islandGeo, islandMat)
    island.position.y = -0.85
    stageGroup.add(island)

    // Lớp đá cuội / chân đế phong thủy vững chắc bên dưới
    const rockBaseGeo = new THREE.ConeGeometry(islandRadius * 0.76, 1.5, 9)
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true,
    })
    const rockBase = new THREE.Mesh(rockBaseGeo, rockMat)
    rockBase.position.y = -1.85
    rockBase.rotation.x = Math.PI
    stageGroup.add(rockBase)

    // Vành hào quang vàng ấm áp viền quanh sân
    const ringGeo = new THREE.TorusGeometry(islandRadius + 0.12, 0.045, 14, 80)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.85,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = -0.8
    stageGroup.add(ring)

    // ── HÀNG RÀO GỖ CÔNG VIÊN UỐN CONG DUYÊN DÁNG ──
    const fenceGroup = new THREE.Group()
    const fenceMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
    })
    const fencePostGeo = new THREE.BoxGeometry(0.1, 0.48, 0.1)
    const fenceRailGeo = new THREE.BoxGeometry(0.04, 0.06, 1.15)

    const fenceAngles = [-0.85, -0.5, -0.15, 0.2, 0.55, 0.9]
    const fenceDist = islandRadius * 0.88
    for (let i = 0; i < fenceAngles.length; i++) {
      const fPost = new THREE.Mesh(fencePostGeo, fenceMat)
      const ang = fenceAngles[i]
      fPost.position.set(Math.sin(ang) * fenceDist, -0.42, Math.cos(ang) * fenceDist)
      fPost.rotation.y = ang
      fenceGroup.add(fPost)

      if (i < fenceAngles.length - 1) {
        const nextAng = fenceAngles[i + 1]
        const midAng = (ang + nextAng) / 2
        const topRail = new THREE.Mesh(fenceRailGeo, fenceMat)
        topRail.position.set(Math.sin(midAng) * fenceDist, -0.3, Math.cos(midAng) * fenceDist)
        topRail.rotation.y = midAng + Math.PI / 2
        fenceGroup.add(topRail)

        const bottomRail = new THREE.Mesh(fenceRailGeo, fenceMat)
        bottomRail.position.set(Math.sin(midAng) * fenceDist, -0.48, Math.cos(midAng) * fenceDist)
        bottomRail.rotation.y = midAng + Math.PI / 2
        fenceGroup.add(bottomRail)
      }
    }
    stageGroup.add(fenceGroup)

    // ── CON ĐƯỜNG ĐÁ DẠO BƯỚC (Stepping Stones Path) ──
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.65,
      metalness: 0.06,
    })
    const stoneGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.04, 9)
    const stonePositions = [
      [0.9, -0.54, 2.1],
      [1.35, -0.54, 1.5],
      [0.85, -0.54, 0.95],
      [1.4, -0.54, 0.3],
      [-1.1, -0.54, 2.3],
      [-1.6, -0.54, 1.6],
    ]
    for (const sp of stonePositions) {
      const st = new THREE.Mesh(stoneGeo, stoneMat)
      st.position.set(sp[0], sp[1], sp[2])
      st.rotation.y = Math.random() * Math.PI
      stageGroup.add(st)
    }

    // ── ĐÈN LỒNG DÃ NGOẠI PHÁT SÁNG ẤM ÁP (Garden Lantern with Glowing Fire) ──
    const lanternGroup = new THREE.Group()
    lanternGroup.position.set(-2.2, -0.55, 1.4)

    // Trụ đèn
    const poleGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.55, 8)
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 })
    const pole = new THREE.Mesh(poleGeo, poleMat)
    pole.position.y = 0.26
    lanternGroup.add(pole)

    // Đèn lồng
    const lanternBodyGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.22, 8)
    const lanternBodyMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    })
    const lanternBody = new THREE.Mesh(lanternBodyGeo, lanternBodyMat)
    lanternBody.position.y = 0.6
    lanternGroup.add(lanternBody)

    // Mái che đèn lồng
    const lanternRoofGeo = new THREE.ConeGeometry(0.22, 0.12, 8)
    const lanternRoof = new THREE.Mesh(lanternRoofGeo, poleMat)
    lanternRoof.position.y = 0.76
    lanternGroup.add(lanternRoof)

    // Ánh sáng ấm từ đèn lồng
    const lanternLight = new THREE.PointLight(0xf59e0b, 1.8, 4.5)
    lanternLight.position.y = 0.6
    lanternGroup.add(lanternLight)
    stageGroup.add(lanternGroup)

    // ── BỤI CỎ HOA XINH XẮN & NẤM NHỎ TRÊN SÂN ──
    const flowerColorList = [0xffffff, 0xfef08a, 0xf472b6, 0xa78bfa]
    const bushCount = 14
    for (let b = 0; b < bushCount; b++) {
      const bAng = (b / bushCount) * Math.PI * 2 + (b % 3) * 0.25
      const bDist = 1.8 + (b % 4) * 0.7
      const bx = Math.sin(bAng) * bDist
      const bz = Math.cos(bAng) * bDist

      // Đốm hoa dại nhỏ
      const petalCol = flowerColorList[b % flowerColorList.length]
      const flMat = new THREE.MeshStandardMaterial({ color: petalCol, roughness: 0.4 })
      const flGeo = new THREE.SphereGeometry(0.065, 8, 8)
      const fl = new THREE.Mesh(flGeo, flMat)
      fl.position.set(bx, -0.52, bz)
      stageGroup.add(fl)

      // Cụm lá cỏ quanh hoa
      const gMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 })
      const gGeo = new THREE.ConeGeometry(0.04, 0.16, 4)
      const gBlade = new THREE.Mesh(gGeo, gMat)
      gBlade.position.set(bx + 0.04, -0.5, bz + 0.03)
      gBlade.rotation.z = 0.25
      stageGroup.add(gBlade)
    }

    // Geometry cánh hoa anh đào có notch đặc trưng
    const petalGeo = createSakuraPetalGeometry(0.18, 0.25)

    // Những cánh hoa rụng rải rác trên thảm cỏ cố định dưới gốc cây
    const fallenPetalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.petalColor),
      emissive: new THREE.Color(theme.petalColor),
      emissiveIntensity: 0.26,
      roughness: 0.4,
      side: THREE.DoubleSide,
    })
    for (let i = 0; i < 36; i++) {
      const fPetal = new THREE.Mesh(petalGeo, fallenPetalMat)
      const fAng = Math.random() * Math.PI * 2
      const fDist = 0.45 + Math.random() * 2.8
      fPetal.position.set(Math.cos(fAng) * fDist, -0.54, Math.sin(fAng) * fDist)
      fPetal.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.2
      fPetal.rotation.z = Math.random() * Math.PI * 2
      const fScale = 0.65 + Math.random() * 0.45
      fPetal.scale.set(fScale, fScale, fScale)
      stageGroup.add(fPetal)
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. CÂY KỶ NIỆM 3D (CHÂN THẬT, NGHỆ THUẬT, TỰ DO XOAY 360 ĐỘ)
    // ══════════════════════════════════════════════════════════════════
    // ĐÂY LÀ NHÓM DUY NHẤT XOAY KHI VUỐT HOẶC TỰ ĐỘNG QUAY!
    const treeGroup = new THREE.Group()
    scene.add(treeGroup)

    // ── THÂN CÂY TỰ NHIÊN CÓ ĐỘ GÂN GUỐC VÀ DÁNG THẾ NGHỆ THUẬT ──
    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x603828, // Nâu gỗ óc chó ấm áp, chân thật
      roughness: 0.55,
      metalness: 0.08,
    })

    // Thân chính uốn lượn tự nhiên vươn lên
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.65, 0),
      new THREE.Vector3(0.08, 0.25, 0.05),
      new THREE.Vector3(-0.08, 1.1, -0.04),
      new THREE.Vector3(0.06, 1.95, 0.03),
    ])
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 36, 0.26, 18, false)
    const trunk = new THREE.Mesh(trunkGeo, barkMat)
    treeGroup.add(trunk)

    // 6 rễ cây cổ thụ bám sâu chắc chắn vào mặt đất
    const rootAngles = [0.2, 1.2, 2.3, 3.4, 4.5, 5.6]
    for (const rAng of rootAngles) {
      const rCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.25, 0),
        new THREE.Vector3(Math.cos(rAng) * 0.45, -0.48, Math.sin(rAng) * 0.45),
        new THREE.Vector3(Math.cos(rAng) * 0.95, -0.62, Math.sin(rAng) * 0.95),
      ])
      const rMesh = new THREE.Mesh(new THREE.TubeGeometry(rCurve, 14, 0.11, 10, false), barkMat)
      treeGroup.add(rMesh)
    }

    // 6 cành chính vươn ra đa hướng 360 độ nâng đỡ vòm lá
    const boughs = [
      {
        curve: [
          new THREE.Vector3(0.06, 1.95, 0.03),
          new THREE.Vector3(-0.55, 2.45, 0.25),
          new THREE.Vector3(-1.15, 2.95, 0.45),
        ],
        r: 0.14,
      },
      {
        curve: [
          new THREE.Vector3(0.06, 1.95, 0.03),
          new THREE.Vector3(0.55, 2.4, 0.2),
          new THREE.Vector3(1.15, 2.9, 0.35),
        ],
        r: 0.14,
      },
      {
        curve: [
          new THREE.Vector3(0.06, 1.95, 0.03),
          new THREE.Vector3(-0.05, 2.6, -0.45),
          new THREE.Vector3(-0.1, 3.2, -0.9),
        ],
        r: 0.13,
      },
      {
        curve: [
          new THREE.Vector3(0.06, 1.95, 0.03),
          new THREE.Vector3(0.12, 2.5, 0.6),
          new THREE.Vector3(0.2, 3.0, 1.05),
        ],
        r: 0.12,
      },
      {
        curve: [
          new THREE.Vector3(0.06, 1.95, 0.03),
          new THREE.Vector3(-0.65, 2.6, -0.35),
          new THREE.Vector3(-1.1, 3.15, -0.6),
        ],
        r: 0.11,
      },
      {
        curve: [
          new THREE.Vector3(0.06, 1.95, 0.03),
          new THREE.Vector3(0.65, 2.65, -0.3),
          new THREE.Vector3(1.1, 3.2, -0.55),
        ],
        r: 0.11,
      },
    ]

    for (const b of boughs) {
      const bCurve = new THREE.CatmullRomCurve3(b.curve)
      const bGeo = new THREE.TubeGeometry(bCurve, 20, b.r, 14, false)
      const bMesh = new THREE.Mesh(bGeo, barkMat)
      treeGroup.add(bMesh)
    }

    // ── TÁN LÁ HOA BỒNG BỀNH ĐA TẦNG NGHỆ THUẬT (Volumetric Fluffy Canopy) ──
    const canopyGroup = new THREE.Group()
    treeGroup.add(canopyGroup)

    const cloudShades = [
      theme.treeCanopy[0] || '#ffaec9',
      theme.treeCanopy[1] || '#ff9ebb',
      theme.treeCanopy[2] || '#ffd4e5',
      '#fff1f5',
      '#ff8fab',
    ]

    const cloudMaterials = cloudShades.map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(c),
          roughness: 0.35,
          metalness: 0.02,
          emissive: new THREE.Color(c),
          emissiveIntensity: 0.32,
        })
    )

    // 16 khối tán cây đan xen bồng bềnh tự nhiên
    const cloudLobes = [
      // Vòm trung tâm
      { pos: [0, 3.35, 0], r: 1.45, scale: [1.28, 0.96, 1.28], mat: cloudMaterials[0] },
      // Trước trái
      { pos: [-1.05, 3.05, 0.72], r: 1.15, scale: [1.18, 0.9, 1.12], mat: cloudMaterials[1] },
      // Trước phải
      { pos: [1.05, 3.0, 0.68], r: 1.18, scale: [1.18, 0.9, 1.12], mat: cloudMaterials[0] },
      // Sau trái
      { pos: [-1.0, 3.25, -0.75], r: 1.12, scale: [1.12, 0.92, 1.18], mat: cloudMaterials[1] },
      // Sau phải
      { pos: [0.95, 3.2, -0.7], r: 1.14, scale: [1.14, 0.92, 1.12], mat: cloudMaterials[2] },
      // Đỉnh vương miện
      { pos: [0, 4.3, 0], r: 1.05, scale: [1.12, 0.88, 1.12], mat: cloudMaterials[3] },
      // Rủ mềm phía trước
      { pos: [0.1, 2.85, 1.35], r: 0.82, scale: [1.1, 0.86, 1.1], mat: cloudMaterials[2] },
      // Rủ mềm bên trái
      { pos: [-1.45, 2.5, 0.22], r: 0.84, scale: [1.12, 0.86, 1.06], mat: cloudMaterials[4] },
      // Rủ mềm bên phải
      { pos: [1.48, 2.55, -0.22], r: 0.88, scale: [1.12, 0.86, 1.06], mat: cloudMaterials[0] },
      // Rủ trước trái thấp
      { pos: [-0.6, 2.35, 1.05], r: 0.74, scale: [1.06, 0.86, 1.06], mat: cloudMaterials[1] },
      // Rủ trước phải thấp
      { pos: [0.65, 2.4, 1.02], r: 0.76, scale: [1.06, 0.86, 1.06], mat: cloudMaterials[2] },
      // Vòm cao phía sau
      { pos: [0, 3.95, -0.7], r: 0.88, scale: [1.12, 0.86, 1.12], mat: cloudMaterials[3] },
      // Đỉnh trái
      { pos: [-0.7, 3.85, 0.28], r: 0.78, scale: [1.1, 0.88, 1.1], mat: cloudMaterials[0] },
      // Đỉnh phải
      { pos: [0.7, 3.8, 0.24], r: 0.8, scale: [1.1, 0.88, 1.1], mat: cloudMaterials[2] },
      // Đỉnh sau trái
      { pos: [-0.55, 3.9, -0.45], r: 0.72, scale: [1.08, 0.86, 1.08], mat: cloudMaterials[4] },
      // Đỉnh sau phải
      { pos: [0.55, 3.85, -0.42], r: 0.74, scale: [1.08, 0.86, 1.08], mat: cloudMaterials[1] },
    ]

    for (const lobe of cloudLobes) {
      const lobeGeo = new THREE.SphereGeometry(lobe.r, 26, 20)
      const lobeMesh = new THREE.Mesh(lobeGeo, lobe.mat)
      lobeMesh.position.set(lobe.pos[0], lobe.pos[1], lobe.pos[2])
      lobeMesh.scale.set(lobe.scale[0], lobe.scale[1], lobe.scale[2])
      lobeMesh.userData = { isCanopy: true }
      canopyGroup.add(lobeMesh)
    }

    // ── HOA ANH ĐÀO VÀ BÚP LÁ XẾP NỔI TRÊN TÁN CÂY (Crisp Blossoms & Leaves) ──
    const flowerPetalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffe4e6,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.04,
      side: THREE.DoubleSide,
    })
    const flowerPistilMat = new THREE.MeshStandardMaterial({
      color: 0xff3b77,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.2,
    })

    const canopyFlowerCount = compact ? 26 : 48
    for (let i = 0; i < canopyFlowerCount; i++) {
      const ang = (i / canopyFlowerCount) * Math.PI * 2 + (i % 3) * 0.2
      const radius = 1.42 + (i % 5) * 0.38
      const fY = 2.45 + (i % 7) * 0.32 + Math.sin(i * 1.6) * 0.35
      const fX = Math.cos(ang) * radius
      const fZ = Math.sin(ang) * radius

      const flowerMesh = createSakuraFlowerMesh(petalGeo, flowerPetalMat, flowerPistilMat, 0.9 + (i % 3) * 0.2)
      flowerMesh.position.set(fX, fY, fZ)
      flowerMesh.lookAt(fX * 2, fY + 0.1, fZ * 2)
      canopyGroup.add(flowerMesh)
    }

    // ── 12 ĐOÁ HOA / LÁ THÁNG KỶ NIỆM (12 Sacred Month Flowers & Badges) ──
    const monthFlowerMeshes: Array<{
      group: THREE.Group
      month: number
      label: string
      count: number
      badgeSprite: THREE.Sprite
      glowMesh?: THREE.Mesh
      baseScale: number
      worldPos: THREE.Vector3
    }> = []

    for (let m = 1; m <= 12; m++) {
      const ang = ((m - 1) / 12) * Math.PI * 2 - Math.PI / 2
      const radius = 2.5 + ((m % 2) === 0 ? 0.38 : -0.22)
      const fY = 2.7 + Math.sin(((m - 1) / 12) * Math.PI * 2) * 1.05
      const fX = Math.cos(ang) * radius
      const fZ = Math.sin(ang) * radius

      const flowerGroup = new THREE.Group()
      flowerGroup.position.set(fX, fY, fZ)

      const count = monthCounts[m] || 0
      const isStarred = count > 0

      // Đóa hoa nở to đẹp
      const mFlowerMesh = createSakuraFlowerMesh(petalGeo, flowerPetalMat, flowerPistilMat, 1.35)
      flowerGroup.add(mFlowerMesh)

      // Vành hào quang vàng óng ánh quay quanh nếu tháng có kỷ niệm
      let glowMesh: THREE.Mesh | undefined
      if (isStarred) {
        const glowGeo = new THREE.TorusGeometry(0.48, 0.03, 10, 36)
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xfbbf24,
          emissiveIntensity: 0.95,
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
      badgeSprite.scale.set(0.76, 0.76, 1)
      badgeSprite.position.set(0, 0, 0.14)
      flowerGroup.add(badgeSprite)

      // Hitbox vô hình to để người dùng bấm vào lá / hoa trên điện thoại cực nhạy
      const hitSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      )
      hitSphere.userData = { isMonthFlower: true, month: m, count }
      flowerGroup.add(hitSphere)

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
        worldPos: new THREE.Vector3(fX, fY, fZ),
      })
    }

    // ── CÁNH HOA VÀ LÁ BAY THEO GIÓ (Drifting Floating Petals) ──
    const petalCount = compact ? 20 : 38
    const fallingPetalMat2 = new THREE.MeshStandardMaterial({
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
    }> = []

    for (let i = 0; i < petalCount; i++) {
      const pMesh = new THREE.Mesh(petalGeo, fallingPetalMat2)
      pMesh.position.set(
        (Math.random() - 0.5) * 4.6,
        0.2 + Math.random() * 4.6,
        (Math.random() - 0.5) * 4.6
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
        vx: (Math.random() - 0.5) * 0.007,
        vz: (Math.random() - 0.5) * 0.007,
        rotSpeedX: 0.02 + Math.random() * 0.03,
        rotSpeedY: 0.025 + Math.random() * 0.035,
        rotSpeedZ: 0.015 + Math.random() * 0.02,
        seed: Math.random() * 10,
      })
    }

    // Đom đóm / bụi vàng tiên cảnh nhảy múa
    const fireflyCount = compact ? 8 : 16
    const ffGeo = new THREE.SphereGeometry(0.045, 6, 6)
    const ffMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.92,
    })
    const firefliesList: Array<{ mesh: THREE.Mesh; seed: number; baseY: number }> = []

    for (let i = 0; i < fireflyCount; i++) {
      const ff = new THREE.Mesh(ffGeo, ffMat)
      const bY = 0.8 + Math.random() * 3.6
      ff.position.set((Math.random() - 0.5) * 4.2, bY, (Math.random() - 0.5) * 4.2)
      scene.add(ff)
      firefliesList.push({ mesh: ff, seed: Math.random() * 10, baseY: bY })
    }

    // ══════════════════════════════════════════════════════════════════
    // 6. TƯƠNG TÁC XOAY 3D CÂY & CHẠM VÀO LÁ LÀ MỞ NGAY
    // ══════════════════════════════════════════════════════════════════
    const raycaster = new THREE.Raycaster()
    const mousePos = new THREE.Vector2(-999, -999)

    let isDragging = false
    let hasMoved = false
    let startX = 0
    let startY = 0
    let targetRotY = 0
    let targetRotX = 0.08
    let curRotY = 0
    let curRotX = 0.08

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
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          hasMoved = true
        }
        // Xoay tròn 3D chỉ cây hoa
        targetRotY += dx * 0.0085
        targetRotX = Math.max(-0.16, Math.min(0.24, targetRotX + dy * 0.004))
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
      // Nếu chỉ là một cú CHẠM/NHẤN (tap), không phải kéo xoay
      if (!hasMoved) {
        const hovM = hoveredMonthRef.current
        if (hovM) {
          if (onOpenFlower2DRef.current) {
            onOpenFlower2DRef.current(hovM)
          } else if (onSelectMonthRef.current) {
            onSelectMonthRef.current(hovM)
          } else if (onOpenBookRef.current) {
            onOpenBookRef.current()
          }
        } else {
          // Kiểm tra raycast toàn diện nếu người dùng nhấn vào bất cứ lá/tán hoa nào trên cây
          raycaster.setFromCamera(mousePos, camera)
          const treeIntersects = raycaster.intersectObjects([treeGroup], true)
          if (treeIntersects.length > 0) {
            const hitPoint = treeIntersects[0].point
            // Tìm đóa hoa tháng gần điểm chạm nhất trên cây
            let nearestMonth = 1
            let minDist = Infinity
            for (const fl of monthFlowerMeshes) {
              const flWorld = fl.group.position.clone().applyMatrix4(treeGroup.matrixWorld)
              const d = flWorld.distanceTo(hitPoint)
              if (d < minDist) {
                minDist = d
                nearestMonth = fl.month
              }
            }

            if (onOpenFlower2DRef.current) {
              onOpenFlower2DRef.current(nearestMonth)
            } else if (onSelectMonthRef.current) {
              onSelectMonthRef.current(nearestMonth)
            } else if (onOpenBookRef.current) {
              onOpenBookRef.current()
            }
          }
        }
      }
      isDragging = false
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    const onResize = () => {
      const newRect = container.getBoundingClientRect()
      const w = newRect.width || (compact ? 320 : 600)
      const h = newRect.height || (compact ? 240 : 600)
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

      // Tự động xoay chậm rãi cây khi không vuốt
      if (!isDragging) {
        targetRotY += 0.0024
      }

      // Smooth Damping chỉ xoay cây hoa, sân vẫn giữ cố định
      curRotY += (targetRotY - curRotY) * 0.08
      curRotX += (targetRotX - curRotX) * 0.08
      treeGroup.rotation.y = curRotY
      treeGroup.rotation.x = curRotX

      // Gió thổi đung đưa tán hoa bồng bềnh
      canopyGroup.rotation.z = Math.sin(elapsedTime * 0.8) * 0.022
      canopyGroup.position.x = Math.sin(elapsedTime * 0.8) * 0.03

      // Hào quang mặt trời & vành hào quang nhịp nhàng
      outerCorona.rotation.z = -elapsedTime * 0.04
      innerCorona.rotation.z = elapsedTime * 0.06
      ring.rotation.z += 0.004

      // Cập nhật mây bay lững lờ từ trái sang phải
      for (const cl of cloudsList) {
        cl.group.position.x += cl.speed
        if (cl.group.position.x > 12) {
          cl.group.position.x = -12
        }
      }

      // Cập nhật đàn chim bay lượn và vỗ cánh
      for (const bird of birdsList) {
        bird.angle += bird.speed
        const bx = bird.centerX + Math.sin(bird.angle) * bird.orbitRadiusX
        const bz = bird.centerZ + Math.cos(bird.angle) * bird.orbitRadiusZ
        const by = bird.altitude + Math.sin(bird.angle * 2 + bird.wingOffset) * 0.55
        bird.group.position.set(bx, by, bz)

        // Hướng mỏ chim về phía trước theo hướng bay
        const nextX = bird.centerX + Math.sin(bird.angle + 0.05) * bird.orbitRadiusX
        const nextZ = bird.centerZ + Math.cos(bird.angle + 0.05) * bird.orbitRadiusZ
        const nextY = bird.altitude + Math.sin((bird.angle + 0.05) * 2 + bird.wingOffset) * 0.55
        bird.group.lookAt(nextX, nextY, nextZ)

        // Vỗ cánh nhịp nhàng
        const flap = Math.sin(elapsedTime * 9.5 + bird.wingOffset) * 0.48
        bird.leftWing.rotation.z = flap
        bird.rightWing.rotation.z = -flap
      }

      // Cập nhật từng cánh hoa rơi uốn lượn theo gió
      for (const petal of petalsList) {
        petal.mesh.position.y -= petal.vy
        petal.mesh.position.x += Math.sin(elapsedTime * 1.5 + petal.seed) * 0.006
        petal.mesh.position.z += Math.cos(elapsedTime * 1.5 + petal.seed) * 0.006

        petal.mesh.rotation.x += petal.rotSpeedX
        petal.mesh.rotation.y += petal.rotSpeedY
        petal.mesh.rotation.z += petal.rotSpeedZ

        if (petal.mesh.position.y < -0.8) {
          petal.mesh.position.y = 4.4 + Math.random() * 0.6
          petal.mesh.position.x = (Math.random() - 0.5) * 4.2
          petal.mesh.position.z = (Math.random() - 0.5) * 4.2
        }
      }

      // Cập nhật đom đóm dập dờn
      for (const ff of firefliesList) {
        ff.mesh.position.y = ff.baseY + Math.sin(elapsedTime * 1.8 + ff.seed) * 0.18
        ff.mesh.position.x += Math.cos(elapsedTime * 0.8 + ff.seed) * 0.005
        ff.mesh.position.z += Math.sin(elapsedTime * 0.8 + ff.seed) * 0.005
      }

      // Cập nhật hiệu ứng hoa tháng (phóng to khi hover)
      for (const fl of monthFlowerMeshes) {
        const isHov = hoveredMonthRef.current === fl.month
        const targetScale = isHov ? fl.baseScale * 1.35 : fl.baseScale
        fl.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15)

        if (fl.glowMesh) {
          fl.glowMesh.rotation.z += 0.02
          const glowPulse = 1.0 + Math.sin(elapsedTime * 3.0 + fl.month) * 0.16
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
          <span style={{ opacity: 0.6, fontSize: '0.68rem' }}>· Nhấn để xem →</span>
        </div>
      )}
    </div>
  )
}
