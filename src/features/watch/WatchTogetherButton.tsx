import React, { useState } from 'react'
import { Users } from 'lucide-react'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import { createGroup, shareToGroups, useMyGroups, type WatchItem } from '../../lib/watchTogether'

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
      {open && pending && <GroupPicker item={pending} onClose={() => setOpen(false)} />}
    </>
  )
}

function GroupPicker({ item, onClose }: { item: WatchItem; onClose: () => void }) {
  const { groups, loading, reload } = useMyGroups()
  const { showToast } = useToast()
  const [selected, setSelected] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [sending, setSending] = useState(false)

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const send = async () => {
    setSending(true)
    try {
      const n = await shareToGroups(selected, item)
      showToast(`Đã gửi lên xem chung ${n} nhóm`, 'success')
      onClose()
    } catch (err: any) {
      showToast(`Không gửi được: ${err?.message ?? err}`)
    } finally {
      setSending(false)
    }
  }

  const create = async () => {
    if (!newName.trim()) return
    try {
      const group = await createGroup(newName.trim())
      setNewName('')
      reload()
      if (group) setSelected((prev) => [...prev, group.id])
    } catch (err: any) {
      showToast(`Không tạo được nhóm: ${err?.message ?? err}`)
    }
  }

  return (
    <Modal title="Gửi lên xem chung" onClose={onClose}>
      <div style={{ fontSize: '0.85rem', marginBottom: 10, opacity: 0.8 }}>{item.title}</div>

      {loading ? (
        <div style={{ fontSize: '0.85rem' }}>Đang tải nhóm…</div>
      ) : groups.length === 0 ? (
        <div style={{ fontSize: '0.85rem', marginBottom: 10 }}>Chưa có nhóm nào. Tạo một nhóm bên dưới.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {groups.map((g) => (
            <label
              key={g.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--surface-2, rgba(0,0,0,0.04))', cursor: 'pointer' }}
            >
              <input type="checkbox" checked={selected.includes(g.id)} onChange={() => toggle(g.id)} />
              <span style={{ fontWeight: 600 }}>{g.name}</span>
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Tên nhóm mới"
          style={{ flex: 1 }}
        />
        <button type="button" onClick={() => void create()}>Tạo nhóm</button>
      </div>

      <button
        type="button"
        className="primary"
        disabled={selected.length === 0 || sending}
        onClick={() => void send()}
        style={{ width: '100%' }}
      >
        {sending ? 'Đang gửi…' : 'Gửi'}
      </button>
    </Modal>
  )
}
