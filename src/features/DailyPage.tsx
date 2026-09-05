import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, ChevronLeft, ChevronRight, ChevronUp, Clock, History, ImagePlus,
  Loader2, NotebookPen, Pencil, Plus, Save,
  Sparkles, Star, Trash2, Youtube, Zap, Settings2, Tag, Play,
  Users, Check, X, List, Calendar, CalendarDays, Search
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { queueWrite } from '../lib/offlineQueue'
import { isEntryFirstTime, isEntrySpecial, type DailyCategoryItem, type DailyType, type Entry, type Person } from '../types'
import { loadLocal, saveLocal } from '../lib/persistence'
import { getRemoteAppSetting, saveAppSetting } from '../lib/userAppSettings'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'
import { SkeletonList } from './Skeleton'
import { fetchYouTubeMeta, youtubeVideoId } from '../lib/youtubeMeta'
import { getVideoWatchLogs, type VideoWatchLog } from '../lib/videoWatchLog'
import { compressForUpload } from '../lib/photo'
import { Memory3DCard } from './daily/Memory3DCard'
import { getVideoPosterUrl } from './daily/SharedEventsView'
import { deleteStorageFile, deleteStorageFiles } from '../lib/storageDelete'
import { uploadMediaFile } from '../lib/storageService'

export const DEFAULT_DAILY_CATEGORIES: DailyCategoryItem[] = []

export const SPECIAL_TAG_LABELS = new Set([
  'lần đầu',
  'lan dau',
  'lan_dau',
  'first_time',
  'first time',
  'is_first_time',
  'đặc biệt',
  'dac biet',
  'dac_biet',
  'special',
  'is_special',
])

export function formatDisplayContent(content: string): string {
  if (!content) return ''
  return content.replace(/^(\[[^\]]+\]\s*)+/, '').trim()
}

