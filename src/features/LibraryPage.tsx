import { useMemo, useState } from 'react'
import { BarChart3, BookOpen, Film, Heart, Music, Pencil, Plus, Tv } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Media } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'

const categories = [
  { id: 'BOOK', label: 'Books', icon: BookOpen, colorClass: 'icon-box-purple', color: 'var(--purple)', bg: 'var(--purple-bg)', labels: ['Muốn đọc', 'Đang đọc', 'Đã đọc'] },
  { id: 'MOVIE', label: 'Movies', icon: Film, colorClass: 'icon-box-rose', color: 'var(--rose)', bg: 'var(--rose-bg)', labels: ['Muốn xem', 'Đang xem', 'Đã xem'] },
  { id: 'YOUTUBE', label: 'YouTube', icon: Tv, colorClass: 'icon-box-amber', color: 'var(--amber)', bg: 'var(--amber-bg)', labels: ['Muốn xem', 'Đang xem', 'Đã xem'] },
  { id: 'MUSIC', label: 'Music', icon: Music, colorClass: 'icon-box-cyan', color: 'var(--cyan)', bg: 'var(--cyan-bg)', labels: ['Muốn nghe', 'Đang nghe', 'Đã nghe'] },
] as const

type Kind = (typeof categories)[number]['id']
type SubView = 'overview' | 'stats'
type StatusFilter = 'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'

function getItemChannelOrArtist(item: Media) {
  if (item.type === 'YOUTUBE') return item.channel ?? parseDescPrefix(item.description, 'Kênh:')
  if (item.type === 'MUSIC') return item.artist ?? parseDescPrefix(item.description, 'Ca sĩ:')
  return ''
}

function parseDescPrefix(desc: string | null, prefix: string) {
  if (!desc) return ''
  const regex = new RegExp(`^${prefix}\\s*(.*?)(?:\\n|$)`, 'i')
  const match = desc.match(regex)
  return match ? match[1].trim() : ''
}

