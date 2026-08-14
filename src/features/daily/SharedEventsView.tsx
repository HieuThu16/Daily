import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CalendarHeart, Filter, ImagePlus, Mail, MapPin, Pencil, Plus, RotateCcw, Star, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import type { SharedEvent, SharedPartner } from '../../types'
import { DeleteButton, Empty, Modal, useQuery } from '../shared'
import { useToast } from '../ToastContext'

const PHOTO_BUCKET = 'daily-photos'

function viDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Bảng màu xoay vòng cho icon lịch mỗi thẻ, cho danh sách đỡ đơn điệu.
const CARD_COLORS = [
  { color: 'var(--purple)',  bg: 'var(--purple-bg)'  },
  { color: 'var(--rose)',    bg: 'var(--rose-bg)'    },
  { color: 'var(--emerald)', bg: 'var(--emerald-bg)' },
  { color: 'var(--amber)',   bg: 'var(--amber-bg)'   },
  { color: 'var(--blue)',    bg: 'var(--blue-bg)'    },
]

/**
 * Nhật ký chung: sự kiện của hai người. Ai thêm email mình vào danh sách
 * "người chung" thì mình thấy sự kiện của họ (xem được, không sửa được).
 */
export function SharedEventsView({
  personId,
  personName,
  isPartner = false,
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
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const [partnerEmail, setPartnerEmail] = useState('')
  const [managePartners, setManagePartners] = useState(false)

  const [filterYear, setFilterYear] = useState<string>('ALL')
  const [filterMonth, setFilterMonth] = useState<string>('ALL')

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null))

    if (!supabase) return
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

  const createEvent = async () => {
    if (!title.trim()) return
    setBusy(true)
    const { data, error } = await supabase!.from('shared_events').insert(payload()).select().single()
    setBusy(false)
    if (error || !data) {
      showToast('❌ Chưa lưu được. Chạy migration shared_events chưa?', 'delete')
      return
    }
    events.setItems((prev) => [data as SharedEvent, ...prev])
    showToast('💞 Đã thêm sự kiện chung')
    setAdding(false)
    resetForm()
  }

  const saveEvent = async () => {
    if (!editing || !title.trim()) return
    const next = payload()
    const { error } = await supabase!.from('shared_events').update(next).eq('id', editing.id)
    if (error) {
      showToast('❌ Chưa lưu được thay đổi', 'delete')
      return
    }
    events.setItems((prev) => prev.map((e) => (e.id === editing.id ? { ...e, ...next } : e)))
    showToast('✏️ Đã cập nhật sự kiện')
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

  const uploadImage = async (file: File) => {
    if (!editing || !supabase) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${myId}/${editing.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
      const url = pub.publicUrl

      const { error: dbErr } = await supabase
        .from('shared_events')
        .update({ image_url: url, image_path: path })
        .eq('id', editing.id)
      if (dbErr) throw dbErr

      events.setItems((prev) => prev.map((item) => (item.id === editing.id ? { ...item, image_url: url, image_path: path } : item)))
      showToast('📷 Đã tải ảnh lên')
    } catch {
      showToast('❌ Không tải ảnh lên được. Tạo bucket daily-photos (public) chưa?', 'delete')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const removeImage = async () => {
    if (!editing || !supabase) return
    setUploading(true)
    try {
      if (editing.image_path) {
        await supabase.storage.from(PHOTO_BUCKET).remove([editing.image_path])
      }
      await supabase.from('shared_events').update({ image_url: null, image_path: null }).eq('id', editing.id)
      events.setItems((prev) => prev.map((item) => (item.id === editing.id ? { ...item, image_url: null, image_path: null } : item)))
      showToast('🗑️ Đã xoá ảnh', 'delete')
    } catch {
      showToast('❌ Chưa xoá ảnh được', 'delete')
    } finally {
      setUploading(false)
    }
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
    </>
  )

  const partnerDisplayName = personName || 'Người yêu'

  return (
    <>
      {/* Thanh hành động đẹp mắt, không vỡ layout */}
      <div style={{ display: 'grid', gridTemplateColumns: onSendInvite ? '1fr 1fr' : '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <button
          className="primary"
          onClick={openAdd}
          style={{ padding: '8px 12px', fontSize: '0.82rem', justifyContent: 'center', minHeight: 38 }}
        >
          <Plus size={15} /> Thêm kỷ niệm
        </button>

        {onSendInvite ? (
          <button
            onClick={onSendInvite}
            style={{
              padding: '8px 12px',
              fontSize: '0.82rem',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
              fontWeight: 600,
              justifyContent: 'center',
              minHeight: 38,
            }}
            title="Gửi lời mời kết nối kỷ niệm"
          >
            <Mail size={15} /> Mời kết nối
          </button>
        ) : (
          <button
            onClick={() => setManagePartners(true)}
            style={{ padding: '8px 12px', fontSize: '0.82rem', justifyContent: 'center', minHeight: 38 }}
          >
            <UserPlus size={15} /> Người chung ({partners.items.length})
          </button>
        )}
      </div>

      {roomCode && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '4px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phòng kỷ niệm:</span>
          <strong style={{ fontSize: '0.78rem', color: 'var(--primary)', letterSpacing: 0.5 }}>{roomCode}</strong>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          aria-label="Lọc theo năm"
          style={{ flex: 1, padding: '5px 8px', fontSize: '0.8rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
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
          style={{ flex: 1, padding: '5px 8px', fontSize: '0.8rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
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
            className="icon small"
            onClick={() => {
              setFilterYear('ALL')
              setFilterMonth('ALL')
            }}
            title="Xoá bộ lọc"
            aria-label="Xoá bộ lọc"
            style={{ padding: '5px 8px', fontSize: '0.75rem', height: 'auto' }}
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
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((ev, i) => {
            const mine = ev.owner_id === myId
            const c = CARD_COLORS[i % CARD_COLORS.length]
            return (
              <div
                key={ev.id}
                className="card"
                onClick={() => setViewing(ev)}
                style={{ padding: 10, margin: 0, display: 'flex', gap: 10, alignItems: 'stretch', cursor: 'pointer' }}
              >
                {ev.image_url ? (
                  <img src={ev.image_url} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div className="icon-box" style={{ width: 72, height: 72, borderRadius: 12, flexShrink: 0, background: c.bg, color: c.color }}>
                    <CalendarDays size={26} />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div className="icon-box icon-box-sm" style={{ width: 20, height: 20, flexShrink: 0, background: c.bg, color: c.color }}>
                      <CalendarDays size={11} />
                    </div>
                    <strong style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</strong>
                    {!mine && (
                      <span className="eyebrow" style={{ margin: 0, padding: '1px 6px', fontSize: '0.62rem', background: 'var(--purple-bg)', color: 'var(--purple)', borderRadius: 6, fontWeight: 700 }}>
                        {partnerDisplayName}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {viDate(ev.event_date)}{ev.event_time ? ` · ${ev.event_time}` : ''}
                  </div>
                  {ev.location && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <MapPin size={11} /> {ev.location}
                    </div>
                  )}
                  {ev.note && <p style={{ margin: '2px 0 0', fontSize: '0.8rem', lineHeight: 1.4, color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.note}</p>}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexShrink: 0 }}>
                  <button
                    className="icon small"
                    aria-label={`${ev.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'} ${ev.title}`}
                    aria-pressed={!!ev.is_favorite}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(ev)
                    }}
                    style={{ color: ev.is_favorite ? 'var(--amber)' : 'var(--text-muted)' }}
                  >
                    <Star size={16} fill={ev.is_favorite ? 'currentColor' : 'none'} />
                  </button>
                  {mine && (
                    <button
                      className="icon small"
                      aria-label={`Sửa ${ev.title}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(ev)
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewingEvent && (
        <Modal title="Chi tiết kỷ niệm" onClose={() => setViewing(null)}>
          <div style={{ display: 'grid', gap: 12 }}>
            {viewingEvent.image_url && (
              <img
                src={viewingEvent.image_url}
                alt={viewingEvent.title}
                style={{
                  width: '100%',
                  maxHeight: 280,
                  objectFit: 'cover',
                  borderRadius: 12,
                  background: 'var(--bg-main)',
                }}
              />
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
        </Modal>
      )}

      {adding && (
        <Modal title="Sự kiện chung mới" onClose={() => setAdding(false)}>
          {eventForm}
          <small className="muted">Lưu xong mở lại sự kiện để đính ảnh.</small>
          <div className="modal-actions">
            <button className="primary" onClick={createEvent} disabled={busy}>{busy ? 'Lưu…' : 'Lưu sự kiện'}</button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title="Sửa sự kiện" onClose={() => setEditing(null)}>
          {eventForm}

          <div style={{ display: 'grid', gap: 8 }}>
            {editing.image_url && (
              <img src={editing.image_url} alt="Ảnh sự kiện" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 12, background: 'var(--bg-main)' }} />
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              aria-label="Chọn ảnh cho sự kiện"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) uploadImage(file)
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => fileInput.current?.click()} disabled={!supabase || uploading}>
                <ImagePlus size={14} /> {uploading ? 'Đang tải…' : editing.image_url ? 'Đổi ảnh' : 'Thêm ảnh'}
              </button>
              {editing.image_url && (
                <button type="button" className="text-danger" onClick={removeImage}>
                  <Trash2 size={14} /> Gỡ ảnh
                </button>
              )}
            </div>
          </div>

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
    </>
  )
}