/** Trích xuất danh sách người thân được gắn trong bài nhật ký (từ tags, brackets hoặc nội dung) */
export function getAttachedPeople(entry: Entry | null | undefined, allPeople: Person[]): Person[] {
  if (!allPeople || allPeople.length === 0 || !entry) return []
  const found = new Map<string, Person>()

  const contentLower = (entry.content || '').toLowerCase()
  const tagsList = (entry.tags || []).map((t) => t.toLowerCase())

  for (const person of allPeople) {
    const pName = person.name.trim().toLowerCase()
    if (!pName) continue

    // 1. Kiểm tra tags
    if (tagsList.includes(pName) || tagsList.includes(`@${pName}`) || tagsList.includes(person.id.toLowerCase())) {
      found.set(person.id, person)
      continue
    }

    // 2. Kiểm tra tag trong ngoặc vuông hoặc @[Tên]
    if (
      contentLower.includes(`[@${pName}]`) ||
      contentLower.includes(`[${pName}]`) ||
      contentLower.includes(`[👤 ${pName}]`) ||
      contentLower.includes(`@${pName}`)
    ) {
      found.set(person.id, person)
      continue
    }

    // 3. Kiểm tra nếu trong nội dung có nhắc tên tự nhiên với ranh giới từ (ví dụ: "Nay mua cho mẹ...", "đi với Ái Vy")
    if (pName.length >= 2) {
      const escaped = pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}([^\\p{L}\\p{N}_]|$)`, 'iu')
      if (regex.test(contentLower)) {
        found.set(person.id, person)
      }
    }
  }

  return Array.from(found.values())
}

export function getCategoryInfo(entry: Entry, allCategories: DailyCategoryItem[]): DailyCategoryItem | null {
  // 1. Kiểm tra nếu có category trực tiếp
  if (entry.category && !SPECIAL_TAG_LABELS.has(entry.category.trim().toLowerCase())) {
    const found = allCategories.find(
      (c) => c.label.toLowerCase() === entry.category?.toLowerCase() || c.id === entry.category
    )
    if (found) return found
    return { id: entry.category, label: entry.category, icon: '🏷️', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' }
  }

  // 2. Kiểm tra nếu nội dung có gắn [Thể loại] (bỏ qua [Lần đầu], [Đặc biệt])
  if (entry.content) {
    const matches = Array.from(entry.content.matchAll(/\[([^\]]+)\]/g))
    for (const match of matches) {
      const catLabel = match[1].trim()
      if (!SPECIAL_TAG_LABELS.has(catLabel.toLowerCase())) {
        const found = allCategories.find(
          (c) => c.label.toLowerCase() === catLabel.toLowerCase() || c.id === catLabel
        )
        if (found) return found
        return { id: catLabel, label: catLabel, icon: '🏷️', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' }
      }
    }
  }

  // 3. Kiểm tra tags
  if (entry.tags && Array.isArray(entry.tags) && entry.tags.length > 0) {
    const nonSpecialTag = entry.tags.find((t) => !SPECIAL_TAG_LABELS.has(t.trim().toLowerCase()))
    if (nonSpecialTag) {
      const found = allCategories.find(
        (c) => c.label.toLowerCase() === nonSpecialTag.toLowerCase() || c.id === nonSpecialTag
      )
      if (found) return found
      return { id: nonSpecialTag, label: nonSpecialTag, icon: '🏷️', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' }
    }
  }
  return null
}

/** 'HH:MM' theo giờ máy, cập nhật mỗi 30 giây. */
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

type PageTab = 'write' | 'collection' | 'stats'
type StatsPeriod = 'week' | 'month' | 'all'

// ── helpers ────────────────────────────────────────────────────────────────

function formatHourFriendly(t: string): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr || '0', 10)
  if (isNaN(h)) return t
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

function computeTimePrefix(from: string, to: string): string {
  if (from && to) {
    return `Từ ${formatHourFriendly(from)} -> ${formatHourFriendly(to)}: `
  }
  if (from) {
    return `Từ ${formatHourFriendly(from)}: `
  }
  return ''
}

function normalizeTimeToHHMM(str: string): string {
  if (!str) return ''
  str = str.replace(/^từ\s+/i, '').trim()
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const [h, m] = str.split(':')
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  }
  const hmMatch = str.match(/^(\d{1,2})h(\d{1,2})?$/i)
  if (hmMatch) {
    const h = hmMatch[1].padStart(2, '0')
    const m = (hmMatch[2] || '00').padStart(2, '0')
    return `${h}:${m}`
  }
  if (/^\d{1,2}$/.test(str)) {
    return `${str.padStart(2, '0')}:00`
  }
  return str
}

function parseTimeRangeFromEntry(entryTime?: string | null, content?: string): { from: string; to: string } {
  let from = ''
  let to = ''

  if (entryTime) {
    if (entryTime.includes('-')) {
      const parts = entryTime.split('-').map((s) => s.trim())
      if (parts[0]) from = normalizeTimeToHHMM(parts[0])
      if (parts[1]) to = normalizeTimeToHHMM(parts[1])
    } else if (entryTime.includes('->')) {
      const parts = entryTime.split('->').map((s) => s.trim())
      if (parts[0]) from = normalizeTimeToHHMM(parts[0])
      if (parts[1]) to = normalizeTimeToHHMM(parts[1])
    } else {
      from = normalizeTimeToHHMM(entryTime.trim())
    }
  }

  if (content) {
    const match = content.match(/^(?:Từ\s+)?(\d{1,2}(?:h\d{1,2}|:\d{2}|h)?)(?:\s*(?:->|-)\s*(\d{1,2}(?:h\d{1,2}|:\d{2}|h)?))?:\s*/i)
    if (match) {
      if (match[1] && !from) from = normalizeTimeToHHMM(match[1])
      if (match[2] && (!to || match[2])) to = normalizeTimeToHHMM(match[2])
    }
  }

  return { from, to }
}

function applyTimePrefixToContent(currentContent: string, newPrefix: string): string {
  const prefixRegex = /^(?:Từ\s+)?(?:\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2})(?:\s*->\s*(?:\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2}))?:\s*/i
  if (prefixRegex.test(currentContent)) {
    return currentContent.replace(prefixRegex, newPrefix)
  }
  if (!currentContent.trim()) {
    return newPrefix
  }
  return `${newPrefix}${currentContent}`
}


function startOfWeek(d: Date) {
  const c = new Date(d)
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7)) // Monday
  return c
}

const PHOTO_BUCKET = 'daily-photos'
const QUICK_KEY = 'daily-quick-phrases'

function viDate(s: string) {
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function groupByDate(entries: Entry[]): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>()
  entries.forEach((e) => {
    const key = e.entry_date
    map.set(key, [...(map.get(key) ?? []), e])
  })
  return map
}

// ── component ──────────────────────────────────────────────────────────────

export function DailyPage() {
  const { showToast } = useToast()
  const { items, setItems, loading } = useQuery<Entry>('daily_entries')
  const peopleQuery = useQuery<Person>('people', 'name')

  const [pageTab, setPageTab] = useState<PageTab>('write')
  const clock = useClock()

  // Thể loại tuỳ chỉnh 100% người dùng tự định nghĩa & lưu Supabase
  const [dailyCategories, setDailyCategories] = useState<DailyCategoryItem[]>(() => {
    return loadLocal<DailyCategoryItem[]>('daily_custom_categories', [])
  })
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState<string | null>(null)

  // Modal quản lý thể loại
  const [showCategoryConfigModal, setShowCategoryConfigModal] = useState(false)
  const [editingCat, setEditingCat] = useState<DailyCategoryItem | null>(null)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('🏷️')
  const [newCatColor, setNewCatColor] = useState('#8b5cf6')
  const [newCatBg, setNewCatBg] = useState('rgba(139, 92, 246, 0.15)')

  // Tải thể loại từ Supabase Database
  useEffect(() => {
    getRemoteAppSetting<DailyCategoryItem[]>('daily_custom_categories', [])
      .then((cats) => {
        if (Array.isArray(cats)) {
          setDailyCategories(cats)
          saveLocal('daily_custom_categories', cats)
        }
      })
      .catch(() => {})
  }, [])

  // Tự động phát hiện & bảo lưu thể loại từ danh sách nhật ký nếu có thể loại mới
  useEffect(() => {
    if (!items || items.length === 0) return
    let hasNew = false
    const currentLabels = new Set(dailyCategories.map((c) => c.label.toLowerCase()))
    const newCats: DailyCategoryItem[] = [...dailyCategories]

    items.forEach((item) => {
      const match = item.content?.match(/^\[([^\]]+)\]/)
      const tag = match?.[1]?.trim() || item.category
      if (tag && !currentLabels.has(tag.toLowerCase())) {
        currentLabels.add(tag.toLowerCase())
        newCats.push({
          id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: tag,
          icon: '🏷️',
          color: '#8b5cf6',
          bg: 'rgba(139, 92, 246, 0.15)',
        })
        hasNew = true
      }
    })

    if (hasNew) {
      setDailyCategories(newCats)
      saveLocal('daily_custom_categories', newCats)
      void saveAppSetting('daily_custom_categories', newCats)
    }
  }, [items])

  // Write tab state
  const [content, setContent] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState(localDate())
  const [timeOverride, setTimeOverride] = useState('') // rỗng = dùng giờ hiện tại
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [isSpecial, setIsSpecial] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')
  const [editing, setEditing] = useState<Entry | null>(null)
  const [editText, setEditText] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editTimeFrom, setEditTimeFrom] = useState('')
  const [editTimeTo, setEditTimeTo] = useState('')
  const [editIsFirstTime, setEditIsFirstTime] = useState(false)
  const [editIsSpecial, setEditIsSpecial] = useState(false)
  const [collectionFilter, setCollectionFilter] = useState<'ALL' | 'FIRST_TIME' | 'SPECIAL' | 'FAV'>('ALL')
  const [collectionSearch, setCollectionSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [quickPhrases, setQuickPhrases] = useState<string[]>(() => loadLocal(QUICK_KEY, []))
  const [editQuick, setEditQuick] = useState<string | null>(null) // != null: đang mở hộp sửa danh sách

  // Media đính kèm cho bài viết mới (hỗ trợ nhiều ảnh & video)
  type AttachedMedia = {
    url: string
    path: string
    type: 'image' | 'video'
    name: string
  }
  const [attachedMedias, setAttachedMedias] = useState<AttachedMedia[]>([])
  const [mediaUploading, setMediaUploading] = useState(false)
  const formFileInputRef = useRef<HTMLInputElement>(null)
  const [previewGallery, setPreviewGallery] = useState<{ items: string[]; index: number } | null>(null)

  const openMediaGallery = (items: string[], index = 0) => {
    if (!items.length) return
    setPreviewGallery({ items, index })
  }

  // Chế độ xem & tuỳ chọn gọn
  const [showExtraOptions, setShowExtraOptions] = useState(false)
  const [viewMode, setViewMode] = useState<'timeline' | 'month'>('timeline')
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('ALL')
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null)

  // Người thân được chọn gắn kèm nhật ký
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([])
  const [showPeopleModal, setShowPeopleModal] = useState(false)
  const [peopleSearch, setPeopleSearch] = useState('')

  const selectedPeople = useMemo(() => {
    return peopleQuery.items.filter((p) => selectedPersonIds.includes(p.id))
  }, [peopleQuery.items, selectedPersonIds])

  const handleUploadFormMedia = async (files: FileList | File[]) => {
    if (!supabase) {
      showToast('⚠️ Cần kết nối Supabase để lưu ảnh/video', 'local')
      return
    }
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    // Loại bỏ tệp trùng lặp với danh sách đã chọn hoặc trong cùng đợt chọn
    const existingNames = new Set(attachedMedias.map((m) => m.name.toLowerCase()))
    const uniqueFiles: File[] = []
    let duplicateCount = 0

    for (const f of fileArray) {
      const nameLower = f.name.toLowerCase()
      if (existingNames.has(nameLower)) {
        duplicateCount++
        continue
      }
      existingNames.add(nameLower)
      uniqueFiles.push(f)
    }

    if (duplicateCount > 0) {
      showToast(`ℹ️ Đã tự động bỏ qua ${duplicateCount} tệp trùng lặp`)
    }

    if (uniqueFiles.length === 0) return

    setMediaUploading(true)
    let savedCount = 0

    for (const file of uniqueFiles) {
      try {
        await new Promise((r) => setTimeout(r, 20))
        const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(file.name)
        let uploadBlob: Blob | File = file
        let ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')

        if (!isVideo) {
          const compressed = await compressForUpload(file)
          uploadBlob = compressed.blob
          ext = compressed.ext
        }

        const fileId = crypto.randomUUID()
        const path = `${date}/${fileId}.${ext}`

        let publicUrl = ''
        try {
          const uploaded = await uploadMediaFile(uploadBlob, {
            folder: `daily-photos/${date}`,
            fileName: fileId,
            bucketFallback: PHOTO_BUCKET,
            resourceType: isVideo ? 'video' : 'image',
          })
          publicUrl = uploaded.url
        } catch (uploadErr: any) {
          console.warn('Lỗi upload file:', uploadErr?.message)
          continue
        }

        const newItem: AttachedMedia = {
          url: publicUrl,
          path: publicUrl.includes('cloudinary.com') ? publicUrl : path,
          type: isVideo ? 'video' : 'image',
          name: file.name,
        }

        // Tải ảnh/video nào hiển thị và lưu ngay ảnh đó
        setAttachedMedias((prev) => [...prev, newItem])
        savedCount++
      } catch (err: any) {
        console.warn('Lỗi upload file:', err)
      }
    }

    if (savedCount > 0) {
      showToast(`✅ Đã tải ${savedCount} ảnh/video lên Supabase Storage!`, 'success')
    } else {
      showToast('❌ Tải file lên thất bại. Vui lòng thử lại.', 'delete')
    }
    setMediaUploading(false)
  }

  const handleRemoveFormMedia = async (index: number) => {
    const item = attachedMedias[index]
    if (!item) return
    if (item.path) {
      void deleteStorageFile(PHOTO_BUCKET, item.path)
    }
    setAttachedMedias((prev) => prev.filter((_, i) => i !== index))
    showToast('🗑️ Đã gỡ file đính kèm', 'delete')
  }
  
  // Lưu danh sách hành động chọn nhanh riêng cho từng người lên Supabase
  const saveUserQuickPhrases = async (phrases: string[]) => {
    let userKey = 'guest'
    if (supabase?.auth) {
      try {
        const user = (await supabase.auth.getUser())?.data?.user
        if (user) {
          userKey = user.id
          const { data: existing } = await supabase
            .from('media_items')
            .select('id')
            .eq('user_id', user.id)
            .eq('genre', 'DAILY_QUICK_ACTIONS')
            .limit(1)

          const payload = {
            user_id: user.id,
            type: 'STORY' as const,
            genre: 'DAILY_QUICK_ACTIONS',
            channel: 'quick_phrases',
            name: 'Daily Quick Actions',
            description: JSON.stringify(phrases),
            is_public: false,
          }

          if (existing && existing.length > 0) {
            await supabase.from('media_items').update(payload).eq('id', existing[0].id)
          } else {
            await supabase.from('media_items').insert(payload)
          }
        }
      } catch (e) {
        console.warn('Lỗi lưu danh sách hành động lên Supabase:', e)
      }
    }
    saveLocal(`daily-quick-phrases-${userKey}`, phrases)
    saveLocal(QUICK_KEY, phrases)
  }

  // Tải danh sách hành động riêng của từng người từ Supabase khi mở trang
  useEffect(() => {
    let alive = true
    const loadPhrases = async () => {
      let userKey = 'guest'
      if (supabase?.auth) {
        try {
          const user = (await supabase.auth.getUser())?.data?.user
          if (user) {
            userKey = user.id
            const { data } = await supabase
              .from('media_items')
              .select('description')
              .eq('user_id', user.id)
              .eq('genre', 'DAILY_QUICK_ACTIONS')
              .is('deleted_at', null)
              .maybeSingle()

            if (data?.description && alive) {
              try {
                const parsed = JSON.parse(data.description)
                if (Array.isArray(parsed)) {
                  setQuickPhrases(parsed)
                  saveLocal(`daily-quick-phrases-${userKey}`, parsed)
                  saveLocal(QUICK_KEY, parsed)
                  return
                }
              } catch {}
            }
          }
        } catch {}
      }
      if (alive) {
        const local = loadLocal<string[]>(`daily-quick-phrases-${userKey}`, loadLocal<string[]>(QUICK_KEY, []))
        if (local.length > 0) setQuickPhrases(local)
      }
    }
    void loadPhrases()
    return () => { alive = false }
  }, [])
  
  // Action Combobox Modal state
  const [showActionModal, setShowActionModal] = useState(false)

  const [actionSearch, setActionSearch] = useState('')
  
  // Video / YouTube / TV Show Modal state
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoUrlInput, setVideoUrlInput] = useState('')
  const [videoFetching, setVideoFetching] = useState(false)
  const [fetchedVideoMeta, setFetchedVideoMeta] = useState<{ title: string; author: string; videoId: string } | null>(null)
  const [recentVideos, setRecentVideos] = useState<VideoWatchLog[]>([])

  
  const entryFileInput = useRef<HTMLInputElement>(null)
  const mentionQuery = content.match(/@([^\s@]*)$/)?.[1]?.toLowerCase() ?? ''
  const mentionPeople = peopleQuery.items.filter((p) => p.name.toLowerCase().includes(mentionQuery)).slice(0, 6)

  // Stats tab state
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('week')
  const [statsType, setStatsType] = useState<'ALL' | DailyType>('ALL')

  // Load recent watch logs when opening video modal
  useEffect(() => {
    if (showVideoModal) {
      const logs = getVideoWatchLogs()
      setRecentVideos(logs.slice(0, 15))
    }
  }, [showVideoModal])

  // Handle time from / time to updates
  const handleTimeFromChange = (fromVal: string) => {
    setTimeFrom(fromVal)
    const newPrefix = computeTimePrefix(fromVal, timeTo)
    setContent((prev) => applyTimePrefixToContent(prev, newPrefix))
    if (fromVal && timeTo) {
      setTimeOverride(`${fromVal} - ${timeTo}`)
    } else if (fromVal) {
      setTimeOverride(fromVal)
    }
  }

  const handleTimeToChange = (toVal: string) => {
    setTimeTo(toVal)
    const newPrefix = computeTimePrefix(timeFrom, toVal)
    setContent((prev) => applyTimePrefixToContent(prev, newPrefix))
    if (timeFrom && toVal) {
      setTimeOverride(`${timeFrom} - ${toVal}`)
    } else if (timeFrom) {
      setTimeOverride(timeFrom)
    }
  }



  const clearTimeRange = () => {
    setTimeFrom('')
    setTimeTo('')
    setTimeOverride('')
    const prefixRegex = /^(?:Từ\s+)?(?:\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2})(?:\s*->\s*(?:\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2}))?:\s*/i
    setContent((prev) => prev.replace(prefixRegex, ''))
  }

  // ── actions ─────────────────────────────────────────────────────────────

  const insertQuickPhrase = (phrase: string) => {
    if (!phrase) return
    setContent((text) => {
      const prefixRegex = /^(?:Từ\s+)?(?:\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2})(?:\s*->\s*(?:\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2}))?:\s*/i
      const match = text.match(prefixRegex)
      if (match) {
        const prefix = match[0]
        const rest = text.slice(prefix.length).trim()
        if (!rest) {
          return `${prefix}${phrase}`
        }
        return `${prefix}${rest}, ${phrase}`
      }
      const trimmed = text.trim()
      return trimmed ? `${trimmed}\n${phrase}` : phrase
    })
    showToast(`⚡ Đã thêm: ${phrase}`)
  }

  // Video paste & select handlers
  const handleFetchUrlMeta = async (url: string) => {
    const vId = youtubeVideoId(url)
    if (!vId) {
      setFetchedVideoMeta(null)
      return
    }
    setVideoFetching(true)
    const meta = await fetchYouTubeMeta(url)
    setVideoFetching(false)
    if (meta) {
      setFetchedVideoMeta({ title: meta.title, author: meta.author, videoId: vId })
    } else {
      setFetchedVideoMeta({ title: 'Video YouTube', author: '', videoId: vId })
    }
  }

  const handleSelectVideo = (video: { videoId: string; title: string; channelName?: string; youtubeUrl?: string }) => {
    // Chỉ lưu vào nội dung nhật ký để tránh bị ghi thành 2 mục trùng nhau
    const channelSuffix = video.channelName ? ` (${video.channelName})` : ''
    const diaryLine = `Xem YouTube: ${video.title}${channelSuffix}`
    insertQuickPhrase(diaryLine)

    setShowVideoModal(false)
    setVideoUrlInput('')
    setFetchedVideoMeta(null)
    showToast('🎬 Đã thêm video YouTube vào Nhật ký!')
  }



  // Quản lý thể loại (Lưu & Xoá)
  const handleSaveCategory = async () => {
    const label = newCatLabel.trim()
    if (!label) {
      showToast('Vui lòng nhập tên thể loại', 'delete')
      return
    }

    let updated: DailyCategoryItem[] = []
    if (editingCat) {
      updated = dailyCategories.map((c) =>
        c.id === editingCat.id
          ? { ...c, label, icon: newCatIcon || '🏷️', color: newCatColor || '#8b5cf6', bg: newCatBg || 'rgba(139, 92, 246, 0.15)' }
          : c
      )
      showToast(`✏️ Đã cập nhật thể loại "${label}"`, 'success')
    } else {
      if (dailyCategories.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
        showToast('Thể loại này đã tồn tại', 'delete')
        return
      }
      const newCat: DailyCategoryItem = {
        id: `cat_${Date.now()}`,
        label,
        icon: newCatIcon || '🏷️',
        color: newCatColor || '#8b5cf6',
        bg: newCatBg || 'rgba(139, 92, 246, 0.15)',
      }
      updated = [...dailyCategories, newCat]
      showToast(`➕ Đã thêm thể loại "${label}"`, 'success')
    }

    setDailyCategories(updated)
    await saveAppSetting('daily_custom_categories', updated)
    setEditingCat(null)
    setNewCatLabel('')
    setNewCatIcon('🏷️')
  }

  const handleDeleteCategory = async (catId: string, catLabel: string) => {
    if (!confirm(`Xoá thể loại "${catLabel}"?`)) return
    const updated = dailyCategories.filter((c) => c.id !== catId)
    setDailyCategories(updated)
    await saveAppSetting('daily_custom_categories', updated)
    if (selectedCategory === catLabel) setSelectedCategory(null)
    showToast(`🗑️ Đã xoá thể loại "${catLabel}"`, 'delete')
  }

  const setQuickTime = (fromVal: string, toVal: string) => {
    setTimeFrom(fromVal)
    setTimeTo(toVal)
    const formatted = fromVal && toVal ? `${fromVal} - ${toVal}` : fromVal
    setTimeOverride(formatted)
    const newPrefix = computeTimePrefix(fromVal, toVal)
    setContent((prev) => applyTimePrefixToContent(prev, newPrefix))
  }

  const saveEntries = async () => {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    setBusy(true)
    setSaveSuccess('')
    const currentTimeString = timeOverride || clock

    const tagsList: string[] = []
    if (selectedCategory) tagsList.push(selectedCategory)
    if (isFirstTime) tagsList.push('FIRST_TIME', 'Lần đầu', 'lan_dau')
    if (isSpecial) tagsList.push('SPECIAL', 'Đặc biệt', 'dac_biet')
    if (selectedPeople.length > 0) {
      selectedPeople.forEach((p) => {
        tagsList.push(`@${p.name}`, p.name)
      })
    }

    // Luôn dùng entry_type chuẩn của database ('FEELING' / 'NEW_THING') để không bao giờ bị dính lỗi check constraint của PostgreSQL
    const safeEntryType: DailyType = isFirstTime ? 'NEW_THING' : 'FEELING'

    // Encode category, first time, special, and tagged people into line so they persist 100% everywhere (both locally & in database across reloads)
    const peoplePrefix = selectedPeople.length > 0 ? selectedPeople.map((p) => `[@${p.name}]`).join(' ') : ''
    const formattedLines = lines.map((lineText) => {
      let l = lineText.trim().replace(/^(\[[^\]]+\]\s*)+/, '')
      let prefix = ''
      if (selectedCategory) prefix += `[${selectedCategory}]`
      if (isFirstTime) prefix += `[Lần đầu]`
      if (isSpecial) prefix += `[Đặc biệt]`
      if (peoplePrefix) prefix += (prefix ? ` ${peoplePrefix}` : peoplePrefix)
      return prefix ? `${prefix} ${l}` : l
    })

    // Tạo payload chuẩn xác với is_first_time, is_special, category, tags và danh sách ảnh/video đính kèm
    const allUrls = attachedMedias.map((m) => m.url)
    const allPaths = attachedMedias.map((m) => m.path)

    const payload = formattedLines.map((lineText, idx) => ({
      content: lineText,
      entry_date: date,
      entry_type: safeEntryType,
      category: selectedCategory || null,
      entry_time: currentTimeString,
      is_first_time: Boolean(isFirstTime),
      is_special: Boolean(isSpecial),
      tags: tagsList,
      image_url: idx === 0 ? allUrls[0] ?? null : null,
      image_path: idx === 0 ? allPaths[0] ?? null : null,
      images: idx === 0 ? (allUrls.length > 0 ? allUrls : null) : null,
      image_paths: idx === 0 ? (allPaths.length > 0 ? allPaths : null) : null,
    }))

    let savedToSupabase = false
    let savedItems: Entry[] = []

    try {
      if (supabase) {
        // Tier 1: Insert đầy đủ is_first_time, is_special, tags, category, images
        const { data, error } = await supabase.from('daily_entries').insert(payload).select()
        if (!error && data && data.length > 0) {
          savedToSupabase = true
          savedItems = (data as any[]).map((row) => ({
            ...row,
            category: selectedCategory,
            is_first_time: Boolean(isFirstTime || row.is_first_time),
            is_special: Boolean(isSpecial || row.is_special),
            tags: row.tags && row.tags.length > 0 ? row.tags : tagsList,
            images: row.images && row.images.length > 0 ? row.images : (row.image_url ? [row.image_url] : allUrls),
            image_paths: row.image_paths && row.image_paths.length > 0 ? row.image_paths : (row.image_path ? [row.image_path] : allPaths),
          })) as Entry[]
        } else if (error) {
          console.warn('Lỗi Supabase Tier 1, thử lại phương án Tier 2 (không có cột mảng images):', error)
          // Tier 2: Thử lại nếu DB chưa chạy migration images hoặc is_first_time
          const tier2Payload = formattedLines.map((lineText, idx) => ({
            content: lineText,
            entry_date: date,
            entry_type: safeEntryType,
            entry_time: currentTimeString,
            tags: tagsList,
            image_url: idx === 0 ? allUrls[0] ?? null : null,
            image_path: idx === 0 ? allPaths[0] ?? null : null,
          }))
          const { data: retryData, error: retryErr } = await supabase
            .from('daily_entries')
            .insert(tier2Payload)
            .select()

          if (!retryErr && retryData && retryData.length > 0) {
            savedToSupabase = true
            savedItems = (retryData as any[]).map((row) => ({
              ...row,
              category: selectedCategory,
              is_first_time: Boolean(isFirstTime),
              is_special: Boolean(isSpecial),
              tags: tagsList,
              images: allUrls,
              image_paths: allPaths,
            })) as Entry[]
          } else if (retryErr) {
            console.warn('Lỗi Supabase Tier 2, thử lại Tier 3 (cột cơ bản nhất):', retryErr)
            // Tier 3: Thử lại với schema cơ bản nhất (không có cột mới)
            const tier3Payload = formattedLines.map((lineText, idx) => ({
              content: lineText,
              entry_date: date,
              entry_type: safeEntryType,
              entry_time: currentTimeString,
              image_url: idx === 0 ? allUrls[0] ?? null : null,
              image_path: idx === 0 ? allPaths[0] ?? null : null,
            }))
            const { data: r3Data, error: r3Err } = await supabase
              .from('daily_entries')
              .insert(tier3Payload)
              .select()

            if (!r3Err && r3Data && r3Data.length > 0) {
              savedToSupabase = true
              savedItems = (r3Data as any[]).map((row) => ({
                ...row,
                category: selectedCategory,
                is_first_time: Boolean(isFirstTime),
                is_special: Boolean(isSpecial),
                tags: tagsList,
                images: allUrls,
                image_paths: allPaths,
              })) as Entry[]
            }
          }
        }

        // Thu thập danh sách người cần lưu vào nhật ký riêng (người được chọn + người được tag @)
        if (savedToSupabase) {
          const targetPeople: Person[] = []
          selectedPersonIds.forEach((pid) => {
            const p = peopleQuery.items.find((x) => x.id === pid)
            if (p && !targetPeople.some((t) => t.id === p.id)) targetPeople.push(p)
          })
          peopleQuery.items.forEach((person) => {
            if (lines.some((line) => line.includes(`@${person.name}`)) && !targetPeople.some((t) => t.id === person.id)) {
              targetPeople.push(person)
            }
          })

          if (targetPeople.length > 0 && supabase) {
            const newLogChunk = lines.join('\n')
            await Promise.all(
              targetPeople.map(async (person) => {
                try {
                  const { data: existing } = await supabase!
                    .from('person_daily_logs')
                    .select('content')
                    .eq('person_id', person.id)
                    .eq('log_date', date)
                    .maybeSingle()

                  const combined = existing?.content && !existing.content.includes(newLogChunk)
                    ? `${existing.content.trim()}\n\n${newLogChunk}`
                    : newLogChunk

                  return supabase!.from('person_daily_logs').upsert(
                    { person_id: person.id, log_date: date, content: combined },
                    { onConflict: 'user_id,person_id,log_date' }
                  )
                } catch (e) {
                  console.warn(`Lỗi lưu nhật ký riêng cho ${person.name}:`, e)
                }
              })
            ).catch(() => {})
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi khi lưu Supabase:', err)
    }

    if (savedToSupabase && savedItems.length > 0) {
      setItems((prev) => [...savedItems, ...prev])
      setContent('')
      setIsFirstTime(false)
      setIsSpecial(false)
      setAttachedMedias([])
      setSelectedPersonIds([])
      setShowExtraOptions(false)
      const peopleMsg = selectedPeople.length > 0 ? ` & nhật ký ${selectedPeople.map(p => p.name).join(', ')}` : ''
      showToast(`☁️ Đã lưu ${lines.length} bài nhật ký${peopleMsg} lên Supabase!`, 'success')
      setSaveSuccess(`Đã lưu ${lines.length} nội dung lên Supabase ✨`)
      setTimeout(() => setSaveSuccess(''), 3500)
    } else {
      // Lưu vào Local Storage & Offline Queue
      const local = payload.map((row, i) => ({
        ...row,
        id: `local-${Date.now()}-${i}`,
        created_at: new Date().toISOString(),
      })) as Entry[]
      payload.forEach((row) => queueWrite({ table: 'daily_entries', op: 'insert', payload: row }))
      setItems((prev) => [...local, ...prev])
      setContent('')
      setIsFirstTime(false)
      setIsSpecial(false)
      setAttachedMedias([])
      setSelectedPersonIds([])
      setShowExtraOptions(false)
      showToast(`💾 Đã lưu ${lines.length} bài vào Local (Hàng đợi đồng bộ)`, 'local')
      setSaveSuccess(`Đã lưu ${lines.length} nội dung vào Local 💾`)
      setTimeout(() => setSaveSuccess(''), 3500)
    }
    setBusy(false)
  }

  const handleEditTimeFromChange = (fromVal: string) => {
    setEditTimeFrom(fromVal)
    const formatted = fromVal && editTimeTo ? `${fromVal} - ${editTimeTo}` : fromVal
    setEditTime(formatted)
    const newPrefix = computeTimePrefix(fromVal, editTimeTo)
    setEditText((prev) => applyTimePrefixToContent(prev, newPrefix))
  }

  const handleEditTimeToChange = (toVal: string) => {
    setEditTimeTo(toVal)
    const formatted = editTimeFrom && toVal ? `${editTimeFrom} - ${toVal}` : editTimeFrom || toVal
    setEditTime(formatted)
    const newPrefix = computeTimePrefix(editTimeFrom, toVal)
    setEditText((prev) => applyTimePrefixToContent(prev, newPrefix))
  }

  const updateEntry = async () => {
    if (!editing || !editText.trim()) return
    let finalTime = editTime
    if (editTimeFrom && editTimeTo) {
      finalTime = `${editTimeFrom} - ${editTimeTo}`
    } else if (editTimeFrom) {
      finalTime = editTimeFrom
    } else {
      const extracted = parseTimeRangeFromEntry(null, editText)
      if (extracted.from && extracted.to) {
        finalTime = `${extracted.from} - ${extracted.to}`
      } else if (extracted.from) {
        finalTime = extracted.from
      }
    }

    const editTagsList: string[] = []
    if (editCategory) editTagsList.push(editCategory)
    if (editIsFirstTime) editTagsList.push('FIRST_TIME', 'Lần đầu', 'lan_dau')
    if (editIsSpecial) editTagsList.push('SPECIAL', 'Đặc biệt', 'dac_biet')

    const safeEditEntryType: DailyType = editIsFirstTime ? 'NEW_THING' : 'FEELING'

    let cleanText = editText.trim().replace(/^(\[[^\]]+\]\s*)+/, '')
    let prefix = ''
    if (editCategory) prefix += `[${editCategory}]`
    if (editIsFirstTime) prefix += `[Lần đầu]`
    if (editIsSpecial) prefix += `[Đặc biệt]`
    const formattedContent = prefix ? `${prefix} ${cleanText}` : cleanText

    const patch = {
      content: formattedContent,
      entry_date: date,
      entry_type: safeEditEntryType,
      category: editCategory || null,
      entry_time: finalTime || null,
      is_first_time: Boolean(editIsFirstTime),
      is_special: Boolean(editIsSpecial),
      tags: editTagsList,
    }

    let updatedOnline = false
    try {
      if (supabase) {
        const { error } = await supabase.from('daily_entries').update(patch).eq('id', editing.id)
        if (!error) {
          updatedOnline = true
        } else {
          // Thử lại nếu DB chưa có cột is_first_time/is_special
          const simplePatch = {
            content: formattedContent,
            entry_date: date,
            entry_type: safeEditEntryType,
            entry_time: finalTime || null,
            tags: editTagsList,
          }
          const { error: err2 } = await supabase.from('daily_entries').update(simplePatch).eq('id', editing.id)
          if (!err2) {
            updatedOnline = true
          } else {
            // Thử lại với payload cơ bản nhất
            const basicPatch = {
              content: formattedContent,
              entry_date: date,
              entry_type: safeEditEntryType,
              entry_time: finalTime || null,
            }
            const { error: err3 } = await supabase.from('daily_entries').update(basicPatch).eq('id', editing.id)
            if (!err3) updatedOnline = true
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi cập nhật nhật ký:', e)
    }

    setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, ...patch } : i)))
    if (updatedOnline) {
      showToast('☁️ Đã cập nhật bài viết lên Supabase!', 'success')
    } else {
      queueWrite({ table: 'daily_entries', op: 'update', payload: { id: editing.id, ...patch } })
      showToast('💾 Đã cập nhật bài viết vào Local', 'local')
    }
    setEditing(null)
  }

  const openEntry = (entry: Entry) => {
    setEditing(entry)
    setEditText(formatDisplayContent(entry.content))
    setDate(entry.entry_date)
    setEditIsFirstTime(isEntryFirstTime(entry))
    setEditIsSpecial(isEntrySpecial(entry))
    const catInfo = getCategoryInfo(entry, dailyCategories)
    setEditCategory(catInfo ? catInfo.label : null)
    const { from, to } = parseTimeRangeFromEntry(entry.entry_time, entry.content)
    setEditTimeFrom(from)
    setEditTimeTo(to)
    setEditTime(from && to ? `${from} - ${to}` : from || entry.entry_time || '')
  }

  /** Đính nhiều ảnh/video vào dòng nhật ký đang mở; lưu lên Supabase Storage. */
  const uploadEntryMedia = async (files: FileList | File[]) => {
    if (!editing || !supabase) return
    const fileArray = Array.from(files)
    if (!fileArray.length) return
    setUploading(true)

    const currentImages = editing.images && editing.images.length > 0
      ? [...editing.images]
      : (editing.image_url ? [editing.image_url] : [])
    const currentPaths = editing.image_paths && editing.image_paths.length > 0
      ? [...editing.image_paths]
      : (editing.image_path ? [editing.image_path] : [])

    let added = 0
    for (const file of fileArray) {
      try {
        const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(file.name)
        let uploadBlob: Blob | File = file
        let ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')

        if (!isVideo) {
          const compressed = await compressForUpload(file)
          uploadBlob = compressed.blob
          ext = compressed.ext
        }

        const fileId = crypto.randomUUID()
        const path = `${editing.entry_date}/${fileId}.${ext}`

        const uploaded = await uploadMediaFile(uploadBlob, {
          folder: `daily-photos/${editing.entry_date}`,
          fileName: fileId,
          bucketFallback: PHOTO_BUCKET,
          resourceType: isVideo ? 'video' : 'image',
        })
        currentImages.push(uploaded.url)
        currentPaths.push(uploaded.url.includes('cloudinary.com') ? uploaded.url : path)
        added++
      } catch (err: any) {
        console.warn('Lỗi xử lý file:', err)
      }
    }

    if (added > 0) {
      const updatePayload = {
        image_url: currentImages[0] || null,
        image_path: currentPaths[0] || null,
        images: currentImages,
        image_paths: currentPaths,
      }
      const { error } = await supabase.from('daily_entries').update(updatePayload).eq('id', editing.id)
      if (error) {
        await supabase.from('daily_entries').update({
          image_url: currentImages[0] || null,
          image_path: currentPaths[0] || null,
        }).eq('id', editing.id)
      }
      const updated = { ...editing, ...updatePayload }
      setEditing(updated)
      setItems((prev) => prev.map((i) => (i.id === editing.id ? updated : i)))
      showToast(`✅ Đã thêm ${added} ảnh/video vào bài viết!`, 'success')
    } else {
      showToast('❌ Tải file lên thất bại', 'delete')
    }
    setUploading(false)
  }

  const removeEntryMedia = async (index?: number) => {
    if (!editing || !supabase) return
    const currentImages = editing.images && editing.images.length > 0
      ? [...editing.images]
      : (editing.image_url ? [editing.image_url] : [])
    const currentPaths = editing.image_paths && editing.image_paths.length > 0
      ? [...editing.image_paths]
      : (editing.image_path ? [editing.image_path] : [])

    if (typeof index === 'number') {
      const path = currentPaths[index]
      if (path) void deleteStorageFile(PHOTO_BUCKET, path)
      currentImages.splice(index, 1)
      currentPaths.splice(index, 1)
    } else {
      if (currentPaths.length > 0) {
        void deleteStorageFiles(PHOTO_BUCKET, currentPaths)
      }
      currentImages.length = 0
      currentPaths.length = 0
    }

    const updatePayload = {
      image_url: currentImages[0] || null,
      image_path: currentPaths[0] || null,
      images: currentImages.length > 0 ? currentImages : null,
      image_paths: currentPaths.length > 0 ? currentPaths : null,
    }

    const { error } = await supabase.from('daily_entries').update(updatePayload).eq('id', editing.id)
    if (error) {
      await supabase.from('daily_entries').update({
        image_url: currentImages[0] || null,
        image_path: currentPaths[0] || null,
      }).eq('id', editing.id)
    }

    const updated = { ...editing, ...updatePayload }
    setEditing(updated)
    setItems((prev) => prev.map((i) => (i.id === editing.id ? updated : i)))
    showToast('🗑️ Đã gỡ file đính kèm', 'delete')
  }

  const toggleFavorite = async (entry: Entry) => {
    const next = !entry.is_favorite
    setItems((prev) => prev.map((i) => (i.id === entry.id ? { ...i, is_favorite: next } : i)))
    setEditing((current) => (current?.id === entry.id ? { ...current, is_favorite: next } : current))
    const { error } = await supabase!.from('daily_entries').update({ is_favorite: next }).eq('id', entry.id)
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === entry.id ? { ...i, is_favorite: !next } : i)))
      showToast('❌ Chưa lưu được. Chạy migration daily_entry_favorite chưa?', 'delete')
      return
    }
    showToast(next ? '⭐ Đã thêm vào yêu thích' : 'Đã bỏ yêu thích')
  }

  const removeEntry = async (id: string) => {
    const target = items.find((i) => i.id === id) || (editing?.id === id ? editing : null)
    if (target) {
      const pathsToDelete: string[] = []
      if (Array.isArray((target as any).image_paths)) {
        pathsToDelete.push(...(target as any).image_paths.filter(Boolean))
      } else if ((target as any).image_path) {
        pathsToDelete.push((target as any).image_path)
      }
      if (pathsToDelete.length > 0) {
        void deleteStorageFiles(PHOTO_BUCKET, pathsToDelete)
      }
    }

    await supabase!.from('daily_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    showToast('🗑️ Đã xóa bài nhật ký thành công', 'delete')
    setEditing(null)
  }

  // ── derived ──────────────────────────────────────────────────────────────

  const keyword = search.trim().toLowerCase()

  /** Không tìm kiếm: chỉ ngày đang chọn. Có tìm kiếm: quét toàn bộ nhật ký, mới nhất trước. */
  const todayEntries = items
    .filter((i) => (keyword ? i.content.toLowerCase().includes(keyword) : i.entry_date === date))
    .filter((i) => {
      if (filterType === 'ALL') return true
      if (filterType === 'FAV') return Boolean(i.is_favorite)
      if (filterType === 'FIRST_TIME') return isEntryFirstTime(i)
      if (filterType === 'SPECIAL') return isEntrySpecial(i)
      if (filterType === 'PEOPLE') return getAttachedPeople(i, peopleQuery.items).length > 0
      if (filterType.startsWith('PERSON:')) {
        const targetPid = filterType.replace('PERSON:', '')
        return getAttachedPeople(i, peopleQuery.items).some((p) => p.id === targetPid)
      }
      if (filterType === 'NONE') {
        const catInfo = getCategoryInfo(i, dailyCategories)
        return !catInfo
      }
      const catInfo = getCategoryInfo(i, dailyCategories)
      return catInfo?.label === filterType || catInfo?.id === filterType || i.entry_type === filterType
    })
    .sort((a, b) => (keyword ? b.entry_date.localeCompare(a.entry_date) : 0))

  /** Ngày này năm trước: cùng ngày-tháng, năm cũ hơn — để đọc lại ký ức. */
  const onThisDay = useMemo(() => {
    const suffix = date.slice(4) // '-MM-DD'
    const year = date.slice(0, 4)
    return items
      .filter((i) => i.entry_date.endsWith(suffix) && i.entry_date.slice(0, 4) < year)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  }, [items, date])

  const statsEntries = useMemo(() => {
    const today = new Date()
    let cutoff: string
    if (statsPeriod === 'week') {
      cutoff = localDate(startOfWeek(today))
    } else if (statsPeriod === 'month') {
      const m = new Date(today.getFullYear(), today.getMonth(), 1)
      cutoff = localDate(m)
    } else {
      cutoff = '2000-01-01'
    }
    return items
      .filter((i) => i.entry_date >= cutoff)
      .filter((i) => {
        if (statsType === 'ALL') return true
        const catInfo = getCategoryInfo(i, dailyCategories)
        return catInfo?.label === statsType || catInfo?.id === statsType || i.entry_type === statsType
      })
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at))
  }, [items, statsPeriod, statsType, dailyCategories])

  // Count by type for summary cards
  const countByType = useMemo(() => {
    const map: Record<string, number> = {}
    statsEntries.forEach((e) => {
      const catInfo = getCategoryInfo(e, dailyCategories)
      const key = catInfo ? catInfo.label : 'Khác'
      map[key] = (map[key] ?? 0) + 1
    })
    return map
  }, [statsEntries, dailyCategories])

  const groupedByDate = useMemo(() => groupByDate(statsEntries), [statsEntries])
  const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => b.localeCompare(a))

  const collectionEntries = useMemo(() => {
    return items
      .filter((i) => isEntryFirstTime(i) || isEntrySpecial(i))
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at))
  }, [items])

  const firstTimeEntries = useMemo(() => collectionEntries.filter((i) => isEntryFirstTime(i)), [collectionEntries])
  const specialEntries = useMemo(() => collectionEntries.filter((i) => isEntrySpecial(i)), [collectionEntries])
  const favCollectionEntries = useMemo(() => collectionEntries.filter((i) => Boolean(i.is_favorite)), [collectionEntries])

  const filteredCollection = useMemo(() => {
    const q = collectionSearch.trim().toLowerCase()
    return collectionEntries
      .filter((i) => {
        if (collectionFilter === 'FIRST_TIME') return isEntryFirstTime(i)
        if (collectionFilter === 'SPECIAL') return isEntrySpecial(i)
        if (collectionFilter === 'FAV') return Boolean(i.is_favorite)
        return true
      })
      .filter((i) => !q || i.content.toLowerCase().includes(q) || i.entry_date.includes(q))
  }, [collectionEntries, collectionFilter, collectionSearch])

  // ── Month & Calendar groups for Month View ──────────────────────────────
  const sortedAllEntries = useMemo(() => {
    return [...items].sort((a, b) => b.entry_date.localeCompare(a.entry_date) || (b.entry_time || '').localeCompare(a.entry_time || ''))
  }, [items])

  type MonthGroup = {
    key: string // "YYYY-MM"
    year: number
    month: number
    label: string
    entries: Entry[]
    totalPhotos: number
  }

  const monthGroups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, MonthGroup>()
    for (const entry of sortedAllEntries) {
      if (!entry.entry_date) continue
      const [yStr, mStr] = entry.entry_date.split('-')
      const year = parseInt(yStr, 10)
      const month = parseInt(mStr, 10)
      if (isNaN(year) || isNaN(month)) continue
      const key = `${year}-${String(month).padStart(2, '0')}`
      let group = map.get(key)
      if (!group) {
        group = {
          key,
          year,
          month,
          label: `Tháng ${month}, ${year}`,
          entries: [],
          totalPhotos: 0,
        }
        map.set(key, group)
      }
      group.entries.push(entry)
      const photosCount = (entry.images && entry.images.length > 0) ? entry.images.length : (entry.image_url ? 1 : 0)
      group.totalPhotos += photosCount
    }
    return Array.from(map.values())
  }, [sortedAllEntries])

  const activeMonthGroup = useMemo(() => {
    if (selectedMonthKey === 'ALL') return null
    return monthGroups.find((g) => g.key === selectedMonthKey) || null
  }, [monthGroups, selectedMonthKey])

  type CalendarDay = {
    dayNum: number | null
    dateStr: string | null
    hasEvents: boolean
    entries: Entry[]
    photosCount: number
  }

  const calendarDays = useMemo<CalendarDay[]>(() => {
    if (!activeMonthGroup) return []
    const { year, month } = activeMonthGroup
    const firstDay = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()

    let startCol = firstDay.getDay() - 1
    if (startCol < 0) startCol = 6

    const evMap = new Map<string, Entry[]>()
    for (const ev of activeMonthGroup.entries) {
      if (!ev.entry_date) continue
      const list = evMap.get(ev.entry_date) || []
      list.push(ev)
      evMap.set(ev.entry_date, list)
    }

    const days: CalendarDay[] = []
    for (let i = 0; i < startCol; i++) {
      days.push({ dayNum: null, dateStr: null, hasEvents: false, entries: [], photosCount: 0 })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const evs = evMap.get(dateStr) || []
      const pCount = evs.reduce((acc, cur) => acc + (cur.images?.length || (cur.image_url ? 1 : 0)), 0)
      days.push({
        dayNum: d,
        dateStr,
        hasEvents: evs.length > 0,
        entries: evs,
        photosCount: pCount,
      })
    }

    return days
  }, [activeMonthGroup])

  const currentMonthIdx = monthGroups.findIndex((g) => g.key === selectedMonthKey)
  const hasNextMonth = currentMonthIdx > 0
  const hasPrevMonth = currentMonthIdx >= 0 && currentMonthIdx < monthGroups.length - 1
  const goNextMonth = () => {
    if (hasNextMonth) {
      setSelectedMonthKey(monthGroups[currentMonthIdx - 1].key)
      setSelectedCalDay(null)
    }
  }
  const goPrevMonth = () => {
    if (hasPrevMonth) {
      setSelectedMonthKey(monthGroups[currentMonthIdx + 1].key)
      setSelectedCalDay(null)
    }
  }

  const monthEntries = useMemo(() => {
    if (!activeMonthGroup) return []
    let list = activeMonthGroup.entries
    if (selectedCalDay) {
      list = list.filter((e) => e.entry_date === selectedCalDay)
    }
    return list
  }, [activeMonthGroup, selectedCalDay])

  const viDisplayDate = (dStr: string) => {
    try {
      const d = new Date(dStr + 'T12:00:00')
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
      const dayName = days[d.getDay()]
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      return `${dayName}, ${day}/${month}/${d.getFullYear()}`
    } catch {
      return dStr
    }
  }

  const getEntryMedias = (entry: Entry | null | undefined): string[] => {
    if (!entry) return []
    if (Array.isArray(entry.images) && entry.images.length > 0) {
      return entry.images.filter((url): url is string => typeof url === 'string' && Boolean(url.trim()))
    }
    if (typeof entry.images === 'string') {
      try {
        const parsed = JSON.parse(entry.images)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((url): url is string => typeof url === 'string' && Boolean(url.trim()))
        }
      } catch {}
    }
    if (entry.image_url && typeof entry.image_url === 'string' && entry.image_url.trim()) {
      return [entry.image_url.trim()]
    }
    return []
  }

  const shiftDate = (offset: number) => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setDate(localDate(d))
  }

  const goToToday = () => {
    setDate(localDate())
  }

  // ── render card helper (Đồng bộ giao diện Thẻ Kỷ Niệm chuẩn Kỷ niệm chung) ──
  const renderDailyEntryCard = (entry: Entry, i = 0, showDatePill = false) => {
    const catInfo = getCategoryInfo(entry, dailyCategories)
    const attachedPeople = getAttachedPeople(entry, peopleQuery.items)
    const hasAttachedPeople = attachedPeople.length > 0
    const entryMedias = getEntryMedias(entry)
    const isSpecialEntry = isEntrySpecial(entry)
    const isFirstTimeEntry = isEntryFirstTime(entry)
    const rawText = formatDisplayContent(entry.content)
    const cleanText = rawText || (entryMedias.length > 0 ? '(Nhật ký ảnh / video)' : 'Nhật ký')
    const dayStr = entry.entry_date ? entry.entry_date.slice(8, 10) : ''
    const monthNum = entry.entry_date ? Number(entry.entry_date.slice(5, 7)) : ''

    return (
      <article
        key={entry.id}
        className={`memory-card ${hasAttachedPeople ? 'has-people' : ''}`}
        onClick={() => openEntry(entry)}
        title="Bấm để xem và sửa chi tiết"
      >
        {/* Khối ngày tháng đồng bộ kiểu Kỷ niệm chung nếu showDatePill */}
        {showDatePill && entry.entry_date ? (
          <time className={`memory-date memory-date-${i % 5}`} dateTime={entry.entry_date} style={{ flexShrink: 0 }}>
            <strong>{dayStr}</strong>
            <span>Thg {monthNum}</span>
          </time>
        ) : (
          /* Nếu xem trong ngày: hiển thị icon thể loại hoặc icon sổ */
          <div
            className="icon-box icon-box-sm"
            style={{
              background: catInfo ? catInfo.bg : 'var(--bg-main)',
              color: catInfo ? catInfo.color : 'var(--primary)',
              width: 38,
              height: 48,
              borderRadius: 10,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: '1rem',
              border: '1px solid var(--card-border)',
            }}
            title={catInfo ? catInfo.label : 'Nhật ký'}
          >
            {catInfo ? catInfo.icon : '📝'}
          </div>
        )}

        {/* Thumbnail ảnh / video nhỏ gọn bo góc (chuẩn memory-thumb, không vỡ layout) */}
        {entryMedias.length > 0 && (
          <div
            className="memory-thumb"
            onClick={(e) => {
              e.stopPropagation()
              openMediaGallery(entryMedias, 0)
            }}
            title="Nhấn xem toàn màn hình"
            style={{ flexShrink: 0, cursor: 'pointer' }}
          >
            {/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(entryMedias[0]) ? (
              <>
                <video src={entryMedias[0]} preload="metadata" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.3)', color: '#fff' }}>
                  <Play size={12} fill="#fff" />
                </div>
              </>
            ) : (
              <img
                src={entryMedias[0]}
                alt=""
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            {entryMedias.length > 1 && (
              <span>+{entryMedias.length - 1}</span>
            )}
          </div>
        )}

        {/* Thân thẻ: Tags, Giờ và Trích đoạn chữ sạch đẹp */}
        <div className="memory-card-body" style={{ flex: 1, minWidth: 0 }}>
          {/* Header nhỏ: giờ, phân loại, người thân, badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 2 }}>
            {entry.entry_time && (
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: catInfo?.color || 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 5px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Clock size={10} /> {entry.entry_time}
              </span>
            )}
            {catInfo && (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: catInfo.color, background: catInfo.bg, padding: '1px 6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span>{catInfo.icon}</span> {catInfo.label}
              </span>
            )}
            {isFirstTimeEntry && (
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#06b6d4', background: 'rgba(6, 182, 212, 0.15)', padding: '1px 5px', borderRadius: 6 }}>
                ✨ Lần đầu
              </span>
            )}
            {isSpecialEntry && (
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: 6 }}>
                🌟 Đặc biệt
              </span>
            )}
            {attachedPeople.map((p) => (
              <span
                key={p.id}
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  color: '#c084fc',
                  background: 'rgba(168, 85, 247, 0.18)',
                  border: '1px solid rgba(168, 85, 247, 0.45)',
                  padding: '1px 6px',
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                👤 {p.name}
              </span>
            ))}
          </div>

          {/* Dòng chữ nội dung: 2 dòng gọn gàng, sạch sẽ */}
          <p style={{ margin: '3px 0 0', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-word' }}>
            {cleanText}
          </p>
        </div>

        {/* Nút hành động bên phải */}
        <div className="memory-card-actions" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            className="memory-icon"
            onClick={(e) => {
              e.stopPropagation()
              toggleFavorite(entry)
            }}
            title={entry.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
            aria-label={entry.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
            style={{ color: entry.is_favorite ? 'var(--amber)' : 'var(--text-muted)' }}
          >
            <Star size={16} fill={entry.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="memory-icon"
            onClick={(e) => {
              e.stopPropagation()
              openEntry(entry)
            }}
            title="Sửa bài nhật ký"
            aria-label="Sửa bài nhật ký"
          >
            <Pencil size={15} />
          </button>
        </div>
      </article>
    )
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <section className="page-shell" style={{ paddingTop: 6 }}>

      {/* ── Page tab switcher ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button
          onClick={() => setPageTab('write')}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 14,
            fontSize: '0.8rem',
            fontWeight: 800,
            border: '1.5px solid',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            borderColor: pageTab === 'write' ? 'var(--primary)' : 'var(--card-border)',
            background: pageTab === 'write' ? 'linear-gradient(135deg, var(--primary), #6366f1)' : 'var(--card-bg)',
            color: pageTab === 'write' ? 'white' : 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: pageTab === 'write' ? '0 3px 12px rgba(99, 102, 241, 0.3)' : 'none',
          }}
        >
          <NotebookPen size={14} /> Viết nhật ký
        </button>
        <button
          onClick={() => setPageTab('collection')}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 14,
            fontSize: '0.8rem',
            fontWeight: 800,
            border: '1.5px solid',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            borderColor: pageTab === 'collection' ? '#ec4899' : 'var(--card-border)',
            background: pageTab === 'collection' ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'var(--card-bg)',
            color: pageTab === 'collection' ? 'white' : 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: pageTab === 'collection' ? '0 3px 12px rgba(236, 72, 153, 0.3)' : 'none',
          }}
        >
          <Sparkles size={14} /> Sưu tập ({collectionEntries.length})
        </button>
        <button
          onClick={() => setPageTab('stats')}
          style={{
            flex: 1,
            padding: '9px 0',
            borderRadius: 14,
            fontSize: '0.8rem',
            fontWeight: 800,
            border: '1.5px solid',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            borderColor: pageTab === 'stats' ? 'var(--emerald)' : 'var(--card-border)',
            background: pageTab === 'stats' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--card-bg)',
            color: pageTab === 'stats' ? 'white' : 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: pageTab === 'stats' ? '0 3px 12px rgba(16, 185, 129, 0.3)' : 'none',
          }}
        >
          <BarChart3 size={14} /> Thống kê
        </button>
      </div>

      {/* ════════════════ WRITE TAB ════════════════════════════════════════ */}
      {pageTab === 'write' && (
        <>
          {/* GIAO DIỆN GỌN CHO FORM NHẬT KÝ */}
          <div className="daily-write-box">
            {/* Header: Chọn ngày & Đồng hồ giờ hiện tại */}
            <div className="daily-write-header">
              <div className="daily-date-nav">
                <button
                  type="button"
                  className="daily-date-nav-btn"
                  onClick={() => shiftDate(-1)}
                  title="Ngày hôm trước"
                  aria-label="Ngày hôm trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <label className="daily-date-label" title="Bấm để chọn ngày khác">
                  <Calendar size={13} style={{ color: 'var(--primary)' }} />
                  <span>{viDisplayDate(date)}</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    aria-label="Chọn ngày nhật ký"
                  />
                </label>
                <button
                  type="button"
                  className="daily-date-nav-btn"
                  onClick={() => shiftDate(1)}
                  title="Ngày tiếp theo"
                  aria-label="Ngày tiếp theo"
                >
                  <ChevronRight size={16} />
                </button>
                {date !== localDate() && (
                  <button
                    type="button"
                    className="daily-today-btn"
                    onClick={goToToday}
                    title="Quay lại ngày hôm nay"
                  >
                    Hôm nay
                  </button>
                )}
              </div>

              <div
                className="daily-clock-badge"
                onClick={() => {
                  if (!timeFrom) setQuickTime(clock, '')
                }}
                style={{ cursor: 'pointer' }}
                title="Bấm để lấy giờ này"
              >
                <Clock size={13} />
                <span>{timeOverride || clock}</span>
              </div>
            </div>

            {/* Textarea nhập nhật ký */}
            <textarea
              className="daily-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                selectedCategory
                  ? `Viết nhật ký [${selectedCategory}]... (Gõ @ để gắn người thân)`
                  : 'Ghi lại một ngày của bạn... (Gõ @ để gắn người thân)'
              }
              rows={2}
            />

            {/* Gợi ý @mention */}
            {content.includes('@') && mentionPeople.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, marginBottom: 4 }}>
                {mentionPeople.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className="eyebrow"
                    onClick={() => setContent((val) => val.replace(/@[^\s@]*$/, `@${person.name} `))}
                  >
                    @{person.name}
                  </button>
                ))}
              </div>
            )}

            {/* Footer Toolbar: Nút Mở rộng thông tin + Chips tóm tắt + Nút Lưu */}
            <div className="daily-write-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  className={`daily-expand-btn ${showExtraOptions ? 'active' : ''}`}
                  onClick={() => setShowExtraOptions(!showExtraOptions)}
                  title={showExtraOptions ? 'Thu gọn tuỳ chọn thêm' : 'Mở rộng tuỳ chọn chi tiết'}
                >
                  {showExtraOptions ? <ChevronUp size={14} /> : <Plus size={14} />}
                  <span>{showExtraOptions ? 'Thu gọn' : 'Thêm thông tin'}</span>
                  {((selectedCategory ? 1 : 0) + ((timeFrom || timeTo || timeOverride) ? 1 : 0) + (attachedMedias.length > 0 ? 1 : 0) + (selectedPersonIds.length > 0 ? 1 : 0) + (isFirstTime ? 1 : 0) + (isSpecial ? 1 : 0)) > 0 && (
                    <span className="daily-badge-count">
                      {(selectedCategory ? 1 : 0) + ((timeFrom || timeTo || timeOverride) ? 1 : 0) + (attachedMedias.length > 0 ? 1 : 0) + (selectedPersonIds.length > 0 ? 1 : 0) + (isFirstTime ? 1 : 0) + (isSpecial ? 1 : 0)}
                    </span>
                  )}
                </button>

                {/* Các chip tóm tắt tuỳ chọn đã chọn */}
                <div className="daily-active-chips">
                  {selectedCategory && (
                    <span className="daily-active-chip" style={{ color: 'var(--purple)' }}>
                      <span>🏷️ {selectedCategory}</span>
                      <button
                        type="button"
                        className="daily-active-chip-del"
                        onClick={() => setSelectedCategory(null)}
                        title="Gỡ thể loại"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}

                  {(timeFrom || timeTo || timeOverride) && (
                    <span className="daily-active-chip" style={{ color: 'var(--amber)' }}>
                      <span>🕒 {timeFrom && timeTo ? `${timeFrom}➔${timeTo}` : (timeFrom || timeOverride)}</span>
                      <button
                        type="button"
                        className="daily-active-chip-del"
                        onClick={clearTimeRange}
                        title="Xoá giờ"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}

                  {attachedMedias.length > 0 && (
                    <span
                      className="daily-active-chip"
                      style={{ color: '#10b981', cursor: 'pointer' }}
                      onClick={() => setShowExtraOptions(true)}
                      title="Nhấn xem danh sách file"
                    >
                      <span>🖼️ {attachedMedias.length} tệp</span>
                    </span>
                  )}

                  {selectedPeople.length > 0 && (
                    <span
                      className="daily-active-chip"
                      style={{ color: '#8b5cf6', cursor: 'pointer' }}
                      onClick={() => setShowExtraOptions(true)}
                      title="Nhấn xem người thân"
                    >
                      <span>👤 {selectedPeople.length} người</span>
                    </span>
                  )}

                  {isFirstTime && (
                    <span className="daily-active-chip" style={{ color: '#0891b2' }}>
                      <span>✨ Lần đầu</span>
                      <button
                        type="button"
                        className="daily-active-chip-del"
                        onClick={() => setIsFirstTime(false)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}

                  {isSpecial && (
                    <span className="daily-active-chip" style={{ color: '#d97706' }}>
                      <span>🌟 Đặc biệt</span>
                      <button
                        type="button"
                        className="daily-active-chip-del"
                        onClick={() => setIsSpecial(false)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                </div>
              </div>

              <button
                className="primary"
                onClick={saveEntries}
                disabled={busy || (!content.trim() && attachedMedias.length === 0)}
                style={{
                  padding: '7px 18px',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                  boxShadow: '0 3px 12px rgba(37, 99, 235, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <Save size={14} />
                {busy ? 'Đang lưu…' : 'Lưu nhật ký'}
              </button>
            </div>

            {/* BẢNG MỞ RỘNG: THÔNG TIN CHI TIẾT */}
            {showExtraOptions && (
              <div className="daily-extra-panel">
                {/* 1. Khung giờ chi tiết */}
                <div>
                  <div className="daily-extra-row-title">
                    <Clock size={12} style={{ color: 'var(--amber)' }} /> Khung giờ chi tiết
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', width: '100%' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--card-border)', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--amber)' }}>Từ:</span>
                      <input
                        type="time"
                        value={timeFrom}
                        onChange={(e) => handleTimeFromChange(e.target.value)}
                        style={{ border: 0, background: 'transparent', color: 'var(--text-main)', font: 'inherit', fontSize: '0.78rem', fontWeight: 700, padding: 0, width: 62, outline: 'none' }}
                        aria-label="Giờ bắt đầu"
                      />
                    </div>

                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--amber)', flexShrink: 0 }}>➔</span>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--card-border)', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--emerald)' }}>Đến:</span>
                      <input
                        type="time"
                        value={timeTo}
                        onChange={(e) => handleTimeToChange(e.target.value)}
                        style={{ border: 0, background: 'transparent', color: 'var(--text-main)', font: 'inherit', fontSize: '0.78rem', fontWeight: 700, padding: 0, width: 62, outline: 'none' }}
                        aria-label="Giờ kết thúc"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setQuickTime(clock, '')}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: 'var(--amber)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      title="Điền giờ hiện tại"
                    >
                      <Clock size={11} /> {clock}
                    </button>

                    {(timeFrom || timeTo || timeOverride) && (
                      <button
                        type="button"
                        onClick={clearTimeRange}
                        style={{
                          fontSize: '0.68rem',
                          padding: '3px 7px',
                          borderRadius: 6,
                          border: '1px solid var(--card-border)',
                          background: 'var(--card-bg)',
                          color: 'var(--rose)',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                        title="Xoá giờ"
                      >
                        ✕ Xoá
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Thể loại nhật ký */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div className="daily-extra-row-title" style={{ margin: 0 }}>
                      <Tag size={12} style={{ color: 'var(--purple)' }} /> Thể loại nhật ký
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCategoryConfigModal(true)}
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--card-border)',
                        background: 'var(--card-bg)',
                        color: 'var(--purple)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Settings2 size={11} /> Cấu hình
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'thin' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        border: !selectedCategory ? '1.5px solid var(--primary)' : '1px solid var(--card-border)',
                        background: !selectedCategory ? 'var(--card-bg)' : 'transparent',
                        color: !selectedCategory ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      🔘 Không phân loại
                    </button>

                    {dailyCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(selectedCategory === cat.label ? null : cat.label)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          border: selectedCategory === cat.label ? `1.5px solid ${cat.color}` : '1px solid var(--card-border)',
                          background: selectedCategory === cat.label ? cat.bg : 'var(--card-bg)',
                          color: selectedCategory === cat.label ? cat.color : 'var(--text-main)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{cat.icon}</span> {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Tiện ích & Đính kèm (4 nút nhỏ gọn, cân đối) */}
                <div style={{ width: '100%', minWidth: 0 }}>
                  <div className="daily-extra-row-title">
                    <Sparkles size={11} style={{ color: 'var(--primary)' }} /> Tiện ích & Đính kèm
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, width: '100%', boxSizing: 'border-box' }}>
                    {/* Nút Hành động */}
                    <button
                      type="button"
                      onClick={() => setShowActionModal(true)}
                      style={{
                        padding: '4px 8px',
                        minHeight: 30,
                        borderRadius: 8,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.15))',
                        color: 'var(--amber)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      <Zap size={12} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Hành động</span>
                    </button>

                    {/* Nút YouTube */}
                    <button
                      type="button"
                      onClick={() => setShowVideoModal(true)}
                      style={{
                        padding: '4px 8px',
                        minHeight: 30,
                        borderRadius: 8,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(244, 63, 94, 0.12))',
                        color: '#ef4444',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      <Youtube size={12} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>YouTube</span>
                    </button>

                    {/* Nút Tải Ảnh / Video */}
                    <button
                      type="button"
                      onClick={() => formFileInputRef.current?.click()}
                      disabled={mediaUploading || !supabase}
                      style={{
                        padding: '4px 8px',
                        minHeight: 30,
                        borderRadius: 8,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        border: attachedMedias.length > 0 ? '1px solid #10b981' : '1px solid rgba(6, 182, 212, 0.3)',
                        background: attachedMedias.length > 0
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.2))'
                          : 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(99, 102, 241, 0.12))',
                        color: attachedMedias.length > 0 ? '#10b981' : '#06b6d4',
                        cursor: mediaUploading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                      title="Tải ảnh hoặc video đính kèm"
                    >
                      {mediaUploading ? (
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                      ) : (
                        <ImagePlus size={12} style={{ flexShrink: 0 }} />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mediaUploading ? 'Tải...' : attachedMedias.length > 0 ? `${attachedMedias.length} tệp` : 'Ảnh / Video'}
                      </span>
                    </button>

                    {/* Nút Gắn Người Thân */}
                    <button
                      type="button"
                      onClick={() => setShowPeopleModal(true)}
                      style={{
                        padding: '4px 8px',
                        minHeight: 30,
                        borderRadius: 8,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        border: selectedPersonIds.length > 0 ? '1px solid #8b5cf6' : '1px solid rgba(139, 92, 246, 0.3)',
                        background: selectedPersonIds.length > 0
                          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(168, 85, 247, 0.22))'
                          : 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(168, 85, 247, 0.12))',
                        color: '#8b5cf6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                      title="Gắn người thân"
                    >
                      <Users size={12} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedPersonIds.length > 0 ? `Người (${selectedPersonIds.length})` : 'Gắn người'}
                      </span>
                    </button>
                  </div>

                  {/* Input upload file được đặt ngoài grid để không ảnh hưởng layout */}
                  <input
                    ref={formFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/mp4,video/webm,video/quicktime,video/m4v"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files) void handleUploadFormMedia(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </div>

                {/* 4. Đánh dấu thẻ 3D */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="daily-extra-row-title" style={{ margin: 0 }}>
                    Đánh dấu thẻ 3D:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFirstTime(!isFirstTime)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      border: isFirstTime ? '1.5px solid #06b6d4' : '1px solid var(--card-border)',
                      background: isFirstTime ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.25))' : 'var(--card-bg)',
                      color: isFirstTime ? '#06b6d4' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Sparkles size={12} />
                    <span>✨ Lần đầu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSpecial(!isSpecial)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      border: isSpecial ? '1.5px solid #f59e0b' : '1px solid var(--card-border)',
                      background: isSpecial ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.25))' : 'var(--card-bg)',
                      color: isSpecial ? '#f59e0b' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Star size={12} />
                    <span>🌟 Đặc biệt</span>
                  </button>
                </div>

                {/* Danh sách người thân đã gắn */}
                {selectedPeople.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '6px 10px', background: 'rgba(139, 92, 246, 0.08)', borderRadius: 10, border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--purple)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} /> Gắn:
                    </span>
                    {selectedPeople.map((p) => (
                      <span
                        key={p.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 7px',
                          borderRadius: 7,
                          background: 'var(--card-bg)',
                          border: '1px solid var(--purple)',
                          color: 'var(--purple)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}
                      >
                        <span>👤 {p.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPersonIds((prev) => prev.filter((id) => id !== p.id))}
                          style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--rose)', display: 'flex', alignItems: 'center' }}
                          title={`Bỏ gắn ${p.name}`}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowPeopleModal(true)}
                      style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 6, border: '1px dashed var(--purple)', background: 'transparent', color: 'var(--purple)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      + Thêm
                    </button>
                  </div>
                )}

                {/* Danh sách file ảnh/video preview */}
                {attachedMedias.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 10, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', overflowX: 'auto' }}>
                    {attachedMedias.map((media, idx) => (
                      <div
                        key={idx}
                        style={{ position: 'relative', width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: '#000', flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}
                        onClick={() => openMediaGallery(attachedMedias.map((m) => m.url), idx)}
                        title="Bấm xem thử"
                      >
                        {media.type === 'video' ? (
                          <>
                            <video src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'grid', placeItems: 'center', color: '#fff' }}>
                              <Play size={12} />
                            </div>
                          </>
                        ) : (
                          <img src={media.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleRemoveFormMedia(idx)
                          }}
                          title="Gỡ file này"
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.85)',
                            color: '#fff',
                            border: 'none',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            padding: 0,
                            zIndex: 2,
                          }}
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => formFileInputRef.current?.click()}
                      disabled={mediaUploading}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        border: '1.5px dashed #10b981',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        flexShrink: 0,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                      }}
                    >
                      <Plus size={14} />
                      <span>Thêm</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {saveSuccess && (
              <div style={{ marginTop: 8, padding: '7px 12px', background: 'var(--emerald-bg)', color: 'var(--emerald)', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' }}>
                {saveSuccess}
              </div>
            )}
          </div>

          {/* Ngày này năm trước — chỉ hiện khi thật sự có ký ức cùng ngày-tháng */}
          {!keyword && onThisDay.length > 0 && (
            <div className="card" style={{ padding: 12, marginBottom: 12, borderRadius: 14 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '0.88rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
                <History size={15} /> Ngày này năm trước ({onThisDay.length})
              </h2>
              <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {onThisDay.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => openEntry(entry)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', border: 0, background: 'var(--bg-main)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--amber)', flexShrink: 0 }}>{entry.entry_date.slice(0, 4)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.content}
                    </span>
                    {entry.image_url && <img src={entry.image_url} alt="" loading="lazy" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Thanh chuyển chế độ xem & Ô tìm kiếm (Full width, cân đối, không lệch) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, marginBottom: 14 }}>
            {/* Thanh chọn chế độ xem căn giữa */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="mem-view-toggle" style={{ width: '100%', maxWidth: 360, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <button
                  type="button"
                  className={viewMode === 'timeline' ? 'active' : ''}
                  onClick={() => setViewMode('timeline')}
                  title="Xem theo danh sách ngày"
                  style={{ justifyContent: 'center' }}
                >
                  <List size={14} /> <span>Danh sách</span>
                </button>
                <button
                  type="button"
                  className={viewMode === 'month' ? 'active' : ''}
                  onClick={() => setViewMode('month')}
                  title="Xem theo tháng giống Kỷ niệm chung"
                  style={{ justifyContent: 'center' }}
                >
                  <CalendarDays size={14} /> <span>Dạng tháng</span>
                </button>
              </div>
            </div>

            {/* Ô tìm kiếm toàn bộ nhật ký (Full width cân đối, có kính lúp) */}
            {viewMode === 'timeline' && (
              <div style={{ position: 'relative', width: '100%' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm trong toàn bộ nhật ký…"
                  aria-label="Tìm trong nhật ký"
                  style={{
                    width: '100%',
                    paddingLeft: 38,
                    paddingRight: search ? 36 : 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: '0.85rem',
                    borderRadius: 13,
                    border: '1px solid var(--card-border)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-main)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 0,
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                      padding: 4,
                    }}
                    title="Xoá tìm kiếm"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ════ CHẾ ĐỘ XEM: DANH SÁCH (TIMELINE) ════ */}
          {viewMode === 'timeline' && (
            <div className="card" style={{ padding: 14, margin: 0, borderRadius: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <NotebookPen size={15} /> {keyword ? `Kết quả tìm (${todayEntries.length})` : `Nhật ký ${viDisplayDate(date)} (${todayEntries.length})`}
                </h2>

                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-main)', padding: 3, borderRadius: 10, border: '1px solid var(--card-border)', overflowX: 'auto', maxWidth: '100%' }}>
                  <button
                    onClick={() => setFilterType('ALL')}
                    style={{ border: 0, background: filterType === 'ALL' ? 'var(--card-bg)' : 'transparent', color: filterType === 'ALL' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: filterType === 'ALL' ? 700 : 500, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => setFilterType('FAV')}
                    aria-label="Lọc bài yêu thích"
                    style={{ border: 0, background: filterType === 'FAV' ? 'var(--amber-bg)' : 'transparent', color: filterType === 'FAV' ? 'var(--amber)' : 'var(--text-muted)', fontWeight: filterType === 'FAV' ? 700 : 500, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
                  >
                    <Star size={11} /> Yêu thích
                  </button>
                  <button
                    onClick={() => setFilterType('FIRST_TIME')}
                    style={{ border: 0, background: filterType === 'FIRST_TIME' ? 'rgba(6, 182, 212, 0.18)' : 'transparent', color: filterType === 'FIRST_TIME' ? '#06b6d4' : 'var(--text-muted)', fontWeight: filterType === 'FIRST_TIME' ? 700 : 500, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                  >
                    ✨ Lần đầu
                  </button>
                  <button
                    onClick={() => setFilterType('SPECIAL')}
                    style={{ border: 0, background: filterType === 'SPECIAL' ? 'rgba(245, 158, 11, 0.18)' : 'transparent', color: filterType === 'SPECIAL' ? '#f59e0b' : 'var(--text-muted)', fontWeight: filterType === 'SPECIAL' ? 700 : 500, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                  >
                    🌟 Đặc biệt
                  </button>
                  <button
                    onClick={() => setFilterType('PEOPLE')}
                    style={{ border: 0, background: filterType === 'PEOPLE' ? 'rgba(168, 85, 247, 0.18)' : 'transparent', color: filterType === 'PEOPLE' ? '#c084fc' : 'var(--text-muted)', fontWeight: filterType === 'PEOPLE' ? 700 : 500, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
                  >
                    <Users size={11} /> Có người
                  </button>
                  <button
                    onClick={() => setFilterType('NONE')}
                    style={{ border: 0, background: filterType === 'NONE' ? 'var(--card-bg)' : 'transparent', color: filterType === 'NONE' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: filterType === 'NONE' ? 700 : 500, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                  >
                    🔘 Không phân loại
                  </button>
                  {dailyCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFilterType(cat.label)}
                      style={{ border: 0, background: filterType === cat.label ? cat.bg : 'transparent', color: filterType === cat.label ? cat.color : 'var(--text-muted)', fontWeight: filterType === cat.label ? 700 : 500, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 8, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <SkeletonList rows={3} height={72} />
              ) : todayEntries.length ? (
                <div className="memory-list">
                  {todayEntries.map((entry, i) => renderDailyEntryCard(entry, i, Boolean(keyword || filterType !== 'ALL')))}
                </div>
              ) : (
                <Empty icon={NotebookPen} colorClass="icon-box-emerald">
                  {keyword
                    ? `Không có bài nào chứa "${search.trim()}".`
                    : filterType === 'ALL' ? 'Chưa có nhật ký nào cho ngày này.' : `Chưa có mục nào cho "${filterType}".`}
                </Empty>
              )}
            </div>
          )}

          {/* ════ CHẾ ĐỘ XEM: DẠNG THÁNG (MONTH VIEW - MINI CALENDAR) ════ */}
          {viewMode === 'month' && (
            <div className="card" style={{ padding: 14, margin: 0, borderRadius: 16 }}>
              {/* Thanh chọn tháng dạng pills */}
              <div className="mem-month-pills-bar" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className={`mem-month-pill ${selectedMonthKey === 'ALL' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMonthKey('ALL')
                    setSelectedCalDay(null)
                  }}
                >
                  <Calendar size={13} />
                  <span>Tất cả tháng ({sortedAllEntries.length})</span>
                </button>

                {monthGroups.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    className={`mem-month-pill ${selectedMonthKey === g.key ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedMonthKey(g.key)
                      setSelectedCalDay(null)
                    }}
                  >
                    <span>Thg {g.month}/{g.year}</span>
                    <span className="mem-month-pill-count">{g.entries.length}</span>
                  </button>
                ))}
              </div>

              {/* Nếu xem 1 tháng cụ thể: Lịch trực quan + Danh sách */}
              {selectedMonthKey !== 'ALL' && activeMonthGroup ? (
                <div>
                  {/* Header tháng và điều hướng tháng */}
                  <div className="mem-month-header-bar">
                    <div className="mem-month-title">
                      <strong>Tháng {activeMonthGroup.month}, {activeMonthGroup.year}</strong>
                      <span>
                        {activeMonthGroup.entries.length} bài nhật ký {activeMonthGroup.totalPhotos > 0 && `· ${activeMonthGroup.totalPhotos} ảnh`}
                      </span>
                    </div>

                    <div className="mem-month-nav-btns">
                      <button
                        type="button"
                        className="mem-month-nav-btn"
                        onClick={goPrevMonth}
                        disabled={!hasPrevMonth}
                        title="Tháng trước đó"
                        aria-label="Tháng trước đó"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        className="mem-month-nav-btn"
                        onClick={goNextMonth}
                        disabled={!hasNextMonth}
                        title="Tháng tiếp theo"
                        aria-label="Tháng tiếp theo"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Lưới Mini Calendar (T2 - CN) chuẩn CSS SharedEventsView */}
                  <div className="mem-mini-calendar" style={{ marginBottom: 14 }}>
                    <div className="mem-cal-grid-header">
                      <span>T2</span>
                      <span>T3</span>
                      <span>T4</span>
                      <span>T5</span>
                      <span>T6</span>
                      <span>T7</span>
                      <span>CN</span>
                    </div>

                    <div className="mem-cal-grid">
                      {calendarDays.map((cell, idx) => {
                        if (cell.dayNum === null) {
                          return <div key={`empty-${idx}`} className="mem-cal-cell empty" />
                        }

                        const isSelected = selectedCalDay === cell.dateStr
                        const hasEvs = cell.hasEvents

                        return (
                          <button
                            key={cell.dateStr || `day-${cell.dayNum}`}
                            type="button"
                            className={`mem-cal-cell ${hasEvs ? 'has-memory' : ''} ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              if (cell.hasEvents && cell.dateStr) {
                                setSelectedCalDay(isSelected ? null : cell.dateStr)
                              }
                            }}
                            disabled={!hasEvs}
                            title={
                              hasEvs
                                ? `Ngày ${cell.dayNum}: ${cell.entries.length} bài nhật ký${cell.photosCount > 0 ? ` (${cell.photosCount} ảnh)` : ''} — Bấm để lọc`
                                : `Ngày ${cell.dayNum}: Chưa có nhật ký`
                            }
                          >
                            <span>{cell.dayNum}</span>
                            {hasEvs && <div className="mem-cal-dot" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Badge hiển thị nếu đang lọc theo ngày trong tháng */}
                  {selectedCalDay && (
                    <div className="mem-day-filter-badge" style={{ marginBottom: 12 }}>
                      <span>
                        <Calendar size={13} /> Đang xem: Ngày {selectedCalDay.slice(8, 10)}/{selectedCalDay.slice(5, 7)}/{selectedCalDay.slice(0, 4)} ({monthEntries.length} bài)
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedCalDay(null)}
                        title="Xem toàn bộ tháng"
                        aria-label="Xem toàn bộ tháng"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  {/* Danh sách bài nhật ký của tháng / ngày đã chọn (Cuộn tự nhiên theo trang) */}
                  {monthEntries.length > 0 ? (
                    <div className="memory-list">
                      {monthEntries.map((entry, i) => renderDailyEntryCard(entry, i, true))}
                    </div>
                  ) : (
                    <Empty icon={NotebookPen} colorClass="icon-box-emerald">
                      {selectedCalDay ? 'Ngày này chưa có bài nhật ký nào.' : 'Tháng này chưa có bài nhật ký nào.'}
                    </Empty>
                  )}
                </div>
              ) : (
                /* Xem tất cả tháng gom nhóm */
                <div style={{ display: 'grid', gap: 18 }}>
                  {monthGroups.length > 0 ? (
                    monthGroups.map((g) => (
                      <section key={g.key} style={{ display: 'grid', gap: 8 }}>
                        <div className="mem-month-group-header">
                          <span className="mem-month-group-title">
                            <Calendar size={13} style={{ color: 'var(--primary)' }} />
                            Tháng {g.month}, {g.year}
                          </span>
                          <span className="mem-month-group-count">
                            {g.entries.length} bài {g.totalPhotos > 0 && `· ${g.totalPhotos} ảnh`}
                          </span>
                        </div>
                        <div className="memory-list">
                          {g.entries.map((entry, i) => renderDailyEntryCard(entry, i, true))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <Empty icon={NotebookPen} colorClass="icon-box-emerald">
                      Chưa có nhật ký nào được ghi nhận.
                    </Empty>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal phóng to xem ảnh / video toàn màn hình (hỗ trợ nhiều ảnh/video) */}
      {previewGallery && (
        <Modal
          title={previewGallery.items.length > 1 ? `Xem ảnh / video (${previewGallery.index + 1}/${previewGallery.items.length})` : 'Xem ảnh / video đính kèm'}
          onClose={() => setPreviewGallery(null)}
        >
          {(() => {
            const currentUrl = previewGallery.items[previewGallery.index]
            if (!currentUrl) return null
            const isVid = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(currentUrl)

            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative' }}>
                <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isVid ? (
                    <video
                      src={currentUrl}
                      poster={getVideoPosterUrl(currentUrl)}
                      controls
                      autoPlay
                      style={{ width: '100%', maxHeight: '72vh', borderRadius: 12, background: '#000' }}
                    />
                  ) : (
                    <img
                      src={currentUrl}
                      alt="Phóng to"
                      style={{ width: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 12 }}
                      onError={(e) => {
                        const target = e.currentTarget
                        const retry = Number(target.dataset.retry || 0)
                        if (retry < 2) {
                          target.dataset.retry = String(retry + 1)
                          const sep = currentUrl.includes('?') ? '&' : '?'
                          target.src = `${currentUrl}${sep}_t=${Date.now()}`
                        }
                      }}
                    />
                  )}

                  {previewGallery.items.length > 1 && (
                    <>
                      {previewGallery.index > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewGallery((prev) => prev ? { ...prev, index: prev.index - 1 } : null)}
                          style={{
                            position: 'absolute',
                            left: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.65)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.3)',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                          }}
                          title="Ảnh trước"
                        >
                          <ChevronLeft size={20} />
                        </button>
                      )}
                      {previewGallery.index < previewGallery.items.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setPreviewGallery((prev) => prev ? { ...prev, index: prev.index + 1 } : null)}
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.65)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.3)',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                          }}
                          title="Ảnh tiếp theo"
                        >
                          <ChevronRight size={20} />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {previewGallery.items.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', maxWidth: '100%', padding: '4px 0' }}>
                    {previewGallery.items.map((url, idx) => {
                      const itemIsVid = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url)
                      const isSelected = idx === previewGallery.index
                      return (
                        <div
                          key={idx}
                          onClick={() => setPreviewGallery((prev) => prev ? { ...prev, index: idx } : null)}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 6,
                            overflow: 'hidden',
                            background: '#000',
                            flexShrink: 0,
                            cursor: 'pointer',
                            border: isSelected ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.2)',
                            opacity: isSelected ? 1 : 0.6,
                            position: 'relative',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          {itemIsVid ? (
                            <span style={{ fontSize: '0.8rem' }}>🎬</span>
                          ) : (
                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginTop: 4 }}>
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}
                  >
                    Mở ở tab mới ↗
                  </a>
                </div>
              </div>
            )
          })()}
        </Modal>
      )}

      {/* ════════════════ COLLECTION TAB (SƯU TẬP THẺ 3D) ════════════════ */}
      {pageTab === 'collection' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header & Bộ lọc Thẻ */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12), rgba(139, 92, 246, 0.12))',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={18} color="#ec4899" />
                  <span>Bộ Sưu Tập Kỷ Niệm 3D</span>
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Tổng hợp các khoảnh khắc "Lần đầu" và "Đặc biệt" dưới dạng thẻ sưu tập 3D lật xoay
                </p>
              </div>

              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  padding: '4px 12px',
                  borderRadius: 99,
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.35)',
                }}
              >
                {collectionEntries.length} Thẻ sưu tập
              </span>
            </div>

            {/* Thanh Tìm kiếm trong Bộ sưu tập */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Tìm trong bộ sưu tập thẻ..."
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 10,
                  fontSize: '0.82rem',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
              <Sparkles size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, color: '#8b5cf6' }} />
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setCollectionFilter('ALL')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: collectionFilter === 'ALL' ? '#8b5cf6' : 'var(--card-border)',
                  background: collectionFilter === 'ALL' ? '#8b5cf6' : 'var(--card-bg)',
                  color: collectionFilter === 'ALL' ? '#fff' : 'var(--text-main)',
                  transition: 'all 0.15s',
                }}
              >
                Tất cả ({collectionEntries.length})
              </button>

              <button
                type="button"
                onClick={() => setCollectionFilter('FIRST_TIME')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: collectionFilter === 'FIRST_TIME' ? '#06b6d4' : 'var(--card-border)',
                  background: collectionFilter === 'FIRST_TIME' ? '#06b6d4' : 'var(--card-bg)',
                  color: collectionFilter === 'FIRST_TIME' ? '#fff' : 'var(--text-main)',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>✨ Lần đầu ({firstTimeEntries.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCollectionFilter('SPECIAL')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: collectionFilter === 'SPECIAL' ? '#f59e0b' : 'var(--card-border)',
                  background: collectionFilter === 'SPECIAL' ? '#f59e0b' : 'var(--card-bg)',
                  color: collectionFilter === 'SPECIAL' ? '#fff' : 'var(--text-main)',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>🌟 Đặc biệt ({specialEntries.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCollectionFilter('FAV')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: collectionFilter === 'FAV' ? 'var(--amber)' : 'var(--card-border)',
                  background: collectionFilter === 'FAV' ? 'var(--amber-bg)' : 'var(--card-bg)',
                  color: collectionFilter === 'FAV' ? 'var(--amber)' : 'var(--text-main)',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Star size={12} fill={collectionFilter === 'FAV' ? 'var(--amber)' : 'none'} />
                <span>Yêu thích ({favCollectionEntries.length})</span>
              </button>
            </div>
          </div>

          {/* Grid Thẻ Sưu Tập 3D */}
          {loading ? (
            <SkeletonList rows={3} height={260} />
          ) : filteredCollection.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                background: 'var(--card-bg)',
                borderRadius: 18,
                border: '1.5px dashed var(--card-border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2))',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#8b5cf6',
                }}
              >
                <Sparkles size={28} />
              </div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {collectionEntries.length === 0
                  ? 'Chưa có thẻ sưu tập nào'
                  : 'Không tìm thấy thẻ sưu tập phù hợp'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.5 }}>
                {collectionEntries.length === 0
                  ? 'Khi viết nhật ký ở Tab Viết, hãy bấm chọn nút "✨ Lần đầu" hoặc "🌟 Đặc biệt" để ghi dấu các khoảnh khắc đáng nhớ vào Bộ sưu tập thẻ 3D này nhé!'
                  : 'Hãy thử đổi bộ lọc hoặc từ khóa tìm kiếm để xem các thẻ khác.'}
              </p>
              {collectionEntries.length === 0 && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => setPageTab('write')}
                  style={{
                    padding: '8px 18px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    borderRadius: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <NotebookPen size={14} /> Viết nhật ký & Thêm thẻ ngay
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20,
                paddingBottom: 20,
              }}
            >
              {filteredCollection.map((entry) => (
                <Memory3DCard
                  key={entry.id}
                  entry={entry}
                  onEdit={openEntry}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════ STATS TAB ════════════════════════════════════════ */}
      {pageTab === 'stats' && (
        <>
          {/* Period + type filter row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {/* Period pills */}
            <div style={{ display: 'flex', gap: 5 }}>
              {([['week', 'Tuần này'], ['month', 'Tháng này'], ['all', 'Tất cả']] as [StatsPeriod, string][]).map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => setStatsPeriod(p)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    border: '1.5px solid', transition: 'all 0.15s',
                    borderColor: statsPeriod === p ? 'var(--primary)' : 'var(--card-border)',
                    background: statsPeriod === p ? 'var(--primary)' : 'var(--card-bg)',
                    color: statsPeriod === p ? 'white' : 'var(--text-main)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Type filter */}
            <select
              aria-label="Lọc theo loại nhật ký"
              value={statsType}
              onChange={(e) => setStatsType(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontWeight: 600 }}
            >
              <option value="ALL">Tất cả thể loại</option>
              {dailyCategories.map((c) => <option key={c.id} value={c.label}>{c.icon} {c.label}</option>)}
            </select>
          </div>

          {/* Summary count cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6, marginBottom: 10 }}>
            {dailyCategories.map((cat) => {
              const count = countByType[cat.label] ?? 0
              const isCur = statsType === cat.label
              return (
                <button
                  key={cat.id}
                  onClick={() => setStatsType(isCur ? 'ALL' : cat.label)}
                  style={{
                    padding: '8px 6px', borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                    border: '1.5px solid', transition: 'all 0.15s',
                    borderColor: isCur ? cat.color : 'var(--card-border)',
                    background: isCur ? cat.bg : 'var(--card-bg)',
                  }}
                >
                  <div style={{ fontSize: '1.1rem', marginBottom: 2 }}>
                    {cat.icon}
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: cat.color }}>{count}</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.label}</div>
                </button>
              )
            })}
          </div>

          {/* Total entry count pill */}
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: 20 }}>
              {statsEntries.length} bài · {sortedDates.length} ngày
            </span>
          </div>

          {/* Timeline list */}
          {loading ? (
            <SkeletonList rows={4} />
          ) : statsEntries.length === 0 ? (
            <Empty icon={BarChart3} colorClass="icon-box-emerald">
              Không có bài viết nào trong khoảng thời gian này.
            </Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 'calc(100vh - 310px)', minHeight: 180 }}>
              {sortedDates.map((d) => {
                const dayEntries = groupedByDate.get(d)!
                const isToday = d === localDate()
                return (
                  <div key={d}>
                    {/* Date header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <div style={{
                        padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800,
                        background: isToday ? 'var(--primary)' : 'var(--card-border)',
                        color: isToday ? 'white' : 'var(--text-muted)',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {isToday ? '📅 Hôm nay' : viDate(d)}
                      </div>
                      <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                        {dayEntries.length} bài
                      </span>
                    </div>

                    {/* Entries for this day */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 8, borderLeft: '2px solid var(--card-border)' }}>
                      {dayEntries.map((entry) => {
                        const catInfo = getCategoryInfo(entry, dailyCategories)
                        return (
                          <div key={entry.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '6px 10px', borderRadius: 10,
                            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                          }}>
                            {catInfo ? (
                              <div className="icon-box icon-box-sm" style={{ background: catInfo.bg, color: catInfo.color, width: 20, height: 20, flexShrink: 0, marginTop: 1, fontSize: '0.75rem' }}>
                                {catInfo.icon}
                              </div>
                            ) : (
                              <div className="icon-box icon-box-sm" style={{ background: 'var(--card-bg)', color: 'var(--text-muted)', width: 20, height: 20, flexShrink: 0, marginTop: 1, fontSize: '0.7rem' }}>
                                📝
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {catInfo && (
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: catInfo.color, marginBottom: 1 }}>
                                  {catInfo.label}
                                </div>
                              )}
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                                {entry.content}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                              {entry.image_url && <img src={entry.image_url} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }} />}
                              <button className="icon small" aria-label="Xem chi tiết" onClick={() => openEntry(entry)} style={{ padding: 3 }}>
                                <Pencil size={11} />
                              </button>
                              <button className="icon small danger" onClick={() => removeEntry(entry.id)} style={{ padding: 3 }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {editQuick !== null && (
        <Modal title="Sửa danh sách chọn nhanh" onClose={() => setEditQuick(null)}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>Mỗi dòng là một mục.</p>
          <textarea
            value={editQuick}
            onChange={(e) => setEditQuick(e.target.value)}
            rows={8}
            aria-label="Danh sách chọn nhanh"
            style={{ width: '100%', border: '1px solid var(--card-border)', borderRadius: 12, padding: 10, fontSize: '0.9rem', background: 'var(--card-bg)', color: 'var(--text-main)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              className="primary"
              onClick={() => {
                const list = editQuick.split('\n').map((l) => l.trim()).filter(Boolean)
                setQuickPhrases(list)
                void saveUserQuickPhrases(list)
                setEditQuick(null)
                showToast('✅ Đã lưu danh sách hành động riêng vào Supabase')
              }}

            >
              <Save size={15} /> Lưu
            </button>
          </div>
        </Modal>
      )}

      {/* Chi tiết một dòng nhật ký: xem đủ nội dung, sửa, đính ảnh */}
      {editing && (
        <Modal title="Chi tiết nhật ký" onClose={() => setEditing(null)}>
          {/* Khung chọn Ngày & Khung giờ: Từ ➔ Đến */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', fontWeight: 700 }}>
              Ngày viết
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 8px', fontSize: '0.82rem' }} />
            </label>

            <div style={{ padding: '8px 10px', background: 'var(--bg-main)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} color="var(--amber)" /> Khung giờ nhật ký:
                </span>
                {(editTimeFrom || editTimeTo || editTime) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditTimeFrom('')
                      setEditTimeTo('')
                      setEditTime('')
                    }}
                    style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    Xóa giờ
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 10, background: 'var(--card-bg)', border: '1.5px solid rgba(245, 158, 11, 0.4)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--amber)' }}>Từ:</span>
                  <input
                    aria-label="Giờ bắt đầu"
                    type="time"
                    value={editTimeFrom}
                    onChange={(e) => handleEditTimeFromChange(e.target.value)}
                    style={{ border: 0, background: 'transparent', color: 'var(--text-main)', font: 'inherit', fontSize: '0.84rem', fontWeight: 700, padding: 0, width: 76, outline: 'none' }}
                  />
                </div>

                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--amber)' }}>➔</span>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 10, background: 'var(--card-bg)', border: '1.5px solid rgba(16, 185, 129, 0.4)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--emerald)' }}>Đến:</span>
                  <input
                    aria-label="Giờ kết thúc"
                    type="time"
                    value={editTimeTo}
                    onChange={(e) => handleEditTimeToChange(e.target.value)}
                    style={{ border: 0, background: 'transparent', color: 'var(--text-main)', font: 'inherit', fontSize: '0.84rem', fontWeight: 700, padding: 0, width: 76, outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Chọn thể loại trong modal sửa */}
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Thể loại nhật ký:
            </span>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              <button
                type="button"
                onClick={() => setEditCategory(null)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 10,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  border: editCategory === null ? '1.5px solid var(--primary)' : '1px solid var(--card-border)',
                  background: editCategory === null ? 'var(--primary-light)' : 'var(--bg-main)',
                  color: editCategory === null ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                🔘 Không phân loại
              </button>
              {dailyCategories.map((cat) => {
                const isSelected = editCategory === cat.label
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setEditCategory(isSelected ? null : cat.label)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 10,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      border: isSelected ? `1.5px solid ${cat.color}` : '1px solid var(--card-border)',
                      background: isSelected ? cat.bg : 'var(--bg-main)',
                      color: isSelected ? cat.color : 'var(--text-main)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {cat.icon} {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          <label>
            Nội dung
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={5} />
          </label>

          {/* Danh sách ảnh & video đã lưu của dòng nhật ký */}
          {(() => {
            const currentImages = editing.images && editing.images.length > 0
              ? editing.images
              : (editing.image_url ? [editing.image_url] : [])

            return (
              <div style={{ display: 'grid', gap: 8 }}>
                {currentImages.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Ảnh & Video đã lưu ({currentImages.length}):
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      {currentImages.map((url, idx) => {
                        const isVid = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url)
                        return (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              width: 64,
                              height: 64,
                              borderRadius: 8,
                              overflow: 'hidden',
                              border: '1px solid var(--border)',
                              background: '#000',
                            }}
                          >
                            {isVid ? (
                              <>
                                <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                                <div style={{ position: 'absolute', bottom: 2, left: 2, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 3, padding: '1px 3px', display: 'flex', alignItems: 'center' }}>
                                  <Play size={10} />
                                </div>
                              </>
                            ) : (
                              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                            <button
                              type="button"
                              onClick={() => void removeEntryMedia(idx)}
                              title="Xoá file này khỏi Supabase"
                              style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                width: 20,
                                height: 20,
                                padding: 0,
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.85)',
                                color: '#fff',
                                border: 'none',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <input
                  ref={entryFileInput}
                  type="file"
                  multiple
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/m4v"
                  hidden
                  aria-label="Chọn ảnh hoặc video cho nhật ký"
                  onChange={(e) => {
                    if (e.target.files) void uploadEntryMedia(e.target.files)
                    e.target.value = ''
                  }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => entryFileInput.current?.click()} disabled={!supabase || uploading}>
                    {uploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <ImagePlus size={14} />}
                    {uploading ? 'Đang tải…' : '+ Thêm Ảnh / Video'}
                  </button>
                  {currentImages.length > 0 && (
                    <button type="button" className="text-danger" onClick={() => void removeEntryMedia()}>
                      <Trash2 size={14} /> Gỡ tất cả
                    </button>
                  )}
                </div>
                {!supabase && <small className="muted">Chưa cấu hình Supabase nên chưa lưu được ảnh/video.</small>}
              </div>
            )
          })()}

          {/* Đánh dấu thẻ Sưu tập: Lần đầu / Đặc biệt trong Modal sửa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Đánh dấu thẻ:</span>
            <button
              type="button"
              onClick={() => setEditIsFirstTime(!editIsFirstTime)}
              style={{
                padding: '5px 12px',
                borderRadius: 10,
                fontSize: '0.76rem',
                fontWeight: 800,
                border: editIsFirstTime ? '1.5px solid #06b6d4' : '1px solid var(--card-border)',
                background: editIsFirstTime ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.25))' : 'var(--bg-main)',
                color: editIsFirstTime ? '#06b6d4' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={13} />
              <span>✨ Lần đầu</span>
            </button>

            <button
              type="button"
              onClick={() => setEditIsSpecial(!editIsSpecial)}
              style={{
                padding: '5px 12px',
                borderRadius: 10,
                fontSize: '0.76rem',
                fontWeight: 800,
                border: editIsSpecial ? '1.5px solid #f59e0b' : '1px solid var(--card-border)',
                background: editIsSpecial ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.25))' : 'var(--bg-main)',
                color: editIsSpecial ? '#f59e0b' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <Star size={13} />
              <span>🌟 Đặc biệt</span>
            </button>
          </div>

          {/* Hiển thị người thân được gắn trong bài nhật ký */}
          {editing && getAttachedPeople(editing, peopleQuery.items).length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                padding: '7px 10px',
                background: 'rgba(168, 85, 247, 0.1)',
                borderRadius: 12,
                border: '1px solid rgba(168, 85, 247, 0.25)',
              }}
            >
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={13} /> Gắn với:
              </span>
              {getAttachedPeople(editing, peopleQuery.items).map((p) => (
                <span
                  key={p.id}
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 8,
                    background: 'var(--card-bg)',
                    color: '#c084fc',
                    border: '1px solid rgba(192, 132, 252, 0.4)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  👤 {p.name}
                </span>
              ))}
            </div>
          )}

          <div className="modal-actions">
            <DeleteButton onDelete={() => removeEntry(editing.id)} />
            <button
              type="button"
              onClick={() => toggleFavorite(editing)}
              style={{ color: editing.is_favorite ? 'var(--amber)' : undefined }}
            >
              <Star size={14} fill={editing.is_favorite ? 'currentColor' : 'none'} />
              {editing.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
            </button>
            <button className="primary" onClick={updateEntry}>Lưu thay đổi</button>
          </div>
        </Modal>
      )}

      {/* ── MODAL: CHỌN & GẮN LINK YOUTUBE VÀO NHẬT KÝ ── */}
      {showVideoModal && (
        <Modal title="🎬 Gắn Video YouTube vào Nhật ký" onClose={() => { setShowVideoModal(false); setFetchedVideoMeta(null); setVideoUrlInput('') }}>
          <div style={{ display: 'grid', gap: 12, maxWidth: '100%', boxSizing: 'border-box' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Dán link video YouTube hoặc chọn từ danh sách video đã xem gần đây để thêm nhanh vào nội dung nhật ký.
            </p>

            {/* Khung Dán Link YouTube */}
            <div style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: 6 }}>
                🔗 Dán link video YouTube:
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
                  value={videoUrlInput}
                  onChange={(e) => {
                    setVideoUrlInput(e.target.value)
                    handleFetchUrlMeta(e.target.value)
                  }}
                  style={{
                    flex: '1 1 220px',
                    minWidth: 0,
                    padding: '8px 12px',
                    fontSize: '0.84rem',
                    borderRadius: 8,
                    border: '1px solid var(--card-border)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-main)',
                  }}
                />
                <button
                  type="button"
                  className="primary"
                  disabled={!fetchedVideoMeta || videoFetching}
                  onClick={() => {
                    if (fetchedVideoMeta) {
                      handleSelectVideo({
                        videoId: fetchedVideoMeta.videoId,
                        title: fetchedVideoMeta.title,
                        channelName: fetchedVideoMeta.author,
                        youtubeUrl: videoUrlInput.trim(),
                      })
                    }
                  }}
                  style={{
                    flex: '0 0 auto',
                    whiteSpace: 'nowrap',
                    padding: '8px 16px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 8,
                  }}
                >
                  <Plus size={15} /> Gắn vào nhật ký
                </button>
              </div>

              {videoFetching && (
                <div style={{ fontSize: '0.74rem', color: 'var(--amber)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={13} className="spin" /> Đang lấy thông tin video…
                </div>
              )}

              {fetchedVideoMeta && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 8,
                    padding: '8px 10px',
                    background: 'var(--card-bg)',
                    borderRadius: 10,
                    border: '1.5px solid var(--emerald)',
                  }}
                >
                  <img
                    src={`https://img.youtube.com/vi/${fetchedVideoMeta.videoId}/hqdefault.jpg`}
                    alt=""
                    style={{ width: 56, height: 38, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fetchedVideoMeta.title}
                    </div>
                    {fetchedVideoMeta.author && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Kênh: {fetchedVideoMeta.author}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Danh sách video xem gần đây */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <History size={13} color="var(--primary)" /> Video đã xem gần đây:
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {recentVideos.length} video
                </span>
              </div>

              {recentVideos.length === 0 ? (
                <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-main)', borderRadius: 10 }}>
                  Chưa có video xem gần đây. Hãy dán link YouTube ở trên để thêm nhanh!
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 2 }}>
                  {recentVideos.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => handleSelectVideo({
                        videoId: v.videoId,
                        title: v.title,
                        channelName: v.channelName,
                        youtubeUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
                      })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: 'var(--bg-main)',
                        border: '1px solid var(--card-border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#ef4444'
                        e.currentTarget.style.background = 'var(--card-bg)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--card-border)'
                        e.currentTarget.style.background = 'var(--bg-main)'
                      }}
                    >
                      <img
                        src={`https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        style={{ width: 50, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {v.title}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                          {v.channelName && <span>{v.channelName}</span>}
                          {v.durationMinutes > 0 && <span>• ~{v.durationMinutes}p</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#ef4444',
                          border: 0,
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      >
                        Chọn
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => setShowVideoModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}


      {/* ── MODAL: COMBOBOX CHỌN HÀNH ĐỘNG ── */}
      {showActionModal && (
        <Modal title="⚡ Chọn hành động nhanh" onClose={() => { setShowActionModal(false); setActionSearch('') }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {/* Ô tìm kiếm hành động (Combobox search) */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Tìm hành động hoặc gõ hành động mới…"
                value={actionSearch}
                onChange={(e) => setActionSearch(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 10,
                  fontSize: '0.86rem',
                  border: '1.5px solid var(--amber)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-main)',
                }}
              />
            </div>

            {/* Nếu tìm kiếm không khớp và có chữ -> cho phép thêm / dùng ngay */}
            {actionSearch.trim() && !quickPhrases.some((p) => p.toLowerCase() === actionSearch.trim().toLowerCase()) && (
              <div
                onClick={() => {
                  const phrase = actionSearch.trim()
                  insertQuickPhrase(phrase)
                  if (!quickPhrases.includes(phrase)) {
                    const next = [...quickPhrases, phrase]
                    setQuickPhrases(next)
                    void saveUserQuickPhrases(next)
                  }
                  setShowActionModal(false)
                  setActionSearch('')
                }}

                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'var(--amber-bg)',
                  color: 'var(--amber)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: '1px dashed var(--amber)',
                }}
              >
                <Plus size={14} /> Dùng ngay hành động mới: "{actionSearch.trim()}"
              </div>
            )}

            {/* Danh sách các hành động có sẵn */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, maxHeight: 280, overflowY: 'auto', padding: '2px 0' }}>
              {quickPhrases
                .filter((phrase) => !actionSearch.trim() || phrase.toLowerCase().includes(actionSearch.trim().toLowerCase()))
                .map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => {
                      insertQuickPhrase(phrase)
                      setShowActionModal(false)
                      setActionSearch('')
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: '1px solid var(--card-border)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--amber)'
                      e.currentTarget.style.background = 'var(--amber-bg)'
                      e.currentTarget.style.color = 'var(--amber)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--card-border)'
                      e.currentTarget.style.background = 'var(--bg-main)'
                      e.currentTarget.style.color = 'var(--text-main)'
                    }}
                  >
                    <span style={{ fontSize: '0.88rem' }}>⚡</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phrase}</span>
                  </button>
                ))}
            </div>

            {/* Tùy chỉnh danh sách */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--card-border)', marginTop: 4 }}>
              <button
                type="button"
                className="icon small"
                onClick={() => {
                  setShowActionModal(false)
                  setEditQuick(quickPhrases.join('\n'))
                }}
                style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Pencil size={12} /> Chỉnh sửa danh sách hành động
              </button>
              <button
                type="button"
                onClick={() => setShowActionModal(false)}
                style={{ fontSize: '0.8rem' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: QUẢN LÝ THỂ LOẠI NHẬT KÝ ── */}
      {showCategoryConfigModal && (
        <Modal
          title="⚙️ Quản lý Thể loại Nhật ký"
          onClose={() => {
            setShowCategoryConfigModal(false)
            setEditingCat(null)
            setNewCatLabel('')
            setNewCatIcon('🏷️')
            setNewCatColor('#8b5cf6')
            setNewCatBg('rgba(139, 92, 246, 0.15)')
          }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Bạn có thể thêm mới, đổi tên, đổi biểu tượng hoặc xoá các thể loại nhật ký theo nhu cầu cá nhân.
            </p>

            {/* Form Thêm / Sửa thể loại */}
            <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: 12, border: '1px solid var(--card-border)', display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-main)' }}>
                {editingCat ? `✏️ Đang sửa: ${editingCat.label}` : '➕ Thêm thể loại mới:'}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Tên thể loại (vd: Du lịch, Thú cưng...)"
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  style={{ flex: '1 1 180px', padding: '7px 10px', fontSize: '0.84rem', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)' }}
                />

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>Icon:</span>
                  <input
                    type="text"
                    value={newCatIcon}
                    onChange={(e) => setNewCatIcon(e.target.value)}
                    style={{ width: 44, textAlign: 'center', fontSize: '1.1rem', padding: '4px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}
                  />
                </div>
              </div>

              {/* Emoji nhanh */}
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Chọn nhanh biểu tượng:</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['❤️', '🌧️', '💼', '📚', '💖', '🏡', '🥗', '💡', '✈️', '🎮', '🎵', '🍔', '⭐', '🎯', '🚀', '🐱', '🌸', '☕', '💪', '🎬'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNewCatIcon(em)}
                      style={{
                        padding: '4px 6px',
                        borderRadius: 6,
                        border: newCatIcon === em ? '1.5px solid var(--purple)' : '1px solid var(--card-border)',
                        background: newCatIcon === em ? 'var(--purple-bg)' : 'var(--card-bg)',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chọn màu sắc */}
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Màu sắc thể loại:</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
                    { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
                    { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' },
                    { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
                    { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
                    { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
                    { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
                    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
                    { color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => { setNewCatColor(c.color); setNewCatBg(c.bg) }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: c.color,
                        border: newCatColor === c.color ? '2.5px solid #fff' : 'none',
                        boxShadow: newCatColor === c.color ? `0 0 0 2px ${c.color}` : 'none',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Nút hành động Lưu/Thêm/Huỷ */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                {editingCat && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCat(null)
                      setNewCatLabel('')
                      setNewCatIcon('🏷️')
                      setNewCatColor('#8b5cf6')
                      setNewCatBg('rgba(139, 92, 246, 0.15)')
                    }}
                    style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: 8 }}
                  >
                    Huỷ sửa
                  </button>
                )}
                <button
                  type="button"
                  className="primary"
                  onClick={handleSaveCategory}
                  style={{ padding: '6px 16px', fontSize: '0.78rem', fontWeight: 700 }}
                >
                  {editingCat ? 'Cập nhật thể loại' : '➕ Thêm thể loại'}
                </button>
              </div>
            </div>

            {/* Danh sách các thể loại hiện có */}
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Danh sách thể loại ({dailyCategories.length}):
              </span>
              {dailyCategories.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-main)', borderRadius: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Chưa có thể loại nào được tạo. Hãy nhập tên và chọn biểu tượng ở trên để thêm thể loại đầu tiên của bạn nhé!
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                  {dailyCategories.map((cat) => (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                      <span style={{ flex: 1, fontSize: '0.84rem', fontWeight: 700, color: cat.color }}>{cat.label}</span>
                      <button
                        type="button"
                        className="icon small"
                        onClick={() => {
                          setEditingCat(cat)
                          setNewCatLabel(cat.label)
                          setNewCatIcon(cat.icon || '🏷️')
                          setNewCatColor(cat.color || '#8b5cf6')
                          setNewCatBg(cat.bg || 'rgba(139, 92, 246, 0.15)')
                        }}
                        title="Sửa thể loại"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon small danger"
                        onClick={() => handleDeleteCategory(cat.id, cat.label)}
                        title="Xoá thể loại"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: CHỌN NGƯỜI THÂN ĐỂ GHI NHẬT KÝ */}
      {showPeopleModal && (
        <Modal title="👥 Chọn người thân ghi nhật ký chung" onClose={() => setShowPeopleModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 300, maxWidth: 440 }}>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Khi chọn người thân, bài nhật ký này sẽ vừa lưu ở trang Daily vừa được tự động lưu vào <strong style={{ color: 'var(--text-main)' }}>Nhật ký riêng</strong> trong trang Người thân của người đó.
            </p>

            <input
              type="text"
              placeholder="🔍 Tìm kiếm theo tên người thân..."
              value={peopleSearch}
              onChange={(e) => setPeopleSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1.5px solid var(--card-border)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.84rem',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              <span>Đã chọn: <strong style={{ color: 'var(--purple)' }}>{selectedPersonIds.length} người</strong></span>
              {selectedPersonIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPersonIds([])}
                  style={{ border: 0, background: 'transparent', color: 'var(--rose)', cursor: 'pointer', fontWeight: 700, fontSize: '0.74rem' }}
                >
                  Bỏ chọn tất cả
                </button>
              )}
            </div>

            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 6, paddingRight: 2 }}>
              {peopleQuery.items
                .filter((p) => !peopleSearch.trim() || p.name.toLowerCase().includes(peopleSearch.trim().toLowerCase()))
                .map((person) => {
                  const isSelected = selectedPersonIds.includes(person.id)
                  return (
                    <div
                      key={person.id}
                      onClick={() => {
                        setSelectedPersonIds((prev) =>
                          isSelected ? prev.filter((id) => id !== person.id) : [...prev, person.id]
                        )
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: isSelected ? '1.5px solid var(--purple)' : '1px solid var(--card-border)',
                        background: isSelected ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-main)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {person.avatar_url ? (
                          <img src={person.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          person.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {person.name}
                        </div>
                        {(person.is_partner || person.group_key || person.notes) && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {person.is_partner ? '❤️ Người yêu' : person.group_key ? `Nhóm: ${person.group_key}` : person.notes}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 7,
                          border: isSelected ? '1.5px solid var(--purple)' : '1px solid var(--card-border)',
                          background: isSelected ? 'var(--purple)' : 'transparent',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && <Check size={13} />}
                      </div>
                    </div>
                  )
                })}
              {peopleQuery.items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Chưa có người thân nào trong danh bạ. Bạn có thể qua trang <strong style={{ color: 'var(--primary)' }}>Người thân</strong> để thêm danh bạ nhé!
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                className="primary"
                onClick={() => setShowPeopleModal(false)}
                style={{ padding: '8px 20px', fontSize: '0.82rem', fontWeight: 700, borderRadius: 10 }}
              >
                Xong ({selectedPersonIds.length})
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}


