import { useMemo, useState } from 'react'
import { BarChart3, BookOpen, Calendar, Clock, Film, FolderCog, Heart, Layers, Music, Pencil, Plus, Tv } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import type { BookAuthor, Media, MovieGenre, MusicArtist, YouTubeChannel } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'

const categories = [
  { id: 'BOOK', label: 'Books', icon: BookOpen, colorClass: 'icon-box-purple', color: 'var(--purple)', bg: 'var(--purple-bg)', labels: ['Sẽ đọc', 'Đang đọc', 'Đã đọc'] },
  { id: 'MOVIE', label: 'Movies', icon: Film, colorClass: 'icon-box-rose', color: 'var(--rose)', bg: 'var(--rose-bg)', labels: ['Sẽ xem', 'Đang xem', 'Đã xem'] },
  { id: 'YOUTUBE', label: 'YouTube', icon: Tv, colorClass: 'icon-box-amber', color: 'var(--amber)', bg: 'var(--amber-bg)', labels: ['Sẽ xem', 'Đang xem', 'Đã xem'] },
  { id: 'MUSIC', label: 'Music', icon: Music, colorClass: 'icon-box-cyan', color: 'var(--cyan)', bg: 'var(--cyan-bg)', labels: ['Sẽ nghe', 'Đang nghe', 'Đã nghe'] },
] as const

type Kind = (typeof categories)[number]['id']
type SubView = 'overview' | 'favorites' | 'stats'
type StatusFilter = 'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'

function getCurrentTimeString() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function parseDescPrefix(desc: string | null, prefix: string) {
  if (!desc) return ''
  const regex = new RegExp(`^${prefix}\\s*(.*?)(?:\\n|$)`, 'i')
  const match = desc.match(regex)
  return match ? match[1].trim() : ''
}

function getItemExtraMeta(item: Media) {
  if (item.type === 'YOUTUBE') return { label: '📺 Kênh: ', value: item.channel ?? parseDescPrefix(item.description, 'Kênh:') }
  if (item.type === 'MUSIC') return { label: '🎵 Ca sĩ: ', value: item.artist ?? parseDescPrefix(item.description, 'Ca sĩ:') }
  if (item.type === 'BOOK') return { label: '📖 Tác giả: ', value: item.author ?? parseDescPrefix(item.description, 'Tác giả:') }
  if (item.type === 'MOVIE') return { label: '🎬 Thể loại: ', value: item.genre ?? parseDescPrefix(item.description, 'Thể loại:') }
  return { label: '', value: '' }
}

function getItemDateTime(item: Media) {
  const date = item.log_date ?? (item.created_at ? item.created_at.slice(0, 10) : parseDescPrefix(item.description, 'Ngày:'))
  const time = item.log_time ?? (item.created_at ? item.created_at.slice(11, 16) : parseDescPrefix(item.description, 'Giờ:'))
  return { date: date || localDate(), time: time || getCurrentTimeString() }
}

