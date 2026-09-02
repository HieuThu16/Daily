import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, Camera, ChevronLeft, ChevronRight, Download,
  ExternalLink,
  Layers, Play, Search, Sparkles, Star,
  X
} from 'lucide-react'
import { useQuery } from '../shared'
import { localDate } from '../../lib/date'
import { useToast } from '../ToastContext'
import { isEntryFirstTime, isEntrySpecial, type Entry, type SharedEvent, type NutritionLog } from '../../types'
import {
  fetchAllCollections,
  getLocalCollections,
  removeCollectionItem,
  toggleCollectionFavorite,
  type CollectionItem,
} from './collectionService'
import { UniversalCollection3DCard } from './UniversalCollection3DCard'
import { Memory3DCard } from '../daily/Memory3DCard'
import { supabase } from '../../lib/supabase'
import './collection.css'

export type MediaSourceType = 'DAILY' | 'MEMORY' | 'NUTRITION'

export interface UnifiedMediaItem {
  id: string
  sourceId: string
  sourceType: MediaSourceType
  sourceLabel: string
  sourceColor: string
  sourceIcon: string
  url: string
  mediaType: 'image' | 'video'
  date: string // 'YYYY-MM-DD'
  time?: string | null
  title: string
  subtitle?: string | null
  location?: string | null
  targetRoute: string
  rawItem: any
}

const MEAL_LABELS: Record<string, string> = {
  MORNING: 'Bữa Sáng',
  LUNCH: 'Bữa Trưa',
  AFTERNOON: 'Bữa Chiều',
  EVENING: 'Bữa Tối',
}

function isVideoUrl(url?: string | null): boolean {
  if (!url) return false
  return /\.(mp4|webm|mov|m4v|mkv|avi)(\?.*)?$/i.test(url)
}

function formatDateHeader(dateStr: string): string {
  try {
    const today = localDate()
    const d = new Date(dateStr + 'T12:00:00')
    const weekday = d.toLocaleDateString('vi-VN', { weekday: 'long' })
    const dayMonth = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    if (dateStr === today) return `Hôm nay · ${weekday}, ${dayMonth}`
    return `${weekday}, ${dayMonth}`
  } catch {
    return dateStr
  }
}

function formatDisplayContent(content: string): string {
  if (!content) return ''
  return content.replace(/^(\[[^\]]+\]\s*)+/, '').split('\n')[0].trim()
}