export function LibraryPage() {
  const { items, setItems, loading } = useQuery<Media>('media_items')

  // Selected Category (Matches Daily 4-button style!)
  const [selectedType, setSelectedType] = useState<'ALL' | Kind>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [subView, setSubView] = useState<SubView>('overview')
  const [search, setSearch] = useState('')

  // Modal State for Add & Edit
  const [activeModal, setActiveModal] = useState<{ kind: Kind; item?: Media } | null>(null)
  const [name, setName] = useState('')
  const [extraVal, setExtraVal] = useState('') // Channel for YouTube, Artist for Music
  const [notes, setNotes] = useState('')

  // Datalist collections for Channel and Artist
  const channels = useMemo(() => {
    const set = new Set<string>()
    items.filter((i) => i.type === 'YOUTUBE').forEach((i) => {
      const ch = getItemChannelOrArtist(i)
      if (ch) set.add(ch)
    })
    return Array.from(set)
  }, [items])

  const artists = useMemo(() => {
    const set = new Set<string>()
    items.filter((i) => i.type === 'MUSIC').forEach((i) => {
      const art = getItemChannelOrArtist(i)
      if (art) set.add(art)
    })
    return Array.from(set)
  }, [items])

  const openAdd = (kind: Kind) => {
    setActiveModal({ kind })
    setName('')
    setExtraVal('')
    setNotes('')
  }

  const openEdit = (item: Media) => {
    const extra = getItemChannelOrArtist(item)
    setActiveModal({ kind: item.type as Kind, item })
    setName(item.name)
    setExtraVal(extra)
    setNotes(item.description ?? '')
  }

  const saveItem = async () => {
    if (!activeModal || !name.trim()) return
    const { kind, item } = activeModal

    const payload: Partial<Media> = {
      type: kind,
      name: name.trim(),
      description: notes.trim() || null,
      channel: kind === 'YOUTUBE' ? extraVal.trim() || null : null,
      artist: kind === 'MUSIC' ? extraVal.trim() || null : null,
    }

    if (item) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...payload } : i)))
      const { error } = await supabase!.from('media_items').update(payload).eq('id', item.id)
      if (error) {
        const prefix = kind === 'YOUTUBE' ? 'Kênh:' : 'Ca sĩ:'
        const formattedDesc = extraVal.trim() ? `${prefix} ${extraVal.trim()}\n${notes.trim()}` : notes.trim()
        await supabase!.from('media_items').update({ name: name.trim(), description: formattedDesc }).eq('id', item.id)
      }
    } else {
      const insertData = { ...payload, status: 'PLANNED' as const }
      const { data, error } = await supabase!.from('media_items').insert(insertData).select().single()
      if (!error && data) {
        setItems((prev) => [data as Media, ...prev])
      } else {
        const prefix = kind === 'YOUTUBE' ? 'Kênh:' : 'Ca sĩ:'
        const formattedDesc = extraVal.trim() ? `${prefix} ${extraVal.trim()}\n${notes.trim()}` : notes.trim()
        const fallbackRes = await supabase!
          .from('media_items')
          .insert({ type: kind, name: name.trim(), description: formattedDesc, status: 'PLANNED' })
          .select()
          .single()
        if (fallbackRes.data) setItems((prev) => [fallbackRes.data as Media, ...prev])
      }
    }

    setActiveModal(null)
  }

  const patchStatusOrFavorite = async (id: string, patch: Partial<Media>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    await supabase!.from('media_items').update(patch).eq('id', id)
  }

  const deleteItem = async () => {
    if (!activeModal?.item) return
    const id = activeModal.item.id
    await supabase!.from('media_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setActiveModal(null)
  }

  // Stats calculation
  const stats = useMemo(() => {
    const total = items.length
    const completed = items.filter((i) => i.status === 'COMPLETED').length
    const inProgress = items.filter((i) => i.status === 'IN_PROGRESS').length
    const planned = items.filter((i) => i.status === 'PLANNED').length

    const categoryStats = categories.map((cat) => ({
      ...cat,
      count: items.filter((i) => i.type === cat.id).length,
      doneCount: items.filter((i) => i.type === cat.id && i.status === 'COMPLETED').length,
    }))

    return { total, completed, inProgress, planned, categoryStats }
  }, [items])

  const filteredItems = items.filter(
    (i) =>
      (selectedType === 'ALL' || i.type === selectedType) &&
      (statusFilter === 'ALL' || i.status === statusFilter) &&
      (i.name + (i.description ?? '')).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <section style={{ maxWidth: 880, margin: '0 auto' }}>
      {/* 4 Category Icons in 1 Horizontal Row (EXACT SAME AS DAILY!) */}
      <div className="daily-4-icons" style={{ marginBottom: 8 }}>
        {categories.map((cat) => {
          const Icon = cat.icon
          const isSelected = selectedType === cat.id
          return (
            <button key={cat.id} className={'daily-icon-btn ' + (isSelected ? 'active' : '')} onClick={() => setSelectedType(cat.id)} style={{ padding: '6px 4px', borderRadius: 12 }}>
              <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 26, height: 26 }}>
                <Icon size={15} />
              </div>
              <span style={{ fontSize: '0.7rem' }}>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* Sub Tabs: Tổng thể vs Thống kê */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="habit-sub-tabs" style={{ margin: 0 }}>
          <button className={subView === 'overview' ? 'active' : ''} onClick={() => setSubView('overview')}>
            <BookOpen size={14} /> Tổng thể ({filteredItems.length})
          </button>
          <button className={subView === 'stats' ? 'active' : ''} onClick={() => setSubView('stats')}>
            <BarChart3 size={14} /> Thống kê
          </button>
        </div>

        <button className="primary" onClick={() => openAdd(selectedType === 'ALL' ? 'BOOK' : selectedType)} style={{ padding: '5px 12px', fontSize: '0.8rem', gap: 4 }}>
          <Plus size={14} /> Thêm mục
        </button>
      </div>

      {/* VIEW 1: TỔNG THỂ (OVERVIEW VIEW WITH STATUS FILTERS) */}
      {subView === 'overview' && (
        <div className="card" style={{ padding: 10, margin: 0 }}>
          {/* Header Bar: Status Filters (Tất cả, Định xem, Đang xem, Đã xem) + Search */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-main)', padding: 3, borderRadius: 10, border: '1px solid var(--card-border)' }}>
              <button
                onClick={() => setStatusFilter('ALL')}
                style={{
                  border: 0,
                  background: statusFilter === 'ALL' ? 'var(--card-bg)' : 'transparent',
                  color: statusFilter === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: statusFilter === 'ALL' ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Tất cả
              </button>
              <button
                onClick={() => setStatusFilter('PLANNED')}
                style={{
                  border: 0,
                  background: statusFilter === 'PLANNED' ? 'var(--primary-light)' : 'transparent',
                  color: statusFilter === 'PLANNED' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: statusFilter === 'PLANNED' ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                📌 Định xem ({items.filter((i) => (selectedType === 'ALL' || i.type === selectedType) && i.status === 'PLANNED').length})
              </button>
              <button
                onClick={() => setStatusFilter('IN_PROGRESS')}
                style={{
                  border: 0,
                  background: statusFilter === 'IN_PROGRESS' ? 'var(--amber-bg)' : 'transparent',
                  color: statusFilter === 'IN_PROGRESS' ? 'var(--amber)' : 'var(--text-muted)',
                  fontWeight: statusFilter === 'IN_PROGRESS' ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                ⏳ Đang xem ({items.filter((i) => (selectedType === 'ALL' || i.type === selectedType) && i.status === 'IN_PROGRESS').length})
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                style={{
                  border: 0,
                  background: statusFilter === 'COMPLETED' ? 'var(--emerald-bg)' : 'transparent',
                  color: statusFilter === 'COMPLETED' ? 'var(--emerald)' : 'var(--text-muted)',
                  fontWeight: statusFilter === 'COMPLETED' ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                ✅ Đã xem ({items.filter((i) => (selectedType === 'ALL' || i.type === selectedType) && i.status === 'COMPLETED').length})
              </button>
            </div>

            <input className="mini-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mục..." style={{ padding: '3px 8px', fontSize: '0.76rem', width: 110 }} />
          </div>

          {loading ? (
            <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải thư viện…</p>
          ) : filteredItems.length ? (
            <div style={{ display: 'grid', gap: 6, maxHeight: '220px', overflowY: 'auto' }}>
              {filteredItems.map((item) => {
                const cat = categories.find((c) => c.id === item.type) ?? categories[0]
                const Icon = cat.icon
                const extra = getItemChannelOrArtist(item)

                return (
                  <div key={item.id} className="check-row" style={{ justifyContent: 'space-between', background: 'var(--bg-main)', borderRadius: 8, padding: '6px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 24, height: 24 }}>
                        <Icon size={13} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        {extra && <span className="library-meta-tag">{cat.id === 'YOUTUBE' ? '📺 Kênh: ' : cat.id === 'MUSIC' ? '🎵 Ca sĩ: ' : ''}{extra}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <select
                        value={item.status}
                        onChange={(e) => patchStatusOrFavorite(item.id, { status: e.target.value as Media['status'] })}
                        style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: cat.color, fontWeight: 700, borderRadius: 6, padding: '2px 6px', fontSize: '0.72rem' }}
                      >
                        {['PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((s, i) => (
                          <option key={s} value={s}>
                            {cat.labels[i]}
                          </option>
                        ))}
                      </select>

                      <button
                        className={'icon small favorite ' + (item.is_favorite ? 'on' : '')}
                        aria-label="Toggle favorite"
                        onClick={() => patchStatusOrFavorite(item.id, { is_favorite: !item.is_favorite })}
                        style={{ padding: 2 }}
                      >
                        <Heart size={14} fill={item.is_favorite ? 'currentColor' : 'none'} />
                      </button>
                      <button className="icon small" aria-label="Edit item" onClick={() => openEdit(item)} style={{ padding: 2 }}>
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty icon={BookOpen} colorClass="icon-box-purple">
              Chưa có mục nào phù hợp. Bấm "+ Thêm mục" để tạo mới nhé!
            </Empty>
          )}
        </div>
      )}

      {/* VIEW 2: THỐNG KÊ (STATISTICS DASHBOARD) */}
      {subView === 'stats' && (
        <div>
          <div className="stats-grid" style={{ gap: 8, marginBottom: 10 }}>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ fontSize: '1.4rem' }}>{stats.total}</div>
              <div className="stat-lbl">Tổng số mục</div>
            </div>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ color: 'var(--emerald)', fontSize: '1.4rem' }}>{stats.completed}</div>
              <div className="stat-lbl">Đã xem / Xong</div>
            </div>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ color: 'var(--amber)', fontSize: '1.4rem' }}>{stats.inProgress}</div>
              <div className="stat-lbl">Đang trải nghiệm</div>
            </div>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ color: 'var(--primary)', fontSize: '1.4rem' }}>{stats.planned}</div>
              <div className="stat-lbl">Định xem / Muốn xem</div>
            </div>
          </div>

          <div className="card" style={{ padding: 12, margin: 0 }}>
            <h2 style={{ fontSize: '0.88rem', marginBottom: 8 }}>Thống kê theo từng thể loại</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {stats.categoryStats.map((cat) => {
                const Icon = cat.icon
                const percent = stats.total ? Math.round((cat.count / stats.total) * 100) : 0
                return (
                  <div key={cat.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, fontSize: '0.78rem', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 22, height: 22 }}>
                          <Icon size={12} />
                        </div>
                        <span>{cat.label}</span>
                      </div>
                      <span style={{ color: cat.color }}>
                        {cat.count} mục ({cat.doneCount} đã xong) • {percent}%
                      </span>
                    </div>
                    <div className="habit-progress-bar-bg" style={{ height: 6 }}>
                      <div className="habit-progress-bar-fill" style={{ width: `${percent}%`, background: cat.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal with Datalist / Combobox for Channel & Artist */}
      {activeModal && (
        <Modal title={(activeModal.item ? 'Sửa ' : 'Thêm ') + categories.find((c) => c.id === activeModal.kind)?.label} onClose={() => setActiveModal(null)}>
          <label>
            Tên mục
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên..." autoFocus />
          </label>

          {/* YouTube Channel Combobox */}
          {activeModal.kind === 'YOUTUBE' && (
            <label>
              Kênh YouTube (Chọn hoặc nhập kênh mới)
              <input
                list="youtube-channels"
                value={extraVal}
                onChange={(e) => setExtraVal(e.target.value)}
                placeholder="Chọn kênh hoặc nhập kênh mới…"
              />
              <datalist id="youtube-channels">
                {channels.map((ch) => (
                  <option key={ch} value={ch} />
                ))}
              </datalist>
            </label>
          )}

          {/* Music Artist Combobox */}
          {activeModal.kind === 'MUSIC' && (
            <label>
              Ca sĩ / Tác giả (Chọn hoặc nhập ca sĩ mới)
              <input
                list="music-artists"
                value={extraVal}
                onChange={(e) => setExtraVal(e.target.value)}
                placeholder="Chọn ca sĩ hoặc nhập tên ca sĩ mới…"
              />
              <datalist id="music-artists">
                {artists.map((art) => (
                  <option key={art} value={art} />
                ))}
              </datalist>
            </label>
          )}

          <label>
            Ghi chú (Tùy chọn)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Mô tả hoặc ghi chú thêm…" />
          </label>

          <div className="modal-actions">
            {activeModal.item ? <DeleteButton onDelete={deleteItem} /> : <div />}
            <button className="primary" onClick={saveItem}>
              Lưu vào cơ sở dữ liệu
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