export function LibraryPage() {
  const { showToast, showSaveToast } = useToast()
  const { items, setItems, loading } = useQuery<Media>('media_items')

  // Dedicated Management Queries for all metadata categories
  const bookAuthorsQuery = useQuery<BookAuthor>('book_authors', 'name')
  const youtubeChannelsQuery = useQuery<YouTubeChannel>('youtube_channels', 'name')
  const musicArtistsQuery = useQuery<MusicArtist>('music_artists', 'name')
  const movieGenresQuery = useQuery<MovieGenre>('movie_genres', 'name')

  // Selected Category (5 Icon-Only Buttons in 1 Row)
  const [selectedType, setSelectedType] = useState<'ALL' | Kind>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [subView, setSubView] = useState<SubView>('overview')
  const [search, setSearch] = useState('')

  // Statistics Date Filter State
  const [statsMode, setStatsMode] = useState<'DAY' | 'ALL'>('DAY')
  const [statsDate, setStatsDate] = useState<string>(localDate())

  // Modal State for Add & Edit
  const [activeModal, setActiveModal] = useState<{ kind: Kind; item?: Media } | null>(null)

  // Dedicated Manager Modal States
  const [manageAuthorsModal, setManageAuthorsModal] = useState(false)
  const [manageChannelsModal, setManageChannelsModal] = useState(false)
  const [manageArtistsModal, setManageArtistsModal] = useState(false)
  const [manageGenresModal, setManageGenresModal] = useState(false)

  // New Management Item Input Values
  const [newAuthorName, setNewAuthorName] = useState('')
  const [newChannelName, setNewChannelName] = useState('')
  const [newArtistName, setNewArtistName] = useState('')
  const [newGenreName, setNewGenreName] = useState('')

  const [name, setName] = useState('')
  const [extraVal, setExtraVal] = useState('') // Channel, Artist, Author, or Genre
  const [logDate, setLogDate] = useState<string>(localDate())
  const [logTime, setLogTime] = useState<string>(getCurrentTimeString())
  const [statusVal, setStatusVal] = useState<Media['status']>('PLANNED')

  // Datalist collections merged from DB query and item history
  const channels = useMemo(() => {
    const set = new Set<string>(youtubeChannelsQuery.items.map((c) => c.name))
    items.filter((i) => i.type === 'YOUTUBE').forEach((i) => {
      const val = getItemExtraMeta(i).value
      if (val) set.add(val)
    })
    return Array.from(set)
  }, [items, youtubeChannelsQuery.items])

  const artists = useMemo(() => {
    const set = new Set<string>(musicArtistsQuery.items.map((a) => a.name))
    items.filter((i) => i.type === 'MUSIC').forEach((i) => {
      const val = getItemExtraMeta(i).value
      if (val) set.add(val)
    })
    return Array.from(set)
  }, [items, musicArtistsQuery.items])

  const authors = useMemo(() => {
    const set = new Set<string>(bookAuthorsQuery.items.map((a) => a.name))
    items.filter((i) => i.type === 'BOOK').forEach((i) => {
      const val = getItemExtraMeta(i).value
      if (val) set.add(val)
    })
    return Array.from(set)
  }, [items, bookAuthorsQuery.items])

  const movieGenres = useMemo(() => {
    const set = new Set<string>(movieGenresQuery.items.map((g) => g.name))
    items.filter((i) => i.type === 'MOVIE').forEach((i) => {
      const val = getItemExtraMeta(i).value
      if (val) set.add(val)
    })
    return Array.from(set)
  }, [items, movieGenresQuery.items])

  const activeCategoryTitle = useMemo(() => {
    if (selectedType === 'ALL') return 'Tất cả thể loại'
    return categories.find((c) => c.id === selectedType)?.label ?? 'Tất cả'
  }, [selectedType])

  const openAdd = (kind: Kind) => {
    setActiveModal({ kind })
    setName('')
    setExtraVal('')
    setLogDate(localDate())
    setLogTime(getCurrentTimeString())
    setStatusVal('PLANNED')
  }

  const openEdit = (item: Media) => {
    const meta = getItemExtraMeta(item)
    const dateTime = getItemDateTime(item)
    setActiveModal({ kind: item.type as Kind, item })
    setName(item.name)
    setExtraVal(meta.value)
    setLogDate(dateTime.date)
    setLogTime(dateTime.time)
    setStatusVal(item.status ?? 'PLANNED')
  }

  const saveItem = async () => {
    if (!activeModal || !name.trim()) return
    const { kind, item } = activeModal

    const payload: Partial<Media> = {
      type: kind,
      name: name.trim(),
      status: statusVal,
      log_date: logDate,
      log_time: logTime,
      channel: kind === 'YOUTUBE' ? extraVal.trim() || null : null,
      artist: kind === 'MUSIC' ? extraVal.trim() || null : null,
      author: kind === 'BOOK' ? extraVal.trim() || null : null,
      genre: kind === 'MOVIE' ? extraVal.trim() || null : null,
    }

    if (item) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...payload } : i)))
      const { error } = await supabase!.from('media_items').update(payload).eq('id', item.id)
      if (error) {
        const prefix = kind === 'YOUTUBE' ? 'Kênh:' : kind === 'MUSIC' ? 'Ca sĩ:' : kind === 'BOOK' ? 'Tác giả:' : 'Thể loại:'
        const formattedDesc = `${prefix} ${extraVal.trim()}\nNgày: ${logDate}\nGiờ: ${logTime}`
        await supabase!.from('media_items').update({ name: name.trim(), status: statusVal, description: formattedDesc }).eq('id', item.id)
        showSaveToast(false, 'mục thư viện')
      } else {
        showSaveToast(true, 'mục thư viện')
      }
    } else {
      const insertData = { ...payload, status: statusVal }
      const { data, error } = await supabase!.from('media_items').insert(insertData).select().single()
      if (!error && data) {
        setItems((prev) => [data as Media, ...prev])
        showSaveToast(true, 'mục thư viện')
      } else {
        const prefix = kind === 'YOUTUBE' ? 'Kênh:' : kind === 'MUSIC' ? 'Ca sĩ:' : kind === 'BOOK' ? 'Tác giả:' : 'Thể loại:'
        const formattedDesc = `${prefix} ${extraVal.trim()}\nNgày: ${logDate}\nGiờ: ${logTime}`
        const fallbackRes = await supabase!
          .from('media_items')
          .insert({ type: kind, name: name.trim(), description: formattedDesc, status: statusVal })
          .select()
          .single()
        if (fallbackRes.data) {
          setItems((prev) => [{ ...(fallbackRes.data as Media), ...payload }, ...prev])
        } else {
          const tempMedia: Media = {
            id: Date.now().toString(),
            name: name.trim(),
            type: kind,
            status: statusVal,
            is_favorite: false,
            description: null,
            log_date: logDate,
            log_time: logTime,
            channel: kind === 'YOUTUBE' ? extraVal.trim() || null : null,
            artist: kind === 'MUSIC' ? extraVal.trim() || null : null,
            author: kind === 'BOOK' ? extraVal.trim() || null : null,
            genre: kind === 'MOVIE' ? extraVal.trim() || null : null,
          }
          setItems((prev) => [tempMedia, ...prev])
        }
        showSaveToast(false, 'mục thư viện')
      }
    }

    setActiveModal(null)
  }

  // 1. Book Authors Manager Functions
  const addBookAuthor = async () => {
    if (!newAuthorName.trim()) return
    const name = newAuthorName.trim()
    const tempId = Date.now().toString()
    bookAuthorsQuery.setItems((prev) => [...prev.filter((a) => a.name !== name), { id: tempId, name }])
    setNewAuthorName('')
    showToast('➕ Đã thêm tác giả mới!')

    const { data } = await supabase!.from('book_authors').insert({ name }).select().single()
    if (data) bookAuthorsQuery.setItems((prev) => prev.map((a) => (a.id === tempId ? (data as BookAuthor) : a)))
  }

  const renameBookAuthor = async (a: BookAuthor) => {
    const val = prompt('Tên tác giả mới:', a.name)?.trim()
    if (!val || val === a.name) return
    bookAuthorsQuery.setItems((prev) => prev.map((item) => (item.id === a.id ? { ...item, name: val } : item)))
    await supabase!.from('book_authors').update({ name: val }).eq('id', a.id)
    showToast('✏️ Đã sửa tên tác giả!')
  }

  const deleteBookAuthor = async (a: BookAuthor) => {
    bookAuthorsQuery.setItems((prev) => prev.filter((item) => item.id !== a.id))
    await supabase!.from('book_authors').update({ deleted_at: new Date().toISOString() }).eq('id', a.id)
    showToast('🗑️ Đã xóa tác giả', 'delete')
  }

  // 2. YouTube Channels Manager Functions
  const addYouTubeChannel = async () => {
    if (!newChannelName.trim()) return
    const name = newChannelName.trim()
    const tempId = Date.now().toString()
    youtubeChannelsQuery.setItems((prev) => [...prev.filter((c) => c.name !== name), { id: tempId, name }])
    setNewChannelName('')
    showToast('➕ Đã thêm kênh mới!')

    const { data } = await supabase!.from('youtube_channels').insert({ name }).select().single()
    if (data) youtubeChannelsQuery.setItems((prev) => prev.map((c) => (c.id === tempId ? (data as YouTubeChannel) : c)))
  }

  const renameYouTubeChannel = async (c: YouTubeChannel) => {
    const val = prompt('Tên kênh mới:', c.name)?.trim()
    if (!val || val === c.name) return
    youtubeChannelsQuery.setItems((prev) => prev.map((item) => (item.id === c.id ? { ...item, name: val } : item)))
    await supabase!.from('youtube_channels').update({ name: val }).eq('id', c.id)
    showToast('✏️ Đã sửa tên kênh!')
  }

  const deleteYouTubeChannel = async (c: YouTubeChannel) => {
    youtubeChannelsQuery.setItems((prev) => prev.filter((item) => item.id !== c.id))
    await supabase!.from('youtube_channels').update({ deleted_at: new Date().toISOString() }).eq('id', c.id)
    showToast('🗑️ Đã xóa kênh', 'delete')
  }

  // 3. Music Artists Manager Functions
  const addMusicArtist = async () => {
    if (!newArtistName.trim()) return
    const name = newArtistName.trim()
    const tempId = Date.now().toString()
    musicArtistsQuery.setItems((prev) => [...prev.filter((art) => art.name !== name), { id: tempId, name }])
    setNewArtistName('')
    showToast('➕ Đã thêm ca sĩ mới!')

    const { data } = await supabase!.from('music_artists').insert({ name }).select().single()
    if (data) musicArtistsQuery.setItems((prev) => prev.map((art) => (art.id === tempId ? (data as MusicArtist) : art)))
  }

  const renameMusicArtist = async (art: MusicArtist) => {
    const val = prompt('Tên ca sĩ mới:', art.name)?.trim()
    if (!val || val === art.name) return
    musicArtistsQuery.setItems((prev) => prev.map((item) => (item.id === art.id ? { ...item, name: val } : item)))
    await supabase!.from('music_artists').update({ name: val }).eq('id', art.id)
    showToast('✏️ Đã sửa tên ca sĩ!')
  }

  const deleteMusicArtist = async (art: MusicArtist) => {
    musicArtistsQuery.setItems((prev) => prev.filter((item) => item.id !== art.id))
    await supabase!.from('music_artists').update({ deleted_at: new Date().toISOString() }).eq('id', art.id)
    showToast('🗑️ Đã xóa ca sĩ', 'delete')
  }

  // 4. Movie Genres Manager Functions
  const addMovieGenre = async () => {
    if (!newGenreName.trim()) return
    const name = newGenreName.trim()
    const tempId = Date.now().toString()
    movieGenresQuery.setItems((prev) => [...prev.filter((g) => g.name !== name), { id: tempId, name }])
    setNewGenreName('')
    showToast('➕ Đã thêm thể loại phim mới!')

    const { data } = await supabase!.from('movie_genres').insert({ name }).select().single()
    if (data) movieGenresQuery.setItems((prev) => prev.map((g) => (g.id === tempId ? (data as MovieGenre) : g)))
  }

  const renameMovieGenre = async (g: MovieGenre) => {
    const val = prompt('Tên thể loại phim mới:', g.name)?.trim()
    if (!val || val === g.name) return
    movieGenresQuery.setItems((prev) => prev.map((item) => (item.id === g.id ? { ...item, name: val } : item)))
    await supabase!.from('movie_genres').update({ name: val }).eq('id', g.id)
    showToast('✏️ Đã sửa tên thể loại phim!')
  }

  const deleteMovieGenre = async (g: MovieGenre) => {
    movieGenresQuery.setItems((prev) => prev.filter((item) => item.id !== g.id))
    await supabase!.from('movie_genres').update({ deleted_at: new Date().toISOString() }).eq('id', g.id)
    showToast('🗑️ Đã xóa thể loại phim', 'delete')
  }

  const patchStatusOrFavorite = async (id: string, patch: Partial<Media>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    await supabase!.from('media_items').update(patch).eq('id', id)
    if (patch.is_favorite !== undefined) {
      showToast(patch.is_favorite ? '❤️ Đã thêm vào danh sách yêu thích!' : '💔 Đã bỏ khỏi danh sách yêu thích')
    } else if (patch.status) {
      showToast('🔄 Đã cập nhật trạng thái mục!')
    }
  }

  const deleteItem = async () => {
    if (!activeModal?.item) return
    const id = activeModal.item.id
    await supabase!.from('media_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setActiveModal(null)
    showToast('🗑️ Đã xóa mục khỏi thư viện', 'delete')
  }

  // Stats Calculation with Date Filtering Support
  const stats = useMemo(() => {
    const scopeItems = items.filter((i) => {
      if (selectedType !== 'ALL' && i.type !== selectedType) return false
      if (statsMode === 'DAY') {
        const itemDate = getItemDateTime(i).date
        return itemDate === statsDate
      }
      return true
    })

    const total = scopeItems.length
    const completed = scopeItems.filter((i) => i.status === 'COMPLETED').length
    const inProgress = scopeItems.filter((i) => i.status === 'IN_PROGRESS').length
    const planned = scopeItems.filter((i) => i.status === 'PLANNED').length
    const favoriteCount = scopeItems.filter((i) => i.is_favorite).length

    const categoryStats = categories.map((cat) => {
      const catItems = scopeItems.filter((i) => i.type === cat.id)
      return {
        ...cat,
        count: catItems.length,
        doneCount: catItems.filter((i) => i.status === 'COMPLETED').length,
        inProgressCount: catItems.filter((i) => i.status === 'IN_PROGRESS').length,
        plannedCount: catItems.filter((i) => i.status === 'PLANNED').length,
      }
    })

    return { total, completed, inProgress, planned, favoriteCount, categoryStats }
  }, [items, selectedType, statsMode, statsDate])

  // Filter Overview Items
  const filteredOverviewItems = useMemo(() => {
    return items.filter(
      (i) =>
        (selectedType === 'ALL' || i.type === selectedType) &&
        (statusFilter === 'ALL' || i.status === statusFilter) &&
        i.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [items, selectedType, statusFilter, search])

  // Filter Favorite Items
  const favoriteItems = useMemo(() => {
    return items.filter(
      (i) =>
        i.is_favorite &&
        (selectedType === 'ALL' || i.type === selectedType) &&
        i.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [items, selectedType, search])

  // Ultra-Resilient Non-Overflowing Media Row Renderer
  const renderMediaRow = (item: Media) => {
    const cat = categories.find((c) => c.id === item.type) ?? categories[0]
    const Icon = cat.icon
    const meta = getItemExtraMeta(item)
    const dateTime = getItemDateTime(item)

    return (
      <div
        key={item.id}
        className="check-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          background: 'var(--bg-main)',
          borderRadius: 8,
          padding: '6px 8px',
          marginBottom: 0,
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Left Column: Icon + Wrappable Title + Badges */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 22, height: 22, flexShrink: 0, marginTop: 2 }}>
            <Icon size={12} />
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                lineHeight: 1.3,
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }}
            >
              {item.name}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
              {meta.value && (
                <span className="library-meta-tag" style={{ fontSize: '0.64rem', padding: '1px 5px', borderRadius: 4, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meta.label}{meta.value}
                </span>
              )}
              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--card-bg)', padding: '1px 5px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                📅 {dateTime.date} ⏰ {dateTime.time}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Controls always stay 100% inside card bounds */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          <select
            value={item.status}
            onChange={(e) => patchStatusOrFavorite(item.id, { status: e.target.value as Media['status'] })}
            style={{
              border: '1px solid var(--card-border)',
              background: 'var(--card-bg)',
              color: cat.color,
              fontWeight: 700,
              borderRadius: 6,
              padding: '2px 4px',
              fontSize: '0.68rem',
              maxWidth: 78,
              cursor: 'pointer',
            }}
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
            style={{ padding: 3, flexShrink: 0 }}
          >
            <Heart size={13} fill={item.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <button className="icon small" aria-label="Edit item" onClick={() => openEdit(item)} style={{ padding: 3, flexShrink: 0 }}>
            <Pencil size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <section style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* TITLE BADGE CENTER / INLINE: Shows Active Tab Name Next To Category */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-light)', padding: '3px 12px', borderRadius: 20 }}>
          Library • {activeCategoryTitle}
        </span>
      </div>

      {/* ROW 1: 5 ICON CATEGORIES IN 1 ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 8 }}>
        <button
          className={'daily-icon-btn ' + (selectedType === 'ALL' ? 'active' : '')}
          onClick={() => setSelectedType('ALL')}
          title="Tất cả thể loại"
          style={{ padding: '4px 0', borderRadius: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          <div className="icon-box icon-box-sm icon-box-blue" style={{ width: 26, height: 26 }}>
            <Layers size={14} />
          </div>
        </button>

        {categories.map((cat) => {
          const Icon = cat.icon
          const isSelected = selectedType === cat.id
          return (
            <button
              key={cat.id}
              className={'daily-icon-btn ' + (isSelected ? 'active' : '')}
              onClick={() => setSelectedType(cat.id)}
              title={cat.label}
              style={{ padding: '4px 0', borderRadius: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 26, height: 26 }}>
                <Icon size={14} />
              </div>
            </button>
          )
        })}
      </div>

      {/* ROW 2: SUB-TABS INCLUDING "+ THÊM" BUTTON INSIDE 100% RESPONSIVE BAR */}
      <div className="habit-sub-tabs" style={{ marginBottom: 8 }}>
        <button className={subView === 'overview' ? 'active' : ''} onClick={() => setSubView('overview')} style={{ padding: '5px 4px', fontSize: '0.74rem' }}>
          <BookOpen size={12} /> Tổng thể ({filteredOverviewItems.length})
        </button>
        <button className={subView === 'favorites' ? 'active' : ''} onClick={() => setSubView('favorites')} style={{ padding: '5px 4px', fontSize: '0.74rem' }}>
          <Heart size={12} style={{ color: 'var(--rose)' }} /> Yêu thích ({favoriteItems.length})
        </button>
        <button className={subView === 'stats' ? 'active' : ''} onClick={() => setSubView('stats')} style={{ padding: '5px 4px', fontSize: '0.74rem' }}>
          <BarChart3 size={12} /> Thống kê
        </button>
        <button
          onClick={() => openAdd(selectedType === 'ALL' ? 'BOOK' : selectedType)}
          style={{ background: 'var(--primary)', color: 'white', fontWeight: 700, padding: '5px 4px', fontSize: '0.74rem', gap: 2 }}
        >
          <Plus size={13} /> Thêm
        </button>
      </div>

      {/* VIEW 1: TỔNG THỂ (OVERVIEW VIEW) */}
      {subView === 'overview' && (
        <div className="card" style={{ padding: 10, margin: 0 }}>
          {/* SEARCH & STATUS SEGMENT BAR */}
          <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
            {/* Status Segmented Control (Sẽ / Đang / Đã) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, background: 'var(--bg-main)', padding: 3, borderRadius: 10, border: '1px solid var(--card-border)' }}>
              <button
                onClick={() => setStatusFilter('ALL')}
                style={{
                  border: 0,
                  background: statusFilter === 'ALL' ? 'var(--card-bg)' : 'transparent',
                  color: statusFilter === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: statusFilter === 'ALL' ? 700 : 500,
                  fontSize: '0.7rem',
                  padding: '3px 0',
                  borderRadius: 7,
                  cursor: 'pointer',
                  textAlign: 'center',
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
                  fontSize: '0.7rem',
                  padding: '3px 0',
                  borderRadius: 7,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                📌 Sẽ ({items.filter((i) => (selectedType === 'ALL' || i.type === selectedType) && i.status === 'PLANNED').length})
              </button>
              <button
                onClick={() => setStatusFilter('IN_PROGRESS')}
                style={{
                  border: 0,
                  background: statusFilter === 'IN_PROGRESS' ? 'var(--amber-bg)' : 'transparent',
                  color: statusFilter === 'IN_PROGRESS' ? 'var(--amber)' : 'var(--text-muted)',
                  fontWeight: statusFilter === 'IN_PROGRESS' ? 700 : 500,
                  fontSize: '0.7rem',
                  padding: '3px 0',
                  borderRadius: 7,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                ⏳ Đang ({items.filter((i) => (selectedType === 'ALL' || i.type === selectedType) && i.status === 'IN_PROGRESS').length})
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                style={{
                  border: 0,
                  background: statusFilter === 'COMPLETED' ? 'var(--emerald-bg)' : 'transparent',
                  color: statusFilter === 'COMPLETED' ? 'var(--emerald)' : 'var(--text-muted)',
                  fontWeight: statusFilter === 'COMPLETED' ? 700 : 500,
                  fontSize: '0.7rem',
                  padding: '3px 0',
                  borderRadius: 7,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                ✅ Đã ({items.filter((i) => (selectedType === 'ALL' || i.type === selectedType) && i.status === 'COMPLETED').length})
              </button>
            </div>

            {/* Search Input Bar */}
            <div style={{ position: 'relative' }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm mục trong thư viện…"
                style={{ width: '100%', border: '1px solid var(--card-border)', borderRadius: 8, padding: '4px 10px', fontSize: '0.76rem', background: 'var(--bg-main)' }}
              />
            </div>
          </div>

          {loading ? (
            <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải thư viện…</p>
          ) : filteredOverviewItems.length ? (
            <div style={{ display: 'grid', gap: 6, maxHeight: '220px', overflowY: 'auto' }}>
              {filteredOverviewItems.map(renderMediaRow)}
            </div>
          ) : (
            <Empty icon={BookOpen} colorClass="icon-box-purple">
              Chưa có mục nào phù hợp. Bấm "+ Thêm" ở trên để tạo mới nhé!
            </Empty>
          )}
        </div>
      )}

      {/* VIEW 2: YÊU THÍCH (FAVORITES VIEW) */}
      {subView === 'favorites' && (
        <div className="card" style={{ padding: 10, margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.84rem', color: 'var(--rose)' }}>
              <Heart size={14} fill="currentColor" />
              <span>Danh sách Yêu thích ({favoriteItems.length})</span>
            </div>
            <input className="mini-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm…" style={{ padding: '3px 6px', fontSize: '0.74rem', width: 85 }} />
          </div>

          {loading ? (
            <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải yêu thích…</p>
          ) : favoriteItems.length ? (
            <div style={{ display: 'grid', gap: 6, maxHeight: '220px', overflowY: 'auto' }}>
              {favoriteItems.map(renderMediaRow)}
            </div>
          ) : (
            <Empty icon={Heart} colorClass="icon-box-rose">
              Chưa có mục nào được thả tim. Thả tim biểu tượng trái tim để thêm vào yêu thích nhé!
            </Empty>
          )}
        </div>
      )}

      {/* VIEW 3: THỐNG KÊ (STATISTICS DASHBOARD WITH DAILY FILTERING) */}
      {subView === 'stats' && (
        <div>
          {/* Daily Date Filter Selector for Statistics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 3, background: 'var(--bg-main)', padding: 2, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <button
                onClick={() => setStatsMode('DAY')}
                style={{
                  border: 0,
                  background: statsMode === 'DAY' ? 'var(--card-bg)' : 'transparent',
                  color: statsMode === 'DAY' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: statsMode === 'DAY' ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                📅 Thống kê Ngày
              </button>
              <button
                onClick={() => setStatsMode('ALL')}
                style={{
                  border: 0,
                  background: statsMode === 'ALL' ? 'var(--card-bg)' : 'transparent',
                  color: statsMode === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                  fontWeight: statsMode === 'ALL' ? 700 : 500,
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                🌐 Tất cả thời gian
              </button>
            </div>

            {statsMode === 'DAY' && (
              <input
                type="date"
                value={statsDate}
                onChange={(e) => setStatsDate(e.target.value)}
                style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: '3px 6px', fontSize: '0.74rem', fontWeight: 700, background: 'var(--bg-main)', color: 'var(--primary)' }}
              />
            )}
          </div>

          <div className="stats-grid" style={{ gap: 6, marginBottom: 8 }}>
            <div className="stat-card" style={{ padding: 6 }}>
              <div className="stat-val" style={{ fontSize: '1.3rem' }}>{stats.total}</div>
              <div className="stat-lbl">{statsMode === 'DAY' ? 'Mục trong ngày' : 'Tổng mục'}</div>
            </div>
            <div className="stat-card" style={{ padding: 6 }}>
              <div className="stat-val" style={{ color: 'var(--rose)', fontSize: '1.3rem' }}>{stats.favoriteCount}</div>
              <div className="stat-lbl">Yêu thích</div>
            </div>
            <div className="stat-card" style={{ padding: 6 }}>
              <div className="stat-val" style={{ color: 'var(--emerald)', fontSize: '1.3rem' }}>{stats.completed}</div>
              <div className="stat-lbl">Đã xong</div>
            </div>
            <div className="stat-card" style={{ padding: 6 }}>
              <div className="stat-val" style={{ color: 'var(--amber)', fontSize: '1.3rem' }}>{stats.inProgress}</div>
              <div className="stat-lbl">Đang xem</div>
            </div>
          </div>

          <div className="card" style={{ padding: 10, margin: 0 }}>
            <h2 style={{ fontSize: '0.85rem', marginBottom: 6 }}>
              Thống kê {categories.length} thể loại {statsMode === 'DAY' ? `(Ngày ${statsDate})` : '(Toàn bộ)'}
            </h2>
            <div style={{ display: 'grid', gap: 6 }}>
              {stats.categoryStats.map((cat) => {
                const Icon = cat.icon
                const percent = stats.total ? Math.round((cat.count / stats.total) * 100) : 0
                return (
                  <div key={cat.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, fontSize: '0.76rem', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div className="icon-box icon-box-sm" style={{ background: cat.bg, color: cat.color, width: 20, height: 20 }}>
                          <Icon size={11} />
                        </div>
                        <span>{cat.label}</span>
                      </div>
                      <span style={{ color: cat.color }}>
                        {cat.count} mục ({cat.doneCount} xong, {cat.inProgressCount} đang, {cat.plannedCount} sẽ) • {percent}%
                      </span>
                    </div>
                    <div className="habit-progress-bar-bg" style={{ height: 5 }}>
                      <div className="habit-progress-bar-fill" style={{ width: `${percent}%`, background: cat.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal with Header Manage Buttons for All Metadata Categories */}
      {activeModal && (
        <Modal title={(activeModal.item ? 'Sửa ' : 'Thêm ') + categories.find((c) => c.id === activeModal.kind)?.label} onClose={() => setActiveModal(null)}>
          <label>
            Tên mục
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên..." autoFocus />
          </label>

          {/* 1. Book Author Field with Manage Button */}
          {activeModal.kind === 'BOOK' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Tác giả sách</span>
                <button
                  type="button"
                  className="icon small"
                  aria-label="Manage authors"
                  onClick={(e) => {
                    e.preventDefault()
                    setManageAuthorsModal(true)
                  }}
                  style={{ fontSize: '0.76rem', gap: 4, display: 'flex', alignItems: 'center', color: 'var(--purple)', fontWeight: 700 }}
                >
                  <FolderCog size={13} /> Quản lý tác giả
                </button>
              </div>
              <input
                list="book-authors-list"
                value={extraVal}
                onChange={(e) => setExtraVal(e.target.value)}
                placeholder="Chọn hoặc nhập tên tác giả mới…"
              />
              <datalist id="book-authors-list">
                {authors.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
          )}

          {/* 2. Movie Genre Field with Manage Button */}
          {activeModal.kind === 'MOVIE' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Thể loại phim</span>
                <button
                  type="button"
                  className="icon small"
                  aria-label="Manage genres"
                  onClick={(e) => {
                    e.preventDefault()
                    setManageGenresModal(true)
                  }}
                  style={{ fontSize: '0.76rem', gap: 4, display: 'flex', alignItems: 'center', color: 'var(--rose)', fontWeight: 700 }}
                >
                  <FolderCog size={13} /> Quản lý thể loại
                </button>
              </div>
              <input
                list="movie-genres-list"
                value={extraVal}
                onChange={(e) => setExtraVal(e.target.value)}
                placeholder="Chọn hoặc nhập thể loại phim mới…"
              />
              <datalist id="movie-genres-list">
                {movieGenres.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
          )}

          {/* 3. YouTube Channel Field with Manage Button */}
          {activeModal.kind === 'YOUTUBE' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Kênh YouTube</span>
                <button
                  type="button"
                  className="icon small"
                  aria-label="Manage channels"
                  onClick={(e) => {
                    e.preventDefault()
                    setManageChannelsModal(true)
                  }}
                  style={{ fontSize: '0.76rem', gap: 4, display: 'flex', alignItems: 'center', color: 'var(--amber)', fontWeight: 700 }}
                >
                  <FolderCog size={13} /> Quản lý kênh
                </button>
              </div>
              <input
                list="youtube-channels-list"
                value={extraVal}
                onChange={(e) => setExtraVal(e.target.value)}
                placeholder="Chọn kênh hoặc nhập kênh mới…"
              />
              <datalist id="youtube-channels-list">
                {channels.map((ch) => (
                  <option key={ch} value={ch} />
                ))}
              </datalist>
            </div>
          )}

          {/* 4. Music Artist Field with Manage Button */}
          {activeModal.kind === 'MUSIC' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Ca sĩ / Nhạc sĩ</span>
                <button
                  type="button"
                  className="icon small"
                  aria-label="Manage artists"
                  onClick={(e) => {
                    e.preventDefault()
                    setManageArtistsModal(true)
                  }}
                  style={{ fontSize: '0.76rem', gap: 4, display: 'flex', alignItems: 'center', color: 'var(--cyan)', fontWeight: 700 }}
                >
                  <FolderCog size={13} /> Quản lý ca sĩ
                </button>
              </div>
              <input
                list="music-artists-list"
                value={extraVal}
                onChange={(e) => setExtraVal(e.target.value)}
                placeholder="Chọn ca sĩ hoặc nhập tên ca sĩ mới…"
              />
              <datalist id="music-artists-list">
                {artists.map((art) => (
                  <option key={art} value={art} />
                ))}
              </datalist>
            </div>
          )}

          {/* Date and Time Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <label>
              📅 Ngày
              <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </label>
            <label>
              ⏰ Giờ
              <input type="time" value={logTime} onChange={(e) => setLogTime(e.target.value)} />
            </label>
          </div>

          {/* Status Selection: Sẽ / Đang / Đã */}
          <label>
            Trạng thái
            <select value={statusVal} onChange={(e) => setStatusVal(e.target.value as Media['status'])} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
              <option value="PLANNED">📌 Sẽ {activeModal.kind === 'BOOK' ? 'đọc' : activeModal.kind === 'MUSIC' ? 'nghe' : 'xem'}</option>
              <option value="IN_PROGRESS">⏳ Đang {activeModal.kind === 'BOOK' ? 'đọc' : activeModal.kind === 'MUSIC' ? 'nghe' : 'xem'}</option>
              <option value="COMPLETED">✅ Đã {activeModal.kind === 'BOOK' ? 'đọc' : activeModal.kind === 'MUSIC' ? 'nghe' : 'xem'}</option>
            </select>
          </label>

          <div className="modal-actions">
            {activeModal.item ? <DeleteButton onDelete={deleteItem} /> : <div />}
            <button className="primary" onClick={saveItem}>
              Lưu vào cơ sở dữ liệu
            </button>
          </div>
        </Modal>
      )}

      {/* 1. Book Authors Manager Modal */}
      {manageAuthorsModal && (
        <Modal title="📖 Quản lý tác giả sách" onClose={() => setManageAuthorsModal(false)}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input
              value={newAuthorName}
              onChange={(e) => setNewAuthorName(e.target.value)}
              placeholder="Tên tác giả mới…"
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.86rem' }}
            />
            <button className="primary" onClick={addBookAuthor} style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
              Thêm
            </button>
          </div>

          <div style={{ display: 'grid', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
            {bookAuthorsQuery.items.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '6px 10px', borderRadius: 8 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{a.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon small" aria-label="Sửa tác giả" onClick={() => renameBookAuthor(a)} style={{ padding: 3 }}>
                    <Pencil size={13} />
                  </button>
                  <DeleteButton onDelete={() => deleteBookAuthor(a)} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* 2. YouTube Channels Manager Modal */}
      {manageChannelsModal && (
        <Modal title="📺 Quản lý kênh YouTube" onClose={() => setManageChannelsModal(false)}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Tên kênh YouTube mới…"
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.86rem' }}
            />
            <button className="primary" onClick={addYouTubeChannel} style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
              Thêm
            </button>
          </div>

          <div style={{ display: 'grid', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
            {youtubeChannelsQuery.items.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '6px 10px', borderRadius: 8 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{c.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon small" aria-label="Sửa kênh" onClick={() => renameYouTubeChannel(c)} style={{ padding: 3 }}>
                    <Pencil size={13} />
                  </button>
                  <DeleteButton onDelete={() => deleteYouTubeChannel(c)} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* 3. Music Artists Manager Modal */}
      {manageArtistsModal && (
        <Modal title="🎵 Quản lý ca sĩ / nhạc sĩ" onClose={() => setManageArtistsModal(false)}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input
              value={newArtistName}
              onChange={(e) => setNewArtistName(e.target.value)}
              placeholder="Tên ca sĩ / nhạc sĩ mới…"
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.86rem' }}
            />
            <button className="primary" onClick={addMusicArtist} style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
              Thêm
            </button>
          </div>

          <div style={{ display: 'grid', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
            {musicArtistsQuery.items.map((art) => (
              <div key={art.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '6px 10px', borderRadius: 8 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{art.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon small" aria-label="Sửa ca sĩ" onClick={() => renameMusicArtist(art)} style={{ padding: 3 }}>
                    <Pencil size={13} />
                  </button>
                  <DeleteButton onDelete={() => deleteMusicArtist(art)} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* 4. Movie Genres Manager Modal */}
      {manageGenresModal && (
        <Modal title="🎬 Quản lý thể loại phim" onClose={() => setManageGenresModal(false)}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input
              value={newGenreName}
              onChange={(e) => setNewGenreName(e.target.value)}
              placeholder="Tên thể loại phim mới…"
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.86rem' }}
            />
            <button className="primary" onClick={addMovieGenre} style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
              Thêm
            </button>
          </div>

          <div style={{ display: 'grid', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
            {movieGenresQuery.items.map((g) => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '6px 10px', borderRadius: 8 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{g.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon small" aria-label="Sửa thể loại" onClick={() => renameMovieGenre(g)} style={{ padding: 3 }}>
                    <Pencil size={13} />
                  </button>
                  <DeleteButton onDelete={() => deleteMovieGenre(g)} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </section>
  )
}
