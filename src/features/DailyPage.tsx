import { useState } from 'react'
import { Frown, Heart, NotebookPen, Pencil, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate, longDate } from '../lib/date'
import type { DailyType, Entry } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'

const categories: Array<{ type: DailyType; title: string; icon: any; color: string; bg: string }> = [
  { type: 'FEELING', title: 'Cảm xúc', icon: Heart, color: 'var(--purple)', bg: 'var(--purple-bg)' },
  { type: 'NEW_THING', title: 'Điều mới', icon: Sparkles, color: 'var(--amber)', bg: 'var(--amber-bg)' },
  { type: 'SAD_THING', title: 'Điều buồn', icon: Frown, color: 'var(--blue)', bg: 'var(--blue-bg)' },
  { type: 'SMALL_WIN', title: 'Việc nhỏ', icon: Plus, color: 'var(--emerald)', bg: 'var(--emerald-bg)' },
]

export function DailyPage() {
  const { items, setItems, loading } = useQuery<Entry>('daily_entries')

  // Selected Category for writing
  const [selectedType, setSelectedType] = useState<DailyType>('FEELING')
  
  // Single Big Textarea for writing
  const [content, setContent] = useState('')
  
  // Filter for today's entries list ('ALL' or specific DailyType)
  const [filterType, setFilterType] = useState<'ALL' | DailyType>('ALL')

  const [date, setDate] = useState(localDate())
  const [busy, setBusy] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')

  // Single Entry Edit Modal state
  const [editing, setEditing] = useState<Entry | null>(null)
  const [editText, setEditText] = useState('')

  // Save Entries from Big Textarea (Filtering out blank lines/paragraphs)
  const saveEntries = async () => {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return

    setBusy(true)
    setSaveSuccess('')

    const currentTimeString = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

    const newEntriesToInsert = lines.map((lineText) => ({
      content: lineText,
      entry_date: date,
      entry_type: selectedType,
    }))

    const { data, error } = await supabase!.from('daily_entries').insert(newEntriesToInsert).select()

    if (!error && data) {
      setItems((prev) => [...(data as Entry[]), ...prev])
      setContent('')
      setSaveSuccess(`Đã lưu ${lines.length} nội dung lúc ${currentTimeString} ✨`)
      setTimeout(() => setSaveSuccess(''), 3500)
    }
    setBusy(false)
  }

  const updateEntry = async () => {
    if (!editing || !editText.trim()) return
    await supabase!.from('daily_entries').update({ content: editText.trim(), entry_date: date }).eq('id', editing.id)
    setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, content: editText.trim(), entry_date: date } : i)))
    setEditing(null)
  }

  const removeEntry = async (id: string) => {
    await supabase!.from('daily_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setEditing(null)
  }

  // Today's entries filtered by filterType
  const todayEntries = items.filter((i) => i.entry_date === date && (filterType === 'ALL' || i.entry_type === filterType))

  return (
    <section style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 4 Icon Categories in 1 Horizontal Row */}
      <div className="daily-4-icons" style={{ marginBottom: 10 }}>
        {categories.map((cat) => {
          const Icon = cat.icon
          const isSelected = selectedType === cat.type
          return (
            <button key={cat.type} className={'daily-icon-btn ' + (isSelected ? 'active' : '')} onClick={() => setSelectedType(cat.type)} style={{ padding: '6px 4px', borderRadius: 12 }}>
              <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 26, height: 26 }}>
                <Icon size={15} />
              </div>
              <span style={{ fontSize: '0.7rem' }}>{cat.title}</span>
            </button>
          )
        })}
      </div>

      {/* Single Big Textarea Box for Writing */}
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="eyebrow" style={{ margin: 0, padding: '2px 8px', fontSize: '0.68rem' }}>
            {longDate(new Date(date + 'T12:00:00'))}
          </span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: '2px 6px', fontSize: '0.78rem' }} />
        </div>

        {/* Big Textarea Box */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`Viết nhật ký ${categories.find((c) => c.type === selectedType)?.title.toLowerCase()} vào đây...`}
          rows={3}
          style={{
            width: '100%',
            border: '1px solid var(--card-border)',
            borderRadius: 12,
            padding: 10,
            fontSize: '0.9rem',
            resize: 'vertical',
            outline: 'none',
            background: 'var(--card-bg)',
            color: 'var(--text-main)',
            lineHeight: 1.5,
            marginBottom: 8,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button className="primary" onClick={saveEntries} disabled={busy} style={{ padding: '6px 16px', fontSize: '0.84rem' }}>
            <Save size={15} />
            {busy ? 'Lưu…' : 'Lưu nhật ký'}
          </button>
        </div>

        {saveSuccess && (
          <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--emerald-bg)', color: 'var(--emerald)', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, textAlign: 'center' }}>
            {saveSuccess}
          </div>
        )}
      </div>

      {/* TODAY'S ENTRIES LIST WITH CATEGORY FILTER TOGGLES */}
      <div className="card" style={{ padding: 12, margin: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--primary)' }}>
            <NotebookPen size={15} /> Nhật ký hôm nay ({todayEntries.length})
          </h2>

          {/* View Filter Toggles: Xem tất cả vs Xem theo từng thể loại */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-main)', padding: 3, borderRadius: 10, border: '1px solid var(--card-border)' }}>
            <button
              onClick={() => setFilterType('ALL')}
              style={{
                border: 0,
                background: filterType === 'ALL' ? 'var(--card-bg)' : 'transparent',
                color: filterType === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: filterType === 'ALL' ? 700 : 500,
                fontSize: '0.72rem',
                padding: '3px 8px',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Tất cả
            </button>
            {categories.map((cat) => (
              <button
                key={cat.type}
                onClick={() => setFilterType(cat.type)}
                style={{
                  border: 0,
                  background: filterType === cat.type ? cat.bg : 'transparent',
                  color: filterType === cat.type ? cat.color : 'var(--text-muted)',
                  fontWeight: filterType === cat.type ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                {cat.title}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải nhật ký…</p>
        ) : todayEntries.length ? (
          <div style={{ display: 'grid', gap: 6, maxHeight: '160px', overflowY: 'auto' }}>
            {todayEntries.map((entry) => {
              const cat = categories.find((c) => c.type === entry.entry_type) ?? categories[0]
              const Icon = cat.icon
              return (
                <div key={entry.id} className="check-row" style={{ justifyContent: 'space-between', background: 'var(--bg-main)', borderRadius: 8, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 22, height: 22 }}>
                      <Icon size={12} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.content}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      className="icon small"
                      aria-label="Edit entry"
                      onClick={() => {
                        setEditing(entry)
                        setEditText(entry.content)
                        setDate(entry.entry_date)
                      }}
                      style={{ padding: 3 }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button className="icon small danger" aria-label="Delete entry" onClick={() => removeEntry(entry.id)} style={{ padding: 3 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <Empty icon={NotebookPen} colorClass="icon-box-emerald">
            {filterType === 'ALL' ? 'Chưa có nhật ký nào cho hôm nay.' : `Chưa có mục nào cho "${categories.find((c) => c.type === filterType)?.title}".`}
          </Empty>
        )}
      </div>

      {/* Single Entry Edit Modal */}
      {editing && (
        <Modal title="Sửa dòng nhật ký" onClose={() => setEditing(null)}>
          <label>
            Ngày viết
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Nội dung
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
          </label>
          <div className="modal-actions">
            <DeleteButton onDelete={() => removeEntry(editing.id)} />
            <button className="primary" onClick={updateEntry}>
              Lưu thay đổi
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
