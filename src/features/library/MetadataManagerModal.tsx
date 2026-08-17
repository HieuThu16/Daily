import { useState, type Dispatch, type SetStateAction } from 'react'
import { Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DeleteButton, Modal } from '../shared'
import { useToast } from '../ToastContext'

/** Sáu bảng metadata (tác giả, thể loại sách/phim/nhạc, kênh, ca sĩ) đều chung schema này. */
export type MetadataRow = { id: string; name: string }

type Props = {
  title: string
  /** Tên bảng Supabase, vd 'book_authors'. */
  table: string
  /** Danh từ dùng trong toast và aria-label, vd 'tác giả'. */
  noun: string
  placeholder: string
  rows: MetadataRow[]
  setRows: Dispatch<SetStateAction<MetadataRow[]>>
  /**
   * Danh sách tên cần hiện khi nó rộng hơn `rows` — tác giả và thể loại sách còn gom
   * thêm tên chỉ xuất hiện trong chính các mục thư viện. Bỏ trống thì liệt kê `rows`.
   */
  names?: string[]
  /** Nhãn đếm bên cạnh tên, vd '3 cuốn'. Trả null thì không hiện. */
  countOf?: (name: string) => string | null
  /** Lan tên mới sang bảng media_items. Gọi sau khi bảng metadata đã đổi xong. */
  onRenamed?: (oldName: string, newName: string) => void | Promise<void>
  onDeleted?: (name: string) => void | Promise<void>
  onClose: () => void
}

export function MetadataManagerModal({
  title,
  table,
  noun,
  placeholder,
  rows,
  setRows,
  names,
  countOf,
  onRenamed,
  onDeleted,
  onClose,
}: Props) {
  const { showToast } = useToast()
  const [newName, setNewName] = useState('')

  const add = async () => {
    const name = newName.trim()
    if (!name) return
    const tempId = Date.now().toString()
    setRows((prev) => [...prev.filter((r) => r.name !== name), { id: tempId, name }])
    setNewName('')
    showToast(`➕ Đã thêm ${noun} mới!`)

    const { data } = await supabase!.from(table).insert({ name }).select().single()
    if (data) setRows((prev) => prev.map((r) => (r.id === tempId ? (data as MetadataRow) : r)))
  }

  const rename = async (name: string) => {
    const next = prompt(`Tên ${noun} mới:`, name)?.trim()
    if (!next || next === name) return
    // Tên có thể chỉ tồn tại trong các mục thư viện, chưa có dòng riêng ở bảng metadata.
    const row = rows.find((r) => r.name === name)
    if (row) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: next } : r)))
      await supabase!.from(table).update({ name: next }).eq('id', row.id)
    }
    await onRenamed?.(name, next)
    showToast(`✏️ Đã sửa tên ${noun}!`)
  }

  const remove = async (name: string) => {
    const row = rows.find((r) => r.name === name)
    if (row) {
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      await supabase!.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', row.id)
    }
    await onDeleted?.(name)
    showToast(`🗑️ Đã xoá ${noun}`, 'delete')
  }

  const listed = names ?? rows.map((r) => r.name)

  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.86rem' }}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="primary" onClick={add} style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
          Thêm
        </button>
      </div>

      <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {listed.map((name) => {
          const count = countOf?.(name)
          return (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '6px 10px', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                {count && (
                  <span style={{ fontSize: '0.72rem', background: 'var(--purple-bg)', color: 'var(--purple)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
                    {count}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="icon small" aria-label={`Sửa ${noun}`} onClick={() => rename(name)} style={{ padding: 3 }}>
                  <Pencil size={13} />
                </button>
                <DeleteButton onDelete={() => remove(name)} />
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
