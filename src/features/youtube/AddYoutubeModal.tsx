import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, ChevronDown, Loader2, Pause, Play, Plus, Save, Search, Tag } from 'lucide-react'
import { Modal } from '../shared'
import { supabase } from '../../lib/supabase'
import { mapWithProgress } from '../../lib/mapWithProgress'
import { fetchYouTubeMeta, youtubeVideoId } from '../../lib/youtubeMeta'
import { matchesKeyword } from '../../lib/vietnameseRank'
import { useToast } from '../ToastContext'
import { apiFetch } from '../../lib/apiFetch'
import { getRemoteAppSetting, saveAppSetting } from '../../lib/userAppSettings'
import { INITIAL_YOUTUBE_CATEGORIES, guessChannelCategory, type CustomCategoryItem } from './YoutubeView'

export type YoutubeLinkKind = 'channel' | 'video' | 'invalid'

/** Một link YouTube là kênh hay video lẻ — không đoán được thì 'invalid'. */
export function classifyYoutubeLink(raw: string): YoutubeLinkKind {
  const line = raw.trim()
  if (!line) return 'invalid'
  if (youtubeVideoId(line)) return 'video'
  try {
    const host = new URL(line).hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'm.youtube.com' || host.endsWith('.youtube.com')) return 'channel'
  } catch {
    /* không phải URL */
  }
  return 'invalid'
}

/** Tách ô dán thành 3 nhóm: link kênh, link video, link hỏng. Không trùng lặp. */
export function classifyYoutubeInput(text: string): {
  channels: string[]
  videos: Array<{ videoId: string; url: string }>
  invalid: string[]
} {
  const channels: string[] = []
  const videos: Array<{ videoId: string; url: string }> = []
  const invalid: string[] = []
  const seen = new Set<string>()

  for (const raw of text.split(/[\n,\s]+/)) {
    const line = raw.trim()
    if (!line || seen.has(line)) continue
    seen.add(line)
    const kind = classifyYoutubeLink(line)
    if (kind === 'video') {
      const videoId = youtubeVideoId(line)!
      if (!videos.some((v) => v.videoId === videoId)) videos.push({ videoId, url: line })
    } else if (kind === 'channel') {
      channels.push(line)
    } else {
      invalid.push(line)
    }
  }
  return { channels, videos, invalid }
}

type DiscoveredVideo = {
  videoId: string
  title: string
  thumbnail: string | null
  duration?: number | null
  publishedAt?: string
  playlistName?: string | null
  channelName: string
  creatorId?: string
  canonicalUrl?: string
  embedUrl?: string
  description?: string
  isKnown?: boolean
  /** Video dán tay: lưu thẳng vào Supabase thay vì qua kế hoạch cào kênh. */
  manual?: boolean
}

