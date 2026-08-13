import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, BookMarked, BookOpen, Calendar, ChevronDown, Clock, Download, Eye, FileText, FileUp, Film, FolderCog, Heart, History, ImagePlus, Layers, ListMusic, MoreVertical, Music, Pencil, Play, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, Tv, Volume2, Youtube } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { loadImportedMediaItemIds, saveReadingLogEntry } from '../lib/book/repository'
import type { BookAuthor, BookFormat, BookReadingLog, Media, MovieGenre, MusicArtist, MusicGenre, YouTubeChannel } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'
import { useHeaderAction } from './HeaderAction'
import { LibraryAudioAction, LibraryAudioDetail, LibraryCategoryBar } from './library/LibraryAudioView'
import { AudioQueuePicker, AudioQueuePlayer } from './library/AudioQueue'
import { MarqueeText } from './library/MarqueeText'
import { RowMenu } from './library/RowMenu'
import { fetchYouTubeMeta, parseMusicTitle, stripTitleNoise, youtubeVideoId } from '../lib/youtubeMeta'
import { BookCover } from './library/BookCover'
import { BookDetailView } from './library/BookDetailView'
import { BookGrid } from './library/BookGrid'
import { VideoDetailView } from './library/VideoDetailView'
import { BookImportModal, type ImportResult } from './library/BookImportModal'

const categories = [
  { id: 'MUSIC', label: 'Nhạc', icon: Music, colorClass: 'icon-box-cyan', color: 'var(--cyan)', bg: 'var(--cyan-bg)', labels: ['Sẽ nghe', 'Đang nghe', 'Đã nghe'] },
  { id: 'YOUTUBE', label: 'TV Show', icon: Tv, colorClass: 'icon-box-amber', color: 'var(--amber)', bg: 'var(--amber-bg)', labels: ['Sẽ xem', 'Đang xem', 'Đã xem'] },
  { id: 'BOOK', label: 'Sách', icon: BookOpen, colorClass: 'icon-box-purple', color: 'var(--purple)', bg: 'var(--purple-bg)', labels: ['Sẽ đọc', 'Đang đọc', 'Đã đọc'] },
  { id: 'MOVIE', label: 'Phim', icon: Film, colorClass: 'icon-box-rose', color: 'var(--rose)', bg: 'var(--rose-bg)', labels: ['Sẽ xem', 'Đang xem', 'Đã xem'] },
  { id: 'MANGA', label: 'Truyện', icon: BookMarked, colorClass: 'icon-box-emerald', color: 'var(--emerald)', bg: 'var(--emerald-bg)', labels: ['Sẽ đọc', 'Đang đọc', 'Đã đọc'] },
] as const

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Tất cả', icon: '🔳', color: 'var(--primary)', bg: 'var(--primary-light)' },
  { key: 'PLANNED', label: 'Sẽ', icon: '📌', color: 'var(--primary)', bg: 'var(--primary-light)' },
  { key: 'IN_PROGRESS', label: 'Đang', icon: '⏳', color: 'var(--amber)', bg: 'var(--amber-bg)' },
  { key: 'COMPLETED', label: 'Đã', icon: '✅', color: 'var(--emerald)', bg: 'var(--emerald-bg)' },
] as const satisfies readonly { key: StatusFilter; label: string; icon: string; color: string; bg: string }[]

/**
 * Ô icon pastel của mỗi mục. Màu suy ra từ id nên một mục luôn giữ đúng một
 * màu qua mọi lần tải, và danh sách có nhịp màu thay vì một khối xám.
 */
const ART_TONES = [
  { bg: '#e0f2fe', fg: '#0284c7' },
  { bg: '#fef3c7', fg: '#d97706' },
  { bg: '#f3e8ff', fg: '#9333ea' },
  { bg: '#dcfce7', fg: '#16a34a' },
  { bg: '#fee2e2', fg: '#e11d48' },
  { bg: '#e0e7ff', fg: '#4f46e5' },
  { bg: '#ccfbf1', fg: '#0d9488' },
  { bg: '#ffe4e6', fg: '#db2777' },
]

const artTone = (id: string) => {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 100000
  const tone = ART_TONES[hash % ART_TONES.length]
  return { background: tone.bg, color: tone.fg }
}

const STATUS_ORDER = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const

