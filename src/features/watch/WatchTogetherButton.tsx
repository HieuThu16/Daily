import React, { useMemo, useState } from 'react'
import { Check, Pencil, Search, Users } from 'lucide-react'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import {
  filterPeople,
  saveContactName,
  shareToPeople,
  usePeople,
  type WatchItem,
  type WatchPerson,
} from '../../lib/watchTogether'

/** Nút "Xem chung" dùng chung ở mọi nơi: video, nhạc, truyện… */
export function WatchTogetherButton({
  item,
  className = 'yt-chip',
  label = 'Xem chung',
  size = 15,
  style,
}: {
  item: WatchItem | (() => WatchItem | null)
  className?: string
  label?: string
  size?: number
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<WatchItem | null>(null)

  const openPicker = () => {
    const value = typeof item === 'function' ? item() : item
    if (!value) return
    setPending(value)
    setOpen(true)
  }

  return (
    <>
      <button type="button" className={className} onClick={openPicker} style={style}>
        <Users size={size} /> {label}
      </button>
      {open && pending && <PeoplePicker item={pending} onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * Chọn thẳng Gmail để gửi, không qua nhóm.
 * Danh sách lấy từ `public.profiles` — mọi tài khoản đã đăng nhập app.
 */
function PeoplePicker({ item, onClose }: { item: WatchItem; onClose: () => void }) {
  const { people, loading, reload } = usePeople()
  const { showToast } = useToast()
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<WatchPerson | null>(null)
  const [sending, setSending] = useState(false)

  const visible = useMemo(() => filterPeople(people, query), [people, query])
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const send = async () => {
    setSending(true)
    try {
      const chosen = people.filter((p) => selected.includes(p.id))
      const n = await shareToPeople(chosen, item)
      showToast(`📺 Đã gửi xem chung cho ${n} người`)
      onClose()
    } catch (err) {
      showToast(`❌ Không gửi được: ${err instanceof Error ? err.message : err}`, 'delete')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title="Gửi xem chung" onClose={onClose}>
      <div style={{ fontSize: '0.85rem', marginBottom: 10, opacity: 0.8 }}>{item.title}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Search size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên hoặc Gmail…"
          style={{ flex: 1 }}
        />
      </div>

      {loading ? (
        <div style={{ fontSize: '0.85rem' }}>Đang tải danh bạ…</div>
      ) : visible.length === 0 ? (
        <div style={{ fontSize: '0.85rem', marginBottom: 10, opacity: 0.75 }}>
          {people.length === 0
            ? 'Chưa có tài khoản nào khác trong app để gửi.'
            : 'Không tìm thấy ai khớp.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 320, overflowY: 'auto' }}>
          {visible.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              checked={selected.includes(p.id)}
              onToggle={() => toggle(p.id)}
              onRename={() => setRenaming(p)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        className="primary"
        disabled={selected.length === 0 || sending}
        onClick={() => void send()}
        style={{ width: '100%' }}
      >
        {sending ? 'Đang gửi…' : selected.length ? `Gửi cho ${selected.length} người` : 'Gửi'}
      </button>

      {renaming && (
        <RenameContactModal
          person={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => {
            setRenaming(null)
            reload()
          }}
        />
      )}
    </Modal>
  )
}

function PersonRow({
  person,
  checked,
  onToggle,
  onRename,
}: {
  person: WatchPerson
  checked: boolean
  onToggle: () => void
  onRename: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'var(--bg-main)',
        border: `1px solid ${checked ? 'var(--accent, #8b5cf6)' : 'var(--card-border)'}`,
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <Avatar person={person} size={28} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.label}
          </span>
          <span style={{ display: 'block', fontSize: '0.72rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.email}
          </span>
        </span>
      </label>
      <button
        type="button"
        aria-label={`Đặt tên cho ${person.email}`}
        title="Đặt tên cho Gmail này"
        onClick={onRename}
        style={{ flexShrink: 0, background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
      >
        <Pencil size={14} />
      </button>
    </div>
  )
}

/** Ảnh đại diện, không có thì lấy chữ cái đầu của tên. */
export function Avatar({ person, size = 28 }: { person: Pick<WatchPerson, 'label' | 'avatarUrl'>; size?: number }) {
  if (person.avatarUrl) {
    return (
      <img
        src={person.avatarUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--card-border)',
        fontSize: size * 0.42,
        fontWeight: 800,
      }}
    >
      {person.label.charAt(0).toUpperCase()}
    </span>
  )
}

/** Đặt tên cho một Gmail. Tên là của RIÊNG mình, lưu vào watch_contacts trên Supabase. */
export function RenameContactModal({
  person,
  onClose,
  onSaved,
}: {
  person: WatchPerson
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useToast()
  const [name, setName] = useState(person.customName ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await saveContactName(person.email, name)
      showToast(name.trim() ? `✅ Đã lưu tên "${name.trim()}"` : '✅ Đã gỡ tên tự đặt')
      onSaved()
    } catch (err) {
      showToast(`❌ Không lưu được tên: ${err instanceof Error ? err.message : err}`, 'delete')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Đặt tên cho Gmail" onClose={onClose}>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
        {person.email}
        <br />
        Tên này chỉ mình bạn thấy, và được lưu lại để lần sau khỏi đặt nữa.
      </p>
      <label>
        Tên hiển thị
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ví dụ: Kim Ý"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
          }}
        />
      </label>
      <button
        type="button"
        className="primary"
        disabled={saving}
        onClick={() => void save()}
        style={{ width: '100%', marginTop: 12 }}
      >
        <Check size={15} /> {saving ? 'Đang lưu…' : 'Lưu tên'}
      </button>
    </Modal>
  )
}
