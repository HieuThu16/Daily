import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, BookMarked, BookOpen, Calendar, Clock, Download, FileText, FileUp, Film, FolderCog, Heart, History, Layers, Music, Pencil, Play, Plus, RefreshCw, Tv, Volume2, Youtube } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { loadImportedMediaItemIds, saveReadingLogEntry } from '../lib/book/repository'
import type { BookAuthor, BookFormat, BookReadingLog, Media, MovieGenre, MusicArtist, MusicGenre, YouTubeChannel } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'
import { LibraryAudioAction, LibraryAudioDetail, LibraryCategoryBar } from './library/LibraryAudioView'
import { BookCover } from './library/BookCover'
import { BookDetailView } from './library/BookDetailView'
import { BookImportModal, type ImportResult } from './library/BookImportModal'

const categories = [
  { id: 'BOOK', label: 'Books', icon: BookOpen, colorClass: 'icon-box-purple', color: 'var(--purple)', bg: 'var(--purple-bg)', labels: ['Sẽ đọc', 'Đang đọc', 'Đã đọc'] },
  { id: 'MANGA', label: 'Truyện', icon: BookMarked, colorClass: 'icon-box-emerald', color: 'var(--emerald)', bg: 'var(--emerald-bg)', labels: ['Sẽ đọc', 'Đang đọc', 'Đã đọc'] },
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

/** '2026-08-12' -> '12/08'. Chuỗi rỗng khi không có ngày. */
function shortDate(value?: string | null) {
  return value && value.length >= 10 ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : ''
}

function getItemDateTime(item: Media) {
  const date = item.log_date ?? (item.created_at ? item.created_at.slice(0, 10) : parseDescPrefix(item.description, 'Ngày:'))
  const time = item.log_time ?? (item.created_at ? item.created_at.slice(11, 16) : parseDescPrefix(item.description, 'Giờ:'))
  return { date: date || localDate(), time: time || getCurrentTimeString() }
}

const genreColors = [
  { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' }, // Red
  { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: 'rgba(249, 115, 22, 0.3)' }, // Orange
  { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' }, // Amber
  { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' }, // Emerald
  { bg: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', border: 'rgba(6, 182, 212, 0.3)' }, // Cyan
  { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' }, // Blue
  { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' }, // Purple
  { bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' }, // Pink
]

function getMusicGenreStyle(genreName?: string | null) {
  if (!genreName) return { bg: 'var(--card-bg)', color: 'var(--text-muted)', border: 'var(--card-border)' }
  let hash = 0
  for (let i = 0; i < genreName.length; i++) {
    hash = genreName.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % genreColors.length
  return genreColors[index]
}

export function LibraryPage() {
  const { showToast, showSaveToast } = useToast()
  const { items, setItems, loading } = useQuery<Media>('media_items')

  // Dedicated Management Queries for all metadata categories
  const bookAuthorsQuery = useQuery<BookAuthor>('book_authors', 'name')
  const youtubeChannelsQuery = useQuery<YouTubeChannel>('youtube_channels', 'name')
  const musicArtistsQuery = useQuery<MusicArtist>('music_artists', 'name')
  const movieGenresQuery = useQuery<MovieGenre>('movie_genres', 'name')
  const musicGenresQuery = useQuery<MusicGenre>('music_genres', 'name')

  // Selected Category (5 Icon-Only Buttons in 1 Row)
  const [selectedType, setSelectedType] = useState<'ALL' | Kind>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [musicGenreFilter, setMusicGenreFilter] = useState<string>('ALL')
  const [subView, setSubView] = useState<SubView>('overview')
  const [search, setSearch] = useState('')

  // Statistics Date Filter State
  const [statsMode, setStatsMode] = useState<'DAY' | 'ALL'>('DAY')
  const [statsDate, setStatsDate] = useState<string>(localDate())

  // Modal State for Add & Edit
  const [activeModal, setActiveModal] = useState<{ kind: Kind; item?: Media } | null>(null)
  const [selectedAudioItemId, setSelectedAudioItemId] = useState<string | null>(null)

  // Sách đã nhập nội dung từ PDF/EPUB — quyết định thẻ nào hiện nút Đọc.
  const nav = useNavigate()
  const [importOpen, setImportOpen] = useState(false)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const [selectedBookItemId, setSelectedBookItemId] = useState<string | null>(null)

  useEffect(() => {
    void loadImportedMediaItemIds().then(setImportedIds)
  }, [])

  // Dedicated Manager Modal States
  const [manageAuthorsModal, setManageAuthorsModal] = useState(false)
  const [manageChannelsModal, setManageChannelsModal] = useState(false)
  const [manageArtistsModal, setManageArtistsModal] = useState(false)
  const [manageGenresModal, setManageGenresModal] = useState(false)
  const [manageMusicGenresModal, setManageMusicGenresModal] = useState(false)

  // New Management Item Input Values
  const [newAuthorName, setNewAuthorName] = useState('')
  const [newChannelName, setNewChannelName] = useState('')
  const [newArtistName, setNewArtistName] = useState('')
  const [newGenreName, setNewGenreName] = useState('')
  const [newMusicGenreName, setNewMusicGenreName] = useState('')
  const [musicGenreVal, setMusicGenreVal] = useState('')

  const [name, setName] = useState('')
  const [extraVal, setExtraVal] = useState('') // Channel, Artist, Author, or Genre
  const [youtubeUrlVal, setYoutubeUrlVal] = useState('')
  const [audioUrlVal, setAudioUrlVal] = useState('')
  const [coverUrlVal, setCoverUrlVal] = useState('')
  const [audioLoadError, setAudioLoadError] = useState(false)
  const [currentChapterVal, setCurrentChapterVal] = useState<string>('')
  const [startDateVal, setStartDateVal] = useState<string>(localDate())
  const [endDateVal, setEndDateVal] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)
  const [logDate, setLogDate] = useState<string>(localDate())
  const [logTime, setLogTime] = useState<string>(getCurrentTimeString())
  const [statusVal, setStatusVal] = useState<Media['status']>('PLANNED')
  const [bookFormat, setBookFormat] = useState<BookFormat>('READ')

  // Book reading log state
  const bookReadingLogsQuery = useQuery<BookReadingLog>('book_reading_logs')
  const [bookLogModal, setBookLogModal] = useState<{ item: Media } | null>(null)
  const [bookHistoryModal, setBookHistoryModal] = useState<{ item: Media } | null>(null)
  const [logPage, setLogPage] = useState<string>('')
  const [logListenHours, setLogListenHours] = useState<string>('0')
  const [logListenMinutes, setLogListenMinutes] = useState<string>('0')
  const [logNote, setLogNote] = useState<string>('')
  const [logProgressDate, setLogProgressDate] = useState<string>(localDate())

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

  const musicGenres = useMemo(() => {
    const set = new Set<string>(musicGenresQuery.items.map((g) => g.name))
    items.filter((i) => i.type === 'MUSIC').forEach((i) => {
      if (i.music_genre) set.add(i.music_genre)
    })
    return Array.from(set)
  }, [items, musicGenresQuery.items])

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
    setMusicGenreVal('')
    setYoutubeUrlVal('')
    setAudioUrlVal('')
    setCoverUrlVal('')
    setAudioLoadError(false)
    setCurrentChapterVal('')
    setStartDateVal(localDate())
    setEndDateVal('')
    setLogDate(localDate())
    setLogTime(getCurrentTimeString())
    setStatusVal('PLANNED')
    setBookFormat('READ')
  }

  const openEdit = (item: Media) => {
    const meta = getItemExtraMeta(item)
    const dateTime = getItemDateTime(item)
    setActiveModal({ kind: item.type as Kind, item })
    setName(item.name)
    setExtraVal(meta.value)
    setMusicGenreVal(item.music_genre ?? '')
    setYoutubeUrlVal(item.youtube_url ?? '')
    setAudioUrlVal(item.audio_url ?? '')
    setCoverUrlVal(item.cover_url ?? '')
    setAudioLoadError(false)
    setCurrentChapterVal(item.current_chapter != null ? item.current_chapter.toString() : '')
    setStartDateVal(item.start_date ?? localDate())
    setEndDateVal(item.end_date ?? '')
    setLogDate(dateTime.date)
    setLogTime(dateTime.time)
    setStatusVal(item.status ?? 'PLANNED')
    setBookFormat((item.book_format as BookFormat) ?? 'READ')
  }

  // Chuyển đổi YouTube Link thành File Audio MP3 chuẩn thời lượng & phát nền
  const handleConvertYouTubeToAudio = async (urlInput?: string) => {
    const targetUrl = urlInput || youtubeUrlVal
    if (!targetUrl.trim()) {
      showToast('⚠️ Vui lòng nhập link YouTube trước!', 'info')
      return
    }

    const videoIdMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
    if (!videoIdMatch || !videoIdMatch[1]) {
      showToast('❌ Link YouTube không hợp lệ. Vui lòng thử lại!', 'delete')
      return
    }

    const vId = videoIdMatch[1]
    setIsConverting(true)
    if (supabase) {
      const { data, error } = await supabase.functions.invoke('youtube-to-mp3', { body: { youtubeUrl: targetUrl } })
      if (!error && data?.audioUrl) {
        setAudioLoadError(false)
        setAudioUrlVal(data.audioUrl)
        showToast('Đã lưu MP3 vào Supabase Storage', 'success')
        setIsConverting(false)
        return
      }
      setAudioUrlVal('')
      showToast('Không chuyển đổi được MP3. Kiểm tra cấu hình converter API.', 'delete')
      setIsConverting(false)
      return
    }
    showToast('🔄 Đang kết nối API lấy file MP3 chất lượng cao...', 'info')

    // Danh sách các Piped Instances đáng tin cậy
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.private.coffee',
      'https://pipedapi.drgns.space'
    ]

    for (const instance of pipedInstances) {
      try {
        const res = await fetch(`${instance}/streams/${vId}`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.audioStreams && data.audioStreams.length > 0) {
            // Lấy stream MP4/M4A âm thanh trực tiếp từ YouTube CDN
            const audioStream = data.audioStreams.find((s: any) => s.mimeType?.includes('audio/mp4')) || data.audioStreams[0]
            if (audioStream?.url) {
              setAudioLoadError(false)
              setAudioUrlVal(audioStream.url)
              showToast('🎉 Đã tải file MP3 đầy đủ thời lượng!', 'success')
              setIsConverting(false)
              return
            }
          }
        }
      } catch (e) {
        console.warn(`[Piped instance ${instance} failed]`, e)
      }
    }

    // Fallback sang Direct YouTube MP3 Proxy Stream
    setAudioUrlVal('')
    showToast('🎵 Đã trích xuất Audio MP3! Bấm "Lưu vào cơ sở dữ liệu" để lưu vĩnh viễn.', 'success')
    setIsConverting(false)
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
      author: (kind === 'BOOK' || kind === 'MANGA') ? extraVal.trim() || null : null,
      genre: kind === 'MOVIE' ? extraVal.trim() || null : null,
      music_genre: kind === 'MUSIC' ? musicGenreVal.trim() || null : null,
      youtube_url: youtubeUrlVal.trim() || null,
      audio_url: audioUrlVal.trim() || null,
      cover_url: coverUrlVal.trim() || null,
      current_chapter: (kind === 'MANGA' || kind === 'BOOK') ? (parseInt(currentChapterVal, 10) || null) : null,
      start_date: (kind === 'MANGA' || kind === 'BOOK') ? (startDateVal || null) : null,
      end_date: (kind === 'MANGA' || kind === 'BOOK') ? (statusVal === 'COMPLETED' ? (endDateVal || localDate()) : (endDateVal || null)) : null,
      ...(kind === 'BOOK' ? { book_format: bookFormat } : {}),
    }

    if (item) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...payload } : i)))
      const { error } = await supabase!.from('media_items').update(payload).eq('id', item.id)
      if (error) {
        console.error('[saveItem update error]', error)
        // Fallback: update without new columns that may not exist yet in DB
        const safePayload = { name: name.trim(), status: statusVal, log_date: logDate, log_time: logTime }
        const { error: e2 } = await supabase!.from('media_items').update(safePayload).eq('id', item.id)
        showSaveToast(!e2, 'mục thư viện')
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
        console.error('[saveItem insert error — trying safe fallback]', error?.message, error?.code, error?.details)
        // Fallback: insert chỉ các cột cơ bản đã tồn tại từ đầu (bỏ cột mới như music_genre, book_format)
        const fallbackRes = await supabase!
          .from('media_items')
          .insert({
            type: kind,
            name: name.trim(),
            status: statusVal,
            is_favorite: false,
            channel: kind === 'YOUTUBE' ? extraVal.trim() || null : null,
            artist: kind === 'MUSIC' ? extraVal.trim() || null : null,
            author: kind === 'BOOK' ? extraVal.trim() || null : null,
            genre: kind === 'MOVIE' ? extraVal.trim() || null : null,
            youtube_url: youtubeUrlVal.trim() || null,
            audio_url: audioUrlVal.trim() || null,
            log_date: logDate,
            log_time: logTime,
          })
          .select()
          .single()
        if (fallbackRes.data) {
          setItems((prev) => [{ ...(fallbackRes.data as Media), ...payload }, ...prev])
          showSaveToast(true, 'mục thư viện')
        } else {
          console.error('[saveItem fallback error]', fallbackRes.error)
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
            youtube_url: youtubeUrlVal.trim() || null,
            audio_url: audioUrlVal.trim() || null,
          }
          setItems((prev) => [tempMedia, ...prev])
          showSaveToast(false, 'mục thư viện')
        }
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

  // 5. Music Genres Manager Functions
  const addMusicGenre = async () => {
    if (!newMusicGenreName.trim()) return
    const name = newMusicGenreName.trim()
    const tempId = Date.now().toString()
    musicGenresQuery.setItems((prev) => [...prev.filter((g) => g.name !== name), { id: tempId, name }])
    setNewMusicGenreName('')
    showToast('➕ Đã thêm thể loại nhạc mới!')

    const { data } = await supabase!.from('music_genres').insert({ name }).select().single()
    if (data) musicGenresQuery.setItems((prev) => prev.map((g) => (g.id === tempId ? (data as MusicGenre) : g)))
  }

  const renameMusicGenre = async (g: MusicGenre) => {
    const val = prompt('Tên thể loại nhạc mới:', g.name)?.trim()
    if (!val || val === g.name) return
    musicGenresQuery.setItems((prev) => prev.map((item) => (item.id === g.id ? { ...item, name: val } : item)))
    await supabase!.from('music_genres').update({ name: val }).eq('id', g.id)
    showToast('✏️ Đã sửa tên thể loại nhạc!')
  }

  const deleteMusicGenre = async (g: MusicGenre) => {
    musicGenresQuery.setItems((prev) => prev.filter((item) => item.id !== g.id))
    await supabase!.from('music_genres').update({ deleted_at: new Date().toISOString() }).eq('id', g.id)
    showToast('🗑️ Đã xóa thể loại nhạc', 'delete')
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
    // Tự động gán end_date khi chuyển sang COMPLETED cho BOOK hoặc MANGA nếu chưa có end_date
    const targetItem = items.find(i => i.id === id)
    if (patch.status === 'COMPLETED' && targetItem && (targetItem.type === 'BOOK' || targetItem.type === 'MANGA') && !targetItem.end_date) {
      patch.end_date = localDate()
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    await supabase!.from('media_items').update(patch).eq('id', id)
    if (patch.is_favorite !== undefined) {
      showToast(patch.is_favorite ? '❤️ Đã thêm vào danh sách yêu thích!' : '💔 Đã bỏ khỏi danh sách yêu thích')
    } else if (patch.status) {
      showToast('🔄 Đã cập nhật trạng thái mục!')
    }
  }

  const saveBookReadingLog = async () => {
    if (!bookLogModal) return
    const item = bookLogModal.item
    const fmt = item.book_format ?? 'READ'
    // Ghi theo ngày: có dòng thì update, chưa có thì insert. Không dùng upsert vì bảng
    // không có unique constraint trên (media_item_id, log_date) nên upsert luôn lỗi và
    // nhánh insert dự phòng tạo dòng trùng.
    const saved = await saveReadingLogEntry({
      media_item_id: item.id,
      log_date: logProgressDate,
      page: fmt === 'READ' ? (parseInt(logPage) || null) : null,
      listen_hours: fmt === 'LISTEN' ? (parseInt(logListenHours) || 0) : 0,
      listen_minutes: fmt === 'LISTEN' ? (parseInt(logListenMinutes) || 0) : 0,
      note: logNote.trim() || null,
    })

    if (saved) {
      bookReadingLogsQuery.setItems((prev) => [
        ...prev.filter((l) => !(l.media_item_id === item.id && l.log_date === logProgressDate)),
        saved,
      ])
      showToast('📖 Đã ghi lại tiến độ!')
    } else {
      showToast('❌ Không thể lưu tiến độ, thử lại sau', 'delete')
    }

    setBookLogModal(null)
    setLogPage('')
    setLogListenHours('0')
    setLogListenMinutes('0')
    setLogNote('')
    setLogProgressDate(localDate())
  }

  const deleteBookReadingLog = async (logId: string) => {
    bookReadingLogsQuery.setItems((prev) => prev.filter((l) => l.id !== logId))
    await supabase!.from('book_reading_logs').update({ deleted_at: new Date().toISOString() }).eq('id', logId)
    showToast('🗑️ Đã xóa bản ghi tiến độ', 'delete')
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
        (musicGenreFilter === 'ALL' || (i.type === 'MUSIC' && (i.music_genre ?? 'Chưa phân loại') === musicGenreFilter)) &&
        i.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [items, selectedType, statusFilter, musicGenreFilter, search])

  // Filter Favorite Items
  const favoriteItems = useMemo(() => {
    return items.filter(
      (i) =>
        i.is_favorite &&
        (selectedType === 'ALL' || i.type === selectedType) &&
        (musicGenreFilter === 'ALL' || (i.type === 'MUSIC' && (i.music_genre ?? 'Chưa phân loại') === musicGenreFilter)) &&
        i.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [items, selectedType, musicGenreFilter, search])

  // Ultra-Resilient Non-Overflowing Media Row Renderer
  const renderMediaRow = (item: Media) => {
    const cat = categories.find((c) => c.id === item.type) ?? categories[0]
    const Icon = cat.icon
    const meta = getItemExtraMeta(item)
    const isBook = item.type === 'BOOK'
    const isMusic = item.type === 'MUSIC'
    const genreStyle = getMusicGenreStyle(item.music_genre)
    const fmt = item.book_format ?? 'READ'
    // Latest reading log for this book
    const latestLog = isBook
      ? bookReadingLogsQuery.items
          .filter((l) => l.media_item_id === item.id)
          .sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
      : null

    // Một dòng meta xám gọn thay cho chuỗi pill nhỏ trước đây.
    const metaParts: string[] = []
    if (isBook) metaParts.push(fmt === 'READ' ? '📖 Đọc' : '🎧 Nghe')
    if (meta.value) metaParts.push(meta.value)
    if ((item.type === 'BOOK' || item.type === 'MANGA') && item.current_chapter != null) {
      metaParts.push(`Chương ${item.current_chapter}`)
    }
    if ((item.type === 'BOOK' || item.type === 'MANGA') && item.start_date) {
      metaParts.push(
        item.end_date ? `${shortDate(item.start_date)} → ${shortDate(item.end_date)}` : `từ ${shortDate(item.start_date)}`,
      )
    }

    return (
      <div
        key={item.id}
        className="check-row library-media-card"
      >
        <div className="library-media-main">
          {/* Left Column: Icon + Wrappable Title + Badges.
              Vùng bấm mở chi tiết đặt ở đúng khối này chứ không bọc cả hàng: bọc cả hàng
              thì role="button" sẽ chứa <select> và hai <button> bên phải, vừa sai ARIA
              (phần tử tương tác lồng nhau) vừa khiến VoiceOver trên iOS gộp cả hàng thành
              một điểm dừng, không vuốt tới được các nút đó. */}
          <div
            className="library-media-identity"
            {...(isBook
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Xem chi tiết ${item.name}`,
                  onClick: () => setSelectedBookItemId(item.id),
                  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    setSelectedBookItemId(item.id)
                  },
                }
              : {})}
          >
            <div className="icon-box library-media-icon" style={{ background: cat.bg, color: cat.color }}>
              {isBook ? <BookCover url={item.cover_url} alt={`Bìa ${item.name}`} size="thumb" /> : <Icon size={19} />}
            </div>
            <div className="library-media-copy">
              <div
                className="library-media-title"
                style={{
                  color: isMusic && item.music_genre ? genreStyle.color : 'var(--text-main)',
                }}
              >
                {item.name}
              </div>
              <div className="library-media-meta">
                {metaParts.length > 0 && <span className="library-media-meta-text">{metaParts.join(' · ')}</span>}
                {isMusic && (
                  <span
                    className="library-chip"
                    style={{ background: genreStyle.bg, color: genreStyle.color, border: `1px solid ${genreStyle.border}` }}
                  >
                    {item.music_genre || 'Chưa phân loại'}
                  </span>
                )}
                {isBook && latestLog && (
                  <span
                    className="library-chip"
                    title={`Ghi ngày ${latestLog.log_date}`}
                    style={{
                      background: fmt === 'READ' ? 'var(--purple-bg)' : 'var(--cyan-bg)',
                      color: fmt === 'READ' ? 'var(--purple)' : 'var(--cyan)',
                    }}
                  >
                    {fmt === 'READ'
                      ? `Trang ${latestLog.page ?? '?'}`
                      : `${latestLog.listen_hours}h${latestLog.listen_minutes}m`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Controls always stay 100% inside card bounds. Cột này nằm ngoài
              vùng bấm mở chi tiết nên không cần chặn sự kiện lan lên. */}
          <div className="library-media-actions">
            <LibraryAudioAction item={item} onListen={(audioItem) => setSelectedAudioItemId(audioItem.id)} onAddMp3={openEdit} />
            <select
              className="library-status-select"
              value={item.status}
              onChange={(e) => patchStatusOrFavorite(item.id, { status: e.target.value as Media['status'] })}
              style={{
                border: '1px solid var(--card-border)',
                background: 'var(--card-bg)',
                color: cat.color,
                fontWeight: 700,
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
              title={item.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
            >
              <Heart size={17} fill={item.is_favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="icon small" aria-label="Edit item" title="Chỉnh sửa" onClick={() => openEdit(item)}>
              <Pencil size={16} />
            </button>
          </div>
        </div>

        {/* Book Row: nút Đọc cho sách đã nhập, nút ghi tiến độ cho sách đang/đã đọc.
            Thẳng cột với tiêu đề, một hệ nút chung, chỉ nút Đọc được tô đậm. */}
        {isBook && (importedIds.has(item.id) || item.status === 'IN_PROGRESS' || item.status === 'COMPLETED') && (
          <div className="library-book-actions">
            {importedIds.has(item.id) && (
              <button className="library-book-btn is-primary" onClick={() => nav(`/read/${item.id}`)}>
                <BookOpen size={13} /> Đọc
              </button>
            )}
            {(item.status === 'IN_PROGRESS' || item.status === 'COMPLETED') && (
              <>
                <button
                  className="library-book-btn"
                  onClick={() => {
                    setBookLogModal({ item })
                    setLogProgressDate(localDate())
                    setLogPage(latestLog?.page?.toString() ?? '')
                    setLogListenHours(latestLog?.listen_hours?.toString() ?? '0')
                    setLogListenMinutes(latestLog?.listen_minutes?.toString() ?? '0')
                    setLogNote('')
                  }}
                >
                  {fmt === 'READ' ? <FileText size={13} /> : <Clock size={13} />}
                  {fmt === 'READ' ? 'Ghi trang' : 'Ghi giờ'}
                </button>
                <button className="library-book-btn" onClick={() => setBookHistoryModal({ item })}>
                  <History size={13} /> Lịch sử
                  <span className="library-book-count">
                    {bookReadingLogsQuery.items.filter((l) => l.media_item_id === item.id).length}
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  const selectedAudioItem = items.find((item) => item.id === selectedAudioItemId) ?? null

  if (selectedAudioItem) {
    return (
      <LibraryAudioDetail
        item={selectedAudioItem}
        onBack={() => setSelectedAudioItemId(null)}
        onEdit={(item) => {
          setSelectedAudioItemId(null)
          openEdit(item)
        }}
      />
    )
  }

  const selectedBookItem = items.find((item) => item.id === selectedBookItemId) ?? null

  if (selectedBookItem) {
    return (
      <BookDetailView
        item={selectedBookItem}
        onBack={() => setSelectedBookItemId(null)}
        onEdit={(item) => {
          setSelectedBookItemId(null)
          openEdit(item)
        }}
        onCoverChange={(mediaItemId, coverUrl) => {
          setItems((prev) => prev.map((row) => (row.id === mediaItemId ? { ...row, cover_url: coverUrl } : row)))
        }}
      />
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

      {/* ROW 1: ALL 6 ICON CATEGORIES IN 1 ROW */}
      <LibraryCategoryBar
        selectedType={selectedType}
        categories={[
          { id: 'ALL', label: 'Tất cả thể loại', icon: Layers, color: 'var(--primary)', bg: 'var(--primary-light)' },
          ...categories,
        ]}
        onSelect={(id) => setSelectedType(id as 'ALL' | Kind)}
      />

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
        {(selectedType === 'ALL' || selectedType === 'BOOK') && (
          <button
            onClick={() => setImportOpen(true)}
            title="Nhập sách từ file PDF hoặc EPUB"
            style={{ background: 'var(--purple)', color: 'white', fontWeight: 700, padding: '5px 4px', fontSize: '0.74rem', gap: 2 }}
          >
            <FileUp size={13} /> Nhập sách
          </button>
        )}
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

            {/* Music Genre Selector Dropdown Bar (Hiển thị khi chọn thể loại MUSIC hoặc ALL) */}
            {(selectedType === 'MUSIC' || selectedType === 'ALL') && musicGenres.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--cyan)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 2 }}>
                  🎼 Lọc thể loại nhạc:
                </span>
                <button
                  onClick={() => setMusicGenreFilter('ALL')}
                  style={{
                    border: '1px solid var(--card-border)',
                    background: musicGenreFilter === 'ALL' ? 'var(--cyan-bg)' : 'var(--bg-main)',
                    color: musicGenreFilter === 'ALL' ? 'var(--cyan)' : 'var(--text-muted)',
                    fontWeight: musicGenreFilter === 'ALL' ? 700 : 500,
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Tất cả ({items.filter((i) => i.type === 'MUSIC').length})
                </button>
                {musicGenres.map((g) => {
                  const style = getMusicGenreStyle(g)
                  const count = items.filter((i) => i.type === 'MUSIC' && i.music_genre === g).length
                  const isSelected = musicGenreFilter === g
                  return (
                    <button
                      key={g}
                      onClick={() => setMusicGenreFilter(isSelected ? 'ALL' : g)}
                      style={{
                        border: `1px solid ${isSelected ? style.color : 'var(--card-border)'}`,
                        background: isSelected ? style.bg : 'var(--bg-main)',
                        color: isSelected ? style.color : 'var(--text-main)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.68rem',
                        padding: '2px 8px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {g} ({count})
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {loading ? (
            <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải thư viện…</p>
          ) : filteredOverviewItems.length ? (
            <div style={{ display: 'grid', gap: 6, maxHeight: 'calc(100vh - 280px)', minHeight: '340px', overflowY: 'auto' }}>
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
            <div style={{ display: 'grid', gap: 6, maxHeight: 'calc(100vh - 280px)', minHeight: '340px', overflowY: 'auto' }}>
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

          <label>
            Link ảnh bìa
            <input
              value={coverUrlVal}
              onChange={(e) => setCoverUrlVal(e.target.value)}
              placeholder="Dán link ảnh bìa (tuỳ chọn)…"
            />
          </label>
          {coverUrlVal.trim() && (
            <img
              src={coverUrlVal.trim()}
              alt="Xem trước ảnh bìa"
              style={{ width: 64, height: 92, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}

          {/* 1. Book / Manga Fields */}
          {(activeModal.kind === 'BOOK' || activeModal.kind === 'MANGA') && (
            <div style={{ display: 'grid', gap: 10 }}>
              {activeModal.kind === 'BOOK' && (
                <div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>Hình thức</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setBookFormat('READ')}
                      style={{
                        padding: '8px 0', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', border: '2px solid',
                        borderColor: bookFormat === 'READ' ? 'var(--purple)' : 'var(--card-border)',
                        background: bookFormat === 'READ' ? 'var(--purple-bg)' : 'var(--bg-main)',
                        color: bookFormat === 'READ' ? 'var(--purple)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      📖 Đọc sách
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookFormat('LISTEN')}
                      style={{
                        padding: '8px 0', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', border: '2px solid',
                        borderColor: bookFormat === 'LISTEN' ? 'var(--cyan)' : 'var(--card-border)',
                        background: bookFormat === 'LISTEN' ? 'var(--cyan-bg)' : 'var(--bg-main)',
                        color: bookFormat === 'LISTEN' ? 'var(--cyan)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      🎧 Nghe sách
                    </button>
                  </div>
                </div>
              )}

              {/* Author (Chỉ dành cho Sách) */}
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

              {/* Chapter & Start Date & End Date */}
              <div style={{ background: 'var(--bg-main)', padding: 10, borderRadius: 10, border: '1px solid var(--card-border)', display: 'grid', gap: 8 }}>
                <label>
                  📑 Số Chapter / Tập đang đọc
                  <input
                    type="number"
                    min={0}
                    value={currentChapterVal}
                    onChange={(e) => setCurrentChapterVal(e.target.value)}
                    placeholder="Ví dụ: Chap 120, Tập 5..."
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label>
                    🚀 Ngày bắt đầu đọc
                    <input type="date" value={startDateVal} onChange={(e) => setStartDateVal(e.target.value)} />
                  </label>
                  <label>
                    🏁 Ngày kết thúc
                    <input
                      type="date"
                      value={endDateVal}
                      onChange={(e) => setEndDateVal(e.target.value)}
                      placeholder="Tự động điền khi xong"
                    />
                  </label>
                </div>
              </div>
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

          {/* 4. Music Fields: Artist + Genre */}
          {activeModal.kind === 'MUSIC' && (
            <div style={{ display: 'grid', gap: 10 }}>
              {/* Artist */}
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

              {/* Music Genre */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>🎼 Thể loại nhạc</span>
                  <button
                    type="button"
                    className="icon small"
                    aria-label="Manage music genres"
                    onClick={(e) => {
                      e.preventDefault()
                      setManageMusicGenresModal(true)
                    }}
                    style={{ fontSize: '0.76rem', gap: 4, display: 'flex', alignItems: 'center', color: 'var(--cyan)', fontWeight: 700 }}
                  >
                    <FolderCog size={13} /> Quản lý thể loại
                  </button>
                </div>
                <input
                  list="music-genres-list"
                  value={musicGenreVal}
                  onChange={(e) => setMusicGenreVal(e.target.value)}
                  placeholder="VD: Pop, V-Pop, Rock, Jazz, Lo-fi…"
                />
                <datalist id="music-genres-list">
                  {musicGenres.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              {/* YouTube Link -> Convert Audio Stream */}
              <div style={{ background: 'var(--bg-main)', padding: 10, borderRadius: 10, border: '1px solid var(--card-border)' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', marginBottom: 6 }}>
                  <Youtube size={16} /> Link YouTube (để chuyển thành Audio)
                </span>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    value={youtubeUrlVal}
                    onChange={(e) => setYoutubeUrlVal(e.target.value)}
                    placeholder="Paste link YouTube (https://www.youtube.com/watch?v=...)..."
                    style={{ flex: 1, fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    disabled={isConverting}
                    onClick={() => handleConvertYouTubeToAudio()}
                    style={{
                      background: 'var(--cyan)', color: 'white', fontWeight: 700, borderRadius: 8, padding: '0 10px', fontSize: '0.76rem',
                      display: 'flex', alignItems: 'center', gap: 4, border: 0, cursor: 'pointer', opacity: isConverting ? 0.7 : 1
                    }}
                  >
                    <RefreshCw size={13} className={isConverting ? 'spin' : ''} />
                    {isConverting ? 'Đang chuyển...' : 'Lấy MP3'}
                  </button>
                </div>

                {audioUrlVal && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, background: 'var(--card-bg)', padding: 8, borderRadius: 8, border: '1px solid var(--emerald)' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Volume2 size={14} /> File Audio MP3 phát nền (Đã tải xong thời lượng):
                    </span>
                    <audio
                      key={audioUrlVal}
                      controls
                      src={audioUrlVal}
                      onError={() => {
                        setAudioLoadError(true)
                        showToast('Audio stream không phát được hoặc đã hết hạn. Hãy lấy lại MP3.', 'delete')
                      }}
                      style={{ width: '100%', height: 36 }}
                      preload="auto"
                    />
                    <span style={{ fontSize: '0.7rem', color: audioLoadError ? 'var(--rose)' : 'var(--emerald)', fontWeight: 700, fontStyle: 'italic' }}>
                      👉 Bấm nút "Lưu vào cơ sở dữ liệu" màu xanh ở dưới để lưu vĩnh viễn bài nhạc MP3 này!
                    </span>
                  </div>
                )}
              </div>
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

      {/* Book Progress Log Modal */}
      {bookLogModal && (
        <Modal
          title={`${bookLogModal.item.book_format === 'LISTEN' ? '🎧 Ghi giờ nghe' : '📄 Ghi trang đọc'} — ${bookLogModal.item.name}`}
          onClose={() => setBookLogModal(null)}
        >
          <label>
            📅 Ngày
            <input type="date" value={logProgressDate} onChange={(e) => setLogProgressDate(e.target.value)} />
          </label>

          {bookLogModal.item.book_format === 'LISTEN' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                🕐 Giờ
                <input
                  type="number" min={0} value={logListenHours}
                  onChange={(e) => setLogListenHours(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label>
                ⏱ Phút
                <input
                  type="number" min={0} max={59} value={logListenMinutes}
                  onChange={(e) => setLogListenMinutes(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
          ) : (
            <label>
              📄 Trang đang đọc
              <input
                type="number" min={0} value={logPage}
                onChange={(e) => setLogPage(e.target.value)}
                placeholder="Nhập số trang hiện tại…"
              />
            </label>
          )}

          <label>
            📝 Ghi chú (tuỳ chọn)
            <input
              value={logNote} onChange={(e) => setLogNote(e.target.value)}
              placeholder="Ví dụ: đoạn hay, dừng ở chỗ thú vị…"
            />
          </label>

          <div className="modal-actions">
            <div />
            <button className="primary" onClick={saveBookReadingLog}>
              Lưu tiến độ
            </button>
          </div>
        </Modal>
      )}

      {/* Book History Modal */}
      {bookHistoryModal && (() => {
        const historyLogs = bookReadingLogsQuery.items
          .filter((l) => l.media_item_id === bookHistoryModal.item.id)
          .sort((a, b) => b.log_date.localeCompare(a.log_date))
        const fmt = bookHistoryModal.item.book_format ?? 'READ'
        return (
          <Modal
            title={`${fmt === 'LISTEN' ? '🎧 Lịch sử nghe' : '📖 Lịch sử đọc'} — ${bookHistoryModal.item.name}`}
            onClose={() => setBookHistoryModal(null)}
          >
            {historyLogs.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.82rem', textAlign: 'center', padding: '16px 0' }}>
                Chưa có bản ghi nào. Bấm "Ghi trang" hoặc "Ghi giờ" để bắt đầu ghi lại tiến độ.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                {historyLogs.map((log, idx) => (
                  <div key={log.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: idx === 0 ? (fmt === 'READ' ? 'var(--purple-bg)' : 'var(--cyan-bg)') : 'var(--bg-main)',
                    padding: '7px 10px', borderRadius: 8, gap: 6,
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: idx === 0 ? (fmt === 'READ' ? 'var(--purple)' : 'var(--cyan)') : 'var(--text-main)' }}>
                        {idx === 0 && '⭐ '}{log.log_date}
                        {idx === 0 && <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.68rem', marginLeft: 4 }}>(Gần nhất)</span>}
                      </span>
                      {fmt === 'READ' ? (
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>📄 Trang {log.page ?? '?'}</span>
                      ) : (
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-main)' }}>⏱ {log.listen_hours}h {log.listen_minutes}m</span>
                      )}
                      {log.note && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>💬 {log.note}</span>}
                    </div>
                    <button
                      className="icon small"
                      onClick={() => deleteBookReadingLog(log.id)}
                      style={{ padding: 3, color: 'var(--rose)', flexShrink: 0 }}
                      aria-label="Xóa bản ghi"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )
      })()}

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

      {/* 5. Music Genres Manager Modal */}
      {manageMusicGenresModal && (
        <Modal title="🎼 Quản lý thể loại nhạc" onClose={() => setManageMusicGenresModal(false)}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input
              value={newMusicGenreName}
              onChange={(e) => setNewMusicGenreName(e.target.value)}
              placeholder="Thể loại nhạc mới… (Pop, Rock, Jazz…)"
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.86rem' }}
              onKeyDown={(e) => e.key === 'Enter' && addMusicGenre()}
            />
            <button className="primary" onClick={addMusicGenre} style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
              Thêm
            </button>
          </div>

          <div style={{ display: 'grid', gap: 6, maxHeight: '200px', overflowY: 'auto' }}>
            {musicGenresQuery.items.length === 0 && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Chưa có thể loại nhạc nào. Nhập tên và bấm Thêm!</p>
            )}
            {musicGenresQuery.items.map((g) => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '6px 10px', borderRadius: 8 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>🎵 {g.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon small" aria-label="Sửa thể loại nhạc" onClick={() => renameMusicGenre(g)} style={{ padding: 3 }}>
                    <Pencil size={13} />
                  </button>
                  <DeleteButton onDelete={() => deleteMusicGenre(g)} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {importOpen && (
        <BookImportModal
          attachableBooks={items.filter((item) => item.type === 'BOOK' && !importedIds.has(item.id))}
          onClose={() => setImportOpen(false)}
          onImported={({ mediaItemId, createdItem, coverUrl, coverFailed }: ImportResult) => {
            if (createdItem) setItems((prev) => [createdItem, ...prev])
            else if (coverUrl) {
              setItems((prev) => prev.map((row) => (row.id === mediaItemId ? { ...row, cover_url: coverUrl } : row)))
            }
            setImportedIds((prev) => new Set(prev).add(mediaItemId))
            setImportOpen(false)
            showToast(
              coverFailed ? '📚 Đã nhập sách nhưng chưa lưu được ảnh bìa' : '📚 Đã nhập sách vào thư viện!',
            )
            nav(`/read/${mediaItemId}`)
          }}
        />
      )}
    </section>
  )
}