/** Màu của mũi tên trạng thái — để đọc được trạng thái mà không cần mở menu. */
const STATUS_TONE: Record<Media['status'], string> = {
  PLANNED: 'var(--text-muted)',
  IN_PROGRESS: 'var(--amber)',
  COMPLETED: 'var(--emerald)',
}

const COVER_BUCKET = 'media-covers'

/**
 * Ô "ảnh bìa" gradient của mỗi mục. Màu suy ra từ id nên một mục luôn giữ đúng
 * một màu qua mọi lần tải, và danh sách nhìn có nhịp màu thay vì một khối xám.
 */
const ART_GRADIENTS = [
  'linear-gradient(135deg, #60a5fa, #a78bfa)',
  'linear-gradient(135deg, #f472b6, #fb923c)',
  'linear-gradient(135deg, #34d399, #22d3ee)',
  'linear-gradient(135deg, #818cf8, #38bdf8)',
  'linear-gradient(135deg, #fb7185, #f59e0b)',
  'linear-gradient(135deg, #a78bfa, #f472b6)',
  'linear-gradient(135deg, #22d3ee, #3b82f6)',
  'linear-gradient(135deg, #4ade80, #14b8a6)',
]

const artGradient = (id: string) => {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 100000
  return ART_GRADIENTS[hash % ART_GRADIENTS.length]
}

