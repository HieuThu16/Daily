import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, CalendarDays, CalendarHeart, ChevronLeft, ChevronRight,
  Filter, Heart, ImagePlus, Mail, MapPin, Maximize2,
  MoreVertical, Pencil, Plus, RotateCcw, Trash2,
  UserPlus, Video, Loader2, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { anniversariesOn, yearsAgoLabel } from '../../lib/anniversary'
import type { SharedEvent, SharedPartner } from '../../types'
import { DeleteButton, Empty, Modal, useQuery } from '../shared'
import { useToast } from '../ToastContext'
import { notifyPartner } from '../../lib/push'
import { compressForUpload } from '../../lib/photo'

const PHOTO_BUCKET = 'daily-photos'

/** Nhận biết URL có phải là video hay không */
export function isMediaVideo(url?: string | null): boolean {
  if (!url) return false
  if (url.startsWith('data:video/')) return true
  const clean = url.split('?')[0].toLowerCase()
  return /\.(mp4|webm|mov|m4v|mkv|avi|3gp|ogv)$/.test(clean)
}

/** Nhận biết File có phải là video hay không */
export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi', '3gp', 'ogv'].includes(ext || '')
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
  const galleryRef = useRef<HTMLDivElement>(null)
  const lightboxTrackRef = useRef<HTMLDivElement>(null)

  const [partnerEmail, setPartnerEmail] = useState('')
  const [managePartners, setManagePartners] = useState(false)

  const [filterYear, setFilterYear] = useState<string>('ALL')
  const [filterMonth, setFilterMonth] = useState<string>('ALL')

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<PhotoProgress | null>(null)
  const [selectedImageIdx, setSelectedImageIdx] = useState<number>(0)
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null)

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
          lightboxTrackRef.current?.scrollTo({ left: prev * window.innerWidth, behavior: 'smooth' })
        }
      } else if (e.key === 'ArrowRight') {
        const curEvent = viewing || editing
        const all = curEvent?.images && curEvent.images.length ? curEvent.images : (curEvent?.image_url ? [curEvent.image_url] : [])
        if (all.length > 0) {
          const next = Math.min(all.length - 1, fullscreenIdx + 1)
          setFullscreenIdx(next)
          lightboxTrackRef.current?.scrollTo({ left: next * window.innerWidth, behavior: 'smooth' })
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

  const resetForm = () => {
    setTitle('')
    setNote('')
    setEventDate(localDate())
    setEventTime('')
    setLocation('')
    setShowExtra(false)
    setPendingFiles([])
    setSelectedImageIdx(0)
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
    setPendingFiles([])
    setSelectedImageIdx(0)
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

  const uploadMultipleMedia = async (
    folder: string,
    files: File[],
    onProgress?: (p: PhotoProgress) => void,
  ) => {
    if (!files.length) return { urls: [] as string[], paths: [] as string[], fellBack: 0 }
    const urls: string[] = []
    const paths: string[] = []
    /** Số ảnh/video không đẩy lên storage được, phải nhúng thẳng vào bản ghi. */
    let fellBack = 0

    for (const [index, file] of files.entries()) {
      let blobToUpload: Blob = file
      try {
        const isVid = isVideoFile(file)
        onProgress?.({ phase: isVid ? 'upload' : 'compress', done: index, total: files.length })

        let ext = file.name.split('.').pop()?.toLowerCase() || (isVid ? 'mp4' : 'jpg')

        if (!isVid) {
          // Nén trước: ảnh gốc từ máy ảnh 4-7MB, nén xong còn ~300KB.
          const compressed = await compressForUpload(file)
          blobToUpload = compressed.blob
          ext = compressed.ext
        }

        onProgress?.({ phase: 'upload', done: index, total: files.length })
        const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const path = `${folder}/${uuid}.${ext}`
        let uploadedUrl = ''

        if (supabase) {
          const contentType = file.type || (isVid ? 'video/mp4' : 'image/jpeg')
          const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blobToUpload, { upsert: true, contentType })
          if (!upErr) {
            const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
            if (pub?.publicUrl) {
              uploadedUrl = pub.publicUrl
            }
          } else {
            console.warn('Supabase storage upload error, fallback to data url:', upErr)
          }
        }

        if (!uploadedUrl) {
          // Nhúng thẳng vào bản ghi: nặng nhưng còn hơn mất ảnh. Có đếm để báo lại.
          uploadedUrl = await fileToDataUrl(blobToUpload)
          if (uploadedUrl) fellBack += 1
        }

        if (uploadedUrl) {
          urls.push(uploadedUrl)
          paths.push(path)
        }
      } catch (err) {
        console.error('Lỗi tải media:', err)
        const dataUrl = await fileToDataUrl(blobToUpload || file)
        if (dataUrl) {
          urls.push(dataUrl)
          paths.push('')
          fellBack += 1
        }
      }
    }
    onProgress?.({ phase: 'upload', done: files.length, total: files.length })
    return { urls, paths, fellBack }
  }

  const createEvent = async () => {
    if (!title.trim() && !note.trim() && pendingFiles.length === 0) {
      showToast('Vui lòng nhập tên sự kiện hoặc đính kèm ảnh/video', 'delete')
      return
    }
    setBusy(true)

    try {
      let urls: string[] = []
      let paths: string[] = []
      let fellBack = 0
      if (pendingFiles.length > 0) {
        const res = await uploadMultipleMedia(eventDate, pendingFiles, setProgress)
        urls = res.urls
        paths = res.paths
        fellBack = res.fellBack
      }
      setProgress({ phase: 'save', done: pendingFiles.length, total: pendingFiles.length })

      const firstUrl = urls[0] || null
      const firstPath = paths[0] || null

      const basePayload = {
        ...payload(),
        image_url: firstUrl,
        image_path: firstPath,
      }

      let created: SharedEvent | null = null

      if (supabase) {
        if (urls.length > 0) {
          const fullPayload = {
            ...basePayload,
            images: urls,
            image_paths: paths,
          }
          const { data, error } = await supabase.from('shared_events').insert(fullPayload).select().single()
          if (error) {
            // Schema cũ chưa có cột mảng images, thử lại với basePayload.
            // Phải nói ra: nếu im lặng thì tải lại trang là mất sạch ảnh từ ảnh thứ hai.
            if (urls.length > 1) warnMissingImagesColumn(showToast)
            const retryRes = await supabase.from('shared_events').insert(basePayload).select().single()
            if (retryRes.data) {
              created = {
                ...(retryRes.data as SharedEvent),
                images: urls,
                image_paths: paths,
              }
            }
          } else if (data) {
            created = data as SharedEvent
          }
        } else {
          const { data } = await supabase.from('shared_events').insert(basePayload).select().single()
          if (data) {
            created = data as SharedEvent
          }
        }
      }

      // Không lưu được lên máy chủ: vẫn hiện ra để khỏi mất công gõ lại, nhưng phải
      // nói thẳng là chưa lưu — trước đây toast báo thành công rồi tải lại trang là mất.
      const savedRemotely = created !== null

      /*
       * Ảnh/video đã nằm trên storage trước khi insert. Insert hỏng mà cứ để đó thì mỗi
       * lần bấm thêm lại là một bộ media mới nằm lại vĩnh viễn — dọn ngay.
       */
      if (!savedRemotely && supabase) {
        const uploaded = paths.filter(Boolean)
        if (uploaded.length) {
          const { error: rmErr } = await supabase.storage.from(PHOTO_BUCKET).remove(uploaded)
          if (rmErr) console.warn('Không dọn được media của lần thêm hỏng:', rmErr)
        }
      }

      if (!created) {
        created = {
          id: `local-${Date.now()}`,
          owner_id: myId || 'local',
          ...basePayload,
          images: urls,
          image_paths: paths,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        } as SharedEvent
      }

      events.setItems((prev) => [created!, ...prev])

      if (savedRemotely) {
        void notifyPartner('Có kỷ niệm mới được chia sẻ', created.title, '/daily', `share-${created.id}`)
        // Nói rõ đã lưu được bao nhiêu ảnh/video
        const savedCount = urls.length
        const missing = pendingFiles.length - savedCount
        let message = savedCount > 0 ? `✅ Đã lưu kỷ niệm cùng ${savedCount} ảnh/video` : '✅ Đã lưu kỷ niệm'
        if (missing > 0) message += ` · ${missing} tệp không đọc được`
        if (fellBack > 0) message += ` · ${fellBack} tệp lưu kèm bản ghi (nặng hơn)`
        showToast(message)
      } else {
        showToast('⚠️ Chưa lưu được lên máy chủ — kỷ niệm chỉ hiện tạm, kiểm tra kết nối rồi thêm lại.', 'delete')
      }
      setAdding(false)
      resetForm()
    } catch (err: any) {
      console.error('Lỗi khi lưu kỷ niệm:', err)
      showToast('❌ Có lỗi khi lưu: ' + (err?.message || 'Vui lòng thử lại'), 'delete')
    } finally {
      setProgress(null)
      setBusy(false)
    }
  }

  const saveEvent = async () => {
    if (!editing) return
    setBusy(true)
    try {
      const next = payload()
      
      let currentImages = editing.images && editing.images.length ? [...editing.images] : (editing.image_url ? [editing.image_url] : [])
      let currentPaths = editing.image_paths && editing.image_paths.length ? [...editing.image_paths] : (editing.image_path ? [editing.image_path] : [])

      if (pendingFiles.length > 0) {
        const { urls, paths } = await uploadMultipleMedia(eventDate, pendingFiles, setProgress)
        currentImages = [...currentImages, ...urls]
        currentPaths = [...currentPaths, ...paths]
        setProgress({ phase: 'save', done: pendingFiles.length, total: pendingFiles.length })
      }

      const baseUpdateData = {
        ...next,
        image_url: currentImages[0] || null,
        image_path: currentPaths[0] || null,
      }

      const fullUpdateData = {
        ...baseUpdateData,
        images: currentImages,
        image_paths: currentPaths,
      }

      /*
       * Phải biết ĐÃ ghi được hay chưa, chứ không báo bừa: trước đây lần thử lại
       * hỏng cũng vẫn hiện "Đã cập nhật", tải lại trang mới biết là mất.
       */
      let savedRemotely = !supabase
      if (supabase) {
        const { error } = await supabase.from('shared_events').update(fullUpdateData).eq('id', editing.id)
        if (!error) {
          savedRemotely = true
        } else {
          // Schema cũ chưa có cột mảng images, thử lại với baseUpdateData
          if (currentImages.length > 1) warnMissingImagesColumn(showToast)
          const retry = await supabase.from('shared_events').update(baseUpdateData).eq('id', editing.id)
          savedRemotely = !retry.error
          if (retry.error) console.warn('Không cập nhật được kỷ niệm:', retry.error.message)
        }
      }

      const finalEvent = {
        ...editing,
        ...fullUpdateData,
      }
      events.setItems((prev) => prev.map((e) => (e.id === editing.id ? finalEvent : e)))
      if (savedRemotely) {
        const added = pendingFiles.length
        showToast(added > 0 ? `✅ Đã cập nhật kỷ niệm, thêm ${added} ảnh/video` : '✏️ Đã cập nhật kỷ niệm')
      } else {
        showToast('⚠️ Chưa lưu được thay đổi lên máy chủ — kiểm tra kết nối rồi thử lại.', 'delete')
      }
      setEditing(null)
      setViewing(null)
      resetForm()
    } catch (err: any) {
      console.error('Lỗi khi cập nhật kỷ niệm:', err)
      showToast('❌ Có lỗi khi cập nhật: ' + (err?.message || 'Vui lòng thử lại'), 'delete')
    } finally {
      setProgress(null)
      setBusy(false)
    }
  }

  const deleteEvent = async (id: string) => {
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

  const removeExistingImage = async (imgIdx: number) => {
    if (!editing) return
    const currentImages = editing.images && editing.images.length ? [...editing.images] : (editing.image_url ? [editing.image_url] : [])
    const currentPaths = editing.image_paths && editing.image_paths.length ? [...editing.image_paths] : (editing.image_path ? [editing.image_path] : [])

    const pathToDelete = currentPaths[imgIdx]
    if (pathToDelete && supabase) {
      try {
        await supabase.storage.from(PHOTO_BUCKET).remove([pathToDelete])
      } catch {
        // Ignored
      }
    }

    currentImages.splice(imgIdx, 1)
    currentPaths.splice(imgIdx, 1)

    const baseUpdateData = {
      image_url: currentImages[0] || null,
      image_path: currentPaths[0] || null,
    }

    const fullUpdateData = {
      ...baseUpdateData,
      images: currentImages,
      image_paths: currentPaths,
    }

    if (supabase) {
      const { error } = await supabase.from('shared_events').update(fullUpdateData).eq('id', editing.id)
      if (error) {
        await supabase.from('shared_events').update(baseUpdateData).eq('id', editing.id)
      }
    }

    const updated = { ...editing, ...fullUpdateData }
    setEditing(updated)
    events.setItems((prev) => prev.map((item) => (item.id === editing.id ? updated : item)))
    showToast('🗑️ Đã gỡ ảnh')
  }

  const handlePendingFileSelection = (files: FileList | null) => {
    if (!files || !files.length) return
    const fileArray = Array.from(files)
    setPendingFiles((prev) => [...prev, ...fileArray])
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

        {/* Tiến trình xử lý media: nén/tải lên -> lưu */}
        {progress && (
          <div className="photo-progress" role="status" aria-live="polite">
            <div className="photo-progress-top">
              <Loader2 size={14} className="photo-progress-spin" />
              <span>
                {PHASE_LABEL[progress.phase]}
                {progress.total > 0 && progress.phase !== 'save' ? ` ${Math.min(progress.done + 1, progress.total)}/${progress.total}` : '…'}
              </span>
            </div>
            <div className="photo-progress-bar">
              <i style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 100}%` }} />
            </div>
            <span className="photo-progress-hint">Đừng đóng cửa sổ, tệp đang được tải lên.</span>
          </div>
        )}

        {/* Xem trước ảnh & video mới chọn chuẩn bị lưu */}
        {pendingFiles.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {pendingFiles.map((file, idx) => {
              const isVid = isVideoFile(file)
              const blobUrl = URL.createObjectURL(file)
              return (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    width: 58,
                    height: 58,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    background: '#000',
                  }}
                >
                  {isVid ? (
                    <>
                      <video src={blobUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
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
                    <img src={blobUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
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
              )
            })}
          </div>
        )}
      </div>
    </>
  )

  const partnerDisplayName = personName || 'Người yêu'

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

      <div className="memory-filters">
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

      {events.loading ? (
        <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải sự kiện…</p>
      ) : !sorted.length ? (
        <Empty icon={CalendarHeart} colorClass="icon-box-rose">
          {isPartner
            ? 'Chưa có sự kiện chung nào trong phòng. Thêm kỷ niệm đầu tiên nhé!'
            : `Chưa có kỷ niệm nào với ${partnerDisplayName}. Thêm kỷ niệm đầu tiên nhé!`}
        </Empty>
      ) : !filtered.length ? (
        <Empty icon={Filter} colorClass="icon-box-amber">
          Không tìm thấy kỷ niệm nào trong thời gian đã chọn.
        </Empty>
      ) : (
        <div className="memory-list">
          {filtered.map((ev, i) => {
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
                        <video src={allImages[0]} preload="metadata" muted playsInline />
                        <div className="memory-thumb-badge">
                          <Video size={10} />
                        </div>
                      </>
                    ) : (
                      <img src={allImages[0]} alt="" />
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
          })}
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

                {/* 2. KHUNG ẢNH & VIDEO CO GIÃN THEO MÀN HÌNH (LƯỚT ĐƯỢC) */}
                {allImages.length > 0 && (
                  <div className="mem-detail-gallery-wrap">
                    <div className="mem-gallery">
                      {/* Nút phóng to toàn màn hình */}
                      <button
                        type="button"
                        className="mem-gallery-fullscreen-btn"
                        onClick={() => setFullscreenIdx(selectedImageIdx)}
                        title="Xem toàn màn hình"
                      >
                        <Maximize2 size={12} /> Toàn màn hình
                      </button>

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

                      {/* Vuốt ngang để đổi ảnh; mỗi ảnh chiếm trọn bề ngang khung. */}
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
                                  controls
                                  playsInline
                                  preload="metadata"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <img src={mediaUrl} alt={`${viewingEvent.title} — ${idx + 1}`} loading="lazy" />
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

                {/* 3. THÔNG TIN NGÀY GIỜ, VỊ TRÍ, GHI CHÚ */}
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

                {/* 4. ĐÚNG 4 NÚT TRÊN 1 HÀNG NGANG KHÔNG CẦN CUỘN */}
                <div
                  className="mem-detail-actions-4"
                  style={{ gridTemplateColumns: allImages.length > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)' }}
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
        <Modal title="Sự kiện chung mới" onClose={() => setAdding(false)}>
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
        <Modal title="Sửa sự kiện" onClose={() => setEditing(null)}>
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
      {fullscreenIdx !== null && viewing && (() => {
        const allImages = viewing.images && viewing.images.length
          ? viewing.images
          : (viewing.image_url ? [viewing.image_url] : [])

        if (!allImages.length) return null

        return (
          <div className="mem-lightbox" role="dialog" aria-modal="true">
            <div className="mem-lightbox-topbar">
              <div className="mem-lightbox-title">
                <strong>{viewing.title}</strong>
                <span>{viDate(viewing.event_date)} {viewing.event_time ? `· ${viewing.event_time}` : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {allImages.length > 1 && (
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 20 }}>
                    {fullscreenIdx + 1} / {allImages.length}
                  </span>
                )}
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
                      lightboxTrackRef.current?.scrollTo({ left: next * window.innerWidth, behavior: 'smooth' })
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
                      lightboxTrackRef.current?.scrollTo({ left: next * window.innerWidth, behavior: 'smooth' })
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
              ref={lightboxTrackRef}
              onScroll={(e) => {
                const el = e.currentTarget
                const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
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
                        controls
                        autoPlay={idx === fullscreenIdx}
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img src={mediaUrl} alt={`${viewing.title} — ảnh ${idx + 1}`} />
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
                          lightboxTrackRef.current?.scrollTo({ left: idx * window.innerWidth, behavior: 'smooth' })
                        }}
                      >
                        {isVid ? (
                          <>
                            <video src={mediaUrl} preload="metadata" muted playsInline />
                            <span className="mem-gallery-thumb-badge">
                              <Video size={8} />
                            </span>
                          </>
                        ) : (
                          <img src={mediaUrl} alt="" loading="lazy" />
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
    </section>
  )
}
