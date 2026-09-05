import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, CalendarDays, CalendarHeart, ChevronLeft, ChevronRight,
  Filter, Heart, ImagePlus, LayoutGrid, List, Mail, MapPin, Maximize2,
  MoreVertical, Pencil, Plus, RotateCcw, Trash2,
  UserPlus, Video, Loader2, X, BookOpen, Image as ImageIcon, TreePine
} from 'lucide-react'
import { MemoryBookView } from './MemoryBookView'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { anniversariesOn, yearsAgoLabel } from '../../lib/anniversary'
import type { SharedEvent, SharedPartner } from '../../types'
import { DeleteButton, Empty, Modal, useQuery } from '../shared'
import { useToast } from '../ToastContext'
import { notifyPartner } from '../../lib/push'
import { compressForUpload } from '../../lib/photo'
import { deleteStorageFile, deleteStorageFiles } from '../../lib/storageDelete'
import { uploadMediaFile } from '../../lib/storageService'

const PHOTO_BUCKET = 'daily-photos'

/** Nhận biết URL có phải là video hay không */
export function isMediaVideo(url?: string | null): boolean {
  if (!url) return false
  if (url.startsWith('data:video/')) return true
  const clean = url.split('?')[0].toLowerCase()
  return /\.(mp4|webm|mov|m4v|mkv|avi|3gp|ogv)$/.test(clean)
}

/** Tự động trích xuất poster / thumbnail JPG từ link video Cloudinary hoặc video URL */
export function getVideoPosterUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (url.includes('cloudinary.com')) {
    return url.replace(/\.(mp4|webm|mov|m4v|mkv|avi|3gp|ogv)(\?.*)?$/i, '.jpg$2')
  }
  return undefined
}

/**
 * Component hiển thị ảnh an toàn, tự động thử lại khi gặp sự cố cache Service Worker,
 * có giao diện fallback tao nhã kèm nút bấm tải lại thay vì để trình duyệt hiện icon vỡ ảnh.
 */
export function SafeMediaImage({
  src,
  alt = '',
  className,
  loading = 'lazy',
  style,
  onClick,
}: {
  src: string
  alt?: string
  className?: string
  loading?: 'lazy' | 'eager'
  style?: React.CSSProperties
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void
}) {
  const [imgSrc, setImgSrc] = useState(src)
  const [retryCount, setRetryCount] = useState(0)
  const [isFailed, setIsFailed] = useState(false)

  useEffect(() => {
    setImgSrc(src)
    setRetryCount(0)
    setIsFailed(false)
  }, [src])

  if (isFailed) {
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#151922',
          color: '#94a3b8',
          gap: 4,
          padding: 6,
          textAlign: 'center',
          cursor: 'pointer',
          boxSizing: 'border-box',
          ...style,
        }}
        onClick={(e) => {
          e.stopPropagation()
          setIsFailed(false)
          setRetryCount(0)
          const sep = src.includes('?') ? '&' : '?'
          setImgSrc(`${src}${sep}_retry=${Date.now()}`)
        }}
        title="Ảnh chưa hiển thị, bấm để tải lại ngay"
      >
        <ImageIcon size={18} style={{ color: '#38bdf8', opacity: 0.8 }} />
        <span style={{ fontSize: '0.62rem', color: '#cbd5e1', fontWeight: 600 }}>Tải lại</span>
      </div>
    )
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      loading={loading}
      style={style}
      onClick={onClick}
      onError={() => {
        if (retryCount < 2) {
          setRetryCount((prev) => prev + 1)
          const sep = src.includes('?') ? '&' : '?'
          setImgSrc(`${src}${sep}_t=${Date.now()}`)
        } else {
          setIsFailed(true)
        }
      }}
    />
  )
}

/** Nhận biết File có phải là video hay không */
export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi', '3gp', 'ogv'].includes(ext || '')
}

/** Đại diện cho một ảnh/video đang chờ tải lên với thông tin preview và fingerprint chống trùng lặp */
export interface PendingMediaItem {
  id: string
  file: File
  previewUrl: string
  fingerprint: string
  isVid: boolean
}

/** Tạo fingerprint duy nhất của tệp từ tên, kích thước và thời gian sửa đổi */
export function getMediaFingerprint(file: File): string {
  return `${file.name}__${file.size}__${file.lastModified}`
}

/** Ảnh/video đang ở bước nào; `done`/`total` để vẽ thanh tiến trình. */
type PhotoProgress = { phase: 'compress' | 'upload' | 'save'; done: number; total: number }

const PHASE_LABEL: Record<PhotoProgress['phase'], string> = {
  compress: 'Đang xử lý ảnh/video',
  upload: 'Đang tải lên máy chủ',
  save: 'Đang lưu kỷ niệm',
}

function viDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Bảng shared_events thiếu cột mảng `images` (migration
 * 20260920000004_shared_events_multiple_images.sql chưa chạy) nên chỉ giữ được
 * ảnh đầu. Nhắc một lần mỗi phiên thay vì âm thầm nuốt mất ảnh.
 */
let warnedMissingImages = false
function warnMissingImagesColumn(showToast: (msg: string, type?: any) => void) {
  if (warnedMissingImages) return
  warnedMissingImages = true
  showToast('⚠️ Chỉ lưu được 1 ảnh — cần chạy migration shared_events_multiple_images trên Supabase', 'delete')
}