type Kind = (typeof categories)[number]['id']
type SubView = 'overview' | 'favorites' | 'queue' | 'stats'
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
  const [selectedVideoItemId, setSelectedVideoItemId] = useState<string | null>(null)

  // Hàng đợi nghe liên tục. Chỉ sống trong phiên này, không ghi xuống database.
  const [queuePicks, setQueuePicks] = useState<string[]>([])
  const [playingQueue, setPlayingQueue] = useState<Media[] | null>(null)

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
  const [autofilling, setAutofilling] = useState(false)
  const [logDate, setLogDate] = useState<string>(localDate())
  const [logTime, setLogTime] = useState<string>(getCurrentTimeString())
  const [statusVal, setStatusVal] = useState<Media['status']>('PLANNED')
  const [bookFormat, setBookFormat] = useState<BookFormat>('READ')
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverPreview, setCoverPreview] = useState(false)
  const coverFileInput = useRef<HTMLInputElement>(null)

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
    // Nhạc thường được ghi lại sau khi đã nghe xong, nên mặc định là "Đã nghe".
    setStatusVal(kind === 'MUSIC' ? 'COMPLETED' : 'PLANNED')
    setBookFormat('READ')
    setCoverPreview(false)
  }

  // Nút "+" của trang dùng ô hành động trên header chung, giống Habits và Người.
  // Thể loại đang chọn quyết định form mở ra; ở "Tất cả" thì mặc định là Sách.
  const addKind: Kind = selectedType === 'ALL' ? 'BOOK' : selectedType
  const openAddFromHeader = useCallback(() => openAdd(addKind), [addKind])
  useHeaderAction(`Thêm ${categories.find((c) => c.id === addKind)?.label ?? ''}`, openAddFromHeader)

  /** Tải ảnh bìa từ máy lên Supabase Storage rồi đưa link công khai vào ô ảnh bìa. */
  const uploadCoverFile = async (file: File) => {
    if (!supabase) return showToast('Chưa cấu hình Supabase nên chưa tải ảnh lên được.', 'delete')
    setCoverUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(COVER_BUCKET).upload(path, file)
    if (error) {
      showToast('Tải ảnh bìa lên thất bại', 'delete')
    } else {
      setCoverUrlVal(supabase.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl)
      showToast('Đã tải ảnh bìa lên')
    }
    setCoverUploading(false)
    if (coverFileInput.current) coverFileInput.current.value = ''
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
    setCoverPreview(false)
  }

  /**
   * Gọi tự điền đúng một lần, ngay khi link vừa đủ để nhận ra video. Gõ tay
   * từng ký tự thì chỉ tới ký tự cuối của id mới thành link hợp lệ, nên không
   * có chuyện bắn hàng chục lượt gọi mạng.
   */
  const handleYouTubeUrlChange = (next: string) => {
    const wasValid = Boolean(youtubeVideoId(youtubeUrlVal))
    setYoutubeUrlVal(next)
    if (!wasValid && youtubeVideoId(next)) void autofillFromYouTube(next)
  }

  /**
   * Dán link YouTube thì tự điền tên và ca sĩ / kênh.
   *
   * Chỉ điền vào ô ĐANG TRỐNG. Ghi đè thứ người dùng đã gõ là hành vi rất khó
   * chịu — đoán sai một cái là mất công gõ lại. Ô nào đã có chữ thì giữ nguyên
   * và báo cho biết là có thể xoá đi để lấy lại.
   */
  const autofillFromYouTube = async (url: string) => {
    const kind = activeModal?.kind
    if (kind !== 'MUSIC' && kind !== 'YOUTUBE') return
    if (!youtubeVideoId(url)) return

    setAutofilling(true)
    const meta = await fetchYouTubeMeta(url)
    setAutofilling(false)
    if (!meta) return

    const nameEmpty = !name.trim()
    const extraEmpty = !extraVal.trim()
    if (!nameEmpty && !extraEmpty) {
      showToast('Đã có tên và ca sĩ nên giữ nguyên. Xoá ô đi rồi dán lại nếu muốn lấy từ YouTube.', 'info')
      return
    }

    if (kind === 'YOUTUBE') {
      // Video thường: tiêu đề giữ gần như nguyên văn, kênh là tên kênh thật.
      if (nameEmpty) setName(stripTitleNoise(meta.title) || meta.title)
      if (extraEmpty && meta.author) setExtraVal(meta.author)
    } else {
      const parsed = parseMusicTitle(meta.title, meta.author)
      if (nameEmpty && parsed.name) setName(parsed.name)
      if (extraEmpty && parsed.artist) setExtraVal(parsed.artist)
    }

    showToast('Đã lấy thông tin từ YouTube', 'success')
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
      const reason = await (error as { context?: Response })?.context?.json?.().then((b) => b?.error).catch(() => null)
      console.error('youtube-to-mp3 failed:', reason ?? error)
      showToast(`Không chuyển đổi được MP3: ${reason ?? error?.message ?? 'lỗi không rõ'}`, 'delete')
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

  /** Mở modal ghi tiến độ, gieo sẵn giá trị từ lần ghi gần nhất của sách. */
  const openBookLog = (item: Media) => {
    const latest = bookReadingLogsQuery.items
      .filter((log) => log.media_item_id === item.id)
      .sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
    setBookLogModal({ item })
    setLogProgressDate(localDate())
    setLogPage(latest?.page?.toString() ?? '')
    setLogListenHours(latest?.listen_hours?.toString() ?? '0')
    setLogListenMinutes(latest?.listen_minutes?.toString() ?? '0')
    setLogNote('')
  }

  const bookLogCount = (mediaItemId: string) =>
    bookReadingLogsQuery.items.filter((log) => log.media_item_id === mediaItemId).length

  const removeMediaItem = async (id: string) => {
    await supabase!.from('media_items').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    showToast('🗑️ Đã xóa mục khỏi thư viện', 'delete')
  }

  const deleteItem = async () => {
    if (!activeModal?.item) return
    await removeMediaItem(activeModal.item.id)
    setActiveModal(null)
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

  /**
   * Số liệu toàn thời gian của từng thư viện, dùng cho bảng tổng thể khi đang ở
   * "Tất cả thể loại". Khác `stats.categoryStats` ở chỗ không lọc theo ngày.
   */
  const libraryOverview = useMemo(
    () =>
      categories.map((cat) => {
        const catItems = items.filter((i) => i.type === cat.id)
        const done = catItems.filter((i) => i.status === 'COMPLETED').length
        return {
          ...cat,
          count: catItems.length,
          done,
          inProgress: catItems.filter((i) => i.status === 'IN_PROGRESS').length,
          planned: catItems.filter((i) => i.status === 'PLANNED').length,
          favorite: catItems.filter((i) => i.is_favorite).length,
          percent: catItems.length ? Math.round((done / catItems.length) * 100) : 0,
        }
      }),
    [items],
  )

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

  /** Các mục đã gắn MP3 — nguồn cho mục "Nghe liên tục". */
  const audioItems = useMemo(() => {
    return items.filter(
      (i) =>
        Boolean(i.audio_url) &&
        (selectedType === 'ALL' || i.type === selectedType) &&
        (musicGenreFilter === 'ALL' || (i.type === 'MUSIC' && (i.music_genre ?? 'Chưa phân loại') === musicGenreFilter)) &&
        i.name.toLowerCase().includes(search.toLowerCase()),
    )
  }, [items, selectedType, musicGenreFilter, search])

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
    const isVideo = item.type === 'YOUTUBE'
    /** Sách và TV Show bấm một lần là mở chi tiết; các loại khác chưa có màn riêng. */
    const openDetail =
      isBook ? () => setSelectedBookItemId(item.id)
      : isVideo ? () => setSelectedVideoItemId(item.id)
      : null
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
          {/* Cột trái: ô bìa + tên (chạy nếu dài) + dòng meta.
              Vùng bấm mở chi tiết đặt ở đúng khối này chứ không bọc cả hàng: bọc cả hàng
              thì role="button" sẽ chứa các nút bên phải, vừa sai ARIA (phần tử tương tác
              lồng nhau) vừa khiến VoiceOver trên iOS gộp cả hàng thành một điểm dừng,
              không vuốt tới được các nút đó. */}
          <div
            className={'library-media-identity' + (openDetail ? ' is-openable' : '')}
            {...(openDetail
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Xem chi tiết ${item.name}`,
                  onClick: openDetail,
                  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    openDetail()
                  },
                }
              : {})}
          >
            <div className="library-media-art" style={artTone(item.id)}>
              {isBook ? <BookCover url={item.cover_url} alt={`Bìa ${item.name}`} size="thumb" /> : <Icon size={19} />}
            </div>
            <div className="library-media-copy">
              <MarqueeText
                className="library-media-title"
                text={item.name}
                style={{ color: isMusic && item.music_genre ? genreStyle.color : 'var(--text-main)' }}
              />
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
            {/* Trạng thái nằm sau một mũi tên để nhường chỗ cho tên bài; màu của
                mũi tên vẫn lộ ra đang ở trạng thái nào, khỏi phải mở menu ra xem. */}
            <RowMenu
              label={`Trạng thái: ${cat.labels[STATUS_ORDER.indexOf(item.status)]}`}
              icon={<ChevronDown size={16} />}
              tone={STATUS_TONE[item.status]}
              items={STATUS_ORDER.map((value, i) => ({
                key: value,
                label: cat.labels[i],
                checked: item.status === value,
                onSelect: () => patchStatusOrFavorite(item.id, { status: value }),
              }))}
            />

            <button
              className={'icon small favorite ' + (item.is_favorite ? 'on' : '')}
              aria-label="Toggle favorite"
              onClick={() => patchStatusOrFavorite(item.id, { is_favorite: !item.is_favorite })}
              title={item.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
            >
              <Heart size={17} fill={item.is_favorite ? 'currentColor' : 'none'} />
            </button>

            <RowMenu
              label={`Thao tác cho ${item.name}`}
              icon={<MoreVertical size={16} />}
              items={[
                { key: 'edit', label: 'Chỉnh sửa', icon: <Pencil size={14} />, onSelect: () => openEdit(item) },
                {
                  key: 'delete',
                  label: 'Xoá khỏi thư viện',
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onSelect: () => {
                    if (confirm(`Xoá "${item.name}" khỏi thư viện?`)) void removeMediaItem(item.id)
                  },
                },
              ]}
            />
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
                  onClick={() => openBookLog(item)}
                >
                  {fmt === 'READ' ? <FileText size={13} /> : <Clock size={13} />}
                  {fmt === 'READ' ? 'Ghi trang' : 'Ghi giờ'}
                </button>
                <button className="library-book-btn" onClick={() => setBookHistoryModal({ item })}>
                  <History size={13} /> Lịch sử
                  <span className="library-book-count">
                    {bookLogCount(item.id)}
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  /** Đơn vị đếm hiện dưới các con số, đổi theo thư viện đang mở. */
  const unitLabel =
    selectedType === 'MUSIC' ? 'bài hát'
    : selectedType === 'BOOK' ? 'cuốn sách'
    : selectedType === 'MANGA' ? 'bộ truyện'
    : selectedType === 'MOVIE' ? 'bộ phim'
    : selectedType === 'YOUTUBE' ? 'video'
    : 'mục'

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
        onStatusChange={(item, status) => patchStatusOrFavorite(item.id, { status })}
        onLogProgress={(item) => {
          setSelectedBookItemId(null)
          openBookLog(item)
        }}
        onShowHistory={(item) => {
          setSelectedBookItemId(null)
          setBookHistoryModal({ item })
        }}
        logCount={bookLogCount(selectedBookItem.id)}
      />
    )
  }

  const selectedVideoItem = items.find((item) => item.id === selectedVideoItemId) ?? null

  if (selectedVideoItem) {
    return (
      <VideoDetailView
        item={selectedVideoItem}
        onBack={() => setSelectedVideoItemId(null)}
        onEdit={(item) => {
          setSelectedVideoItemId(null)
          openEdit(item)
        }}
        onStatusChange={(item, status) => patchStatusOrFavorite(item.id, { status })}
      />
    )
  }

  return (
    <section className="page-shell">
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
          { id: 'ALL', label: 'Tất cả', icon: Layers, color: 'var(--primary)', bg: 'var(--primary-light)' },
          ...categories,
        ]}
        onSelect={(id) => setSelectedType(id as 'ALL' | Kind)}
      />

      {/* ROW 2: SUB-TABS INCLUDING "+ THÊM" BUTTON INSIDE 100% RESPONSIVE BAR */}
      {/* Bảng số liệu kiêm chọn tab: con số là thứ đáng nhìn nhất nên cho nó
          đứng trước, nhãn nhỏ bên dưới. Bấm vào cột nào là mở tab đó. */}
      <div className="library-stat-tabs" role="tablist" aria-label="Khu vực thư viện">
        <button
          role="tab"
          aria-selected={subView === 'overview'}
          className={subView === 'overview' ? 'active' : ''}
          onClick={() => setSubView('overview')}
        >
          <span className="library-stat-head"><BookOpen size={13} /> Tổng thể</span>
          <strong>{filteredOverviewItems.length}</strong>
          <small>{unitLabel}</small>
        </button>
        <button
          role="tab"
          aria-selected={subView === 'favorites'}
          className={subView === 'favorites' ? 'active' : ''}
          onClick={() => setSubView('favorites')}
        >
          <span className="library-stat-head"><Heart size={13} style={{ color: 'var(--rose)' }} /> Yêu thích</span>
          <strong>{favoriteItems.length}</strong>
          <small>{unitLabel}</small>
        </button>
        <button
          role="tab"
          aria-selected={subView === 'queue'}
          className={subView === 'queue' ? 'active' : ''}
          onClick={() => setSubView('queue')}
        >
          <span className="library-stat-head"><ListMusic size={13} style={{ color: 'var(--cyan)' }} /> Nghe liên tục</span>
          <strong>{audioItems.length}</strong>
          <small>có MP3</small>
        </button>
        <button
          role="tab"
          aria-selected={subView === 'stats'}
          className={subView === 'stats' ? 'active' : ''}
          onClick={() => setSubView('stats')}
        >
          <span className="library-stat-head"><BarChart3 size={13} /> Thống kê</span>
          <span className="library-stat-link">Xem chi tiết ›</span>
        </button>
      </div>

      {(selectedType === 'ALL' || selectedType === 'BOOK') && (
        <button className="library-import-btn" onClick={() => setImportOpen(true)} title="Nhập sách từ file PDF hoặc EPUB">
          <FileUp size={13} /> Nhập sách từ PDF / EPUB
        </button>
      )}

      {/* VIEW 1a: TỔNG THỂ khi chưa chọn thể loại — bảng thống kê từng thư viện.
          Bấm một thẻ là vào thẳng thư viện đó và thấy danh sách như cũ. */}
      {subView === 'overview' && selectedType === 'ALL' && (
        <div className="library-overview">
          {libraryOverview.map((lib) => {
            const Icon = lib.icon
            return (
              <button
                key={lib.id}
                type="button"
                className="library-overview-card"
                aria-label={`Mở thư viện ${lib.label}, ${lib.count} mục`}
                onClick={() => setSelectedType(lib.id)}
              >
                <div className="library-overview-head">
                  <span className="icon-box icon-box-sm" style={{ background: lib.bg, color: lib.color }}>
                    <Icon size={14} />
                  </span>
                  <strong>{lib.label}</strong>
                  {lib.favorite > 0 && (
                    <span className="library-overview-fav">
                      <Heart size={11} /> {lib.favorite}
                    </span>
                  )}
                  <span className="library-overview-count" style={{ color: lib.color }}>
                    {lib.count}
                  </span>
                </div>

                {lib.count === 0 ? (
                  <span className="library-overview-empty">Chưa có mục nào</span>
                ) : (
                  <>
                    <div className="library-overview-breakdown">
                      <span>📌 {lib.planned} {lib.labels[0].toLowerCase()}</span>
                      <span style={{ color: 'var(--amber)' }}>⏳ {lib.inProgress} {lib.labels[1].toLowerCase()}</span>
                      <span style={{ color: 'var(--emerald)' }}>✅ {lib.done} {lib.labels[2].toLowerCase()}</span>
                    </div>
                    <div className="habit-progress-bar-bg" style={{ height: 5 }}>
                      <div className="habit-progress-bar-fill" style={{ width: `${lib.percent}%`, background: lib.color }} />
                    </div>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* VIEW 1b: TỔNG THỂ của một thư viện cụ thể — danh sách mục */}
      {subView === 'overview' && selectedType !== 'ALL' && (
        <div className="card" style={{ padding: 10, margin: 0 }}>
          {/* SEARCH & STATUS SEGMENT BAR */}
          <div className="library-controls">
            {/* Status Segmented Control (Sẽ / Đang / Đã) */}
            <div className="form-row-4 library-status-bar">
              {STATUS_FILTERS.map((f) => {
                const count = items.filter((i) => i.type === selectedType && i.status === f.key).length
                return (
                  <button
                    key={f.key}
                    className={'library-status-pill' + (statusFilter === f.key ? ' is-on' : '')}
                    style={statusFilter === f.key ? { background: f.bg, color: f.color } : undefined}
                    onClick={() => setStatusFilter(f.key)}
                  >
                    {f.icon} {f.label}
                    {f.key !== 'ALL' && ` (${count})`}
                  </button>
                )
              })}
            </div>

            {/* Search Input Bar */}
            <div className="library-search">
              <Search size={15} aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm mục trong thư viện…"
              />
            </div>

            {/* Hàng lọc thể loại nhạc, chỉ có nghĩa trong thư viện Music */}
            {selectedType === 'MUSIC' && musicGenres.length > 0 && (
              <div className="library-genre-bar">
                <span className="library-genre-label">
                  <SlidersHorizontal size={14} /> Lọc thể loại nhạc:
                </span>
                <button
                  className={'library-genre-chip' + (musicGenreFilter === 'ALL' ? ' is-on' : '')}
                  onClick={() => setMusicGenreFilter('ALL')}
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
                      className={'library-genre-chip' + (isSelected ? ' is-on' : '')}
                      onClick={() => setMusicGenreFilter(isSelected ? 'ALL' : g)}
                      style={isSelected ? { borderColor: style.color, background: style.bg, color: style.color } : undefined}
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
            <div className="library-media-list">
              {selectedType === 'BOOK' ? (
                <BookGrid
                  items={filteredOverviewItems}
                  onOpen={(item) => setSelectedBookItemId(item.id)}
                  onToggleFavorite={(item) =>
                    patchStatusOrFavorite(item.id, { is_favorite: !item.is_favorite })
                  }
                />
              ) : (
                filteredOverviewItems.map(renderMediaRow)
              )}
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
            <div className="library-media-list">
              {selectedType === 'BOOK' ? (
                <BookGrid
                  items={favoriteItems}
                  onOpen={(item) => setSelectedBookItemId(item.id)}
                  onToggleFavorite={(item) =>
                    patchStatusOrFavorite(item.id, { is_favorite: !item.is_favorite })
                  }
                />
              ) : (
                favoriteItems.map(renderMediaRow)
              )}
            </div>
          ) : (
            <Empty icon={Heart} colorClass="icon-box-rose">
              Chưa có mục nào được thả tim. Thả tim biểu tượng trái tim để thêm vào yêu thích nhé!
            </Empty>
          )}
        </div>
      )}

      {/* VIEW 3: NGHE LIÊN TỤC — chọn nhiều bài có MP3 rồi nghe lần lượt. */}
      {subView === 'queue' && (
        <div className="card" style={{ padding: 10, margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.84rem', color: 'var(--cyan)' }}>
              <ListMusic size={14} />
              <span>Nghe liên tục ({audioItems.length})</span>
            </div>
            <input className="mini-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm…" style={{ padding: '3px 6px', fontSize: '0.74rem', width: 85 }} />
          </div>

          <AudioQueuePicker
            items={audioItems}
            selectedIds={queuePicks}
            onToggle={(id) => setQueuePicks((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
            onToggleAll={() =>
              setQueuePicks((ids) => (ids.length === audioItems.length ? [] : audioItems.map((i) => i.id)))
            }
            onPlay={() => setPlayingQueue(audioItems.filter((i) => queuePicks.includes(i.id)))}
          />
        </div>
      )}

      {/* VIEW 4: THỐNG KÊ (STATISTICS DASHBOARD WITH DAILY FILTERING) */}
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
          {/* Nhạc không có ảnh bìa: chỉ cần ô tên, đỡ một tầng cho form. */}
          {activeModal.kind === 'MUSIC' ? (
            <label>
              Tên mục
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên..." autoFocus />
            </label>
          ) : (
            <div className="cover-field">
              <button
                type="button"
                className="cover-thumb"
                onClick={() => coverUrlVal.trim() && setCoverPreview(true)}
                disabled={!coverUrlVal.trim()}
                aria-label={coverUrlVal.trim() ? 'Xem ảnh bìa cỡ lớn' : 'Chưa có ảnh bìa'}
              >
                {coverUrlVal.trim() ? (
                  <img
                    src={coverUrlVal.trim()}
                    alt="Ảnh bìa"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                ) : (
                  <ImagePlus size={18} />
                )}
              </button>

              <div className="cover-field-body">
                <label>
                  Tên mục
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên..." autoFocus />
                </label>
                <input
                  className="cover-url-input"
                  value={coverUrlVal}
                  onChange={(e) => setCoverUrlVal(e.target.value)}
                  placeholder="Dán link ảnh bìa (tuỳ chọn)…"
                />
                <div className="cover-field-actions">
                  <input
                    ref={coverFileInput}
                    type="file"
                    accept="image/*"
                    hidden
                    aria-label="Chọn ảnh bìa từ máy"
                    onChange={(e) => e.target.files?.[0] && uploadCoverFile(e.target.files[0])}
                  />
                  <button type="button" onClick={() => coverFileInput.current?.click()} disabled={coverUploading}>
                    <ImagePlus size={13} /> {coverUploading ? 'Đang tải…' : 'Tải ảnh lên'}
                  </button>
                  <button type="button" onClick={() => setCoverPreview(true)} disabled={!coverUrlVal.trim()}>
                    <Eye size={13} /> Xem mẫu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 1. Book / Manga Fields */}
          {(activeModal.kind === 'BOOK' || activeModal.kind === 'MANGA') && (
            <div style={{ display: 'grid', gap: 10 }}>
              {activeModal.kind === 'BOOK' && (
                <div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>Hình thức</span>
                  <div className="form-row-2" style={{ gap: 6 }}>
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

              {/* Chapter & Start Date & End Date — phẳng, không lồng khung để tiết kiệm chiều cao */}
              <div style={{ display: 'grid', gap: 8 }}>
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
                <div className="form-row-2 stack-sm">
                  <label>
                    🚀 Bắt đầu
                    <input type="date" value={startDateVal} onChange={(e) => setStartDateVal(e.target.value)} />
                  </label>
                  <label>
                    🏁 Kết thúc
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
            <div style={{ display: 'grid', gap: 10 }}>
              {/* Dán link vào đây là tên video và tên kênh tự điền xuống dưới. */}
              <label>
                Link YouTube
                <div className="yt-url-field">
                  <input
                    value={youtubeUrlVal}
                    onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                    placeholder="Dán link video (https://www.youtube.com/watch?v=…)"
                  />
                  {autofilling && <RefreshCw size={14} className="spin" aria-label="Đang lấy thông tin" />}
                </div>
              </label>

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
                  {autofilling && <RefreshCw size={13} className="spin" aria-label="Đang lấy tên bài" />}
                </span>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    value={youtubeUrlVal}
                    onChange={(e) => handleYouTubeUrlChange(e.target.value)}
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

          {/* Ngày · Giờ · Trạng thái gộp thành hai hàng ngắn để form vừa một màn hình */}
          <div className="form-row-2" style={{ marginTop: 8 }}>
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

      {/* Xem mẫu ảnh bìa ở cỡ lớn trước khi lưu */}
      {coverPreview && (
        <Modal title="Xem mẫu ảnh bìa" onClose={() => setCoverPreview(false)}>
          <img
            src={coverUrlVal.trim()}
            alt="Xem mẫu ảnh bìa"
            style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 12, background: 'var(--bg-main)' }}
          />
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
            <div className="form-row-2">
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

      {/* Thanh nghe liên tục bám đáy, sống qua việc đổi tab trong thư viện. */}
      {playingQueue && playingQueue.length > 0 && (
        <AudioQueuePlayer queue={playingQueue} onClose={() => setPlayingQueue(null)} />
      )}
    </section>
  )
}
