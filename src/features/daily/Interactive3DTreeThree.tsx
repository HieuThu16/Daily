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
 * Tạo hình dạng cánh hoa anh đào uốn cong tự nhiên trong không gian 3D
 */
function createCurvedPetalGeometry(width = 0.16, height = 0.22): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 4, 4)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    // Tạo độ võng cong cánh hoa tự nhiên (cupped shell)
    const curve = -(x * x * 2.2 + (y - height * 0.2) ** 2 * 0.8)
    pos.setZ(i, curve * 0.15)
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Tạo một bông hoa 5 cánh hoàn chỉnh dạng 3D
 */
function createFullBlossomMesh(petalGeo: THREE.BufferGeometry, petalMat: THREE.Material, centerMat: THREE.Material): THREE.Group {
  const flowerGroup = new THREE.Group()
  const petalCount = 5
  for (let i = 0; i < petalCount; i++) {
    const pMesh = new THREE.Mesh(petalGeo, petalMat)
    const angle = (i / petalCount) * Math.PI * 2
    pMesh.position.set(Math.cos(angle) * 0.08, Math.sin(angle) * 0.08, 0)
    pMesh.rotation.z = angle - Math.PI / 2
    pMesh.rotation.x = 0.25
    flowerGroup.add(pMesh)
  }
  // Nhuỵ vàng
  const centerGeo = new THREE.SphereGeometry(0.045, 8, 8)
  const center = new THREE.Mesh(centerGeo, centerMat)
  center.position.z = 0.02
  flowerGroup.add(center)
  return flowerGroup
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

    // ── ĐẢO NGỌC BỒNG BỀNH (Floating Crystal Moss Pedestal) ──
    const islandGeo = new THREE.CylinderGeometry(2.1, 1.5, 0.5, 48)
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.65,
      metalness: 0.08,
      emissive: 0x14532d,
      emissiveIntensity: 0.15,
    })
    const island = new THREE.Mesh(islandGeo, islandMat)
    island.position.y = -0.75
    island.receiveShadow = true
    treeGroup.add(island)

    // Tầng đáy đá pha lê lơ lửng bên dưới
    const rockBaseGeo = new THREE.ConeGeometry(1.5, 1.0, 7)
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.85,
      metalness: 0.2,
      flatShading: true,
    })
    const rockBase = new THREE.Mesh(rockBaseGeo, rockMat)
    rockBase.position.y = -1.5
    rockBase.rotation.x = Math.PI
    treeGroup.add(rockBase)

    // Vành hào quang vàng pha lê lơ lửng quanh đảo
    const ringGeo = new THREE.TorusGeometry(2.35, 0.04, 16, 72)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.8,
      roughness: 0.15,
      metalness: 0.85,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = -0.72
    treeGroup.add(ring)

    // Vành pha lê phụ bay chéo huyền ảo
    const subRingGeo = new THREE.TorusGeometry(2.6, 0.02, 12, 64)
    const subRing = new THREE.Mesh(subRingGeo, ringMat)
    subRing.rotation.x = Math.PI / 2.3
    subRing.rotation.y = 0.2
    subRing.position.y = -0.75
    treeGroup.add(subRing)

    // ── THÂN CÂY CỔ THỤ NGHỆ THUẬT (Sculpted Gnarled Bonsai Trunk) ──
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.65, 0),
      new THREE.Vector3(0.12, 0.2, 0.08),
      new THREE.Vector3(-0.15, 1.25, -0.06),
      new THREE.Vector3(0.08, 2.15, 0.05),
      new THREE.Vector3(0, 2.85, 0),
    ])
    const trunkGeo = new THREE.TubeGeometry(trunkCurve, 40, 0.32, 16, false)
    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x5c3317,
      roughness: 0.82,
      metalness: 0.08,
    })
    const trunk = new THREE.Mesh(trunkGeo, barkMat)
    trunk.castShadow = true
    trunk.receiveShadow = true
    treeGroup.add(trunk)

    // Thân phụ quấn quýt (Twisting Sub-Trunk) tạo độ gân guốc cổ thụ
    const vineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.15, -0.65, 0.1),
      new THREE.Vector3(-0.15, 0.4, 0.12),
      new THREE.Vector3(0.12, 1.4, -0.1),
      new THREE.Vector3(-0.05, 2.3, 0.08),
    ])
    const vineGeo = new THREE.TubeGeometry(vineCurve, 32, 0.12, 10, false)
    const vine = new THREE.Mesh(vineGeo, barkMat)
    vine.castShadow = true
    treeGroup.add(vine)

    // Bộ rễ cổ thụ bám sâu vào đảo ngọc
    const rootAngles = [0.2, 1.4, 2.5, 3.8, 5.0, 6.0]
    for (const rAng of rootAngles) {
      const rx = Math.cos(rAng) * 1.15
      const rz = Math.sin(rAng) * 1.15
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.35, 0),
        new THREE.Vector3(rx * 0.45, -0.55, rz * 0.45),
        new THREE.Vector3(rx, -0.74, rz),
      ])
      const rGeo = new THREE.TubeGeometry(rootCurve, 16, 0.11, 8, false)
      const rootMesh = new THREE.Mesh(rGeo, barkMat)
      rootMesh.castShadow = true
      treeGroup.add(rootMesh)
    }

    // ── CÁC CÀNH CÂY CỔ THỤ TỎA ĐỀU 360 ĐỘ ──
    const branchTips: THREE.Vector3[] = []
    const branchCount = 10
    for (let i = 0; i < branchCount; i++) {
      const ang = (i / branchCount) * Math.PI * 2 + ((i % 2) * 0.25 - 0.12)
      const dist = 1.45 + (i % 3) * 0.35
      const height = 2.7 + (i % 2 === 0 ? 0.5 : -0.35)
      const tipX = Math.cos(ang) * dist
      const tipY = height
      const tipZ = Math.sin(ang) * dist
      const tipPos = new THREE.Vector3(tipX, tipY, tipZ)
      branchTips.push(tipPos)

      const startY = 1.5 + (i / branchCount) * 0.9
      const branchCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, startY, 0),
        new THREE.Vector3(tipX * 0.45, startY + 0.4, tipZ * 0.45),
        tipPos,
      ])
      const bGeo = new THREE.TubeGeometry(branchCurve, 18, 0.13, 8, false)
      const branchMesh = new THREE.Mesh(bGeo, barkMat)
      branchMesh.castShadow = true
      treeGroup.add(branchMesh)

      // Nhánh con rủ uốn lượn mang hoa
      const subAng = ang + 0.35
      const subTip = new THREE.Vector3(
        tipX * 1.35 + Math.cos(subAng) * 0.45,
        tipY + 0.35 - (i % 2) * 0.2,
        tipZ * 1.35 + Math.sin(subAng) * 0.45
      )
      const subCurve = new THREE.CatmullRomCurve3([tipPos, subTip])
      const subGeo = new THREE.TubeGeometry(subCurve, 10, 0.07, 6, false)
      const subMesh = new THREE.Mesh(subGeo, barkMat)
      subMesh.castShadow = true
      treeGroup.add(subMesh)
      branchTips.push(subTip)
    }

    // ── TÁN HOA BỒNG BỀNH RỰC RỠ SẮC MÀU (Lush Volumetric Flower Clouds) ──
    const canopyGroup = new THREE.Group()
    treeGroup.add(canopyGroup)

    // Bảng màu hoa mùa phong phú, rạng rỡ và sắc nét
    const palette = [
      theme.flowers[0] || theme.petalColor,
      theme.flowers[1] || '#ff77a9',
      theme.flowers[2] || '#ff2e63',
      theme.flowers[3] || '#ffe082',
      theme.flowers[4] || '#ffffff',
      theme.petalColor,
      theme.accent,
    ]

    const clusterGeo = new THREE.DodecahedronGeometry(0.62, 1)
    const clusterCount = compact ? 16 : 28

    // Pre-create shared materials for all clusters instead of instantiating in loop
    const paletteMats = palette.map((colHex) =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colHex),
        roughness: 0.45,
        metalness: 0.08,
        emissive: new THREE.Color(colHex),
        emissiveIntensity: 0.25,
      })
    )

    for (let i = 0; i < clusterCount; i++) {
      const ang = (i / clusterCount) * Math.PI * 2 + (i % 3) * 0.15
      const radius = 0.55 + (i % 5) * 0.38
      const pY = 2.3 + Math.sin(i * 1.8) * 0.95 + ((i % 4) - 1.5) * 0.15
      const pX = Math.cos(ang) * radius
      const pZ = Math.sin(ang) * radius

      const puffMat = paletteMats[i % paletteMats.length]
      const puff = new THREE.Mesh(clusterGeo, puffMat)
      puff.position.set(pX, pY, pZ)
      const scale = 0.85 + (i % 3) * 0.35
      puff.scale.set(scale * 1.15, scale * 0.95, scale * 1.1)
      canopyGroup.add(puff)
    }

    // Vòm hoa vương miện trên đỉnh cây
    const crownMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[0]),
      roughness: 0.4,
      metalness: 0.05,
      emissive: new THREE.Color(palette[0]),
      emissiveIntensity: 0.3,
    })
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 1), crownMat)
    crown.position.set(0, 3.5, 0)
    canopyGroup.add(crown)

    // ── 12 BÔNG HOA THÁNG NỞ QUANH TÁN CÂY (12 Sacred Month Flowers) ──
    const monthFlowerMeshes: Array<{
      group: THREE.Group
      month: number
      label: string
      count: number
      badgeSprite: THREE.Sprite
      glowMesh?: THREE.Mesh
      baseScale: number
    }> = []

    const curvedPetalGeo = createCurvedPetalGeometry(0.18, 0.26)
    const pistilMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.4,
    })

    for (let m = 1; m <= 12; m++) {
      const ang = ((m - 1) / 12) * Math.PI * 2 - Math.PI / 2
      const radius = 2.5 + ((m % 2) === 0 ? 0.4 : -0.25)
      const fY = 2.6 + Math.sin(((m - 1) / 12) * Math.PI * 2) * 1.05
      const fX = Math.cos(ang) * radius
      const fZ = Math.sin(ang) * radius

      const flowerGroup = new THREE.Group()
      flowerGroup.position.set(fX, fY, fZ)

      const count = monthCounts[m] || 0
      const isStarred = count > 0

      // 5 cánh hoa 3D uốn lượn
      const flowerCol = new THREE.Color(palette[(m - 1) % palette.length])
      const flowerPetalMat = new THREE.MeshStandardMaterial({
        color: flowerCol,
        emissive: flowerCol,
        emissiveIntensity: isStarred ? 0.45 : 0.2,
        roughness: 0.35,
        metalness: 0.08,
        side: THREE.DoubleSide,
      })

      for (let p = 0; p < 5; p++) {
        const pAng = (p / 5) * Math.PI * 2
        const pMesh = new THREE.Mesh(curvedPetalGeo, flowerPetalMat)
        pMesh.position.set(Math.cos(pAng) * 0.16, Math.sin(pAng) * 0.16, -0.04)
        pMesh.rotation.z = pAng + Math.PI / 2
        pMesh.rotation.x = 0.25
        pMesh.scale.set(0.85, 0.85, 0.85)
        flowerGroup.add(pMesh)
      }

      // Nhuỵ hoa trung tâm phát sáng
      const pistil = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), pistilMat)
      flowerGroup.add(pistil)

      // Vòng hào quang vàng xoay quanh nếu tháng có kỷ niệm
      let glowMesh: THREE.Mesh | undefined
      if (isStarred) {
        const glowGeo = new THREE.TorusGeometry(0.42, 0.028, 10, 36)
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xf59e0b,
          emissiveIntensity: 1.0,
          roughness: 0.1,
          metalness: 0.9,
        })
        glowMesh = new THREE.Mesh(glowGeo, glowMat)
        flowerGroup.add(glowMesh)
      }

      // Nhãn chữ Tháng (T1..T12) & Badge số lượng dạng Billboard Sprite
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

      // Gắn dữ liệu nhận diện Raycast
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

    // ── HOA VÀ CÁNH HOA RƠI RƠI SIÊU ĐẸP (Falling Flowers & Fluttering Petals) ──
    // 1. Cánh hoa rơi đơn lẻ uốn cong
    const petalCount = compact ? 18 : 34
    const fallingPetalGeo = createCurvedPetalGeometry(0.13, 0.18)
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

    const fallingPetalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.petalColor),
      emissive: new THREE.Color(theme.petalColor),
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.45,
    })

    for (let i = 0; i < petalCount; i++) {
      const pMesh = new THREE.Mesh(fallingPetalGeo, fallingPetalMat)
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

    // 2. Những bông hoa 5 cánh nguyên vẹn xoay tròn rơi từ cành (Full Blossom Falls)
    const fullBlossomCount = compact ? 3 : 6
    for (let i = 0; i < fullBlossomCount; i++) {
      const col = new THREE.Color(palette[i % palette.length])
      const fMat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
        roughness: 0.4,
      })
      const fullBlossom = createFullBlossomMesh(fallingPetalGeo, fMat, pistilMat)
      fullBlossom.scale.set(0.55, 0.55, 0.55)
      fullBlossom.position.set(
        (Math.random() - 0.5) * 3.4,
        1.0 + Math.random() * 3.6,
        (Math.random() - 0.5) * 3.4
      )
      scene.add(fullBlossom)

      petalsList.push({
        mesh: fullBlossom,
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

    // ── ĐOM ĐÓM & BỤI TIÊN PHÁT SÁNG (Golden Fireflies Dust) ──
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
      subRing.rotation.z -= 0.003

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