export function SharedEventsView({
  personId,
  personName,
  isPartner = false,
  roomCode,
  onSendInvite,
}: {
  personId: string
  personName?: string
  isPartner?: boolean
  roomCode?: string | null
  onSendInvite?: () => void
}) {
  const { showToast } = useToast()
  const events = useQuery<SharedEvent>('shared_events')
  const partners = useQuery<SharedPartner>('shared_partners')
  const [myId, setMyId] = useState<string | null>(null)

  const [viewing, setViewing] = useState<SharedEvent | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<SharedEvent | null>(null)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [eventDate, setEventDate] = useState(localDate())
  const [eventTime, setEventTime] = useState('')
  const [location, setLocation] = useState('')
  /** "Thông tin thêm" mặc định đóng: giờ và vị trí chỉ hiện khi cần điền. */
  const [showExtra, setShowExtra] = useState(false)
  const [busy, setBusy] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLDivElement | null>(null)
  const lightboxTrackRef = useRef<HTMLDivElement | null>(null)

  const [partnerEmail, setPartnerEmail] = useState('')
  const [managePartners, setManagePartners] = useState(false)

  const [filterYear, setFilterYear] = useState<string>('ALL')
  const [filterMonth, setFilterMonth] = useState<string>('ALL')
  const [viewMode, setViewMode] = useState<'timeline' | 'month'>('month')
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('ALL')
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null)
  const [showMemoryBook, setShowMemoryBook] = useState(false)
  const [memoryBookMode, setMemoryBookMode] = useState<'tree' | 'book'>('book')

  const [pendingMedia, setPendingMedia] = useState<PendingMediaItem[]>([])
  const abortUploadRef = useRef(false)
  const pendingMediaRef = useRef<PendingMediaItem[]>([])
  pendingMediaRef.current = pendingMedia

  // Dọn dẹp bộ nhớ: revoke các URL preview khi huỷ hoặc unmount
  const revokeAllPreviews = (items: PendingMediaItem[]) => {
    for (const item of items) {
      if (item.previewUrl) {
        try {
          URL.revokeObjectURL(item.previewUrl)
        } catch {}
      }
    }
  }

  useEffect(() => {
    return () => {
      abortUploadRef.current = true
      revokeAllPreviews(pendingMediaRef.current)
    }
  }, [])

  const [progress, setProgress] = useState<PhotoProgress | null>(null)
  const [selectedImageIdx, setSelectedImageIdx] = useState<number>(0)
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null)
  const [isGridView, setIsGridView] = useState<boolean>(false)
  const isProgrammaticScrollRef = useRef(false)

  // Đặt lại xem ảnh đơn và ảnh đầu tiên mỗi khi mở kỷ niệm mới
  useEffect(() => {
    setIsGridView(false)
    setSelectedImageIdx(0)
  }, [viewing?.id])

  // Cuộn ngay lập tức tới slide tương ứng khi mở Lightbox hoặc đổi fullscreenIdx
  useEffect(() => {
    if (fullscreenIdx === null) return
    const track = lightboxTrackRef.current
    if (track) {
      isProgrammaticScrollRef.current = true
      const width = track.clientWidth || window.innerWidth
      track.scrollTo({ left: fullscreenIdx * width, behavior: 'instant' as ScrollBehavior })
      const timer = setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [fullscreenIdx])

  // Cuộn thumbnail active ở đáy lightbox vào giữa tầm nhìn
  useEffect(() => {
    if (fullscreenIdx === null) return
    const timer = setTimeout(() => {
      const activeThumb = document.querySelector('.mem-lightbox-bottom .mem-gallery-thumb-item.on')
      activeThumb?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }, 50)
    return () => clearTimeout(timer)
  }, [fullscreenIdx])

  // Đồng bộ galleryRef khi không ở chế độ lưới
  useEffect(() => {
    if (isGridView) return
    const track = galleryRef.current
    if (track && selectedImageIdx >= 0) {
      const width = track.clientWidth
      if (width > 0) {
        track.scrollTo({ left: selectedImageIdx * width, behavior: 'instant' as ScrollBehavior })
      }
    }
  }, [selectedImageIdx, isGridView, viewing?.id])

  // Điều khiển phím mũi tên & Esc khi xem toàn màn hình
  useEffect(() => {
    if (fullscreenIdx === null) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenIdx(null)
      } else if (e.key === 'ArrowLeft') {
        const curEvent = viewing || editing
        const all = curEvent?.images && curEvent.images.length ? curEvent.images : (curEvent?.image_url ? [curEvent.image_url] : [])
        if (all.length > 0) {
          const prev = Math.max(0, fullscreenIdx - 1)
          setFullscreenIdx(prev)
          isProgrammaticScrollRef.current = true
          const w = lightboxTrackRef.current?.clientWidth || window.innerWidth
          lightboxTrackRef.current?.scrollTo({ left: prev * w, behavior: 'smooth' })
          setTimeout(() => { isProgrammaticScrollRef.current = false }, 300)
        }
      } else if (e.key === 'ArrowRight') {
        const curEvent = viewing || editing
        const all = curEvent?.images && curEvent.images.length ? curEvent.images : (curEvent?.image_url ? [curEvent.image_url] : [])
        if (all.length > 0) {
          const next = Math.min(all.length - 1, fullscreenIdx + 1)
          setFullscreenIdx(next)
          isProgrammaticScrollRef.current = true
          const w = lightboxTrackRef.current?.clientWidth || window.innerWidth
          lightboxTrackRef.current?.scrollTo({ left: next * w, behavior: 'smooth' })
          setTimeout(() => { isProgrammaticScrollRef.current = false }, 300)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenIdx, viewing, editing])

  useEffect(() => {
    supabase?.auth?.getUser().then(({ data }) => setMyId(data?.user?.id ?? null)).catch(() => null)

    if (!supabase || typeof supabase.channel !== 'function') return
    const channel = supabase
      .channel('shared_events_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_events' }, () => {
        events.reload()
      })
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [])

  // Kỷ niệm chung của phòng (roomCode nếu là partner), hoặc kỷ niệm cá nhân gắn theo personId
  const sorted = useMemo(() => {
    // 1. Lọc theo roomCode (khi là partner) hoặc personId
    const matched = events.items.filter((e) => {
      if (isPartner && roomCode) {
        return e.room_code === roomCode || e.person_id === personId
      }
      if (roomCode) {
        return e.room_code === roomCode || e.person_id === personId
      }
      // Người thân thông thường (không liên kết phòng): Chỉ lấy kỷ niệm gắn đúng người này
      return e.person_id === personId
    })

    // 2. Loại bỏ hoàn toàn bản ghi trùng lặp (theo id hoặc theo title + date + room_code)
    const seenIds = new Set<string>()
    const seenKeys = new Set<string>()
    const unique: SharedEvent[] = []

    for (const item of matched) {
      if (seenIds.has(item.id)) continue
      const contentKey = `${item.room_code ?? ''}_${item.event_date}_${item.title.trim().toLowerCase()}`
      if (seenKeys.has(contentKey)) continue

      seenIds.add(item.id)
      seenKeys.add(contentKey)
      unique.push(item)
    }

    // 3. Sắp xếp theo ngày mới nhất
    return unique.sort(
      (a, b) => b.event_date.localeCompare(a.event_date) || (b.event_time ?? '').localeCompare(a.event_time ?? ''),
    )
  }, [events.items, roomCode, personId, myId])

  const availableYears = useMemo(() => {
    const years = new Set<string>()
    for (const ev of sorted) {
      if (ev.event_date) {
        const y = ev.event_date.slice(0, 4)
        if (y) years.add(y)
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [sorted])

  const filtered = useMemo(() => {
    return sorted.filter((ev) => {
      if (!ev.event_date) return true
      const [y, m] = ev.event_date.split('-')
      if (filterYear !== 'ALL' && y !== filterYear) return false
      if (filterMonth !== 'ALL' && String(parseInt(m, 10)) !== filterMonth) return false
      return true
    })
  }, [sorted, filterYear, filterMonth])

  /** Kỷ niệm rơi đúng ngày này của những năm trước — nhắc ngay đầu trang. */
  const anniversaries = useMemo(() => anniversariesOn(sorted, localDate()), [sorted])

  const viewingEvent = useMemo(
    () => (viewing ? (events.items.find((e) => e.id === viewing.id) ?? viewing) : null),
    [events.items, viewing],
  )

  const monthGroups = useMemo(() => {
    const map = new Map<string, { key: string; year: number; month: number; label: string; events: SharedEvent[]; totalPhotos: number }>()
    for (const ev of sorted) {
      if (!ev.event_date) continue
      const y = Number(ev.event_date.slice(0, 4))
      const m = Number(ev.event_date.slice(5, 7))
      const key = `${y}-${String(m).padStart(2, '0')}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          year: y,
          month: m,
          label: `Tháng ${m}, ${y}`,
          events: [],
          totalPhotos: 0,
        })
      }
      const group = map.get(key)!
      group.events.push(ev)
      const count = (ev.images && ev.images.length) || (ev.image_url ? 1 : 0)
      group.totalPhotos += count
    }
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key))
  }, [sorted])

  const activeMonthGroup = useMemo(() => {
    if (selectedMonthKey === 'ALL') return null
    return monthGroups.find((g) => g.key === selectedMonthKey) || null
  }, [monthGroups, selectedMonthKey])

  const calendarDays = useMemo(() => {
    if (!activeMonthGroup) return []
    const { year, month } = activeMonthGroup
    const firstDay = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    let startDayOfWeek = firstDay.getDay() - 1
    if (startDayOfWeek === -1) startDayOfWeek = 6

    const days: Array<{
      dayNum: number | null
      dateStr: string | null
      hasEvents: boolean
      events: SharedEvent[]
      photosCount: number
    }> = []

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ dayNum: null, dateStr: null, hasEvents: false, events: [], photosCount: 0 })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const evs = activeMonthGroup.events.filter((e) => e.event_date === dateStr)
      let pCount = 0
      evs.forEach((e) => {
        pCount += (e.images && e.images.length) || (e.image_url ? 1 : 0)
      })
      days.push({
        dayNum: d,
        dateStr,
        hasEvents: evs.length > 0,
        events: evs,
        photosCount: pCount,
      })
    }

    return days
  }, [activeMonthGroup])

  const currentMonthIdx = monthGroups.findIndex((g) => g.key === selectedMonthKey)
  const hasNextMonth = currentMonthIdx > 0
  const hasPrevMonth = currentMonthIdx >= 0 && currentMonthIdx < monthGroups.length - 1
  const goNextMonth = () => {
    if (hasNextMonth) {
      setSelectedMonthKey(monthGroups[currentMonthIdx - 1].key)
      setSelectedCalDay(null)
    }
  }
  const goPrevMonth = () => {
    if (hasPrevMonth) {
      setSelectedMonthKey(monthGroups[currentMonthIdx + 1].key)
      setSelectedCalDay(null)
    }
  }

  const resetForm = () => {
    setTitle('')
    setNote('')
    setEventDate(localDate())
    setEventTime('')
    setLocation('')
    setShowExtra(false)
    revokeAllPreviews(pendingMedia)
    setPendingMedia([])
    setSelectedImageIdx(0)
    abortUploadRef.current = false
  }

  const openAdd = () => {
    resetForm()
    setAdding(true)
  }

  const openEdit = (ev: SharedEvent) => {
    setEditing(ev)
    setTitle(ev.title)
    setNote(ev.note ?? '')
    setEventDate(ev.event_date)
    setEventTime(ev.event_time ?? '')
    setLocation(ev.location ?? '')
    setShowExtra(Boolean(ev.location))
    revokeAllPreviews(pendingMedia)
    setPendingMedia([])
    setSelectedImageIdx(0)
    abortUploadRef.current = false
  }

  const getEffectiveTitle = () => {
    if (title.trim()) return title.trim()
    if (note.trim()) return note.trim().slice(0, 40)
    if (eventDate) {
      const parts = eventDate.split('-')
      if (parts.length === 3) {
        return `Kỷ niệm ${parts[2]}/${parts[1]}/${parts[0]}`
      }
      return `Kỷ niệm ${eventDate}`
    }
    return 'Kỷ niệm chung'
  }

  const payload = (customTitle?: string) => ({
    person_id: personId,
    room_code: isPartner && roomCode ? roomCode : null,
    title: (customTitle ?? getEffectiveTitle()).trim(),
    note: note.trim() || null,
    event_date: eventDate,
    event_time: eventTime || null,
    location: location.trim() || null,
  })

  /** FileReader đọc được cả Blob, không riêng File — nhận Blob để dùng luôn bản đã nén. */
  const fileToDataUrl = (file: Blob): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => resolve('')
      reader.readAsDataURL(file)
    })

  /** Tải lên một tệp media đơn lẻ với nén ảnh mượt mà và fallback an toàn */
  const uploadSingleMedia = async (
    folder: string,
    file: File,
    isVid: boolean,
    onPhase?: (phase: 'compress' | 'upload') => void,
  ): Promise<{ url: string; path: string; isFallback: boolean }> => {
    let blobToUpload: Blob = file
    let ext = file.name.split('.').pop()?.toLowerCase() || (isVid ? 'mp4' : 'jpg')

    if (!isVid) {
      onPhase?.('compress')
      const compressed = await compressForUpload(file)
      blobToUpload = compressed.blob
      ext = compressed.ext
    }

    onPhase?.('upload')
    const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const path = `${folder}/${uuid}.${ext}`
    let uploadedUrl = ''
    let isFallback = false

    try {
      const uploaded = await uploadMediaFile(blobToUpload, {
        folder: `daily-photos/${folder}`,
        fileName: uuid,
        bucketFallback: PHOTO_BUCKET,
        resourceType: isVid ? 'video' : 'image',
      })
      uploadedUrl = uploaded.url
    } catch (upErr) {
      console.warn('Upload error, fallback to data url:', upErr)
    }

    if (!uploadedUrl) {
      uploadedUrl = await fileToDataUrl(blobToUpload)
      if (uploadedUrl) isFallback = true
    }

    return { url: uploadedUrl, path: uploadedUrl.includes('cloudinary.com') ? uploadedUrl : (uploadedUrl ? path : ''), isFallback }
  }


  const createEvent = async () => {
    if (!title.trim() && !note.trim() && pendingMedia.length === 0) {
      showToast('Vui lòng nhập tên sự kiện hoặc đính kèm ảnh/video', 'delete')
      return
    }
    setBusy(true)
    abortUploadRef.current = false

    if (pendingMedia.length > 0) {
      setProgress({ phase: 'compress', done: 0, total: pendingMedia.length })
    }

    try {
      const basePayload = {
        ...payload(),
        image_url: null,
        image_path: null,
      }

      let created: SharedEvent | null = null

      // Bước 1: Lưu kỷ niệm vào Supabase ngay trước để có ID
      if (supabase) {
        const fullPayload = {
          ...basePayload,
          images: [],
          image_paths: [],
        }
        const { data, error } = await supabase.from('shared_events').insert(fullPayload).select().single()
        if (error) {
          // Schema cũ chưa có cột images
          const retryRes = await supabase.from('shared_events').insert(basePayload).select().single()
          if (retryRes.data) {
            created = {
              ...(retryRes.data as SharedEvent),
              images: [],
              image_paths: [],
            }
          }
        } else if (data) {
          created = data as SharedEvent
        }
      }

      const savedRemotely = created !== null

      if (!created) {
        created = {
          id: `local-${Date.now()}`,
          owner_id: myId || 'local',
          ...basePayload,
          images: [],
          image_paths: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        } as SharedEvent
      }

      // Đưa ngay vào danh sách để giao diện hiển thị mượt mà không chờ đợi
      events.setItems((prev) => [created!, ...prev])

      if (!savedRemotely) {
        showToast('⚠️ Chưa lưu được lên máy chủ — kỷ niệm chỉ hiện tạm, kiểm tra kết nối rồi thêm lại.', 'delete')
        setAdding(false)
        resetForm()
        return
      }

      // Bước 2: Tải từng ảnh/video và lưu NGAY ("tải ảnh nào lưu ảnh đó", "dừng thì vẫn lưu các ảnh đã lưu")
      const uploadedUrls: string[] = []
      const uploadedPaths: string[] = []
      let fellBack = 0
      let stoppedEarly = false

      if (pendingMedia.length > 0) {
        for (let i = 0; i < pendingMedia.length; i++) {
          if (abortUploadRef.current) {
            stoppedEarly = true
            break
          }

          const item = pendingMedia[i]
          // Nhường vòng lặp 25ms để trình duyệt vẽ lại giao diện mượt mà không bị khựng
          await new Promise((r) => setTimeout(r, 25))
          if (abortUploadRef.current) {
            stoppedEarly = true
            break
          }

          setProgress({ phase: item.isVid ? 'upload' : 'compress', done: i, total: pendingMedia.length })

          try {
            const res = await uploadSingleMedia(
              eventDate,
              item.file,
              item.isVid,
              (phase) => setProgress({ phase, done: i, total: pendingMedia.length }),
            )

            if (res.isFallback) fellBack++

            if (res.url) {
              uploadedUrls.push(res.url)
              uploadedPaths.push(res.path)

              // LƯU NGAY VÀO SUPABASE CHO KỶ NIỆM HIỆN TẠI
              if (supabase && created.id && !created.id.startsWith('local-')) {
                const patch = {
                  images: [...uploadedUrls],
                  image_paths: [...uploadedPaths],
                  image_url: uploadedUrls[0] || null,
                  image_path: uploadedPaths[0] || null,
                }
                const { error: patchErr } = await supabase.from('shared_events').update(patch).eq('id', created.id)
                if (patchErr) {
                  if (uploadedUrls.length > 1) warnMissingImagesColumn(showToast)
                  await supabase.from('shared_events').update({
                    image_url: uploadedUrls[0] || null,
                    image_path: uploadedPaths[0] || null,
                  }).eq('id', created.id)
                }
              }

              // Cập nhật ngay vào danh sách trong React state
              events.setItems((prev) =>
                prev.map((e) =>
                  e.id === created!.id
                    ? {
                        ...e,
                        images: [...uploadedUrls],
                        image_paths: [...uploadedPaths],
                        image_url: uploadedUrls[0] || null,
                        image_path: uploadedPaths[0] || null,
                      }
                    : e,
                ),
              )

              if (item.previewUrl) {
                try {
                  URL.revokeObjectURL(item.previewUrl)
                } catch {}
              }
            }
          } catch (mediaErr) {
            console.error('Lỗi khi tải ảnh/video:', mediaErr)
          }

          setProgress({ phase: 'save', done: i + 1, total: pendingMedia.length })
        }
      }

      if (stoppedEarly) {
        showToast(`⏸️ Đã dừng tải lên. Đã lưu ${uploadedUrls.length}/${pendingMedia.length} ảnh/video vào kỷ niệm.`)
      } else {
        void notifyPartner('Có kỷ niệm mới được chia sẻ', created.title, '/daily', `share-${created.id}`)
        const savedCount = uploadedUrls.length
        const missing = pendingMedia.length - savedCount
        let message = savedCount > 0 ? `✅ Đã lưu kỷ niệm cùng ${savedCount} ảnh/video` : '✅ Đã lưu kỷ niệm'
        if (missing > 0) message += ` · ${missing} tệp không đọc được`
        if (fellBack > 0) message += ` · ${fellBack} tệp lưu kèm bản ghi (nặng hơn)`
        showToast(message)
      }

      setAdding(false)
      resetForm()
    } catch (err: any) {
      console.error('Lỗi khi lưu kỷ niệm:', err)
      showToast('❌ Có lỗi khi lưu: ' + (err?.message || 'Vui lòng thử lại'), 'delete')
    } finally {
      setProgress(null)
      setBusy(false)
      abortUploadRef.current = false
    }
  }

  const saveEvent = async () => {
    if (!editing) return
    setBusy(true)
    abortUploadRef.current = false

    if (pendingMedia.length > 0) {
      setProgress({ phase: 'compress', done: 0, total: pendingMedia.length })
    }

    try {
      let currentImages = editing.images && editing.images.length ? [...editing.images] : (editing.image_url ? [editing.image_url] : [])
      let currentPaths = editing.image_paths && editing.image_paths.length ? [...editing.image_paths] : (editing.image_path ? [editing.image_path] : [])

      // Giữ nguyên room_code và person_id sẵn có để tránh vi phạm RLS và không làm mất dữ liệu phòng
      const preservedRoomCode = editing.room_code || (isPartner && roomCode ? roomCode : null)
      const preservedPersonId = editing.person_id || personId || null

      const baseUpdateData = {
        title: (title.trim() || getEffectiveTitle()).trim(),
        note: note.trim() || null,
        event_date: eventDate,
        event_time: eventTime || null,
        location: location.trim() || null,
        room_code: preservedRoomCode,
        person_id: preservedPersonId,
        image_url: currentImages[0] || null,
        image_path: currentPaths[0] || null,
      }
      const fullUpdateData = {
        ...baseUpdateData,
        images: currentImages,
        image_paths: currentPaths,
      }

      let savedRemotely = !supabase
      if (supabase) {
        const { error } = await supabase.from('shared_events').update(fullUpdateData).eq('id', editing.id)
        if (!error) {
          savedRemotely = true
        } else {
          console.warn('Update fullUpdateData failed, retrying baseUpdateData:', error.message)
          if (currentImages.length > 1) warnMissingImagesColumn(showToast)
          const retry = await supabase.from('shared_events').update(baseUpdateData).eq('id', editing.id)
          savedRemotely = !retry.error
          if (retry.error) {
            console.error('Không cập nhật được kỷ niệm:', retry.error.message)
            showToast('⚠️ Lỗi lưu máy chủ: ' + retry.error.message, 'delete')
          }
        }
      }

      // Cập nhật ngay trên giao diện React & local cache để phản ánh ngày/thông tin mới
      let updatedEv: SharedEvent = {
        ...editing,
        ...fullUpdateData,
      }
      events.setItems((prev) => prev.map((e) => (e.id === editing.id ? updatedEv : e)))
      if (viewing?.id === editing.id) {
        setViewing(updatedEv)
      }
      setEditing(updatedEv)

      let newlyUploadedCount = 0
      let stoppedEarly = false

      if (pendingMedia.length > 0) {
        for (let i = 0; i < pendingMedia.length; i++) {
          if (abortUploadRef.current) {
            stoppedEarly = true
            break
          }

          const item = pendingMedia[i]
          await new Promise((r) => setTimeout(r, 25))
          if (abortUploadRef.current) {
            stoppedEarly = true
            break
          }

          setProgress({ phase: item.isVid ? 'upload' : 'compress', done: i, total: pendingMedia.length })

          try {
            const res = await uploadSingleMedia(
              eventDate,
              item.file,
              item.isVid,
              (phase) => setProgress({ phase, done: i, total: pendingMedia.length }),
            )

            if (res.url) {
              currentImages = [...currentImages, res.url]
              currentPaths = [...currentPaths, res.path]
              newlyUploadedCount++

              // Cập nhật ngay vào Supabase cho sự kiện này
              if (supabase) {
                const patchData = {
                  images: currentImages,
                  image_paths: currentPaths,
                  image_url: currentImages[0] || null,
                  image_path: currentPaths[0] || null,
                }
                const { error: pErr } = await supabase.from('shared_events').update(patchData).eq('id', editing.id)
                if (pErr) {
                  if (currentImages.length > 1) warnMissingImagesColumn(showToast)
                  await supabase.from('shared_events').update({
                    image_url: currentImages[0] || null,
                    image_path: currentPaths[0] || null,
                  }).eq('id', editing.id)
                }
              }

              // Cập nhật lại giao diện React
              updatedEv = {
                ...updatedEv,
                ...baseUpdateData,
                images: currentImages,
                image_paths: currentPaths,
                image_url: currentImages[0] || null,
                image_path: currentPaths[0] || null,
              }
              events.setItems((prev) => prev.map((e) => (e.id === editing.id ? updatedEv : e)))
              if (viewing?.id === editing.id) {
                setViewing(updatedEv)
              }
              setEditing(updatedEv)

              if (item.previewUrl) {
                try {
                  URL.revokeObjectURL(item.previewUrl)
                } catch {}
              }
            }
          } catch (e) {
            console.error('Lỗi khi tải ảnh vào sự kiện:', e)
          }

          setProgress({ phase: 'save', done: i + 1, total: pendingMedia.length })
        }
      }

      if (stoppedEarly) {
        showToast(`⏸️ Đã dừng tải lên. Đã lưu thêm ${newlyUploadedCount}/${pendingMedia.length} ảnh/video vào kỷ niệm.`)
      } else if (savedRemotely) {
        showToast(newlyUploadedCount > 0 ? `✅ Đã cập nhật kỷ niệm, thêm ${newlyUploadedCount} ảnh/video` : '✏️ Đã cập nhật ngày và thông tin kỷ niệm')
      } else {
        showToast('⚠️ Chưa lưu được thay đổi lên máy chủ — kiểm tra kết nối rồi thử lại.', 'delete')
      }

      setEditing(null)
      resetForm()
    } catch (err: any) {
      console.error('Lỗi khi cập nhật kỷ niệm:', err)
      showToast('❌ Có lỗi khi cập nhật: ' + (err?.message || 'Vui lòng thử lại'), 'delete')
    } finally {
      setProgress(null)
      setBusy(false)
      abortUploadRef.current = false
    }
  }

  const deleteEvent = async (id: string) => {
    const target = events.items.find((e) => e.id === id) || (viewing?.id === id ? viewing : null)
    if (target) {
      const pathsToDelete: string[] = []
      if (Array.isArray(target.image_paths)) {
        pathsToDelete.push(...target.image_paths.filter(Boolean))
      } else if (target.image_path) {
        pathsToDelete.push(target.image_path)
      }
      if (Array.isArray(target.images)) {
        for (const url of target.images) {
          try {
            const u = new URL(url)
            const marker = `/${PHOTO_BUCKET}/`
            const idx = u.pathname.indexOf(marker)
            if (idx !== -1) {
              pathsToDelete.push(decodeURIComponent(u.pathname.slice(idx + marker.length).split('?')[0]))
            }
          } catch {
            // ignore
          }
        }
      }
      if (pathsToDelete.length > 0) {
        void deleteStorageFiles(PHOTO_BUCKET, Array.from(new Set(pathsToDelete)))
      }
    }

    const { error } = await supabase!.from('shared_events').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      showToast('❌ Chưa xoá được', 'delete')
      return
    }
    events.setItems((prev) => prev.filter((e) => e.id !== id))
    showToast('🗑️ Đã xoá sự kiện', 'delete')
    setViewing(null)
  }

  const toggleFavorite = async (ev: SharedEvent) => {
    const next = !ev.is_favorite
    const { error } = await supabase!.from('shared_events').update({ is_favorite: next }).eq('id', ev.id)
    if (error) {
      showToast('❌ Chưa đổi được yêu thích', 'delete')
      return
    }
    events.setItems((prev) => prev.map((e) => (e.id === ev.id ? { ...e, is_favorite: next } : e)))
    showToast(next ? '⭐ Đã thích sự kiện' : '🖤 Đã bỏ thích')
  }

  const addPartner = async () => {
    const email = partnerEmail.trim().toLowerCase()
    if (!email) return
    const { data, error } = await supabase!
      .from('shared_partners')
      .insert({ partner_email: email })
      .select()
      .single()
    if (error || !data) {
      showToast('❌ Không thêm được email', 'delete')
      return
    }
    partners.setItems((prev) => [data as SharedPartner, ...prev])
    setPartnerEmail('')
    showToast(`💌 Đã thêm ${email}`)
  }

  const removePartner = async (id: string) => {
    const { error } = await supabase!.from('shared_partners').delete().eq('id', id)
    if (error) {
      showToast('❌ Chưa xoá được người này', 'delete')
      return
    }
    partners.setItems((prev) => prev.filter((p) => p.id !== id))
    showToast('🗑️ Đã xoá người chung', 'delete')
  }

  const deleteImageFromEvent = async (targetEvent: SharedEvent, imgIdx: number) => {
    const currentImages = targetEvent.images && targetEvent.images.length
      ? [...targetEvent.images]
      : (targetEvent.image_url ? [targetEvent.image_url] : [])
    const currentPaths = targetEvent.image_paths && targetEvent.image_paths.length
      ? [...targetEvent.image_paths]
      : (targetEvent.image_path ? [targetEvent.image_path] : [])

    if (imgIdx < 0 || imgIdx >= currentImages.length) return

    if (!confirm(`Xoá ảnh/video số ${imgIdx + 1} này khỏi Supabase? Không thể hoàn tác.`)) {
      return
    }

    setBusy(true)
    try {
      let pathToDelete = currentPaths[imgIdx]
      if (!pathToDelete && currentImages[imgIdx]) {
        try {
          const u = new URL(currentImages[imgIdx])
          const bucketMarker = `/${PHOTO_BUCKET}/`
          const markerIdx = u.pathname.indexOf(bucketMarker)
          if (markerIdx !== -1) {
            pathToDelete = decodeURIComponent(u.pathname.slice(markerIdx + bucketMarker.length).split('?')[0])
          }
        } catch {
          // Ignored
        }
      }

      if (pathToDelete) {
        void deleteStorageFile(PHOTO_BUCKET, pathToDelete)
      }

      const nextImages = currentImages.filter((_, i) => i !== imgIdx)
      const nextPaths = currentPaths.filter((_, i) => i !== imgIdx)

      const baseUpdateData = {
        image_url: nextImages[0] || null,
        image_path: nextPaths[0] || null,
      }

      const fullUpdateData = {
        ...baseUpdateData,
        images: nextImages,
        image_paths: nextPaths,
      }

      if (supabase) {
        const { error } = await supabase.from('shared_events').update(fullUpdateData).eq('id', targetEvent.id)
        if (error) {
          await supabase.from('shared_events').update(baseUpdateData).eq('id', targetEvent.id)
        }
      }

      const updated = { ...targetEvent, ...fullUpdateData }
      events.setItems((prev) => prev.map((item) => (item.id === targetEvent.id ? updated : item)))
      if (viewing?.id === targetEvent.id) {
        setViewing(updated)
      }
      if (editing?.id === targetEvent.id) {
        setEditing(updated)
      }

      const remainingCount = nextImages.length
      if (remainingCount === 0) {
        setFullscreenIdx(null)
        setSelectedImageIdx(0)
        setIsGridView(false)
      } else {
        const nextIdx = Math.min(imgIdx, remainingCount - 1)
        setSelectedImageIdx(nextIdx)
        if (fullscreenIdx !== null) {
          setFullscreenIdx(nextIdx)
          setTimeout(() => {
            const track = lightboxTrackRef.current
            if (track) {
              const width = track.clientWidth || window.innerWidth
              track.scrollTo({ left: nextIdx * width, behavior: 'instant' as ScrollBehavior })
            }
          }, 30)
        }
      }

      showToast('🗑️ Đã xoá ảnh khỏi Supabase')
    } catch (err: any) {
      console.error('Lỗi khi xoá ảnh:', err)
      showToast('❌ Có lỗi khi xoá ảnh: ' + (err?.message || 'Vui lòng thử lại'), 'delete')
    } finally {
      setBusy(false)
    }
  }

  const removeExistingImage = async (imgIdx: number) => {
    if (!editing) return
    await deleteImageFromEvent(editing, imgIdx)
  }

  const removePendingItem = (id: string) => {
    setPendingMedia((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.previewUrl) {
        try {
          URL.revokeObjectURL(target.previewUrl)
        } catch {}
      }
      return prev.filter((p) => p.id !== id)
    })
  }

  const handlePendingFileSelection = (files: FileList | null) => {
    if (!files || !files.length) return
    const fileArray = Array.from(files)

    const existingFingerprints = new Set(pendingMedia.map((p) => p.fingerprint))

    const existingMediaNames = new Set<string>()
    if (editing) {
      const curImages = editing.images && editing.images.length ? editing.images : (editing.image_url ? [editing.image_url] : [])
      const curPaths = editing.image_paths && editing.image_paths.length ? editing.image_paths : (editing.image_path ? [editing.image_path] : [])
      for (const p of curPaths) {
        const base = p.split('/').pop()?.toLowerCase()
        if (base) existingMediaNames.add(base)
      }
      for (const u of curImages) {
        const clean = u.split('?')[0]
        const base = clean.split('/').pop()?.toLowerCase()
        if (base) existingMediaNames.add(base)
      }
    }

    const newItems: PendingMediaItem[] = []
    let duplicateCount = 0

    for (const file of fileArray) {
      const fp = getMediaFingerprint(file)
      if (existingFingerprints.has(fp)) {
        duplicateCount++
        continue
      }
      if (existingMediaNames.has(file.name.toLowerCase())) {
        duplicateCount++
        continue
      }

      existingFingerprints.add(fp)
      const isVid = isVideoFile(file)
      let previewUrl = ''
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        try {
          previewUrl = URL.createObjectURL(file)
        } catch {
          previewUrl = ''
        }
      }

      newItems.push({
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl,
        fingerprint: fp,
        isVid,
      })
    }

    if (duplicateCount > 0) {
      showToast(`ℹ️ Đã tự động bỏ qua ${duplicateCount} ảnh/video trùng lặp`)
    }

    if (newItems.length > 0) {
      setPendingMedia((prev) => [...prev, ...newItems])
    }
  }

  const eventForm = (
    <>
      <label>
        Thông tin sự kiện
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ví dụ: Lần đầu đi Đà Lạt (để trống tự đặt theo ngày)"
          autoFocus
        />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ flex: 1 }}>
          Ngày
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </label>
        <label style={{ flex: 1 }}>
          Giờ
          <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
        </label>
      </div>
      <label>
        Kể thêm
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Hôm đó thế nào…" />
      </label>

      {/* Vị trí ít dùng nên giấu sau nút này cho gọn. */}
      <button type="button" className="eyebrow" onClick={() => setShowExtra((v) => !v)} style={{ alignSelf: 'flex-start' }}>
        {showExtra ? '− ' : '+ '}Thông tin thêm
      </button>
      {showExtra && (
        <label>
          Vị trí
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ở đâu?" />
        </label>
      )}

      {/* Chọn nhiều ảnh & video từ bộ sưu tập */}
      <div style={{ marginTop: 8 }}>
        <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6, display: 'block' }}>
          Ảnh & Video kỷ niệm (chọn nhiều file)
        </label>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Chọn nhiều ảnh từ bộ sưu tập"
          onChange={(e) => {
            handlePendingFileSelection(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          aria-label="Chọn nhiều video từ bộ sưu tập"
          onChange={(e) => {
            handlePendingFileSelection(e.target.files)
            e.target.value = ''
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            style={{
              padding: '10px 8px',
              fontSize: '0.82rem',
              border: '1px dashed var(--primary)',
              borderRadius: 10,
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <ImagePlus size={16} /> Chọn ảnh (nhiều ảnh)
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            style={{
              padding: '10px 8px',
              fontSize: '0.82rem',
              border: '1px dashed #8b5cf6',
              borderRadius: 10,
              background: 'rgba(139, 92, 246, 0.08)',
              color: '#8b5cf6',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <Video size={16} /> Chọn video (nhiều video)
          </button>
        </div>

        {/* Tiến trình xử lý media: nén/tải lên -> lưu kèm nút Dừng */}
        {progress && (
          <div className="photo-progress" role="status" aria-live="polite">
            <div className="photo-progress-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                <Loader2 size={14} className="photo-progress-spin" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {PHASE_LABEL[progress.phase]}
                  {progress.total > 0 && progress.phase !== 'save' ? ` ${Math.min(progress.done + 1, progress.total)}/${progress.total}` : '…'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  abortUploadRef.current = true
                }}
                className="photo-progress-stop-btn"
                title="Dừng tải lên (vẫn giữ các ảnh đã tải xong)"
              >
                <X size={12} /> Dừng tải
              </button>
            </div>
            <div className="photo-progress-bar">
              <i style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 100}%` }} />
            </div>
            <span className="photo-progress-hint">Ảnh tải đến đâu sẽ lưu ngay đến đó. Bấm "Dừng tải" bất cứ lúc nào để giữ các ảnh đã lưu.</span>
          </div>
        )}

        {/* Xem trước ảnh & video mới chọn chuẩn bị lưu */}
        {pendingMedia.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Ảnh & Video đã chọn ({pendingMedia.length}):
              </span>
              {pendingMedia.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    revokeAllPreviews(pendingMedia)
                    setPendingMedia([])
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Xoá tất cả
                </button>
              )}
            </div>
            <div className="photo-preview-grid">
              {pendingMedia.map((item) => (
                <div key={item.id} className="photo-preview-item">
                  {item.isVid ? (
                    <>
                      {item.previewUrl ? (
                        <video src={item.previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#888' }}>
                          <Video size={18} />
                        </div>
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          left: 2,
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          borderRadius: 3,
                          padding: '1px 3px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Video size={10} />
                      </div>
                    </>
                  ) : (
                    <img
                      src={item.previewUrl}
                      alt=""
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removePendingItem(item.id)}
                    title="Bỏ tệp này"
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 18,
                      height: 18,
                      padding: 0,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )

  const partnerDisplayName = personName || 'Người yêu'

  const renderMemoryCard = (ev: SharedEvent, i: number) => {
    const mine = ev.owner_id === myId
    const allImages = ev.images && ev.images.length ? ev.images : (ev.image_url ? [ev.image_url] : [])
    return (
      <article
        key={ev.id}
        className="memory-card"
        onClick={() => {
          setSelectedImageIdx(0)
          setViewing(ev)
        }}
      >
        <time className={`memory-date memory-date-${i % 5}`} dateTime={ev.event_date}>
          <strong>{ev.event_date.slice(8, 10)}</strong>
          <span>Thg {Number(ev.event_date.slice(5, 7))}</span>
        </time>
        {allImages.length > 0 && (
          <div className="memory-thumb">
            {isMediaVideo(allImages[0]) ? (
              <>
                <video
                  src={allImages[0]}
                  poster={getVideoPosterUrl(allImages[0])}
                  preload="metadata"
                  muted
                  playsInline
                />
                <div className="memory-thumb-badge">
                  <Video size={10} />
                </div>
              </>
            ) : (
              <SafeMediaImage src={allImages[0]} alt="" />
            )}
            {allImages.length > 1 && (
              <span>
                +{allImages.length - 1}
              </span>
            )}
          </div>
        )}

        <div className="memory-card-body">
          <div className="memory-card-title">
            <strong>{ev.title}</strong>
            {!mine && (
              <span className="memory-partner">
                {partnerDisplayName}
              </span>
            )}
          </div>
          <div className="memory-card-meta">
            {viDate(ev.event_date)}{ev.event_time ? ` · ${ev.event_time}` : ''}
          </div>
          {ev.location && (
            <div className="memory-location">
              <MapPin size={11} /> {ev.location}
            </div>
          )}
          {ev.note && <p>{ev.note}</p>}
        </div>

        <div className="memory-card-actions">
          <button
            className="memory-icon"
            aria-label={`${ev.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'} ${ev.title}`}
            aria-pressed={!!ev.is_favorite}
            onClick={(e) => {
              e.stopPropagation()
              toggleFavorite(ev)
            }}
          >
            <Heart size={16} fill={ev.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            className="memory-icon"
            aria-label={`Sửa ${ev.title}`}
            onClick={(e) => {
              e.stopPropagation()
              openEdit(ev)
            }}
          >
            <MoreVertical size={17} />
          </button>
        </div>
      </article>
    )
  }

  return (
    <section className="memory-view">
      <div className="memory-actions">
        <button
          className="memory-add"
          onClick={openAdd}
        >
          <Plus size={15} /> Thêm kỷ niệm
        </button>

        {isPartner && (
          onSendInvite ? (
            <button
              onClick={onSendInvite}
              className="memory-invite"
              title="Gửi lời mời kết nối kỷ niệm"
            >
              <Mail size={15} /> Mời kết nối
            </button>
          ) : (
            <button
              onClick={() => setManagePartners(true)}
              className="memory-invite"
            >
              <UserPlus size={15} /> Người chung ({partners.items.length})
            </button>
          )
        )}
      </div>

      {anniversaries.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 12, borderColor: 'var(--rose)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.88rem', color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarHeart size={15} /> Ngày này những năm trước ({anniversaries.length})
          </h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {anniversaries.map(({ event, monthsAgo }) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setViewing(event)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: 0, background: 'var(--bg-main)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--rose)', flexShrink: 0 }}>{yearsAgoLabel(monthsAgo)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {event.title}
                </span>
                {event.image_url && <img src={event.image_url} alt="" loading="lazy" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover' }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {isPartner && roomCode && (
        <div className="memory-room">
          <span>Phòng kỷ niệm chung</span>
          <strong>{roomCode}</strong>
        </div>
      )}

      {/* Thanh điều khiển chế độ xem: Dạng tháng vs Danh sách timeline */}
      <div className="memory-controls-row">
        <div className="mem-view-toggle">
          <button
            type="button"
            className={!showMemoryBook && viewMode === 'month' ? 'active' : ''}
            onClick={() => {
              setShowMemoryBook(false)
              setViewMode('month')
            }}
            title="Xem theo dạng tháng"
          >
            <CalendarDays size={14} /> <span>12 Tháng</span>
          </button>
          <button
            type="button"
            className={!showMemoryBook && viewMode === 'timeline' ? 'active' : ''}
            onClick={() => {
              setShowMemoryBook(false)
              setViewMode('timeline')
            }}
            title="Xem dạng danh sách timeline"
          >
            <List size={14} /> <span>Danh sách</span>
          </button>
          <button
            type="button"
            className={`mem-view-book-btn ${showMemoryBook && memoryBookMode === 'book' ? 'active' : ''}`}
            onClick={() => {
              setMemoryBookMode('book')
              setShowMemoryBook(true)
            }}
            title="Mở Sách Kỷ niệm 3D: Album lật sách 3D chân thực"
            style={{
              color: '#d97706',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <BookOpen size={14} /> <span>📖 Sách 3D</span>
          </button>
          <button
            type="button"
            className={`mem-view-tree-btn ${showMemoryBook && memoryBookMode === 'tree' ? 'active' : ''}`}
            onClick={() => {
              setMemoryBookMode('tree')
              setShowMemoryBook(true)
            }}
            title="Mở Cây Kỷ niệm 3D: Cây hoa anh đào 3D 12 tháng xoay 360 độ"
            style={{
              color: '#e11d48',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <TreePine size={14} /> <span>🌸 Cây 3D</span>
          </button>
        </div>

        {viewMode === 'timeline' && (
          <div className="memory-filters" style={{ margin: 0, flex: 1, minWidth: 200, justifyContent: 'flex-end' }}>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              aria-label="Lọc theo năm"
            >
              <option value="ALL">🗓️ Tất cả năm</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>

            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              aria-label="Lọc theo tháng"
            >
              <option value="ALL">📅 Tất cả tháng</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={String(m)}>
                  Tháng {m}
                </option>
              ))}
            </select>

            {(filterYear !== 'ALL' || filterMonth !== 'ALL') && (
              <button
                type="button"
                className="memory-reset"
                onClick={() => {
                  setFilterYear('ALL')
                  setFilterMonth('ALL')
                }}
                title="Xoá bộ lọc"
                aria-label="Xoá bộ lọc"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {events.loading ? (
        <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải sự kiện…</p>
      ) : !sorted.length ? (
        <Empty icon={CalendarHeart} colorClass="icon-box-rose">
          {isPartner
            ? 'Chưa có sự kiện chung nào trong phòng. Thêm kỷ niệm đầu tiên nhé!'
            : `Chưa có kỷ niệm nào với ${partnerDisplayName}. Thêm kỷ niệm đầu tiên nhé!`}
        </Empty>
      ) : viewMode === 'month' ? (
        /* ===== GIAO DIỆN THEO THÁNG ===== */
        <div>
          {/* Thanh chọn nhanh các tháng có kỷ niệm */}
          <div className="mem-month-pills-bar">
            <button
              type="button"
              className={`mem-month-pill ${selectedMonthKey === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setSelectedMonthKey('ALL')
                setSelectedCalDay(null)
              }}
            >
              <span>Tất cả tháng</span>
              <span className="mem-month-pill-badge">{sorted.length}</span>
            </button>
            {monthGroups.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`mem-month-pill ${selectedMonthKey === g.key ? 'active' : ''}`}
                onClick={() => {
                  setSelectedMonthKey(g.key)
                  setSelectedCalDay(null)
                }}
              >
                <span>Thg {g.month}/{g.year}</span>
                <span className="mem-month-pill-badge">{g.events.length}</span>
              </button>
            ))}
          </div>

          {selectedMonthKey !== 'ALL' && activeMonthGroup ? (
            /* Xem chi tiết 1 tháng cụ thể */
            <div>
              <div className="mem-month-header-bar">
                <div className="mem-month-header-title">
                  <strong>Tháng {activeMonthGroup.month}, {activeMonthGroup.year}</strong>
                  <span>{activeMonthGroup.events.length} kỷ niệm · {activeMonthGroup.totalPhotos} khoảnh khắc</span>
                </div>
                <div className="mem-month-nav-btns">
                  <button
                    type="button"
                    className="mem-month-nav-btn"
                    onClick={goPrevMonth}
                    disabled={!hasPrevMonth}
                    title="Tháng trước đó"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="mem-month-nav-btn"
                    onClick={goNextMonth}
                    disabled={!hasNextMonth}
                    title="Tháng tiếp theo"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Lưới mini calendar trực quan */}
              <div className="mem-mini-calendar">
                <div className="mem-cal-grid-header">
                  <span>T2</span>
                  <span>T3</span>
                  <span>T4</span>
                  <span>T5</span>
                  <span>T6</span>
                  <span>T7</span>
                  <span>CN</span>
                </div>
                <div className="mem-cal-grid">
                  {calendarDays.map((cell, idx) => {
                    if (cell.dayNum === null) {
                      return <div key={`empty-${idx}`} className="mem-cal-cell empty" />
                    }
                    const isSelected = selectedCalDay === cell.dateStr
                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        className={`mem-cal-cell ${cell.hasEvents ? 'has-memory' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          if (cell.hasEvents && cell.dateStr) {
                            setSelectedCalDay(isSelected ? null : cell.dateStr)
                          }
                        }}
                        disabled={!cell.hasEvents}
                        title={cell.hasEvents ? `${cell.dayNum}/${activeMonthGroup.month}: ${cell.events.length} kỷ niệm (${cell.photosCount} ảnh)` : undefined}
                      >
                        <span>{cell.dayNum}</span>
                        {cell.hasEvents && <div className="mem-cal-dot" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tag lọc theo ngày được chọn */}
              {selectedCalDay && (
                <div className="mem-day-filter-badge">
                  <span>Đang lọc: Ngày {selectedCalDay.slice(8, 10)}/{selectedCalDay.slice(5, 7)}/{selectedCalDay.slice(0, 4)}</span>
                  <button type="button" onClick={() => setSelectedCalDay(null)} title="Hiện cả tháng">
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Danh sách kỷ niệm của tháng */}
              <div className="memory-list">
                {activeMonthGroup.events
                  .filter((e) => !selectedCalDay || e.event_date === selectedCalDay)
                  .map((ev, i) => renderMemoryCard(ev, i))}
              </div>
            </div>
          ) : (
            /* Gom nhóm theo tất cả các tháng */
            <div style={{ display: 'grid', gap: 14 }}>
              {monthGroups.map((g) => (
                <div key={g.key} className="mem-month-section">
                  <div className="mem-month-group-header">
                    <strong><CalendarDays size={14} /> Tháng {g.month}, {g.year}</strong>
                    <span>{g.events.length} kỷ niệm · {g.totalPhotos} ảnh</span>
                  </div>
                  <div className="memory-list">
                    {g.events.map((ev, i) => renderMemoryCard(ev, i))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : !filtered.length ? (
        <Empty icon={Filter} colorClass="icon-box-amber">
          Không tìm thấy kỷ niệm nào trong thời gian đã chọn.
        </Empty>
      ) : (
        <div className="memory-list">
          {filtered.map((ev, i) => renderMemoryCard(ev, i))}
        </div>
      )}

      {viewingEvent && (
        <Modal
          className="mem-detail-modal"
          hideHeader={true}
          onClose={() => setViewing(null)}
        >
          {(() => {
            const allImages = viewingEvent.images && viewingEvent.images.length
              ? viewingEvent.images
              : (viewingEvent.image_url ? [viewingEvent.image_url] : [])

            return (
              <>
                {/* 1. THANH TIÊU ĐỀ & NÚT BACK / ĐÓNG */}
              {isGridView ? (
                /* CHẾ ĐỘ XEM LƯỚI TOÀN BỘ ẢNH CHUẨN NATIVE GALLERY (3 CỘT VUÔNG VẮN NHƯ GOOGLE PHOTOS) */
                <>
                  <div className="mem-detail-head">
                    <div className="mem-detail-head-left">
                      <button
                        type="button"
                        className="mem-detail-back-btn"
                        onClick={() => setIsGridView(false)}
                        title="Quay lại xem từng ảnh"
                        aria-label="Quay lại"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <h3 className="mem-detail-title">
                        {viewingEvent.title || 'Kỷ niệm'}
                      </h3>
                      <span
                        className="eyebrow"
                        style={{
                          margin: 0,
                          padding: '2px 8px',
                          fontSize: '0.7rem',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          borderRadius: 8,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {allImages.length} ảnh
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon"
                      onClick={() => setViewing(null)}
                      title="Đóng"
                      aria-label="Đóng"
                      style={{ padding: 4 }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* LƯỚI 3 CỘT CHUẨN ĐẸP 100% NHƯ SAMSUNG GALLERY / GOOGLE PHOTOS */}
                  <div className="mem-gallery-grid-scroll">
                    <div className="mem-gallery-grid-track">
                      {allImages.map((mediaUrl, idx) => {
                        const isVid = isMediaVideo(mediaUrl)
                        const isSelected = idx === selectedImageIdx
                        return (
                          <div
                            key={idx}
                            className={`mem-gallery-grid-thumb ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedImageIdx(idx)
                              setFullscreenIdx(idx)
                            }}
                            title={`Ảnh ${idx + 1} — Nhấn để xem toàn màn hình`}
                            role="button"
                            tabIndex={0}
                          >
                            {isVid ? (
                              <>
                                <video
                                  src={mediaUrl}
                                  poster={getVideoPosterUrl(mediaUrl)}
                                  preload="metadata"
                                  muted
                                  playsInline
                                />
                                <span className="mem-gallery-grid-vid-badge">
                                  <Video size={11} />
                                </span>
                              </>
                            ) : (
                              <SafeMediaImage src={mediaUrl} alt="" loading="lazy" />
                            )}
                            <button
                              type="button"
                              className="mem-gallery-grid-del-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteImageFromEvent(viewingEvent, idx)
                              }}
                              title={`Xoá ảnh ${idx + 1} này khỏi Supabase`}
                              aria-label={`Xoá ảnh ${idx + 1}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : (
                /* CHẾ ĐỘ XEM CHI TIẾT TỪNG ẢNH (SLIDESHOW) */
                <>
                  <div className="mem-detail-head">
                    <div className="mem-detail-head-left">
                      <button
                        type="button"
                        className="mem-detail-back-btn"
                        onClick={() => setViewing(null)}
                        title="Quay lại"
                        aria-label="Quay lại"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <h3 className="mem-detail-title">{viewingEvent.title}</h3>
                      {viewingEvent.owner_id !== myId && (
                        <span
                          className="eyebrow"
                          style={{
                            margin: 0,
                            padding: '2px 7px',
                            fontSize: '0.65rem',
                            background: 'var(--purple-bg)',
                            color: 'var(--purple)',
                            borderRadius: 6,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {partnerDisplayName}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="icon"
                      onClick={() => setViewing(null)}
                      title="Đóng"
                      aria-label="Đóng"
                      style={{ padding: 4 }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* KHUNG ẢNH & VIDEO CO GIÃN THEO MÀN HÌNH */}
                  {allImages.length > 0 && (
                    <div className="mem-detail-gallery-wrap">
                      <div className="mem-gallery">
                        {/* Huy hiệu & nút thao tác nhanh phía trên ảnh */}
                        <div className="mem-gallery-top-badges">
                          <button
                            type="button"
                            className="mem-gallery-top-badge-btn"
                            onClick={() => setFullscreenIdx(selectedImageIdx)}
                            title="Xem toàn màn hình"
                          >
                            <Maximize2 size={12} /> Toàn màn hình
                          </button>
                          {allImages.length > 1 && (
                            <button
                              type="button"
                              className="mem-gallery-top-badge-btn grid-pill"
                              onClick={() => setIsGridView(true)}
                              title="Xem toàn bộ ảnh dạng lưới"
                            >
                              <LayoutGrid size={12} /> Lưới ảnh ({allImages.length})
                            </button>
                          )}
                          <button
                            type="button"
                            className="mem-gallery-top-badge-btn danger"
                            onClick={() => deleteImageFromEvent(viewingEvent, selectedImageIdx)}
                            title={`Xoá ảnh ${selectedImageIdx + 1} này khỏi Supabase`}
                          >
                            <Trash2 size={12} /> Xoá ảnh này
                          </button>
                        </div>

                        {/* Nút mũi tên chuyển ảnh trái / phải */}
                        {allImages.length > 1 && (
                          <>
                            {selectedImageIdx > 0 && (
                              <button
                                type="button"
                                className="mem-gallery-nav-btn prev"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const nextIdx = selectedImageIdx - 1
                                  setSelectedImageIdx(nextIdx)
                                  const track = galleryRef.current
                                  track?.scrollTo({ left: nextIdx * track.clientWidth, behavior: 'smooth' })
                                }}
                                title="Ảnh trước"
                              >
                                <ChevronLeft size={18} />
                              </button>
                            )}
                            {selectedImageIdx < allImages.length - 1 && (
                              <button
                                type="button"
                                className="mem-gallery-nav-btn next"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const nextIdx = selectedImageIdx + 1
                                  setSelectedImageIdx(nextIdx)
                                  const track = galleryRef.current
                                  track?.scrollTo({ left: nextIdx * track.clientWidth, behavior: 'smooth' })
                                }}
                                title="Ảnh tiếp theo"
                              >
                                <ChevronRight size={18} />
                              </button>
                            )}
                          </>
                        )}

                        {/* Vuốt ngang để đổi ảnh; mỗi ảnh chiếm trọn bề ngang khung */}
                        <div
                          className="mem-gallery-track"
                          ref={galleryRef}
                          onScroll={(e) => {
                            const el = e.currentTarget
                            const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
                            if (idx !== selectedImageIdx) setSelectedImageIdx(idx)
                          }}
                        >
                          {allImages.map((mediaUrl, idx) => {
                            const isVid = isMediaVideo(mediaUrl)
                            return (
                              <div
                                className="mem-gallery-slide"
                                key={idx}
                                onClick={() => setFullscreenIdx(idx)}
                                title="Nhấn để xem toàn màn hình"
                              >
                                {isVid ? (
                                  <video
                                    src={mediaUrl}
                                    poster={getVideoPosterUrl(mediaUrl)}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <SafeMediaImage src={mediaUrl} alt={`${viewingEvent.title} — ${idx + 1}`} loading="lazy" />
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {allImages.length > 1 && (
                          <>
                            <span className="mem-gallery-count">
                              {selectedImageIdx + 1}/{allImages.length}
                            </span>
                            <div className="mem-gallery-dots">
                              {allImages.map((_, idx) => (
                                <i key={idx} className={idx === selectedImageIdx ? 'on' : undefined} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* THÔNG TIN NGÀY GIỜ, VỊ TRÍ, GHI CHÚ */}
                  <div className="mem-detail-info-wrap">
                    <div className="mem-detail-meta-row">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CalendarDays size={13} style={{ color: 'var(--purple)' }} />
                        <strong style={{ color: 'var(--text-main)' }}>{viDate(viewingEvent.event_date)}</strong>
                        {viewingEvent.event_time && <span>· {viewingEvent.event_time}</span>}
                      </span>

                      {viewingEvent.location && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={13} style={{ color: 'var(--rose)' }} />
                          <span>{viewingEvent.location}</span>
                        </span>
                      )}
                    </div>

                    {viewingEvent.note && (
                      <div className="mem-detail-note">
                        {viewingEvent.note}
                      </div>
                    )}
                  </div>
                </>
              )}

                {/* 4. ĐÚNG 5 NÚT TRÊN 1 HÀNG NGANG KHÔNG CẦN CUỘN */}
                <div
                  className="mem-detail-actions-5"
                  style={{ gridTemplateColumns: allImages.length > 0 ? 'repeat(5, 1fr)' : 'repeat(3, 1fr)' }}
                >
                  <button
                    type="button"
                    className={`mem-detail-btn-compact fav ${viewingEvent.is_favorite ? 'active' : ''}`}
                    onClick={() => toggleFavorite(viewingEvent)}
                    title={viewingEvent.is_favorite ? 'Bỏ thích' : 'Yêu thích'}
                  >
                    <Heart size={14} fill={viewingEvent.is_favorite ? 'currentColor' : 'none'} />
                    <span>{viewingEvent.is_favorite ? 'Đã thích' : 'Thích'}</span>
                  </button>

                  {allImages.length > 0 && (
                    <button
                      type="button"
                      className="mem-detail-btn-compact fullscreen"
                      onClick={() => setFullscreenIdx(selectedImageIdx)}
                      title="Phóng to toàn màn hình"
                    >
                      <Maximize2 size={14} />
                      <span>Phóng to</span>
                    </button>
                  )}

                  {allImages.length > 0 && (
                    <button
                      type="button"
                      className={`mem-detail-btn-compact grid ${isGridView ? 'active' : ''}`}
                      onClick={() => setIsGridView((prev) => !prev)}
                      title={isGridView ? 'Quay lại xem ảnh' : 'Xem toàn bộ ảnh dạng lưới'}
                    >
                      <LayoutGrid size={14} />
                      <span>{isGridView ? 'Đóng lưới' : 'Lưới'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="mem-detail-btn-compact edit"
                    onClick={() => {
                      const evToEdit = viewingEvent
                      setViewing(null)
                      openEdit(evToEdit)
                    }}
                    title="Chỉnh sửa sự kiện"
                  >
                    <Pencil size={14} />
                    <span>Sửa</span>
                  </button>

                  <button
                    type="button"
                    className="mem-detail-btn-compact delete"
                    onClick={async () => {
                      if (!confirm('Xoá kỷ niệm này? App không thể hoàn tác.')) return
                      await deleteEvent(viewingEvent.id)
                      setViewing(null)
                    }}
                    title="Xoá sự kiện"
                  >
                    <Trash2 size={14} />
                    <span>Xoá</span>
                  </button>
                </div>
              </>
            )
          })()}
        </Modal>
      )}

      {adding && (
        <Modal
          title="Sự kiện chung mới"
          onClose={() => {
            abortUploadRef.current = true
            setAdding(false)
            resetForm()
          }}
        >
          {eventForm}
          <div className="modal-actions">
            <button className="primary" onClick={createEvent} disabled={busy}>
              {busy
                ? progress
                  ? `${PHASE_LABEL[progress.phase]}…`
                  : 'Đang lưu…'
                : 'Lưu sự kiện'}
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          title="Sửa sự kiện"
          onClose={() => {
            abortUploadRef.current = true
            setEditing(null)
            resetForm()
          }}
        >
          {eventForm}

          {/* Danh sách ảnh & video hiện tại của sự kiện */}
          {(() => {
            const currentImages = editing.images && editing.images.length ? editing.images : (editing.image_url ? [editing.image_url] : [])
            if (!currentImages.length) return null
            return (
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Ảnh & Video đã lưu ({currentImages.length}):</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {currentImages.map((url, idx) => {
                    const isVid = isMediaVideo(url)
                    return (
                      <div key={idx} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
                        {isVid ? (
                          <>
                            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                            <div style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 3, padding: '1px 3px', display: 'flex', alignItems: 'center' }}>
                              <Video size={10} />
                            </div>
                          </>
                        ) : (
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        <button
                          type="button"
                          onClick={() => removeExistingImage(idx)}
                          title="Xoá file này"
                          style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, padding: 0, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.85)', color: '#fff', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <div className="modal-actions">
            <DeleteButton onDelete={() => deleteEvent(editing.id)} />
            <button className="primary" onClick={saveEvent} disabled={busy}>
              {busy ? (progress ? `${PHASE_LABEL[progress.phase]}…` : 'Đang lưu…') : 'Lưu thay đổi'}
            </button>
          </div>
        </Modal>
      )}

      {managePartners && (
        <Modal title="Người xem chung" onClose={() => setManagePartners(false)}>
          <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
            Thêm Gmail của người kia để họ xem được sự kiện của bạn. Muốn thấy sự kiện của họ thì họ cũng phải thêm Gmail của bạn.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPartner()}
              placeholder="ten@gmail.com"
              type="email"
              aria-label="Gmail người chung"
              style={{ flex: 1 }}
            />
            <button className="primary" onClick={addPartner}>Thêm</button>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {partners.items.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-main)', borderRadius: 8, padding: '6px 10px' }}>
                <span style={{ flex: 1, fontSize: '0.82rem' }}>{p.partner_email}</span>
                <button className="icon small danger" aria-label={`Gỡ ${p.partner_email}`} onClick={() => removePartner(p.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ─── FULLSCREEN LIGHTBOX (XEM TOÀN MÀN HÌNH ẢNH & VIDEO) ─── */}
      {fullscreenIdx !== null && (viewingEvent || viewing) && (() => {
        const curEvent = viewingEvent || viewing!
        const allImages = curEvent.images && curEvent.images.length
          ? curEvent.images
          : (curEvent.image_url ? [curEvent.image_url] : [])

        if (!allImages.length) return null

        return (
          <div className="mem-lightbox" role="dialog" aria-modal="true">
            <div className="mem-lightbox-topbar">
              <div className="mem-lightbox-title">
                <strong>{curEvent.title}</strong>
                <span>{viDate(curEvent.event_date)} {curEvent.event_time ? `· ${curEvent.event_time}` : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {allImages.length > 1 && (
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 20 }}>
                    {fullscreenIdx + 1} / {allImages.length}
                  </span>
                )}
                {/* Nút xoá ảnh Supabase từng ảnh trực tiếp từ Lightbox */}
                <button
                  type="button"
                  className="mem-lightbox-action-btn danger"
                  onClick={() => deleteImageFromEvent(curEvent, fullscreenIdx)}
                  title={`Xoá ảnh ${fullscreenIdx + 1} này khỏi Supabase`}
                  aria-label={`Xoá ảnh ${fullscreenIdx + 1}`}
                >
                  <Trash2 size={18} />
                </button>
                <button
                  type="button"
                  className="mem-lightbox-close"
                  onClick={() => setFullscreenIdx(null)}
                  title="Đóng toàn màn hình (Esc)"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Mũi tên trái / phải */}
            {allImages.length > 1 && (
              <>
                {fullscreenIdx > 0 && (
                  <button
                    type="button"
                    className="mem-gallery-nav-btn prev"
                    style={{ left: 16, width: 44, height: 44, zIndex: 35 }}
                    onClick={() => {
                      const next = fullscreenIdx - 1
                      setFullscreenIdx(next)
                      isProgrammaticScrollRef.current = true
                      const w = lightboxTrackRef.current?.clientWidth || window.innerWidth
                      lightboxTrackRef.current?.scrollTo({ left: next * w, behavior: 'smooth' })
                      setTimeout(() => { isProgrammaticScrollRef.current = false }, 300)
                    }}
                  >
                    <ChevronLeft size={26} />
                  </button>
                )}
                {fullscreenIdx < allImages.length - 1 && (
                  <button
                    type="button"
                    className="mem-gallery-nav-btn next"
                    style={{ right: 16, width: 44, height: 44, zIndex: 35 }}
                    onClick={() => {
                      const next = fullscreenIdx + 1
                      setFullscreenIdx(next)
                      isProgrammaticScrollRef.current = true
                      const w = lightboxTrackRef.current?.clientWidth || window.innerWidth
                      lightboxTrackRef.current?.scrollTo({ left: next * w, behavior: 'smooth' })
                      setTimeout(() => { isProgrammaticScrollRef.current = false }, 300)
                    }}
                  >
                    <ChevronRight size={26} />
                  </button>
                )}
              </>
            )}

            {/* Slide track toàn màn hình */}
            <div
              className="mem-lightbox-track"
              ref={(node) => {
                lightboxTrackRef.current = node
                if (node && fullscreenIdx !== null) {
                  isProgrammaticScrollRef.current = true
                  const width = node.clientWidth || window.innerWidth
                  node.scrollLeft = fullscreenIdx * width
                  requestAnimationFrame(() => {
                    if (node && fullscreenIdx !== null) {
                      const finalWidth = node.clientWidth || window.innerWidth
                      node.scrollLeft = fullscreenIdx * finalWidth
                      setTimeout(() => {
                        isProgrammaticScrollRef.current = false
                      }, 150)
                    }
                  })
                }
              }}
              onScroll={(e) => {
                if (isProgrammaticScrollRef.current) return
                const el = e.currentTarget
                const width = el.clientWidth || window.innerWidth
                if (width <= 0) return
                const idx = Math.round(el.scrollLeft / width)
                if (idx !== fullscreenIdx && idx >= 0 && idx < allImages.length) {
                  setFullscreenIdx(idx)
                  setSelectedImageIdx(idx)
                }
              }}
            >
              {allImages.map((mediaUrl, idx) => {
                const isVid = isMediaVideo(mediaUrl)
                return (
                  <div className="mem-lightbox-slide" key={idx}>
                    {isVid ? (
                      <video
                        src={mediaUrl}
                        poster={getVideoPosterUrl(mediaUrl)}
                        controls
                        autoPlay={idx === fullscreenIdx}
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <SafeMediaImage src={mediaUrl} alt={`${curEvent.title} — ảnh ${idx + 1}`} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Dải thumbnail dưới đáy */}
            {allImages.length > 1 && (
              <div className="mem-lightbox-bottom">
                <div className="mem-gallery-thumbs" style={{ justifyContent: 'center' }}>
                  {allImages.map((mediaUrl, idx) => {
                    const isVid = isMediaVideo(mediaUrl)
                    return (
                      <div
                        key={idx}
                        className={`mem-gallery-thumb-item ${idx === fullscreenIdx ? 'on' : ''}`}
                        onClick={() => {
                          setFullscreenIdx(idx)
                          setSelectedImageIdx(idx)
                          isProgrammaticScrollRef.current = true
                          const w = lightboxTrackRef.current?.clientWidth || window.innerWidth
                          lightboxTrackRef.current?.scrollTo({ left: idx * w, behavior: 'smooth' })
                          setTimeout(() => { isProgrammaticScrollRef.current = false }, 300)
                        }}
                      >
                        {isVid ? (
                          <>
                            <video
                              src={mediaUrl}
                              poster={getVideoPosterUrl(mediaUrl)}
                              preload="metadata"
                              muted
                              playsInline
                            />
                            <span className="mem-gallery-thumb-badge">
                              <Video size={8} />
                            </span>
                          </>
                        ) : (
                          <SafeMediaImage src={mediaUrl} alt="" loading="lazy" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Quyển sách Kỷ niệm 3D & Cây 3D riêng biệt (Có nút Back) ── */}
      {showMemoryBook && (
        <MemoryBookView
          events={sorted}
          personName={partnerDisplayName}
          roomCode={roomCode}
          initialViewMode={memoryBookMode}
          onClose={() => setShowMemoryBook(false)}
        />
      )}
    </section>
  )
}
