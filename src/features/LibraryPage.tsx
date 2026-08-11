import { useMemo, useState } from 'react'
import { BarChart3, BookOpen, Film, Heart, Music, Pencil, Plus, ScrollText, Settings2, Tv } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Media, MovieGenre } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'

const categories = [
  { id: 'BOOK', label: 'Sách', icon: BookOpen, color: 'var(--purple)', bg: 'var(--purple-bg)', labels: ['Định đọc', 'Đang đọc', 'Đã đọc'] },
  { id: 'STORY', label: 'Truyện', icon: ScrollText, color: 'var(--primary)', bg: 'var(--primary-light)', labels: ['Định đọc', 'Đang đọc', 'Đã đọc'] },
  { id: 'MOVIE', label: 'Movie', icon: Film, color: 'var(--rose)', bg: 'var(--rose-bg)', labels: ['Định xem', 'Đang xem', 'Đã xem'] },
  { id: 'YOUTUBE', label: 'YouTube', icon: Tv, color: 'var(--amber)', bg: 'var(--amber-bg)', labels: ['Định xem', 'Đang xem', 'Đã xem'] },
  { id: 'MUSIC', label: 'Nhạc', icon: Music, color: 'var(--cyan)', bg: 'var(--cyan-bg)', labels: ['Định nghe', 'Đang nghe', 'Đã nghe'] },
] as const

type Kind = (typeof categories)[number]['id']
type SubView = 'overview' | 'stats'

function getItemExtra(item: Media) {
  if (item.type === 'YOUTUBE') return item.channel ?? ''
  if (item.type === 'MUSIC') return item.artist ?? ''
  return ''
}

