import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CalendarHeart, Filter, Heart, ImagePlus, Mail, MapPin, MoreVertical, Pencil, Plus, RotateCcw, Star, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { anniversariesOn, yearsAgoLabel } from '../../lib/anniversary'
import type { SharedEvent, SharedPartner } from '../../types'
import { DeleteButton, Empty, Modal, useQuery } from '../shared'
import { useToast } from '../ToastContext'
import { notifyPartner } from '../../lib/push'

const PHOTO_BUCKET = 'daily-photos'

function viDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Nhật ký chung: sự kiện của hai người. Ai thêm email mình vào danh sách
 * "người chung" thì mình thấy sự kiện của họ (xem được, không sửa được).
 */
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
  roomCode = 'HIEU-Y-2026',
  onSendInvite,
}: {
  personId: string
  personName?: string
  isPartner?: boolean
  roomCode?: string
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
  const fileInput = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  const [partnerEmail, setPartnerEmail] = useState('')
  const [managePartners, setManagePartners] = useState(false)

  const [filterYear, setFilterYear] = useState<string>('ALL')
  const [filterMonth, setFilterMonth] = useState<string>('ALL')

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [selectedImageIdx, setSelectedImageIdx] = useState<number>(0)

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

  // Kỷ niệm chung của phòng (roomCode), hoặc gắn theo personId, hoặc do đối tác chia sẻ sang
  const sorted = useMemo(() => {
    // 1. Lọc theo roomCode hoặc personId hoặc owner
    const matched = events.items.filter(
      (e) => (roomCode && e.room_code === roomCode) || e.person_id === personId || (myId != null && e.owner_id !== myId),
    )

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

  const payload = () => ({
    person_id: personId,
    room_code: roomCode || 'HIEU-Y-2026',
    title: title.trim(),
    note: note.trim() || null,
    event_date: eventDate,
    event_time: eventTime || null,
    location: location.trim() || null,
  })

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => resolve('')
      reader.readAsDataURL(file)
    })

  const uploadMultipleImages = async (folder: string, files: File[]) => {
    if (!files.length) return { urls: [] as string[], paths: [] as string[] }
    const urls: string[] = []
    const paths: string[] = []

    for (const file of files) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${folder}/${crypto.randomUUID()}.${ext}`
        let uploadedUrl = ''

        if (supabase) {
          const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: true })
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
          uploadedUrl = await fileToDataUrl(file)
        }

        if (uploadedUrl) {
          urls.push(uploadedUrl)
          paths.push(path)
        }
      } catch (err) {
        console.error('Lỗi tải ảnh:', err)
        const dataUrl = await fileToDataUrl(file)
        if (dataUrl) {
          urls.push(dataUrl)
          paths.push('')
        }
      }
    }
    return { urls, paths }
  }

  const createEvent = async () => {
    if (!title.trim()) return
    setBusy(true)

    let urls: string[] = []
    let paths: string[] = []
    if (pendingFiles.length > 0) {
      const res = await uploadMultipleImages(eventDate, pendingFiles)
      urls = res.urls
      paths = res.paths
    }

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

    setBusy(false)
    events.setItems((prev) => [created!, ...prev])
    if (savedRemotely) {
      void notifyPartner('Có kỷ niệm mới được chia sẻ', created.title, '/daily', `share-${created.id}`)
      showToast('💞 Đã thêm kỷ niệm mới')
    } else {
      showToast('⚠️ Chưa lưu được lên máy chủ — kỷ niệm chỉ hiện tạm, kiểm tra kết nối rồi thêm lại.', 'delete')
    }
    setAdding(false)
    resetForm()
  }

  const saveEvent = async () => {
    if (!editing || !title.trim()) return
    setBusy(true)
    const next = payload()
    
    let currentImages = editing.images && editing.images.length ? [...editing.images] : (editing.image_url ? [editing.image_url] : [])
    let currentPaths = editing.image_paths && editing.image_paths.length ? [...editing.image_paths] : (editing.image_path ? [editing.image_path] : [])

    if (pendingFiles.length > 0) {
      const { urls, paths } = await uploadMultipleImages(eventDate, pendingFiles)
      currentImages = [...currentImages, ...urls]
      currentPaths = [...currentPaths, ...paths]
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

    if (supabase) {
      const { error } = await supabase.from('shared_events').update(fullUpdateData).eq('id', editing.id)
      if (error) {
        // Schema cũ chưa có cột mảng images, thử lại với baseUpdateData
        if (currentImages.length > 1) warnMissingImagesColumn(showToast)
        await supabase.from('shared_events').update(baseUpdateData).eq('id', editing.id)
      }
    }

    setBusy(false)
    const finalEvent = {
      ...editing,
      ...fullUpdateData,
    }
    events.setItems((prev) => prev.map((e) => (e.id === editing.id ? finalEvent : e)))
    showToast('✏️ Đã cập nhật kỷ niệm')
    setEditing(null)
    setViewing(null)
    resetForm()
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
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Lần đầu đi Đà Lạt" autoFocus />
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

      {/* Chọn nhiều ảnh từ bộ sưu tập */}
      <div style={{ marginTop: 8 }}>
        <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6, display: 'block' }}>
          Ảnh kỷ niệm (chọn nhiều ảnh)
        </label>
        <input
          ref={fileInput}
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
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', border: '1px dashed var(--primary)', borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600 }}
        >
          <ImagePlus size={15} /> Chọn ảnh từ bộ sưu tập (nhiều ảnh)
        </button>

        {/* Xem trước ảnh mới chọn chuẩn bị lưu */}
        {pendingFiles.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {pendingFiles.map((file, idx) => (
              <div key={idx} style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                  style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, padding: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', display: 'grid', placeItems: 'center' }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
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

        {onSendInvite ? (
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

      {roomCode && (
        <div className="memory-room">
          <span>Phòng kỷ niệm</span>
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
          Chưa có sự kiện chung nào. Thêm kỷ niệm đầu tiên nhé!
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
                    <img src={allImages[0]} alt="" />
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
        <Modal title="Chi tiết kỷ niệm" onClose={() => setViewing(null)}>
          {(() => {
            const allImages = viewingEvent.images && viewingEvent.images.length
              ? viewingEvent.images
              : (viewingEvent.image_url ? [viewingEvent.image_url] : [])

            return (
              <div style={{ display: 'grid', gap: 12 }}>
                {allImages.length > 0 && (
                  <div className="mem-gallery">
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
                      {allImages.map((imgUrl, idx) => (
                        <div className="mem-gallery-slide" key={idx}>
                          <img src={imgUrl} alt={`${viewingEvent.title} — ảnh ${idx + 1}`} loading="lazy" />
                        </div>
                      ))}
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
                        <div className="mem-gallery-thumbs">
                          {allImages.map((imgUrl, idx) => (
                            <img
                              key={idx}
                              src={imgUrl}
                              alt=""
                              loading="lazy"
                              className={idx === selectedImageIdx ? 'on' : undefined}
                              onClick={() => {
                                setSelectedImageIdx(idx)
                                const track = galleryRef.current
                                track?.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' })
                              }}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', flex: 1 }}>{viewingEvent.title}</h3>
                  {viewingEvent.owner_id !== myId && (
                    <span className="eyebrow" style={{ margin: 0, padding: '2px 8px', fontSize: '0.65rem', background: 'var(--purple-bg)', color: 'var(--purple)', borderRadius: 6, fontWeight: 700 }}>
                      {partnerDisplayName}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarDays size={16} style={{ color: 'var(--purple)' }} />
                    <strong style={{ color: 'var(--text-main)' }}>{viDate(viewingEvent.event_date)}</strong>
                    {viewingEvent.event_time && <span>· {viewingEvent.event_time}</span>}
                  </div>

                  {viewingEvent.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={16} style={{ color: 'var(--rose)' }} />
                      <span>{viewingEvent.location}</span>
                    </div>
                  )}
                </div>

                {viewingEvent.note && (
                  <div
                    style={{
                      background: 'var(--bg-main)',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: '0.88rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--text-main)',
                      borderLeft: '3px solid var(--purple)',
                    }}
                  >
                    {viewingEvent.note}
                  </div>
                )}

                <div className="modal-actions" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(viewingEvent)}
                    style={{ color: viewingEvent.is_favorite ? 'var(--amber)' : 'inherit' }}
                  >
                    <Star size={16} fill={viewingEvent.is_favorite ? 'currentColor' : 'none'} />
                    {viewingEvent.is_favorite ? 'Bỏ thích' : 'Yêu thích'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const evToEdit = viewingEvent
                      setViewing(null)
                      openEdit(evToEdit)
                    }}
                  >
                    <Pencil size={15} /> Sửa
                  </button>
                  <DeleteButton
                    onDelete={async () => {
                      await deleteEvent(viewingEvent.id)
                      setViewing(null)
                    }}
                  />
                </div>
              </div>
            )
          })()}
        </Modal>
      )}

      {adding && (
        <Modal title="Sự kiện chung mới" onClose={() => setAdding(false)}>
          {eventForm}
          <div className="modal-actions">
            <button className="primary" onClick={createEvent} disabled={busy}>{busy ? 'Lưu…' : 'Lưu sự kiện'}</button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title="Sửa sự kiện" onClose={() => setEditing(null)}>
          {eventForm}

          {/* Danh sách ảnh hiện tại của sự kiện */}
          {(() => {
            const currentImages = editing.images && editing.images.length ? editing.images : (editing.image_url ? [editing.image_url] : [])
            if (!currentImages.length) return null
            return (
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Ảnh đã lưu ({currentImages.length}):</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {currentImages.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(idx)}
                        title="Xoá ảnh này"
                        style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, padding: 0, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.85)', color: '#fff', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <div className="modal-actions">
            <DeleteButton onDelete={() => deleteEvent(editing.id)} />
            <button className="primary" onClick={saveEvent}>Lưu thay đổi</button>
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
    </section>
  )
}
