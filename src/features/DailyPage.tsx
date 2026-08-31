import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, Clock, History, ImagePlus,
  Link as Loader2, NotebookPen, Pencil, Plus, Save,
  Sparkles, Star, Trash2, Youtube, Zap, Settings2, Tag
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { localDate, longDate } from '../lib/date'
import { queueWrite } from '../lib/offlineQueue'
import type { DailyCategoryItem, DailyType, Entry, Person } from '../types'
import { loadLocal, saveLocal } from '../lib/persistence'
import { getRemoteAppSetting, saveAppSetting } from '../lib/userAppSettings'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'
import { SkeletonList } from './Skeleton'
import { fetchYouTubeMeta, youtubeVideoId } from '../lib/youtubeMeta'
import { getVideoWatchLogs, type VideoWatchLog } from '../lib/videoWatchLog'
import { compressForUpload } from '../lib/photo'
import { Memory3DCard } from './daily/Memory3DCard'

export const DEFAULT_DAILY_CATEGORIES: DailyCategoryItem[] = []

export function getCategoryInfo(entry: Entry, allCategories: DailyCategoryItem[]): DailyCategoryItem | null {
  const catLabel = entry.category || (entry.tags && entry.tags.length > 0 ? entry.tags[0] : null)
  if (catLabel) {
    const found = allCategories.find((c) => c.label === catLabel || c.id === catLabel)
    if (found) return found
    return { id: catLabel, label: catLabel, icon: '🏷️', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' }
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

  const saveEntries = async () => {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    setBusy(true)
    setSaveSuccess('')
    const currentTimeString = timeOverride || clock

    // Tạo payload chuẩn xác với is_first_time, is_special và category
    const payload = lines.map((lineText) => ({
      content: lineText,
      entry_date: date,
      entry_type: selectedCategory ? (selectedCategory as DailyType) : 'FEELING',
      entry_time: currentTimeString,
      is_first_time: Boolean(isFirstTime),
      is_special: Boolean(isSpecial),
      tags: selectedCategory ? [selectedCategory] : [],
    }))

    let savedToSupabase = false
    let savedItems: Entry[] = []

    try {
      if (supabase) {
        const { data, error } = await supabase.from('daily_entries').insert(payload).select()
        if (!error && data && data.length > 0) {
          savedToSupabase = true
          savedItems = data as Entry[]

          // Lưu người được nhắc tên nếu có
          const mentioned = peopleQuery.items.filter((person) =>
            lines.some((line) => line.includes(`@${person.name}`))
          )
          if (mentioned.length > 0 && supabase) {
            await Promise.all(
              mentioned.map((person) =>
                supabase!.from('person_daily_logs').upsert(
                  { person_id: person.id, log_date: date, content: lines.join('\n') },
                  { onConflict: 'user_id,person_id,log_date' }
                )
              )
            ).catch(() => {})
          }
        } else if (error) {
          console.warn('Lỗi Supabase, thử lại phương án dự phòng:', error)
          // Thử lại nếu DB từ chối cột mới
          const simplePayload = lines.map((lineText) => ({
            content: lineText,
            entry_date: date,
            entry_time: currentTimeString,
          }))
          const { data: retryData, error: retryErr } = await supabase
            .from('daily_entries')
            .insert(simplePayload)
            .select()

          if (!retryErr && retryData && retryData.length > 0) {
            savedToSupabase = true
            savedItems = (retryData as any[]).map((row) => ({
              ...row,
              is_first_time: Boolean(isFirstTime),
              is_special: Boolean(isSpecial),
              tags: selectedCategory ? [selectedCategory] : [],
            })) as Entry[]
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
      showToast(`☁️ Đã lưu ${lines.length} bài nhật ký lên Supabase!`, 'success')
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

    const patch = {
      content: editText.trim(),
      entry_date: date,
      entry_time: finalTime || null,
      is_first_time: Boolean(editIsFirstTime),
      is_special: Boolean(editIsSpecial),
      tags: editCategory ? [editCategory] : [],
    }

    let updatedOnline = false
    try {
      if (supabase) {
        const { error } = await supabase.from('daily_entries').update(patch).eq('id', editing.id)
        if (!error) {
          updatedOnline = true
        } else {
          // Thử lại nếu DB chưa có cột mới
          const simplePatch = {
            content: editText.trim(),
            entry_date: date,
            entry_time: finalTime || null,
          }
          const { error: err2 } = await supabase.from('daily_entries').update(simplePatch).eq('id', editing.id)
          if (!err2) updatedOnline = true
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
    setEditText(entry.content)
    setDate(entry.entry_date)
    setEditIsFirstTime(Boolean(entry.is_first_time))
    setEditIsSpecial(Boolean(entry.is_special))
    const catInfo = getCategoryInfo(entry, dailyCategories)
    setEditCategory(catInfo ? catInfo.label : null)
    const { from, to } = parseTimeRangeFromEntry(entry.entry_time, entry.content)
    setEditTimeFrom(from)
    setEditTimeTo(to)
    setEditTime(from && to ? `${from} - ${to}` : from || entry.entry_time || '')
  }

  /** Đính ảnh vào dòng nhật ký đang mở; ảnh cũ bị thay và xoá khỏi storage. */
  const uploadEntryImage = async (file: File) => {
    if (!editing || !supabase) return
    setUploading(true)
    // Nén trước: ảnh gốc từ máy ảnh 4-7MB, nén xong còn ~300KB.
    const { blob, ext } = await compressForUpload(file)
    const path = `${editing.entry_date}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob)
    if (uploadError) {
      showToast('❌ Tải ảnh lên thất bại', 'delete')
      setUploading(false)
      return
    }
    const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
    const previousPath = editing.image_path
    const { error } = await supabase.from('daily_entries').update({ image_url: url, image_path: path }).eq('id', editing.id)
    if (error) {
      await supabase.storage.from(PHOTO_BUCKET).remove([path])
      showToast('❌ Chưa lưu được ảnh. Chạy migration daily_entry_image chưa?', 'delete')
      setUploading(false)
      return
    }
    if (previousPath) await supabase.storage.from(PHOTO_BUCKET).remove([previousPath])
    setEditing((current) => (current ? { ...current, image_url: url, image_path: path } : current))
    setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, image_url: url, image_path: path } : i)))
    showToast('🖼️ Đã thêm ảnh')
    setUploading(false)
  }

  const removeEntryImage = async () => {
    if (!editing || !supabase) return
    const path = editing.image_path
    await supabase.from('daily_entries').update({ image_url: null, image_path: null }).eq('id', editing.id)
    if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path])
    setEditing((current) => (current ? { ...current, image_url: null, image_path: null } : current))
    setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, image_url: null, image_path: null } : i)))
    showToast('🗑️ Đã gỡ ảnh', 'delete')
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
      if (filterType === 'FIRST_TIME') return Boolean(i.is_first_time)
      if (filterType === 'SPECIAL') return Boolean(i.is_special)
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
      .filter((i) => Boolean(i.is_first_time) || Boolean(i.is_special))
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at))
  }, [items])

  const firstTimeEntries = useMemo(() => collectionEntries.filter((i) => Boolean(i.is_first_time)), [collectionEntries])
  const specialEntries = useMemo(() => collectionEntries.filter((i) => Boolean(i.is_special)), [collectionEntries])
  const favCollectionEntries = useMemo(() => collectionEntries.filter((i) => Boolean(i.is_favorite)), [collectionEntries])

  const filteredCollection = useMemo(() => {
    const q = collectionSearch.trim().toLowerCase()
    return collectionEntries
      .filter((i) => {
        if (collectionFilter === 'FIRST_TIME') return Boolean(i.is_first_time)
        if (collectionFilter === 'SPECIAL') return Boolean(i.is_special)
        if (collectionFilter === 'FAV') return Boolean(i.is_favorite)
        return true
      })
      .filter((i) => !q || i.content.toLowerCase().includes(q) || i.entry_date.includes(q))
  }, [collectionEntries, collectionFilter, collectionSearch])

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <section className="page-shell">

      {/* ── Page tab switcher ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => setPageTab('write')}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700,
            border: '1.5px solid', cursor: 'pointer', transition: 'all 0.18s',
            borderColor: pageTab === 'write' ? 'var(--primary)' : 'var(--card-border)',
            background: pageTab === 'write' ? 'var(--primary)' : 'var(--card-bg)',
            color: pageTab === 'write' ? 'white' : 'var(--text-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          <NotebookPen size={13} /> Viết nhật ký
        </button>
        <button
          onClick={() => setPageTab('collection')}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700,
            border: '1.5px solid', cursor: 'pointer', transition: 'all 0.18s',
            borderColor: pageTab === 'collection' ? '#8b5cf6' : 'var(--card-border)',
            background: pageTab === 'collection' ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'var(--card-bg)',
            color: pageTab === 'collection' ? 'white' : 'var(--text-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            boxShadow: pageTab === 'collection' ? '0 3px 12px rgba(139, 92, 246, 0.35)' : 'none',
          }}
        >
          <Sparkles size={13} /> Sưu tập ({collectionEntries.length})
        </button>
        <button
          onClick={() => setPageTab('stats')}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700,
            border: '1.5px solid', cursor: 'pointer', transition: 'all 0.18s',
            borderColor: pageTab === 'stats' ? 'var(--emerald)' : 'var(--card-border)',
            background: pageTab === 'stats' ? 'var(--emerald)' : 'var(--card-bg)',
            color: pageTab === 'stats' ? 'white' : 'var(--text-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          <BarChart3 size={13} /> Thống kê
        </button>
      </div>

      {/* ════════════════ WRITE TAB ════════════════════════════════════════ */}
      {pageTab === 'write' && (
        <>
          {/* Thanh chọn Thể loại nhật ký & Quản lý */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Tag size={13} color="var(--purple)" /> Thể loại nhật ký:
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: selectedCategory ? 'var(--purple)' : 'var(--text-muted)' }}>
                  {selectedCategory ? `(Đang chọn: ${selectedCategory})` : '(Mặc định: Không có)'}
                </span>
              </span>

              <button
                type="button"
                onClick={() => setShowCategoryConfigModal(true)}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 8,
                  border: '1px solid var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--purple)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
                title="Cấu hình / Thêm / Sửa / Xoá thể loại"
              >
                <Settings2 size={12} /> Cấu hình thể loại
              </button>
            </div>

            {/* Dải nút cuộn ngang chọn thể loại */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 4,
                scrollbarWidth: 'none',
              }}
            >
              {/* Nút: Không phân loại (Mặc định) */}
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 12,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  border: selectedCategory === null ? '1.5px solid var(--primary)' : '1px solid var(--card-border)',
                  background: selectedCategory === null ? 'var(--primary-light)' : 'var(--card-bg)',
                  color: selectedCategory === null ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🔘 Không phân loại</span>
              </button>

              {/* Các thể loại tùy chỉnh */}
              {dailyCategories.map((cat) => {
                const isSelected = selectedCategory === cat.label
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(isSelected ? null : cat.label)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 12,
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      border: isSelected ? `1.5px solid ${cat.color}` : '1px solid var(--card-border)',
                      background: isSelected ? cat.bg : 'var(--card-bg)',
                      color: isSelected ? cat.color : 'var(--text-main)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                      boxShadow: isSelected ? `0 2px 8px ${cat.color}33` : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                )
              })}

              {dailyCategories.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowCategoryConfigModal(true)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 12,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    border: '1px dashed var(--purple)',
                    background: 'var(--purple-bg)',
                    color: 'var(--purple)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={13} /> Thêm thể loại mới
                </button>
              )}
            </div>
          </div>

          {/* Write card */}
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="eyebrow" style={{ margin: 0, padding: '2px 8px', fontSize: '0.68rem' }}>
                {longDate(new Date(date + 'T12:00:00'))}
              </span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: '2px 6px', fontSize: '0.78rem' }} aria-label="Ngày của nhật ký" />
            </div>

            {/* Khung chọn 2 nút Giờ: Giờ từ ➔ Giờ đến */}
            <div style={{ padding: '8px 12px', background: 'var(--bg-main)', borderRadius: 12, border: '1px solid var(--card-border)', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={13} color="var(--amber)" /> Khung giờ nhật ký:
                </span>
                {(timeFrom || timeTo || timeOverride) && (
                  <button
                    type="button"
                    onClick={clearTimeRange}
                    style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    Xóa giờ
                  </button>
                )}
              </div>

              {/* 2 nút chọn giờ: Giờ từ & Giờ đến */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 10, background: 'var(--card-bg)', border: '1.5px solid rgba(245, 158, 11, 0.4)' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--amber)' }}>Từ:</span>
                  <input
                    aria-label="Giờ bắt đầu"
                    type="time"
                    value={timeFrom}
                    onChange={(e) => handleTimeFromChange(e.target.value)}
                    style={{ border: 0, background: 'transparent', color: 'var(--text-main)', font: 'inherit', fontSize: '0.86rem', fontWeight: 700, padding: 0, width: 76, outline: 'none' }}
                  />
                </div>

                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--amber)' }}>➔</span>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 10, background: 'var(--card-bg)', border: '1.5px solid rgba(16, 185, 129, 0.4)' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--emerald)' }}>Đến:</span>
                  <input
                    aria-label="Giờ kết thúc"
                    type="time"
                    value={timeTo}
                    onChange={(e) => handleTimeToChange(e.target.value)}
                    style={{ border: 0, background: 'transparent', color: 'var(--text-main)', font: 'inherit', fontSize: '0.86rem', fontWeight: 700, padding: 0, width: 76, outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mốc:</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '2px 8px', borderRadius: 8 }}>
                    {timeOverride || clock}
                  </span>
                </div>
              </div>
            </div>

            {/* Thanh chọn Hành động & Nút liên kết YouTube / TV Show */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {/* Nút chính: Mở Modal Combobox Chọn Hành Động */}
              <button
                type="button"
                onClick={() => setShowActionModal(true)}
                style={{
                  padding: '7px 8px',
                  borderRadius: 12,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: '1.5px solid var(--amber)',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.25))',
                  color: 'var(--amber)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.15)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.background = 'var(--amber)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.25))'
                  e.currentTarget.style.color = 'var(--amber)'
                }}
              >
                <Zap size={14} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Hành động (Chọn nhanh)</span>
              </button>

              {/* Nút Gắn YouTube / TV Show */}
              <button
                type="button"
                onClick={() => setShowVideoModal(true)}
                style={{
                  padding: '7px 8px',
                  borderRadius: 12,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: '1.5px solid #ef4444',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(244, 63, 94, 0.18))',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.background = '#ef4444'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(244, 63, 94, 0.18))'
                  e.currentTarget.style.color = '#ef4444'
                }}
              >
                <Youtube size={14} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Gắn YouTube / TV Show</span>
              </button>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={selectedCategory ? `Viết nhật ký [${selectedCategory}] vào đây... (Ví dụ: Từ 4h -> 5h: Chơi thể thao)` : `Viết nhật ký hôm nay vào đây... (Ví dụ: Từ 4h -> 5h: Chơi LQ)`}
              rows={3}
              style={{ width: '100%', border: '1px solid var(--card-border)', borderRadius: 12, padding: 10, fontSize: '0.9rem', resize: 'vertical', outline: 'none', background: 'var(--card-bg)', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: 8 }}
            />
            {content.includes('@') && mentionPeople.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {mentionPeople.map((person) => <button key={person.id} type="button" className="eyebrow" onClick={() => setContent((value) => value.replace(/@[^\s@]*$/, `@${person.name} `))}>@{person.name}</button>)}
              </div>
            )}
            {/* 2 NÚT ĐÁNH DẤU: LẦN ĐẦU & ĐẶC BIỆT (XUẤT HIỆN Ở TAB SƯU TẬP THẺ 3D) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10, padding: '4px 0' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Đánh dấu thẻ:</span>
              <button
                type="button"
                onClick={() => setIsFirstTime(!isFirstTime)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 10,
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  border: isFirstTime ? '1.5px solid #06b6d4' : '1px solid var(--card-border)',
                  background: isFirstTime ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.25))' : 'var(--bg-main)',
                  color: isFirstTime ? '#06b6d4' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: isFirstTime ? '0 2px 10px rgba(6, 182, 212, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Sparkles size={13} />
                <span>✨ Lần đầu</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSpecial(!isSpecial)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 10,
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  border: isSpecial ? '1.5px solid #f59e0b' : '1px solid var(--card-border)',
                  background: isSpecial ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.25))' : 'var(--bg-main)',
                  color: isSpecial ? '#f59e0b' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: isSpecial ? '0 2px 10px rgba(245, 158, 11, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Star size={13} />
                <span>🌟 Đặc biệt</span>
              </button>

              {(isFirstTime || isSpecial) && (
                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginLeft: 'auto' }}>
                  ✓ Sẽ lưu vào Bộ sưu tập thẻ 3D
                </span>
              )}
            </div>

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

          {/* Ngày này năm trước — chỉ hiện khi thật sự có ký ức cùng ngày-tháng */}
          {!keyword && onThisDay.length > 0 && (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '0.88rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={15} /> Ngày này năm trước ({onThisDay.length})
              </h2>
              <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {onThisDay.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => openEntry(entry)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', border: 0, background: 'var(--bg-main)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--amber)', flexShrink: 0 }}>{entry.entry_date.slice(0, 4)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.content}
                    </span>
                    {entry.image_url && <img src={entry.image_url} alt="" loading="lazy" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Today's entries list */}
          <div className="card" style={{ padding: 12, margin: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--primary)' }}>
                <NotebookPen size={15} /> {keyword ? `Kết quả tìm (${todayEntries.length})` : `Nhật ký hôm nay (${todayEntries.length})`}
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

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm trong toàn bộ nhật ký…"
              aria-label="Tìm trong nhật ký"
              style={{ width: '100%', marginBottom: 8, fontSize: '0.82rem' }}
            />

            {loading ? (
              <SkeletonList rows={3} height={72} />
            ) : todayEntries.length ? (
              <div style={{ display: 'grid', gap: 6, maxHeight: 'calc(100vh - 350px)', minHeight: '230px', overflowY: 'auto' }}>
                {todayEntries.map((entry) => {
                  const catInfo = getCategoryInfo(entry, dailyCategories)
                  return (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-main)', borderRadius: 7 }}>
                    <button
                      type="button"
                      aria-label={`Xem chi tiết: ${entry.content}`}
                      onClick={() => openEntry(entry)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', borderRadius: 7, padding: '4px 7px', cursor: 'pointer' }}
                    >
                      {catInfo ? (
                        <div className="icon-box icon-box-sm" style={{ background: catInfo.bg, color: catInfo.color, width: 20, height: 20, flexShrink: 0, fontSize: '0.75rem' }} title={catInfo.label}>
                          {catInfo.icon}
                        </div>
                      ) : (
                        <div className="icon-box icon-box-sm" style={{ background: 'var(--card-bg)', color: 'var(--text-muted)', width: 20, height: 20, flexShrink: 0, fontSize: '0.7rem' }}>
                          📝
                        </div>
                      )}
                      {keyword && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0 }}>{entry.entry_date.slice(8)}/{entry.entry_date.slice(5, 7)}</span>
                      )}
                      {entry.entry_time && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: catInfo?.color || 'var(--amber)', flexShrink: 0 }}>{entry.entry_time}</span>
                      )}
                      {entry.is_first_time && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#06b6d4', background: 'rgba(6, 182, 212, 0.15)', padding: '1px 5px', borderRadius: 6, flexShrink: 0 }}>
                          ✨ Lần đầu
                        </span>
                      )}
                      {entry.is_special && (
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 5px', borderRadius: 6, flexShrink: 0 }}>
                          🌟 Đặc biệt
                        </span>
                      )}
                      <span style={{ flex: 1, minWidth: 0, fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.content}
                      </span>
                      {entry.image_url && <img src={entry.image_url} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />}
                    </button>
                    <button
                      type="button"
                      aria-label={`${entry.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'}: ${entry.content}`}
                      aria-pressed={!!entry.is_favorite}
                      onClick={() => toggleFavorite(entry)}
                      style={{ border: 0, background: 'transparent', padding: '4px 7px', cursor: 'pointer', color: entry.is_favorite ? 'var(--amber)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                    >
                      <Star size={13} fill={entry.is_favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Sửa: ${entry.content}`}
                      onClick={() => openEntry(entry)}
                      style={{ border: 0, background: 'transparent', padding: '4px 7px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                    >
                      <Pencil size={13} />
                    </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty icon={NotebookPen} colorClass="icon-box-emerald">
                {keyword
                  ? `Không có bài nào chứa "${search.trim()}".`
                  : filterType === 'ALL' ? 'Chưa có nhật ký nào cho hôm nay.' : `Chưa có mục nào cho "${filterType}".`}
              </Empty>
            )}
          </div>
        </>
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

          <div style={{ display: 'grid', gap: 8 }}>
            {editing.image_url && (
              <img src={editing.image_url} alt="Ảnh nhật ký" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 12, background: 'var(--bg-main)' }} />
            )}
            <input
              ref={entryFileInput}
              type="file"
              accept="image/*"
              hidden
              aria-label="Chọn ảnh cho nhật ký"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) uploadEntryImage(file)
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => entryFileInput.current?.click()} disabled={!supabase || uploading}>
                <ImagePlus size={14} /> {uploading ? 'Đang tải…' : editing.image_url ? 'Đổi ảnh' : 'Thêm ảnh'}
              </button>
              {editing.image_url && (
                <button type="button" className="text-danger" onClick={removeEntryImage}>
                  <Trash2 size={14} /> Gỡ ảnh
                </button>
              )}
            </div>
            {!supabase && <small className="muted">Chưa cấu hình Supabase nên chưa lưu được ảnh.</small>}
          </div>

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
    </section>
  )
}