export function LibraryPage() {
  const { items, setItems, loading } = useQuery<Media>('media_items')
  const genres = useQuery<MovieGenre>('movie_genres', 'name')
  const [selectedType, setSelectedType] = useState<'ALL' | Kind>('ALL')
  const [subView, setSubView] = useState<SubView>('overview')
  const [search, setSearch] = useState('')
  const [activeModal, setActiveModal] = useState<{ kind: Kind; item?: Media } | null>(null)
  const [showGenres, setShowGenres] = useState(false)
  const [name, setName] = useState('')
  const [extraVal, setExtraVal] = useState('')
  const [status, setStatus] = useState<Media['status']>('PLANNED')
  const [genreId, setGenreId] = useState('')
  const [newGenre, setNewGenre] = useState('')

  const channels = useMemo(() => Array.from(new Set(items.filter((i) => i.type === 'YOUTUBE').map(getItemExtra).filter(Boolean))), [items])
  const artists = useMemo(() => Array.from(new Set(items.filter((i) => i.type === 'MUSIC').map(getItemExtra).filter(Boolean))), [items])

  const openAdd = (kind: Kind) => {
    setActiveModal({ kind })
    setName(''); setExtraVal(''); setStatus('PLANNED'); setGenreId('')
  }

  const openEdit = (item: Media) => {
    setActiveModal({ kind: item.type, item })
    setName(item.name); setExtraVal(getItemExtra(item)); setStatus(item.status); setGenreId(item.movie_genre_id ?? '')
  }

  const saveItem = async () => {
    if (!activeModal || !name.trim()) return
    const { kind, item } = activeModal
    const payload = {
      type: kind,
      name: name.trim(),
      description: null,
      channel: kind === 'YOUTUBE' ? extraVal.trim() || null : null,
      artist: kind === 'MUSIC' ? extraVal.trim() || null : null,
      movie_genre_id: kind === 'MOVIE' ? genreId || null : null,
      status,
    }
    if (item) {
      const { error } = await supabase!.from('media_items').update(payload).eq('id', item.id)
      if (error) return alert('Không thể lưu mục này. Vui lòng thử lại.')
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...payload } : i)))
    } else {
      const { data, error } = await supabase!.from('media_items').insert(payload).select().single()
      if (error || !data) return alert('Không thể tạo mục này. Hãy kiểm tra migration Supabase đã được áp dụng.')
      setItems((prev) => [data as Media, ...prev])
    }
    setActiveModal(null)
  }

  const patchItem = async (id: string, patch: Partial<Media>) => {
    const { error } = await supabase!.from('media_items').update(patch).eq('id', id)
    if (!error) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  const deleteItem = async () => {
    if (!activeModal?.item) return
    const { error } = await supabase!.from('media_items').update({ deleted_at: new Date().toISOString() }).eq('id', activeModal.item.id)
    if (!error) setItems((prev) => prev.filter((i) => i.id !== activeModal.item!.id))
    setActiveModal(null)
  }

  const addGenre = async () => {
    if (!newGenre.trim()) return
    const { data, error } = await supabase!.from('movie_genres').insert({ name: newGenre.trim() }).select().single()
    if (error || !data) return alert('Không thể thêm thể loại. Tên có thể đã tồn tại.')
    genres.setItems((prev) => [...prev, data as MovieGenre])
    setNewGenre('')
  }

  const addGenreFromMovieForm = async () => {
    const value = prompt('Tên thể loại Movie mới')?.trim()
    if (!value) return
    const { data, error } = await supabase!.from('movie_genres').insert({ name: value }).select().single()
    if (error || !data) return alert('Không thể thêm thể loại. Tên có thể đã tồn tại.')
    const genre = data as MovieGenre
    genres.setItems((prev) => [...prev, genre])
    setGenreId(genre.id)
  }

  const renameGenre = async (genre: MovieGenre) => {
    const value = prompt('Tên thể loại', genre.name)?.trim()
    if (!value || value === genre.name) return
    const { error } = await supabase!.from('movie_genres').update({ name: value }).eq('id', genre.id)
    if (!error) genres.setItems((prev) => prev.map((g) => (g.id === genre.id ? { ...g, name: value } : g)))
  }

  const deleteGenre = async (genre: MovieGenre) => {
    await supabase!.from('media_items').update({ movie_genre_id: null }).eq('movie_genre_id', genre.id)
    const { error } = await supabase!.from('movie_genres').update({ deleted_at: new Date().toISOString() }).eq('id', genre.id)
    if (!error) {
      genres.setItems((prev) => prev.filter((g) => g.id !== genre.id))
      setItems((prev) => prev.map((i) => (i.movie_genre_id === genre.id ? { ...i, movie_genre_id: null } : i)))
    }
  }

  const stats = useMemo(() => {
    const total = items.length
    return {
      total,
      completed: items.filter((i) => i.status === 'COMPLETED').length,
      inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
      planned: items.filter((i) => i.status === 'PLANNED').length,
      categoryStats: categories.map((cat) => ({ ...cat, count: items.filter((i) => i.type === cat.id).length, doneCount: items.filter((i) => i.type === cat.id && i.status === 'COMPLETED').length })),
    }
  }, [items])
  const filteredItems = items.filter((i) => (selectedType === 'ALL' || i.type === selectedType) && i.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <section style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="daily-4-icons" style={{ marginBottom: 8 }}>
        {categories.map((cat) => {
          const Icon = cat.icon
          return <button key={cat.id} className={'daily-icon-btn ' + (selectedType === cat.id ? 'active' : '')} onClick={() => setSelectedType(cat.id)} style={{ padding: '6px 4px', borderRadius: 12 }}><div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 26, height: 26 }}><Icon size={15} /></div><span style={{ fontSize: '0.7rem' }}>{cat.label}</span></button>
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <div className="habit-sub-tabs" style={{ margin: 0 }}>
          <button className={subView === 'overview' ? 'active' : ''} onClick={() => setSubView('overview')}><BookOpen size={14} /> Tổng thể ({filteredItems.length})</button>
          <button className={subView === 'stats' ? 'active' : ''} onClick={() => setSubView('stats')}><BarChart3 size={14} /> Thống kê</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {selectedType === 'MOVIE' && <button className="icon" title="Quản lý thể loại phim" onClick={() => setShowGenres(true)}><Settings2 size={16} /></button>}
          <button className="primary" onClick={() => openAdd(selectedType === 'ALL' ? 'BOOK' : selectedType)} style={{ padding: '5px 12px', fontSize: '0.8rem', gap: 4 }}><Plus size={14} /> Thêm mục</button>
        </div>
      </div>

      {subView === 'overview' && <div className="card" style={{ padding: 12, margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button className="category-chip" onClick={() => setSelectedType('ALL')} style={{ background: selectedType === 'ALL' ? 'var(--primary-light)' : 'var(--soft)', color: selectedType === 'ALL' ? 'var(--primary)' : 'var(--text-muted)', border: 0, cursor: 'pointer' }}>Tất cả ({items.length})</button>
          <input className="mini-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mục..." style={{ padding: '3px 8px', fontSize: '0.78rem', width: 130 }} />
        </div>
        {loading ? <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải thư viện…</p> : filteredItems.length ? <div style={{ display: 'grid', gap: 6, maxHeight: '240px', overflowY: 'auto' }}>
          {filteredItems.map((item) => {
            const cat = categories.find((c) => c.id === item.type) ?? categories[0]
            const Icon = cat.icon; const extra = getItemExtra(item); const genre = genres.items.find((g) => g.id === item.movie_genre_id)
            return <div key={item.id} className="check-row" style={{ justifyContent: 'space-between', background: 'var(--bg-main)', borderRadius: 8, padding: '6px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}><div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 24, height: 24 }}><Icon size={13} /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>{extra && <span className="library-meta-tag">{item.type === 'YOUTUBE' ? 'Kênh: ' : 'Ca sĩ: '}{extra}</span>}{genre && <span className="library-meta-tag">Thể loại: {genre.name}</span>}</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><select value={item.status} onChange={(e) => patchItem(item.id, { status: e.target.value as Media['status'] })} style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: cat.color, fontWeight: 700, borderRadius: 6, padding: '2px 6px', fontSize: '0.72rem' }}>{['PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((s, i) => <option key={s} value={s}>{cat.labels[i]}</option>)}</select><button className={'icon small favorite ' + (item.is_favorite ? 'on' : '')} aria-label="Yêu thích" onClick={() => patchItem(item.id, { is_favorite: !item.is_favorite })} style={{ padding: 2 }}><Heart size={14} fill={item.is_favorite ? 'currentColor' : 'none'} /></button><button className="icon small" aria-label="Sửa mục" onClick={() => openEdit(item)} style={{ padding: 2 }}><Pencil size={13} /></button></div>
            </div>
          })}
        </div> : <Empty icon={BookOpen} colorClass="icon-box-purple">Chưa có mục nào. Bấm “Thêm mục” để tạo nhé!</Empty>}
      </div>}

      {subView === 'stats' && <div><div className="stats-grid" style={{ gap: 8, marginBottom: 10 }}>{[[stats.total, 'Tổng số mục', 'var(--text-main)'], [stats.completed, 'Đã hoàn thành', 'var(--emerald)'], [stats.inProgress, 'Đang trải nghiệm', 'var(--amber)'], [stats.planned, 'Dự định', 'var(--primary)']].map(([value, label, color]) => <div className="stat-card" style={{ padding: 8 }} key={label as string}><div className="stat-val" style={{ color: color as string, fontSize: '1.4rem' }}>{value}</div><div className="stat-lbl">{label}</div></div>)}</div><div className="card" style={{ padding: 12, margin: 0 }}><h2 style={{ fontSize: '0.88rem', marginBottom: 8 }}>Thống kê theo từng thể loại</h2><div style={{ display: 'grid', gap: 8 }}>{stats.categoryStats.map((cat) => { const Icon = cat.icon; const percent = stats.total ? Math.round(cat.count / stats.total * 100) : 0; return <div key={cat.id}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, fontSize: '0.78rem', fontWeight: 600 }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={13} color={cat.color} />{cat.label}</span><span style={{ color: cat.color }}>{cat.count} mục ({cat.doneCount} đã xong) • {percent}%</span></div><div className="habit-progress-bar-bg" style={{ height: 6 }}><div className="habit-progress-bar-fill" style={{ width: `${percent}%`, background: cat.color }} /></div></div> })}</div></div></div>}

      {activeModal && <Modal title={(activeModal.item ? 'Sửa ' : 'Thêm ') + categories.find((c) => c.id === activeModal.kind)?.label} onClose={() => setActiveModal(null)}><label>Tên mục<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên..." autoFocus /></label>{activeModal.kind === 'YOUTUBE' && <label>Kênh YouTube<input list="youtube-channels" value={extraVal} onChange={(e) => setExtraVal(e.target.value)} placeholder="Chọn hoặc nhập kênh mới..." /><datalist id="youtube-channels">{channels.map((channel) => <option key={channel} value={channel} />)}</datalist></label>}{activeModal.kind === 'MUSIC' && <label>Ca sĩ / Tác giả<input list="music-artists" value={extraVal} onChange={(e) => setExtraVal(e.target.value)} placeholder="Chọn hoặc nhập ca sĩ mới..." /><datalist id="music-artists">{artists.map((artist) => <option key={artist} value={artist} />)}</datalist></label>}{activeModal.kind === 'MOVIE' && <label>Thể loại<div style={{ display: 'flex', gap: 6 }}><select value={genreId} onChange={(e) => setGenreId(e.target.value)}><option value="">Chưa phân loại</option>{genres.items.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select><button type="button" className="icon" aria-label="Thêm thể loại Movie" title="Thêm thể loại" onClick={addGenreFromMovieForm}><Plus size={16} /></button></div></label>}<label>Trạng thái<select value={status} onChange={(e) => setStatus(e.target.value as Media['status'])}>{['PLANNED', 'IN_PROGRESS', 'COMPLETED'].map((value, index) => <option key={value} value={value}>{categories.find((c) => c.id === activeModal.kind)!.labels[index]}</option>)}</select></label><div className="modal-actions">{activeModal.item ? <DeleteButton onDelete={deleteItem} /> : <div />}<button className="primary" onClick={saveItem}>Lưu</button></div></Modal>}

      {showGenres && <Modal title="Thể loại Movie" onClose={() => setShowGenres(false)}><div className="add-habit"><input value={newGenre} onChange={(e) => setNewGenre(e.target.value)} placeholder="Tên thể loại mới" onKeyDown={(e) => e.key === 'Enter' && addGenre()} /><button className="primary" onClick={addGenre}><Plus size={16} /> Thêm</button></div><div className="category-manager">{genres.items.length ? genres.items.map((genre) => <div key={genre.id}><span>{genre.name}</span><button className="icon small" aria-label="Đổi tên thể loại" onClick={() => renameGenre(genre)}><Pencil size={14} /></button><DeleteButton onDelete={() => deleteGenre(genre)} /></div>) : <p className="muted">Chưa có thể loại nào.</p>}</div></Modal>}
    </section>
  )
}