function formatDuration(sec?: number | null): string {
  if (!sec || isNaN(sec)) return ''
  const total = Math.floor(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

async function post(body: any) {
  const res = await apiFetch('/api/sync-tvshow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json
}

/** Tạo series thủ công trước khi ghi video (FK tvshow_videos.series_key). */
async function ensureManualSeries(seriesKey: string, title: string, channelName: string, now: string) {
  const { error } = await supabase!.from('tvshow_series').upsert(
    {
      series_key: seriesKey,
      platform: 'youtube',
      creator_id: 'manual',
      creator_name: channelName,
      title,
      status: 'COMPLETE',
      expected_parts: 1,
      found_parts: 1,
      confidence: 1,
      updated_at: now,
    },
    { onConflict: 'series_key' },
  )
  if (error) throw new Error(error.message)
}

async function saveManualVideo(v: DiscoveredVideo) {
  const now = new Date().toISOString()
  const channelName = v.channelName || 'Tự thêm'
  await ensureManualSeries(`manual:${v.videoId}`, v.title, channelName, now)
  const { error } = await supabase!.from('tvshow_videos').upsert(
    {
      platform: 'youtube',
      video_id: v.videoId,
      series_key: `manual:${v.videoId}`,
      creator_id: 'manual',
      creator_name: channelName,
      title: v.title,
      canonical_url: v.canonicalUrl ?? `https://www.youtube.com/watch?v=${v.videoId}`,
      embed_url: `https://www.youtube.com/embed/${v.videoId}`,
      thumbnail: v.thumbnail ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      part_number: 1,
      total_parts: 1,
      is_final: true,
      part_confidence: 1,
      last_seen_at: now,
    },
    { onConflict: 'platform,video_id' },
  )
  if (error) throw new Error(error.message)
}

/**
 * Một ô dán duy nhất cho cả link kênh lẫn link video lẻ — tự phân biệt.
 * Kênh thì quét toàn bộ danh sách video để tích chọn, video lẻ thì đọc tiêu đề rồi lưu.
 */
export function AddYoutubeModal({
  onClose,
  onSaved,
  initialUrl = '',
  customCategories = INITIAL_YOUTUBE_CATEGORIES,
  onAddCustomCategory,
}: {
  onClose: () => void
  onSaved: (savedCategory?: string) => void
  initialUrl?: string
  customCategories?: CustomCategoryItem[]
  onAddCustomCategory?: (label: string, icon?: string) => Promise<string | undefined>
}) {
  const { showToast } = useToast()
  const [text, setText] = useState(initialUrl)
  const [state, setState] = useState<'paste' | 'scanning' | 'paused' | 'ready' | 'saving' | 'saved'>('paste')
  const [discovered, setDiscovered] = useState<DiscoveredVideo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activePlan, setActivePlan] = useState<any>(null)
  const [activeJob, setActiveJob] = useState<{ channelName: string; sectionName: string; percent: number } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  /** Chỉ cào video có chữ này; rỗng nghĩa là lấy hết kênh. */
  const [crawlKeyword, setCrawlKeyword] = useState('')
  /** Đếm số video bị từ khoá loại ra, để không tưởng kênh trống. */
  const [skippedByKeyword, setSkippedByKeyword] = useState(0)
  const [filterType, setFilterType] = useState<'all' | 'fresh' | 'known'>('all')
  const [savingProgress, setSavingProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const stopRef = useRef(false)

  // Quản lý thể loại lưu
  const [categories, setCategories] = useState<CustomCategoryItem[]>(() =>
    customCategories && customCategories.length > 0 ? customCategories : INITIAL_YOUTUBE_CATEGORIES,
  )
  const [selectedCategory, setSelectedCategory] = useState<string>('Review phim')
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [categoryPickerOpenPaste, setCategoryPickerOpenPaste] = useState(false)
  const [userPickedCategory, setUserPickedCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon] = useState('🏷️')
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const categoryDropdownRefPaste = useRef<HTMLDivElement>(null)

  const parsed = useMemo(() => classifyYoutubeInput(text), [text])

  // Cập nhật danh sách thể loại từ props
  useEffect(() => {
    if (customCategories && customCategories.length > 0) {
      setCategories(customCategories)
    }
  }, [customCategories])

  // Đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryPickerOpen(false)
      }
      if (categoryDropdownRefPaste.current && !categoryDropdownRefPaste.current.contains(e.target as Node)) {
        setCategoryPickerOpenPaste(false)
      }
    }
    if (categoryPickerOpen || categoryPickerOpenPaste) {
      document.addEventListener('mousedown', onClickOutside)
    }
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [categoryPickerOpen, categoryPickerOpenPaste])

  // Link chia sẻ từ app khác: điền sẵn, khỏi phải dán tay.
  useEffect(() => {
    if (initialUrl) setText(initialUrl)
  }, [initialUrl])

  const addVideos = (items: DiscoveredVideo[], autoSelect: (v: DiscoveredVideo) => boolean) => {
    if (items.length === 0) return
    setDiscovered((prev) => {
      const seen = new Set(prev.map((p) => p.videoId))
      return [...prev, ...items.filter((v) => !seen.has(v.videoId))]
    })
    setSelectedIds((prev) => {
      const next = new Set(prev)
      items.forEach((v) => autoSelect(v) && next.add(v.videoId))
      return next
    })
  }

  const scanChannel = async (url: string) => {
    const { plan } = await post({ action: 'plan', creatorUrl: url })
    setActivePlan(plan)

    // Tự động đoán thể loại theo tên kênh nếu người dùng chưa chọn thủ công
    if (!userPickedCategory && plan.channelName) {
      const guessed = guessChannelCategory(plan.channelName)
      setSelectedCategory(guessed)
    }

    let pages = 0

    for (let entryIndex = 0; entryIndex < plan.entries.length; entryIndex++) {
      const entry = plan.entries[entryIndex]
      let pageToken: string | undefined
      do {
        if (stopRef.current) return { stopped: true }
        const { outcome } = await post({ action: 'page', plan, cursor: { entryIndex, pageToken }, dryRun: true })
        pages++
        const pageVideos = (outcome.videos || []).map((v: any) => ({
          ...v,
          channelName: plan.channelName,
          creatorId: plan.channelId,
        }))
        // Lọc ngay tại đây thay vì lọc lúc hiện: danh sách khỏi phình vì video
        // không liên quan, và số "đã tìm thấy" phản ánh đúng thứ sẽ lưu.
        const kept = crawlKeyword.trim()
          ? pageVideos.filter((v: any) => matchesKeyword(v.title ?? '', crawlKeyword, v.channelName ?? ''))
          : pageVideos
        if (kept.length < pageVideos.length) {
          setSkippedByKeyword((n) => n + (pageVideos.length - kept.length))
        }
        addVideos(kept, (v) => !v.isKnown)
        setActiveJob({
          channelName: plan.channelName,
          sectionName: entry.name,
          percent: plan.totalPages > 0 ? Math.min(100, Math.round((pages / plan.totalPages) * 100)) : 50,
        })
        if (entry.isUploads && outcome.allKnown && pages > 1) break
        pageToken = outcome.nextPageToken
      } while (pageToken)
    }
    return { stopped: false }
  }

  /** Video dán tay: đọc tiêu đề qua oEmbed rồi bỏ vào cùng danh sách với video cào được. */
  const loadPastedVideos = async () => {
    if (parsed.videos.length === 0) return
    const metas = await Promise.all(parsed.videos.map((v) => fetchYouTubeMeta(v.url)))

    if (!userPickedCategory && metas[0]?.author) {
      const guessed = guessChannelCategory(metas[0].author)
      setSelectedCategory(guessed)
    }

    const knownIds = new Set<string>()
    if (supabase) {
      const { data } = await supabase
        .from('tvshow_videos')
        .select('video_id')
        .in('video_id', parsed.videos.map((v) => v.videoId))
      ;((data ?? []) as { video_id: string }[]).forEach((r) => knownIds.add(r.video_id))
    }
    addVideos(
      parsed.videos.map((v, i) => ({
        videoId: v.videoId,
        title: metas[i]?.title ?? `Video ${i + 1}`,
        thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        channelName: metas[i]?.author || 'Tự thêm',
        canonicalUrl: v.url,
        isKnown: knownIds.has(v.videoId),
        manual: true,
      })),
      (v) => !v.isKnown,
    )
  }

  const start = async () => {
    setError('')
    stopRef.current = false
    setDiscovered([])
    setSelectedIds(new Set())
    setSkippedByKeyword(0)
    setState('scanning')
    try {
      await loadPastedVideos()
      for (const url of parsed.channels) {
        if (stopRef.current) return setState('paused')
        try {
          const { stopped } = await scanChannel(url)
          if (stopped) return setState('paused')
        } catch (err: any) {
          setError(`Không quét được ${url}: ${err?.message ?? err}`)
        }
      }
      setState('ready')
    } catch (err: any) {
      setError(String(err?.message ?? err))
      setState('ready')
    }
  }

  const filtered = useMemo(
    () =>
      discovered.filter((v) => {
        const matchSearch = !searchTerm.trim() || v.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
        const matchFilter =
          filterType === 'all' || (filterType === 'fresh' && !v.isKnown) || (filterType === 'known' && Boolean(v.isKnown))
        return matchSearch && matchFilter
      }),
    [discovered, searchTerm, filterType],
  )

  const toggle = (videoId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      return next
    })

  const handleSelectCategory = (catName: string) => {
    setSelectedCategory(catName)
    setUserPickedCategory(true)
    setCategoryPickerOpen(false)
    setCategoryPickerOpenPaste(false)
    showToast(`Đã chọn thể loại: ${catName}`, 'info')
  }

  const handleCreateCategory = async () => {
    const trimmed = newCatName.trim()
    if (!trimmed) return
    let catLabel = trimmed
    if (onAddCustomCategory) {
      const res = await onAddCustomCategory(trimmed, newCatIcon)
      if (res) catLabel = res
    } else {
      const newCat: CustomCategoryItem = {
        id: `cat_${Date.now()}`,
        label: trimmed,
        icon: newCatIcon || '🏷️',
      }
      const updated = [...categories, newCat]
      setCategories(updated)
      await saveAppSetting('youtube_custom_categories', updated)
    }
    setSelectedCategory(catLabel)
    setUserPickedCategory(true)
    setNewCatName('')
    setIsAddingCategory(false)
    setCategoryPickerOpen(false)
    setCategoryPickerOpenPaste(false)
    showToast(`Đã thêm thể loại "${catLabel}"`, 'success')
  }

  const handleSave = async () => {
    const chosen = discovered.filter((v) => selectedIds.has(v.videoId))
    if (chosen.length === 0) return
    stopRef.current = true
    setState('saving')
    setSavingProgress({ current: 0, total: chosen.length })
    try {
      await mapWithProgress(
        chosen,
        async (video) => {
          if (video.manual) {
            await saveManualVideo(video)
          } else {
            await post({
              action: 'save_selected',
              plan: activePlan || { creatorUrl: parsed.channels[0], channelName: video.channelName },
              videos: [video],
            })
          }
        },
        { concurrency: 5, onProgress: (current, total) => setSavingProgress({ current, total }) },
      )

      // Cập nhật thể loại cho kênh trong youtube_channel_categories
      if (selectedCategory) {
        try {
          const currentMap = await getRemoteAppSetting<Record<string, string>>('youtube_channel_categories', {})
          const updatedMap = { ...currentMap }
          if (activePlan?.channelId) updatedMap[activePlan.channelId] = selectedCategory
          if (activePlan?.channelName) updatedMap[activePlan.channelName] = selectedCategory
          parsed.channels.forEach((url) => {
            updatedMap[url] = selectedCategory
          })
          chosen.forEach((v) => {
            if (v.creatorId) updatedMap[v.creatorId] = selectedCategory
            if (v.channelName) updatedMap[v.channelName] = selectedCategory
          })
          if (chosen.some((v) => v.manual)) {
            updatedMap['manual'] = selectedCategory
          }
          await saveAppSetting('youtube_channel_categories', updatedMap)
        } catch (catErr) {
          console.warn('[AddYoutubeModal] Lỗi lưu thể loại:', catErr)
        }
      }

      setState('saved')
      onSaved(selectedCategory)
      setTimeout(onClose, 900)
    } catch (err: any) {
      showToast(`Lỗi khi lưu video: ${err?.message ?? err}`)
      setState('ready')
    }
  }

  const freshCount = discovered.filter((v) => !v.isKnown).length
  const knownCount = discovered.length - freshCount
  const currentCatObj = categories.find((c) => c.label === selectedCategory)
  const currentCatIcon = currentCatObj?.icon || '🏷️'

  /** Render menu dropdown chọn thể loại */
  const renderCategoryDropdown = (isOpen: boolean) => {
    if (!isOpen) return null
    return (
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 6px)',
          zIndex: 100,
          minWidth: 260,
          maxWidth: 320,
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Chọn thể loại lưu
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{categories.length} mục</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 2 }}>
          {categories.map((cat) => {
            const isChosen = cat.label === selectedCategory
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectCategory(cat.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: `1px solid ${isChosen ? 'var(--primary)' : 'var(--card-border)'}`,
                  background: isChosen ? 'rgba(124, 58, 237, 0.12)' : 'var(--bg-main)',
                  color: isChosen ? 'var(--primary)' : 'var(--text-main)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  transition: 'all 0.12s ease',
                }}
              >
                <span>{cat.icon || '🏷️'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Thêm thể loại mới nhanh */}
        {isAddingCategory ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--card-border)', paddingTop: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Tên thể loại mới..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleCreateCategory()
                  }
                }}
                autoFocus
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--card-border)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.75rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => void handleCreateCategory()}
                disabled={!newCatName.trim()}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Lưu
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingCategory(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px dashed var(--card-border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '0.73rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 2,
            }}
          >
            <Plus size={12} />
            <span>Thêm thể loại mới</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <Modal
      title="📡 Thêm từ YouTube"
      aria-label="Thêm từ YouTube"
      onClose={state === 'scanning' ? () => { stopRef.current = true; setState('paused') } : onClose}
    >
      <div className="tv-sync-container">
        {state === 'paste' ? (
          <>
            <textarea
              className="tv-links-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Dán link kênh hoặc link video, mỗi dòng một link:\nhttps://www.youtube.com/@web5ngay\nhttps://youtu.be/xxxxxxxxxxx'}
            />

            {/* Chọn thể loại ngay tại màn hình dán link */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 12,
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700 }}>
                <Tag size={15} color="var(--primary)" />
                <span>Thể loại lưu vào:</span>
              </div>
              <div style={{ position: 'relative' }} ref={categoryDropdownRefPaste}>
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpenPaste((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 8,
                    background: 'rgba(124, 58, 237, 0.08)',
                    border: '1px solid var(--primary)',
                    color: 'var(--primary)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <span>{currentCatIcon}</span>
                  <span>{selectedCategory}</span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: categoryPickerOpenPaste ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>
                {renderCategoryDropdown(categoryPickerOpenPaste)}
              </div>
            </div>

            <label className="tv-keyword-field">
              <span className="tv-keyword-label">
                <Search size={13} /> Chỉ cào video có chữ (để trống = lấy hết kênh)
              </span>
              <input
                value={crawlKeyword}
                onChange={(e) => setCrawlKeyword(e.target.value)}
                placeholder="Ví dụ: doraemon"
              />
              <span className="tv-keyword-hint">
                Không cần bỏ dấu — gõ “hoat hinh” vẫn bắt được “Hoạt Hình”. Nhiều từ thì phải có đủ.
              </span>
            </label>

            <div className="tv-sync-badge-summary">
              <span className="tv-sync-pill-valid">
                <Check size={12} /> {parsed.channels.length} kênh · {parsed.videos.length} video lẻ
              </span>
              {parsed.invalid.length > 0 && (
                <span className="tv-sync-pill-invalid">
                  <AlertCircle size={12} /> {parsed.invalid.length} link sai định dạng
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Dán gì cũng được — link kênh sẽ được quét toàn bộ video để tích chọn, link video lẻ thì tự đọc tiêu đề.
            </div>

            <div className="tv-sync-actions">
              <button type="button" className="tv-btn-action secondary" onClick={onClose}>Đóng</button>
              <button
                type="button"
                className="tv-btn-action primary"
                onClick={() => void start()}
                disabled={parsed.channels.length === 0 && parsed.videos.length === 0}
              >
                <Search size={15} /> Quét / đọc link
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="tv-sync-dashboard" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 700 }}>
                  {state === 'scanning' ? (
                    <>
                      <div className="tv-sync-pulse-dot" />
                      <span>
                        Đang quét: {activeJob?.channelName || 'YouTube…'}
                        {activeJob?.sectionName ? ` · ${activeJob.sectionName}` : ''} — đã tìm {discovered.length} video
                      </span>
                    </>
                  ) : state === 'paused' ? (
                    <>
                      <div className="tv-sync-pulse-dot paused" />
                      <span style={{ color: '#f59e0b' }}>Đã tạm dừng quét</span>
                    </>
                  ) : state === 'saving' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" color="#10b981" />
                      <span style={{ color: '#10b981' }}>Đang lưu {savingProgress?.current}/{savingProgress?.total} video…</span>
                    </>
                  ) : state === 'saved' ? (
                    <>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span style={{ color: '#10b981' }}>Đã lưu {selectedIds.size} video!</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} color="#10b981" />
                      <span>
                        Xong: {discovered.length} video tìm thấy
                        {/* Nói rõ đã bỏ bao nhiêu, không thì tưởng kênh ít video. */}
                        {skippedByKeyword > 0 && (
                          <span className="tv-keyword-skipped">
                            {' '}· bỏ qua {skippedByKeyword} video không khớp “{crawlKeyword.trim()}”
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                  Đã chọn {selectedIds.size} / {discovered.length}
                </div>
              </div>

              {state === 'scanning' && (
                <div className="tv-sync-progress-bar" style={{ marginTop: 6 }}>
                  <div className="tv-sync-progress-fill running" style={{ width: `${activeJob ? activeJob.percent : 30}%` }} />
                </div>
              )}
            </div>

            {/* Nút chọn thể loại khi quét / danh sách video */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 12,
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                marginTop: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={14} color="var(--primary)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>Thể loại lưu:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span>{currentCatIcon}</span>
                  <span>{selectedCategory}</span>
                </span>
              </div>

              <div style={{ position: 'relative' }} ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'rgba(124, 58, 237, 0.1)',
                    border: '1px solid var(--primary)',
                    color: 'var(--primary)',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Bấm để đổi thể loại lưu cho các video này"
                >
                  <Tag size={12} />
                  <span>Đổi thể loại</span>
                  <ChevronDown
                    size={13}
                    style={{
                      transform: categoryPickerOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>
                {renderCategoryDropdown(categoryPickerOpen)}
              </div>
            </div>

            {error && <div className="tv-hint tv-bad">{error}</div>}

            <div className="tv-sync-video-toolbar">
              <div className="tv-sync-search-box">
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Lọc video theo tên…"
                  className="tv-sync-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="tv-sync-select-helpers">
                <button type="button" className={`tv-sync-pill-btn ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>
                  Tất cả ({discovered.length})
                </button>
                <button type="button" className={`tv-sync-pill-btn ${filterType === 'fresh' ? 'active' : ''}`} onClick={() => setFilterType('fresh')}>
                  Video mới ({freshCount})
                </button>
                <button type="button" className={`tv-sync-pill-btn ${filterType === 'known' ? 'active' : ''}`} onClick={() => setFilterType('known')}>
                  Đã có ({knownCount})
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'flex-end', marginTop: 2 }}>
                <button type="button" className="tv-sync-pill-btn" onClick={() => setSelectedIds((p) => { const n = new Set(p); filtered.forEach((v) => n.add(v.videoId)); return n })}>
                  Chọn tất cả
                </button>
                <button type="button" className="tv-sync-pill-btn" onClick={() => setSelectedIds((p) => { const n = new Set(p); filtered.forEach((v) => n.delete(v.videoId)); return n })}>
                  Bỏ chọn
                </button>
                <button type="button" className="tv-sync-pill-btn" onClick={() => setSelectedIds(new Set(discovered.filter((v) => !v.isKnown).map((v) => v.videoId)))}>
                  Chỉ chọn video mới
                </button>
              </div>
            </div>

            <div className="tv-sync-video-container">
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {discovered.length === 0 ? 'Đang lấy dữ liệu từ YouTube…' : 'Không có video nào khớp bộ lọc.'}
                </div>
              ) : (
                filtered.map((v) => {
                  const isSelected = selectedIds.has(v.videoId)
                  return (
                    <div
                      key={v.videoId}
                      className={`tv-sync-video-item ${isSelected ? 'selected' : ''} ${v.isKnown ? 'known' : ''}`}
                      onClick={() => toggle(v.videoId)}
                    >
                      <div className="tv-sync-checkbox">{isSelected && <Check size={13} strokeWidth={3} />}</div>
                      <div className="tv-sync-video-thumb-wrap">
                        {v.thumbnail ? (
                          <img src={v.thumbnail} alt={v.title} className="tv-sync-video-thumb" />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#333' }} />
                        )}
                        {v.duration ? <span className="tv-sync-video-duration">{formatDuration(v.duration)}</span> : null}
                      </div>
                      <div className="tv-sync-video-meta">
                        <div className="tv-sync-video-title" title={v.title}>{v.title}</div>
                        <div className="tv-sync-video-sub">
                          <span>{v.channelName}</span>
                          {v.playlistName && <span>· {v.playlistName}</span>}
                          {v.isKnown ? (
                            <span className="tv-sync-known-badge">Đã có trong thư viện</span>
                          ) : (
                            <span className="tv-sync-fresh-badge">Mới</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>


            <div className="tv-sync-actions">
              <button
                type="button"
                className="tv-btn-action secondary"
                onClick={() => { stopRef.current = true; setState('paste') }}
                disabled={state === 'saving'}
              >
                Nhập link khác
              </button>
              {state === 'scanning' && (
                <button type="button" className="tv-btn-action pause" onClick={() => { stopRef.current = true; setState('paused') }}>
                  <Pause size={15} /> Tạm dừng
                </button>
              )}
              {state === 'paused' && (
                <button type="button" className="tv-btn-action secondary" onClick={() => void start()}>
                  <Play size={15} /> Quét tiếp
                </button>
              )}
              <button
                type="button"
                className="tv-btn-action save"
                onClick={() => void handleSave()}
                disabled={selectedIds.size === 0 || state === 'saving'}
              >
                {state === 'saving' ? (
                  <><Loader2 size={15} className="animate-spin" /> Đang lưu…</>
                ) : (
                  <><Save size={15} /> Thêm {selectedIds.size} video</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