export function CollectionPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // 1. NGUỒN DỮ LIỆU TỪ HỆ THỐNG
  const dailyQuery = useQuery<Entry>('daily_entries')
  const sharedEventsQuery = useQuery<SharedEvent>('shared_events')
  const nutritionQuery = useQuery<NutritionLog>('nutrition_logs')

  const [savedCollections, setSavedCollections] = useState<CollectionItem[]>(() => getLocalCollections())
  const [activeTab, setActiveTab] = useState<'day_focus' | 'timeline' | 'gallery' | 'special'>('day_focus')
  const [selectedDate, setSelectedDate] = useState<string>(localDate())

  // Bộ lọc thư viện ảnh
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'ALL' | 'IMAGE' | 'VIDEO'>('ALL')
  const [sourceFilter, setSourceFilter] = useState<'ALL' | MediaSourceType>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('ALL')
  const [monthFilter, setMonthFilter] = useState<string>('ALL')

  // Lightbox Modal
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Tải danh sách user_collections
  useEffect(() => {
    let alive = true
    void (async () => {
      const data = await fetchAllCollections()
      if (alive) setSavedCollections(data)
    })()

    const handleUpdate = () => {
      if (alive) setSavedCollections(getLocalCollections())
    }
    window.addEventListener('user_collections_updated', handleUpdate)
    return () => {
      alive = false
      window.removeEventListener('user_collections_updated', handleUpdate)
    }
  }, [])

  // 2. GỘP TOÀN BỘ ẢNH & VIDEO TỪ NHẬT KÝ, KỶ NIỆM VÀ ĂN UỐNG THEO NGÀY
  const allMediaItems = useMemo(() => {
    const list: UnifiedMediaItem[] = []

    // 2.1 Nhật ký hàng ngày (Daily entries)
    dailyQuery.items.forEach((entry) => {
      if (entry.image_url) {
        list.push({
          id: `daily_${entry.id}`,
          sourceId: entry.id,
          sourceType: 'DAILY',
          sourceLabel: '📝 Nhật ký',
          sourceColor: '#38bdf8',
          sourceIcon: '📝',
          url: entry.image_url,
          mediaType: isVideoUrl(entry.image_url) ? 'video' : 'image',
          date: entry.entry_date || (entry.created_at ? entry.created_at.slice(0, 10) : localDate()),
          time: entry.entry_time,
          title: formatDisplayContent(entry.content) || 'Khoảnh khắc nhật ký',
          subtitle: entry.category ? `Thể loại: ${entry.category}` : null,
          targetRoute: '/daily',
          rawItem: entry,
        })
      }
    })

    // 2.2 Kỷ niệm chung & người thân (Shared events / Memories)
    sharedEventsQuery.items.forEach((event) => {
      const urls: string[] = []
      if (Array.isArray(event.images)) {
        event.images.forEach((img) => {
          if (img && !urls.includes(img)) urls.push(img)
        })
      }
      if (event.image_url && !urls.includes(event.image_url)) {
        urls.push(event.image_url)
      }

      urls.forEach((url, idx) => {
        list.push({
          id: `memory_${event.id}_${idx}`,
          sourceId: event.id,
          sourceType: 'MEMORY',
          sourceLabel: '💖 Kỷ niệm',
          sourceColor: '#f43f5e',
          sourceIcon: '💖',
          url,
          mediaType: isVideoUrl(url) ? 'video' : 'image',
          date: event.event_date || (event.created_at ? event.created_at.slice(0, 10) : localDate()),
          time: event.event_time,
          title: event.title || 'Khoảnh khắc kỷ niệm',
          subtitle: event.note || null,
          location: event.location,
          targetRoute: event.person_id ? `/people/${event.person_id}` : '/people',
          rawItem: event,
        })
      })
    })

    // 2.3 Ăn uống (Nutrition logs)
    nutritionQuery.items.forEach((log) => {
      const urls: string[] = []
      if (Array.isArray(log.images)) {
        log.images.forEach((img) => {
          if (img && !urls.includes(img)) urls.push(img)
        })
      }
      if (log.image_url && !urls.includes(log.image_url)) {
        urls.push(log.image_url)
      }

      urls.forEach((url, idx) => {
        list.push({
          id: `nutrition_${log.id}_${idx}`,
          sourceId: log.id,
          sourceType: 'NUTRITION',
          sourceLabel: '🥗 Ăn uống',
          sourceColor: '#10b981',
          sourceIcon: '🥗',
          url,
          mediaType: isVideoUrl(url) ? 'video' : 'image',
          date: log.log_date || (log.created_at ? log.created_at.slice(0, 10) : localDate()),
          time: log.log_time,
          title: log.food_name,
          subtitle: `${MEAL_LABELS[log.meal_slot] || log.meal_slot} · ${new Intl.NumberFormat('vi-VN').format(log.price)}đ`,
          targetRoute: '/nutrition',
          rawItem: log,
        })
      })
    })

    // Sắp xếp thời gian giảm dần (mới nhất lên đầu)
    return list.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date)
      if (cmp !== 0) return cmp
      return (b.time || '').localeCompare(a.time || '')
    })
  }, [dailyQuery.items, sharedEventsQuery.items, nutritionQuery.items])

  // 3. MEDIA CỦA NGÀY ĐANG CHỌN (DAY FOCUS)
  const dayMediaItems = useMemo(() => {
    return allMediaItems.filter((item) => item.date === selectedDate)
  }, [allMediaItems, selectedDate])

  // Nhóm media của ngày theo 3 chuyên mục
  const dayGroupedByCategory = useMemo(() => {
    return {
      memories: dayMediaItems.filter((i) => i.sourceType === 'MEMORY'),
      dailies: dayMediaItems.filter((i) => i.sourceType === 'DAILY'),
      nutritions: dayMediaItems.filter((i) => i.sourceType === 'NUTRITION'),
    }
  }, [dayMediaItems])

  // 4. DANH SÁCH TẤT CẢ MEDIA PHÂN NHÓM THEO TỪNG NGÀY (TIMELINE)
  const timelineGroupedByDate = useMemo(() => {
    const map = new Map<string, UnifiedMediaItem[]>()
    allMediaItems.forEach((item) => {
      const current = map.get(item.date) || []
      current.push(item)
      map.set(item.date, current)
    })
    return Array.from(map.entries())
  }, [allMediaItems])

  // 5. THƯ VIỆN ẢNH ĐƯỢC LỌC (GALLERY VIEW)
  const filteredGalleryItems = useMemo(() => {
    return allMediaItems.filter((item) => {
      if (mediaTypeFilter === 'IMAGE' && item.mediaType !== 'image') return false
      if (mediaTypeFilter === 'VIDEO' && item.mediaType !== 'video') return false
      if (sourceFilter !== 'ALL' && item.sourceType !== sourceFilter) return false

      if (yearFilter !== 'ALL') {
        const itemYear = item.date.slice(0, 4)
        if (itemYear !== yearFilter) return false
      }
      if (monthFilter !== 'ALL') {
        const itemMonth = item.date.slice(5, 7)
        if (itemMonth !== monthFilter) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = item.title.toLowerCase().includes(q)
        const matchSub = item.subtitle?.toLowerCase().includes(q) || false
        const matchLoc = item.location?.toLowerCase().includes(q) || false
        if (!matchTitle && !matchSub && !matchLoc) return false
      }

      return true
    })
  }, [allMediaItems, mediaTypeFilter, sourceFilter, yearFilter, monthFilter, searchQuery])

  // Danh sách các năm có trong dữ liệu
  const availableYears = useMemo(() => {
    const set = new Set<string>()
    allMediaItems.forEach((item) => set.add(item.date.slice(0, 4)))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [allMediaItems])

  // Thẻ nhật ký lần đầu & đặc biệt
  const diarySpecialCards = useMemo(() => {
    return dailyQuery.items
      .filter((i) => isEntryFirstTime(i) || isEntrySpecial(i))
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  }, [dailyQuery.items])

  // Thao tác chuyển ngày
  const handleShiftDay = (delta: number) => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      date.setDate(date.getDate() + delta)
      const nextY = date.getFullYear()
      const nextM = String(date.getMonth() + 1).padStart(2, '0')
      const nextD = String(date.getDate()).padStart(2, '0')
      setSelectedDate(`${nextY}-${nextM}-${nextD}`)
    } catch {
      setSelectedDate(localDate())
    }
  }

  // Active item trong Lightbox
  const activeLightboxItem = lightboxIndex !== null ? (activeTab === 'day_focus' ? dayMediaItems[lightboxIndex] : filteredGalleryItems[lightboxIndex]) : null

  // Điều hướng Lightbox
  const handleNextLightbox = () => {
    const list = activeTab === 'day_focus' ? dayMediaItems : filteredGalleryItems
    if (lightboxIndex !== null && lightboxIndex < list.length - 1) {
      setLightboxIndex(lightboxIndex + 1)
    }
  }

  const handlePrevLightbox = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1)
    }
  }

  // Tải file về máy
  const handleDownloadMedia = (url: string) => {
    window.open(url, '_blank')
    showToast('📥 Đang mở tệp media gốc để tải về')
  }

  return (
    <div className="collection-page">
      {/* 1. THANH ĐIỀU HƯỚNG TABS & BỘ CHỌN NGÀY TINH GỌN */}
      <div className="collection-nav-bar">
        <div className="collection-tabs">
          <button
            type="button"
            className={`collection-tab-btn ${activeTab === 'day_focus' ? 'active' : ''}`}
            onClick={() => setActiveTab('day_focus')}
          >
            <Calendar size={14} /> Theo Ngày ({dayMediaItems.length})
          </button>
          <button
            type="button"
            className={`collection-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <Layers size={14} /> Dòng Thời Gian
          </button>
          <button
            type="button"
            className={`collection-tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            <Camera size={14} /> Thư Viện Media ({allMediaItems.length})
          </button>
          <button
            type="button"
            className={`collection-tab-btn ${activeTab === 'special' ? 'active' : ''}`}
            onClick={() => setActiveTab('special')}
          >
            <Sparkles size={14} /> Sưu Tập Đặc Biệt ({savedCollections.length + diarySpecialCards.length})
          </button>
        </div>

        {/* Bộ chọn ngày cho chế độ Day Focus */}
        {activeTab === 'day_focus' && (
          <div className="date-controller-toolbar">
            <button
              type="button"
              className="tv-btn"
              onClick={() => handleShiftDay(-1)}
              style={{ padding: '5px 8px', borderRadius: 8, fontSize: '0.78rem' }}
              title="Hôm qua"
            >
              <ChevronLeft size={14} /> Hôm qua
            </button>

            <input
              type="date"
              className="date-controller-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />

            <button
              type="button"
              className="tv-btn"
              onClick={() => setSelectedDate(localDate())}
              style={{
                padding: '5px 8px',
                borderRadius: 8,
                fontSize: '0.78rem',
                background: selectedDate === localDate() ? 'rgba(56, 189, 248, 0.2)' : undefined,
                color: selectedDate === localDate() ? '#38bdf8' : undefined,
                fontWeight: 700,
              }}
            >
              Hôm nay
            </button>

            <button
              type="button"
              className="tv-btn"
              onClick={() => handleShiftDay(1)}
              style={{ padding: '5px 8px', borderRadius: 8, fontSize: '0.78rem' }}
              title="Ngày mai"
            >
              Ngày mai <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 3. CHẾ ĐỘ 1: KHOẢNH KHẮC THEO NGÀY (DAY FOCUS) */}
      {activeTab === 'day_focus' && (
        <div>
          {/* Tiêu đề ngày được chọn */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
              📅 {formatDateHeader(selectedDate)}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              {dayMediaItems.length} ảnh & video
            </span>
          </div>

          {dayMediaItems.length === 0 ? (
            <div className="day-highlight-box" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <span style={{ fontSize: '2.4rem', display: 'block', marginBottom: 10 }}>📷</span>
              <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Chưa có hình ảnh hoặc video nào trong ngày {selectedDate}
              </h4>
              <p style={{ margin: '0 auto 16px', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 420 }}>
                Bạn có thể thêm ảnh/video vào <strong>Nhật ký</strong>, <strong>Kỷ niệm</strong> hoặc <strong>Bữa ăn uống</strong> để tự động xuất hiện tại đây.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="tv-btn primary" onClick={() => navigate('/daily')} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  📝 Viết Nhật Ký
                </button>
                <button type="button" className="tv-btn primary" onClick={() => navigate('/nutrition')} style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#10b981' }}>
                  🥗 Ghi Bữa Ăn
                </button>
                <button type="button" className="tv-btn primary" onClick={() => navigate('/people')} style={{ fontSize: '0.8rem', padding: '6px 12px', background: '#f43f5e' }}>
                  💖 Thêm Kỷ Niệm
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* 3.1 Kỷ niệm trong ngày */}
              {dayGroupedByCategory.memories.length > 0 && (
                <div className="day-highlight-box">
                  <div className="media-category-header">
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 6 }}>
                      💖 Kỷ Niệm ({dayGroupedByCategory.memories.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/people')}
                      style={{ background: 'none', border: 0, color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      Xem trang kỷ niệm <ExternalLink size={12} />
                    </button>
                  </div>
                  <div className="media-grid">
                    {dayGroupedByCategory.memories.map((item) => (
                      <div
                        key={item.id}
                        className="media-card-item"
                        onClick={() => setLightboxIndex(dayMediaItems.findIndex((i) => i.id === item.id))}
                      >
                        <span className="media-card-source-badge" style={{ background: `${item.sourceColor}cc`, color: '#fff' }}>
                          {item.sourceLabel}
                        </span>
                        {item.mediaType === 'video' ? (
                          <>
                            <div className="media-card-video-tag">
                              <Play size={10} fill="#fff" /> Video
                            </div>
                            <video src={item.url} className="media-card-thumb" />
                          </>
                        ) : (
                          <img src={item.url} alt={item.title} className="media-card-thumb" loading="lazy" />
                        )}
                        <div className="media-card-overlay">
                          <p className="media-card-title">{item.title}</p>
                          {item.time && <small style={{ fontSize: '0.68rem', opacity: 0.8 }}>🕒 {item.time}</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3.2 Nhật ký trong ngày */}
              {dayGroupedByCategory.dailies.length > 0 && (
                <div className="day-highlight-box">
                  <div className="media-category-header">
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                      📝 Nhật Ký ({dayGroupedByCategory.dailies.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/daily')}
                      style={{ background: 'none', border: 0, color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      Xem trang nhật ký <ExternalLink size={12} />
                    </button>
                  </div>
                  <div className="media-grid">
                    {dayGroupedByCategory.dailies.map((item) => (
                      <div
                        key={item.id}
                        className="media-card-item"
                        onClick={() => setLightboxIndex(dayMediaItems.findIndex((i) => i.id === item.id))}
                      >
                        <span className="media-card-source-badge" style={{ background: `${item.sourceColor}cc`, color: '#fff' }}>
                          {item.sourceLabel}
                        </span>
                        {item.mediaType === 'video' ? (
                          <>
                            <div className="media-card-video-tag">
                              <Play size={10} fill="#fff" /> Video
                            </div>
                            <video src={item.url} className="media-card-thumb" />
                          </>
                        ) : (
                          <img src={item.url} alt={item.title} className="media-card-thumb" loading="lazy" />
                        )}
                        <div className="media-card-overlay">
                          <p className="media-card-title">{item.title}</p>
                          {item.time && <small style={{ fontSize: '0.68rem', opacity: 0.8 }}>🕒 {item.time}</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3.3 Ăn uống trong ngày */}
              {dayGroupedByCategory.nutritions.length > 0 && (
                <div className="day-highlight-box">
                  <div className="media-category-header">
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                      🥗 Bữa Ăn Uống ({dayGroupedByCategory.nutritions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate('/nutrition')}
                      style={{ background: 'none', border: 0, color: 'var(--text-muted)', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      Xem trang ăn uống <ExternalLink size={12} />
                    </button>
                  </div>
                  <div className="media-grid">
                    {dayGroupedByCategory.nutritions.map((item) => (
                      <div
                        key={item.id}
                        className="media-card-item"
                        onClick={() => setLightboxIndex(dayMediaItems.findIndex((i) => i.id === item.id))}
                      >
                        <span className="media-card-source-badge" style={{ background: `${item.sourceColor}cc`, color: '#fff' }}>
                          {item.sourceLabel}
                        </span>
                        {item.mediaType === 'video' ? (
                          <>
                            <div className="media-card-video-tag">
                              <Play size={10} fill="#fff" /> Video
                            </div>
                            <video src={item.url} className="media-card-thumb" />
                          </>
                        ) : (
                          <img src={item.url} alt={item.title} className="media-card-thumb" loading="lazy" />
                        )}
                        <div className="media-card-overlay">
                          <p className="media-card-title">{item.title}</p>
                          <small style={{ fontSize: '0.68rem', opacity: 0.9, color: '#6ee7b7' }}>{item.subtitle}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. CHẾ ĐỘ 2: DÒNG THỜI GIAN TOÀN BỘ (TIMELINE) */}
      {activeTab === 'timeline' && (
        <div>
          {timelineGroupedByDate.length === 0 ? (
            <div className="day-highlight-box" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <span style={{ fontSize: '2.4rem' }}>🖼️</span>
              <h4 style={{ margin: '8px 0 4px', fontSize: '1rem', fontWeight: 800 }}>Chưa có khoảnh khắc nào</h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Tất cả hình ảnh & video bạn tải lên nhật ký, kỷ niệm, ăn uống sẽ xuất hiện thành dòng thời gian tại đây.
              </p>
            </div>
          ) : (
            <div>
              {timelineGroupedByDate.map(([dateKey, items]) => (
                <div key={dateKey} className="timeline-day-group">
                  <div className="timeline-day-header">
                    <Calendar size={13} color="#38bdf8" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {formatDateHeader(dateKey)}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      • {items.length} khoảnh khắc
                    </span>
                  </div>

                  <div className="media-grid">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="media-card-item"
                        onClick={() => {
                          const idx = allMediaItems.findIndex((i) => i.id === item.id)
                          setLightboxIndex(idx)
                        }}
                      >
                        <span className="media-card-source-badge" style={{ background: `${item.sourceColor}cc`, color: '#fff' }}>
                          {item.sourceLabel}
                        </span>
                        {item.mediaType === 'video' ? (
                          <>
                            <div className="media-card-video-tag">
                              <Play size={10} fill="#fff" /> Video
                            </div>
                            <video src={item.url} className="media-card-thumb" />
                          </>
                        ) : (
                          <img src={item.url} alt={item.title} className="media-card-thumb" loading="lazy" />
                        )}
                        <div className="media-card-overlay">
                          <p className="media-card-title">{item.title}</p>
                          {item.time && <small style={{ fontSize: '0.68rem', opacity: 0.8 }}>🕒 {item.time}</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. CHẾ ĐỘ 3: THƯ VIỆN MEDIA LƯỚI NGHỆ THUẬT (GALLERY VIEW) */}
      {activeTab === 'gallery' && (
        <div>
          {/* Thanh lọc media */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 16,
              background: 'rgba(15, 23, 42, 0.65)',
              padding: '8px 12px',
              borderRadius: 14,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Lọc loại Media: Tất cả, Ảnh, Video */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['ALL', 'IMAGE', 'VIDEO'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMediaTypeFilter(type)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: 0,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: mediaTypeFilter === type ? 'var(--primary)' : 'transparent',
                    color: mediaTypeFilter === type ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {type === 'ALL' ? 'Tất cả' : type === 'IMAGE' ? '📸 Ảnh' : '🎬 Video'}
                </button>
              ))}
            </div>

            {/* Lọc Nguồn: Tất cả, Kỷ niệm, Nhật ký, Ăn uống */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['ALL', 'MEMORY', 'DAILY', 'NUTRITION'] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSourceFilter(src)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: 0,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    background: sourceFilter === src ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    color: sourceFilter === src ? '#38bdf8' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {src === 'ALL' ? 'Mọi nguồn' : src === 'MEMORY' ? '💖 Kỷ niệm' : src === 'DAILY' ? '📝 Nhật ký' : '🥗 Ăn uống'}
                </button>
              ))}
            </div>

            {/* Lọc theo Năm & Tháng */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
                <Search size={13} color="var(--text-muted)" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm khoảnh khắc…"
                  style={{ background: 'transparent', border: 0, outline: 'none', color: 'var(--text-main)', fontSize: '0.76rem', width: 140 }}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: 8,
                  padding: '4px 6px',
                  color: 'var(--text-main)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                }}
              >
                <option value="ALL">Tất cả năm</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>

              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: 8,
                  padding: '4px 6px',
                  color: 'var(--text-main)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                }}
              >
                <option value="ALL">Tất cả tháng</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                  <option key={m} value={m}>Tháng {Number(m)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lưới hình ảnh & video */}
          {filteredGalleryItems.length === 0 ? (
            <div className="day-highlight-box" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Không tìm thấy ảnh hoặc video nào phù hợp với bộ lọc.
              </p>
            </div>
          ) : (
            <div className="media-grid">
              {filteredGalleryItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="media-card-item"
                  onClick={() => setLightboxIndex(idx)}
                >
                  <span className="media-card-source-badge" style={{ background: `${item.sourceColor}cc`, color: '#fff' }}>
                    {item.sourceLabel}
                  </span>
                  {item.mediaType === 'video' ? (
                    <>
                      <div className="media-card-video-tag">
                        <Play size={10} fill="#fff" /> Video
                      </div>
                      <video src={item.url} className="media-card-thumb" />
                    </>
                  ) : (
                    <img src={item.url} alt={item.title} className="media-card-thumb" loading="lazy" />
                  )}
                  <div className="media-card-overlay">
                    <p className="media-card-title">{item.title}</p>
                    <small style={{ fontSize: '0.68rem', opacity: 0.8 }}>📅 {item.date}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. CHẾ ĐỘ 4: SƯU TẬP ĐẶC BIỆT & VĂN HÓA (BOOKS, MANGA, FIRST TIMES) */}
      {activeTab === 'special' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Thẻ khoảnh khắc Nhật ký lần đầu / đặc biệt */}
          {diarySpecialCards.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="#eab308" /> Khoảnh Khắc Lần Đầu & Đặc Biệt ({diarySpecialCards.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {diarySpecialCards.map((entry) => (
                  <Memory3DCard
                    key={entry.id}
                    entry={entry}
                    onEdit={() => navigate('/daily')}
                    onToggleFavorite={(e) => {
                      const nextFav = !e.is_favorite
                      dailyQuery.setItems((prev) => prev.map((item) => (item.id === e.id ? { ...item, is_favorite: nextFav } : item)))
                      if (supabase) {
                        void supabase.from('daily_entries').update({ is_favorite: nextFav }).eq('id', e.id)
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Các mục sưu tập Sách, Truyện H, Manga, YouTube */}
          {savedCollections.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 12px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={16} color="#6366f1" /> Tác Phẩm & Nội Dung Đã Lưu ({savedCollections.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {savedCollections.map((item) => (
                  <UniversalCollection3DCard
                    key={item.id}
                    item={item}
                    onRemove={async (itm) => {
                      await removeCollectionItem(itm.id, itm.item_type, itm.item_id)
                      setSavedCollections(getLocalCollections())
                      showToast('Đã xóa khỏi bộ sưu tập')
                    }}
                    onToggleFavorite={async (itm) => {
                      await toggleCollectionFavorite(itm.id)
                      setSavedCollections(getLocalCollections())
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. LIGHTBOX XEM FULLSCREEN ẢNH & VIDEO */}
      {lightboxIndex !== null && activeLightboxItem && (
        <div className="lightbox-backdrop" onClick={() => setLightboxIndex(null)}>
          {/* Header Lightbox */}
          <div className="lightbox-header" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: activeLightboxItem.sourceColor,
                  fontSize: '0.76rem',
                  fontWeight: 800,
                }}
              >
                {activeLightboxItem.sourceLabel}
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, opacity: 0.9 }}>
                📅 {formatDateHeader(activeLightboxItem.date)} {activeLightboxItem.time ? `· 🕒 ${activeLightboxItem.time}` : ''}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="tv-btn"
                onClick={() => handleDownloadMedia(activeLightboxItem.url)}
                style={{ padding: '6px 10px', fontSize: '0.78rem', borderRadius: 8 }}
                title="Tải về"
              >
                <Download size={14} /> Tải về
              </button>

              <button
                type="button"
                className="tv-btn"
                onClick={() => navigate(activeLightboxItem.targetRoute)}
                style={{ padding: '6px 10px', fontSize: '0.78rem', borderRadius: 8, background: 'rgba(56, 189, 248, 0.25)', color: '#38bdf8' }}
                title="Xem nguồn gốc bài viết"
              >
                <ExternalLink size={14} /> Đi tới bài viết
              </button>

              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer', padding: 6 }}
                title="Đóng"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Media Content Body */}
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {lightboxIndex > 0 && (
              <button type="button" className="lightbox-nav-btn lightbox-prev" onClick={handlePrevLightbox}>
                <ChevronLeft size={24} />
              </button>
            )}

            {activeLightboxItem.mediaType === 'video' ? (
              <video
                src={activeLightboxItem.url}
                controls
                autoPlay
                className="lightbox-media"
                style={{ background: '#000' }}
              />
            ) : (
              <img src={activeLightboxItem.url} alt={activeLightboxItem.title} className="lightbox-media" />
            )}

            {(activeTab === 'day_focus' ? lightboxIndex < dayMediaItems.length - 1 : lightboxIndex < filteredGalleryItems.length - 1) && (
              <button type="button" className="lightbox-nav-btn lightbox-next" onClick={handleNextLightbox}>
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Footer Lightbox */}
          <div className="lightbox-footer" onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 4px', fontSize: '0.96rem', fontWeight: 800 }}>
              {activeLightboxItem.title}
            </h4>
            {activeLightboxItem.subtitle && (
              <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85 }}>
                {activeLightboxItem.subtitle}
              </p>
            )}
            {activeLightboxItem.location && (
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', opacity: 0.75 }}>
                📍 {activeLightboxItem.location}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
