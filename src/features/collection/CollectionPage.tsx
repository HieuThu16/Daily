import { useState, useEffect, useMemo } from 'react'
import {
  Sparkles, Star, Search,
  BookOpen, Music, Youtube, BookMarked,
  NotebookPen, Heart, Layers, Compass
} from 'lucide-react'
import {
  fetchAllCollections,
  getLocalCollections,
  removeCollectionItem,
  toggleCollectionFavorite,
  type CollectionItem,
} from './collectionService'
import { UniversalCollection3DCard } from './UniversalCollection3DCard'
import { Memory3DCard } from '../daily/Memory3DCard'
import { useQuery } from '../shared'
import { isEntryFirstTime, isEntrySpecial, type Entry } from '../../types'
import { useToast } from '../ToastContext'

type FilterTab = 'ALL' | 'DIARY' | 'BOOK' | 'TRUYEN_H' | 'MANGA' | 'YOUTUBE' | 'MUSIC' | 'FAV'

export function CollectionPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<CollectionItem[]>(() => getLocalCollections())
  const [, setLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState<FilterTab>('ALL')
  const [search, setSearch] = useState('')

  // Tải thêm các bài Nhật ký được đánh dấu "Lần đầu" hoặc "Đặc biệt"
  const diaryQuery = useQuery<Entry>('daily_entries')
  const diaryCards = useMemo(() => {
    return diaryQuery.items
      .filter((i) => isEntryFirstTime(i) || isEntrySpecial(i))
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  }, [diaryQuery.items])

  // Tải danh sách bộ sưu tập từ Supabase
  useEffect(() => {
    let alive = true
    void (async () => {
      setLoading(true)
      const data = await fetchAllCollections()
      if (alive) {
        setItems(data)
        setLoading(false)
      }
    })()

    const handleUpdate = () => {
      if (alive) {
        setItems(getLocalCollections())
      }
    }

    window.addEventListener('user_collections_updated', handleUpdate)
    return () => {
      alive = false
      window.removeEventListener('user_collections_updated', handleUpdate)
    }
  }, [])

  // Đếm số lượng theo từng tab
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      ALL: items.length + diaryCards.length,
      DIARY: diaryCards.length,
      BOOK: 0,
      TRUYEN_H: 0,
      MANGA: 0,
      YOUTUBE: 0,
      MUSIC: 0,
      FAV: items.filter((i) => i.is_favorite).length + diaryCards.filter((i) => i.is_favorite).length,
    }

    items.forEach((i) => {
      if (map[i.item_type] !== undefined) {
        map[i.item_type]++
      }
    })

    return map
  }, [items, diaryCards])

  // Lọc danh sách theo tab và tìm kiếm
  const q = search.trim().toLowerCase()

  const filteredCollectionItems = useMemo(() => {
    return items.filter((i) => {
      if (currentTab === 'FAV') return Boolean(i.is_favorite)
      if (currentTab !== 'ALL' && i.item_type !== currentTab) return false
      if (currentTab === 'DIARY') return false // Nhật ký hiển thị riêng
      if (!q) return true
      return (
        i.title.toLowerCase().includes(q) ||
        (i.subtitle && i.subtitle.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q))
      )
    })
  }, [items, currentTab, q])

  const filteredDiaryCards = useMemo(() => {
    if (currentTab !== 'ALL' && currentTab !== 'DIARY' && currentTab !== 'FAV') return []
    return diaryCards.filter((entry) => {
      if (currentTab === 'FAV' && !entry.is_favorite) return false
      if (!q) return true
      return entry.content.toLowerCase().includes(q) || entry.entry_date.includes(q)
    })
  }, [diaryCards, currentTab, q])

  // Xóa 1 item khỏi bộ sưu tập
  const handleRemove = (item: CollectionItem) => {
    removeCollectionItem(item.id, item.item_type, item.item_id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    showToast('🗑️ Đã bỏ khỏi Bộ sưu tập', 'delete')
  }

  // Toggle favorite
  const handleToggleFavorite = (item: CollectionItem) => {
    toggleCollectionFavorite(item.id)
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_favorite: !i.is_favorite } : i)),
    )
  }

  const totalVisible = filteredCollectionItems.length + filteredDiaryCards.length

  return (
    <section className="page-shell">
      {/* ── BANNER HEADER BỘ SƯU TẬP 3D ── */}
      <div
        style={{
          padding: '18px 20px',
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.18), rgba(59, 130, 246, 0.15))',
          border: '1.5px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
          marginBottom: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)',
                flexShrink: 0,
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)' }}>
                Bộ Sưu Tập Thẻ Kỷ Niệm 3D
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Không gian lưu giữ thẻ bài 3D: Sách, Truyện H, Manga, YouTube, Nhạc và Nhật ký
              </p>
            </div>
          </div>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: 99,
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 800,
              boxShadow: '0 2px 10px rgba(139, 92, 246, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Layers size={14} />
            <span>{counts.ALL} Thẻ sưu tập</span>
          </div>
        </div>

        {/* Thanh tìm kiếm */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Tìm kiếm thẻ bài trong bộ sưu tập (tên sách, video, truyện, nhạc, nhật ký)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 38px',
              borderRadius: 12,
              fontSize: '0.86rem',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)',
              outline: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          />
          <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, color: '#8b5cf6' }} />
        </div>

        {/* CÁC TAB PHÂN LOẠI THẺ (CHỌN NHANH) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
          {[
            { id: 'ALL', label: 'Tất cả', icon: Sparkles, count: counts.ALL, color: '#8b5cf6' },
            { id: 'DIARY', label: 'Nhật ký', icon: NotebookPen, count: counts.DIARY, color: '#f59e0b' },
            { id: 'BOOK', label: 'Sách', icon: BookOpen, count: counts.BOOK, color: '#a855f7' },
            { id: 'TRUYEN_H', label: 'Truyện H', icon: Heart, count: counts.TRUYEN_H, color: '#f43f5e' },
            { id: 'MANGA', label: 'Manga / BL', icon: BookMarked, count: counts.MANGA, color: '#10b981' },
            { id: 'YOUTUBE', label: 'YouTube', icon: Youtube, count: counts.YOUTUBE, color: '#ef4444' },
            { id: 'MUSIC', label: 'Nhạc', icon: Music, count: counts.MUSIC, color: '#06b6d4' },
            { id: 'FAV', label: 'Yêu thích', icon: Star, count: counts.FAV, color: 'var(--amber)' },
          ].map((tab) => {
            const isSelected = currentTab === tab.id
            const TabIcon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCurrentTab(tab.id as FilterTab)}
                style={{
                  padding: '6px 13px',
                  borderRadius: 20,
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1.5px solid',
                  borderColor: isSelected ? tab.color : 'var(--card-border)',
                  background: isSelected ? tab.color : 'var(--card-bg)',
                  color: isSelected ? '#fff' : 'var(--text-main)',
                  transition: 'all 0.16s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: isSelected ? `0 2px 8px ${tab.color}40` : 'none',
                }}
              >
                <TabIcon size={13} fill={tab.id === 'FAV' && isSelected ? '#fff' : 'none'} />
                <span>{tab.label}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.85, background: 'rgba(0,0,0,0.15)', padding: '1px 6px', borderRadius: 99 }}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── GRID HIỂN THỊ CÁC THẺ BÀI SƯU TẬP 3D ── */}
      {totalVisible === 0 ? (
        <div
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            background: 'var(--card-bg)',
            borderRadius: 20,
            border: '1.5px dashed var(--card-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            marginTop: 10,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2))',
              display: 'grid',
              placeItems: 'center',
              color: '#8b5cf6',
            }}
          >
            <Compass size={32} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {counts.ALL === 0
              ? 'Bộ sưu tập của bạn đang trống'
              : 'Không có thẻ sưu tập nào trong mục này'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.6 }}>
            {counts.ALL === 0
              ? 'Bạn có thể bấm nút "✨ Lưu vào Sưu tầm" khi đọc Sách, Truyện H, Manga, xem YouTube, nghe Nhạc hoặc đánh dấu "Lần đầu / Đặc biệt" khi viết Nhật ký để lưu vào đây nhé!'
              : 'Thử chuyển sang tab khác hoặc xóa bộ lọc tìm kiếm để xem các thẻ bài sưu tập khác.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
            gap: 16,
            paddingBottom: 40,
          }}
        >
          {/* Thẻ Nhật ký Lần đầu & Đặc biệt */}
          {filteredDiaryCards.map((entry) => (
            <Memory3DCard
              key={`diary-${entry.id}`}
              entry={entry}
              onEdit={() => {}}
              onToggleFavorite={() => {}}
            />
          ))}

          {/* Thẻ Universal (Sách, Truyện H, Manga, YouTube, Nhạc) */}
          {filteredCollectionItems.map((item) => (
            <UniversalCollection3DCard
              key={item.id}
              item={item}
              onRemove={handleRemove}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}
    </section>
  )
}
