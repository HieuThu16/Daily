import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  Copy,
  Database,
  ExternalLink,
  Film,
  HardDrive,
  Music,
  Play,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ToastContext'

export interface StorageItem {
  id: string
  bucket_id: string
  name: string
  size_bytes: number
  mime_type: string
  created_at: string
  public_url: string
  category: string
  category_name: string
  is_video: boolean
  is_image: boolean
}

export interface TableUsage {
  table_name: string
  row_count: number
  total_bytes: number
  index_bytes: number
}

function fmtBytes(bytes: number) {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

function fmtDateShort(iso: string) {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return ''
  }
}

function detectCategory(path: string): { key: string; name: string } {
  const p = path.toLowerCase()
  if (p.startsWith('shared_events/') || p.includes('/shared_events/')) {
    return { key: 'shared_events', name: 'Sự kiện chung' }
  }
  if (p.startsWith('daily_entries/') || p.includes('/daily_entries/')) {
    return { key: 'daily_entries', name: 'Nhật ký cá nhân' }
  }
  if (p.startsWith('covers/') || p.includes('/covers/')) {
    return { key: 'covers', name: 'Bìa sách & Manga' }
  }
  if (p.startsWith('nutrition/') || p.includes('/nutrition/')) {
    return { key: 'nutrition', name: 'Dinh dưỡng & Bữa ăn' }
  }
  if (p.startsWith('goals/') || p.includes('/goals/')) {
    return { key: 'goals', name: 'Mục tiêu cá nhân' }
  }
  if (p.startsWith('people/') || p.includes('/people/')) {
    return { key: 'people', name: 'Người thân & Bạn bè' }
  }
  if (p.startsWith('audio/') || p.includes('/audio/')) {
    return { key: 'audio', name: 'Nhạc & Âm thanh' }
  }
  if (p.startsWith('avatars/') || p.includes('/avatars/')) {
    return { key: 'avatars', name: 'Ảnh đại diện' }
  }
  return { key: 'other', name: 'Khác / Chưa phân loại' }
}

function checkIsVideo(mime: string, name: string) {
  return (
    mime?.startsWith('video/') ||
    /\.(mp4|mov|webm|mkv|avi|m4v|3gp)$/i.test(name)
  )
}

function checkIsImage(mime: string, name: string) {
  return (
    mime?.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg|heic|avif)$/i.test(name)
  )
}

import { deleteStorageFile } from '../../lib/storageDelete'

const SQL_MIGRATION_SNIPPET = `-- Chạy lệnh này trong Supabase > SQL Editor để phân tích chi tiết dung lượng & cấp quyền xóa tệp:
create or replace function public.storage_details()
returns table (
  id uuid,
  bucket_id text,
  name text,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql security definer set search_path = public, storage
as $$
  select o.id, o.bucket_id, o.name,
    coalesce((o.metadata->>'size')::bigint, 0) as size_bytes,
    coalesce(o.metadata->>'mimetype', '') as mime_type,
    o.created_at, o.updated_at
  from storage.objects o
  order by coalesce((o.metadata->>'size')::bigint, 0) desc
  limit 1000;
$$;

create or replace function public.database_table_usage()
returns table (
  table_name text,
  row_count bigint,
  total_bytes bigint,
  index_bytes bigint
)
language sql security definer set search_path = public
as $$
  select c.relname::text as table_name,
    coalesce(s.n_live_tup, 0)::bigint as row_count,
    pg_total_relation_size(c.oid)::bigint as total_bytes,
    pg_indexes_size(c.oid)::bigint as index_bytes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc;
$$;

-- Cấp quyền xóa tệp cho Storage (tránh lỗi RLS chặn khi xóa)
do $$ begin
  create policy "public daily photos delete" on storage.objects for delete using (bucket_id = 'daily-photos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public media audio delete" on storage.objects for delete using (bucket_id = 'media-audio');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public person photos delete" on storage.objects for delete using (bucket_id = 'person-photos');
exception when duplicate_object then null; end $$;

-- Hàm RPC xóa tệp cấp cao
create or replace function public.delete_storage_object(p_bucket text, p_name text)
returns boolean language plpgsql security definer set search_path = public, storage as $$
declare v_count int;
begin
  delete from storage.objects where bucket_id = p_bucket and name = p_name;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

grant execute on function public.storage_details() to authenticated, anon;
grant execute on function public.database_table_usage() to authenticated, anon;
grant execute on function public.delete_storage_object(text, text) to authenticated, anon;`

interface StorageBreakdownModalProps {
  onClose: () => void
  totalStorageBytes?: number
  storageQuotaBytes?: number
  initialTab?: 'storage' | 'database'
}

export function StorageBreakdownModal({
  onClose,
  totalStorageBytes = 0,
  storageQuotaBytes = 1024 * 1024 * 1024,
  initialTab = 'storage',
}: StorageBreakdownModalProps) {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'storage' | 'database'>(initialTab)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<StorageItem[]>([])
  const [tables, setTables] = useState<TableUsage[]>([])
  const [copiedSql, setCopiedSql] = useState(false)
  const [showSqlGuide, setShowSqlGuide] = useState(false)
  const [rpcSupported, setRpcSupported] = useState<boolean | null>(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'image' | 'large'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'size_desc' | 'size_asc' | 'date_desc'>('size_desc')

  // Preview & Delete State
  const [previewItem, setPreviewItem] = useState<StorageItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<StorageItem | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  // Load storage details
  const loadData = useCallback(async () => {
    setLoading(true)
    let foundItems: StorageItem[] = []
    let hasRpc = false

    try {
      // 1. Try RPC storage_details
      const res = await supabase?.rpc('storage_details')
      if (res && !res.error && Array.isArray(res.data)) {
        hasRpc = true
        setRpcSupported(true)
        foundItems = res.data.map((row: any) => {
          const bucket = row.bucket_id || 'photos'
          const pub = supabase?.storage.from(bucket).getPublicUrl(row.name)?.data?.publicUrl || ''
          const cat = detectCategory(row.name)
          const isVid = checkIsVideo(row.mime_type, row.name)
          const isImg = checkIsImage(row.mime_type, row.name)
          return {
            id: row.id || `${bucket}/${row.name}`,
            bucket_id: bucket,
            name: row.name,
            size_bytes: Number(row.size_bytes || 0),
            mime_type: row.mime_type || '',
            created_at: row.created_at || '',
            public_url: pub,
            category: cat.key,
            category_name: cat.name,
            is_video: isVid,
            is_image: isImg,
          }
        })
      }
    } catch {
      hasRpc = false
    }

    // 2. Fallback if RPC is not available yet: scan buckets recursively and check DB tables
    if (!hasRpc) {
      setRpcSupported(false)
      try {
        const fallbackItems: StorageItem[] = []
        const seenIds = new Set<string>()

        // Helper to scan a folder recursively in a given bucket
        const scanFolder = async (bucket: string, prefix: string, depth: number = 0): Promise<void> => {
          if (depth > 2) return
          try {
            const { data } = await supabase?.storage.from(bucket).list(prefix, {
              limit: 100,
              sortBy: { column: 'name', order: 'asc' },
            }) || {}

            if (!data || !Array.isArray(data)) return

            for (const it of data) {
              if (!it.name || it.name === '.emptyFolderPlaceholder') continue
              const fullPath = prefix ? `${prefix}/${it.name}` : it.name
              const meta = (it.metadata as any)

              // If it has a size in metadata or an extension, treat as file
              const hasFileExt = /\.[a-z0-9]{2,5}$/i.test(it.name)
              if (meta?.size !== undefined || hasFileExt) {
                const mime = meta?.mimetype || ''
                const cat = detectCategory(fullPath)
                const itemKey = `${bucket}/${fullPath}`
                if (!seenIds.has(itemKey)) {
                  seenIds.add(itemKey)
                  fallbackItems.push({
                    id: it.id || itemKey,
                    bucket_id: bucket,
                    name: fullPath,
                    size_bytes: Number(meta?.size || 0),
                    mime_type: mime,
                    created_at: it.created_at || '',
                    public_url: supabase?.storage.from(bucket).getPublicUrl(fullPath)?.data?.publicUrl || '',
                    category: cat.key,
                    category_name: cat.name,
                    is_video: checkIsVideo(mime, it.name),
                    is_image: checkIsImage(mime, it.name),
                  })
                }
              } else {
                // It's a folder, traverse into it
                await scanFolder(bucket, fullPath, depth + 1)
              }
            }
          } catch {
            // continue
          }
        }

        // Scan known buckets
        const targetBuckets = ['daily-photos', 'person-photos', 'media-covers', 'book-covers']
        for (const b of targetBuckets) {
          await scanFolder(b, '', 0)
        }

        // Also query shared_events and daily_entries to catch all attached photos/videos
        try {
          const { data: sharedEvents } = await supabase
            ?.from('shared_events')
            .select('id, title, image_url, image_path, images, image_paths, created_at')
            .order('created_at', { ascending: false })
            .limit(100) || {}

          if (sharedEvents && Array.isArray(sharedEvents)) {
            for (const ev of sharedEvents) {
              const paths: string[] = []
              if (Array.isArray(ev.image_paths)) paths.push(...ev.image_paths)
              else if (ev.image_path) paths.push(ev.image_path)

              const urls: string[] = []
              if (Array.isArray(ev.images)) urls.push(...ev.images)
              else if (ev.image_url) urls.push(ev.image_url)

              for (let i = 0; i < Math.max(paths.length, urls.length); i++) {
                const path = paths[i] || ''
                const url = urls[i] || (path ? supabase?.storage.from('daily-photos').getPublicUrl(path)?.data?.publicUrl || '' : '')
                const fileName = path ? path.split('/').pop() || path : (url.split('/').pop()?.split('?')[0] || `Ảnh/Video sự kiện`)
                const itemKey = path ? `daily-photos/${path}` : url
                if (!seenIds.has(itemKey) && (path || url)) {
                  seenIds.add(itemKey)
                  const isVid = checkIsVideo('', fileName) || checkIsVideo('', url)
                  fallbackItems.push({
                    id: itemKey,
                    bucket_id: 'daily-photos',
                    name: path || fileName,
                    size_bytes: 0,
                    mime_type: isVid ? 'video/mp4' : 'image/jpeg',
                    created_at: ev.created_at || '',
                    public_url: url,
                    category: 'shared_events',
                    category_name: `Sự kiện: ${ev.title || 'Kỷ niệm chung'}`,
                    is_video: isVid,
                    is_image: !isVid,
                  })
                }
              }
            }
          }
        } catch {
          // ignore
        }

        try {
          const { data: dailyEntries } = await supabase
            ?.from('daily_entries')
            .select('id, title, date, image_url, image_path, images, image_paths, created_at')
            .order('created_at', { ascending: false })
            .limit(100) || {}

          if (dailyEntries && Array.isArray(dailyEntries)) {
            for (const de of dailyEntries) {
              const paths: string[] = []
              if (Array.isArray(de.image_paths)) paths.push(...de.image_paths)
              else if (de.image_path) paths.push(de.image_path)

              const urls: string[] = []
              if (Array.isArray(de.images)) urls.push(...de.images)
              else if (de.image_url) urls.push(de.image_url)

              for (let i = 0; i < Math.max(paths.length, urls.length); i++) {
                const path = paths[i] || ''
                const url = urls[i] || (path ? supabase?.storage.from('daily-photos').getPublicUrl(path)?.data?.publicUrl || '' : '')
                const fileName = path ? path.split('/').pop() || path : (url.split('/').pop()?.split('?')[0] || `Nhật ký ${de.date}`)
                const itemKey = path ? `daily-photos/${path}` : url
                if (!seenIds.has(itemKey) && (path || url)) {
                  seenIds.add(itemKey)
                  const isVid = checkIsVideo('', fileName) || checkIsVideo('', url)
                  fallbackItems.push({
                    id: itemKey,
                    bucket_id: 'daily-photos',
                    name: path || fileName,
                    size_bytes: 0,
                    mime_type: isVid ? 'video/mp4' : 'image/jpeg',
                    created_at: de.created_at || '',
                    public_url: url,
                    category: 'daily_entries',
                    category_name: `Nhật ký: ${de.title || de.date}`,
                    is_video: isVid,
                    is_image: !isVid,
                  })
                }
              }
            }
          }
        } catch {
          // ignore
        }

        foundItems = fallbackItems.sort((a, b) => b.size_bytes - a.size_bytes)
      } catch (err) {
        console.error('Fallback storage scan failed:', err)
      }
    }

    setItems(foundItems)

    // Load table usage
    try {
      const dbRes = await supabase?.rpc('database_table_usage')
      if (dbRes && !dbRes.error && Array.isArray(dbRes.data)) {
        setTables(
          dbRes.data.map((r: any) => ({
            table_name: r.table_name,
            row_count: Number(r.row_count || 0),
            total_bytes: Number(r.total_bytes || 0),
            index_bytes: Number(r.index_bytes || 0),
          })),
        )
      }
    } catch {
      // ignore
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Handle Delete File
  const confirmDelete = async () => {
    if (!deletingItem) return
    setDeletingBusy(true)
    try {
      const res = await deleteStorageFile(deletingItem.bucket_id, deletingItem.name)

      if (!res.success) {
        showToast(
          `❌ Không thể xóa: ${res.error || 'Supabase từ chối quyền xóa'}. Vui lòng chạy câu lệnh SQL phân quyền.`,
          'delete',
        )
      } else {
        showToast(
          `🗑️ Đã xóa vĩnh viễn tệp khỏi Supabase và giải phóng ${fmtBytes(deletingItem.size_bytes)}!`,
          'success',
        )
        setItems((prev) => prev.filter((i) => i.id !== deletingItem.id))
        setDeletingItem(null)
      }
    } catch (err: any) {
      showToast(`Lỗi: ${err?.message || 'Không thể xóa'}`, 'delete')
    } finally {
      setDeletingBusy(false)
    }
  }

  // Copy SQL script
  const handleCopySql = () => {
    void navigator.clipboard.writeText(SQL_MIGRATION_SNIPPET)
    setCopiedSql(true)
    showToast('Đã sao chép mã SQL vào bộ nhớ tạm', 'info')
    setTimeout(() => setCopiedSql(false), 2500)
  }

  // Aggregate stats
  const stats = useMemo(() => {
    let videoBytes = 0
    let videoCount = 0
    let imageBytes = 0
    let imageCount = 0
    let otherBytes = 0
    let otherCount = 0

    const categoriesMap: Record<
      string,
      { key: string; name: string; totalBytes: number; count: number; videoBytes: number; videoCount: number }
    > = {}

    for (const it of items) {
      const bytes = it.size_bytes || 0
      if (it.is_video) {
        videoBytes += bytes
        videoCount += 1
      } else if (it.is_image) {
        imageBytes += bytes
        imageCount += 1
      } else {
        otherBytes += bytes
        otherCount += 1
      }

      if (!categoriesMap[it.category]) {
        categoriesMap[it.category] = {
          key: it.category,
          name: it.category_name,
          totalBytes: 0,
          count: 0,
          videoBytes: 0,
          videoCount: 0,
        }
      }
      categoriesMap[it.category].totalBytes += bytes
      categoriesMap[it.category].count += 1
      if (it.is_video) {
        categoriesMap[it.category].videoBytes += bytes
        categoriesMap[it.category].videoCount += 1
      }
    }

    const categoriesList = Object.values(categoriesMap).sort((a, b) => b.totalBytes - a.totalBytes)
    const totalScannedBytes = videoBytes + imageBytes + otherBytes

    return {
      videoBytes,
      videoCount,
      imageBytes,
      imageCount,
      otherBytes,
      otherCount,
      totalScannedBytes,
      categoriesList,
    }
  }, [items])

  // Filter and Sort Items
  const filteredItems = useMemo(() => {
    return items
      .filter((it) => {
        // Type filter
        if (typeFilter === 'video' && !it.is_video) return false
        if (typeFilter === 'image' && !it.is_image) return false
        if (typeFilter === 'large' && it.size_bytes < 10 * 1024 * 1024) return false

        // Category filter
        if (categoryFilter !== 'all' && it.category !== categoryFilter) return false

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matches =
            it.name.toLowerCase().includes(q) ||
            it.category_name.toLowerCase().includes(q) ||
            it.mime_type.toLowerCase().includes(q)
          if (!matches) return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'size_desc') return b.size_bytes - a.size_bytes
        if (sortBy === 'size_asc') return a.size_bytes - b.size_bytes
        if (sortBy === 'date_desc') {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        }
        return 0
      })
  }, [items, typeFilter, categoryFilter, searchQuery, sortBy])

  return (
    <div
      className="storage-breakdown-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="storage-breakdown-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="storage-breakdown-head">
          <div className="storage-breakdown-title-group">
            <div className="storage-breakdown-icon">
              <HardDrive size={20} />
            </div>
            <div>
              <h2 className="storage-breakdown-title">Chi tiết dung lượng lưu trữ</h2>
              <p className="storage-breakdown-subtitle">
                Xem video, hình ảnh và nơi chiếm nhiều dung lượng nhất
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="storage-btn-icon"
              onClick={() => void loadData()}
              title="Tải lại dữ liệu"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            <button className="storage-btn-icon" onClick={onClose} title="Đóng">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="storage-tabs">
          <button
            className={`storage-tab-btn ${activeTab === 'storage' ? 'storage-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('storage')}
          >
            <Film size={15} />
            <span>Kho tệp (Video, Ảnh, Tệp)</span>
            <span className="storage-tab-badge">{items.length}</span>
          </button>
          <button
            className={`storage-tab-btn ${activeTab === 'database' ? 'storage-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('database')}
          >
            <Database size={15} />
            <span>Cơ sở dữ liệu Supabase</span>
            {tables.length > 0 && <span className="storage-tab-badge">{tables.length} bảng</span>}
          </button>
        </div>

        <div className="storage-breakdown-body">
          {activeTab === 'storage' && (
            <>
              {/* Summary Cards */}
              <div className="storage-summary-grid">
                <div className="storage-stat-card storage-stat-card--total">
                  <div className="storage-stat-label">Tổng dung lượng kho tệp</div>
                  <div className="storage-stat-value">
                    {fmtBytes(totalStorageBytes || stats.totalScannedBytes)}
                  </div>
                  <div className="storage-stat-sub">
                    Hạn mức {fmtBytes(storageQuotaBytes)} · {items.length} tệp đã quét
                  </div>
                </div>

                <div
                  className={`storage-stat-card storage-stat-card--video ${typeFilter === 'video' ? 'storage-stat-card--selected' : ''}`}
                  onClick={() => setTypeFilter(typeFilter === 'video' ? 'all' : 'video')}
                  style={{ cursor: 'pointer' }}
                  title="Nhấn để chỉ xem các video"
                >
                  <div className="storage-stat-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>🎥 Video chiếm</span>
                    {typeFilter === 'video' && <span className="storage-active-pill">Đang lọc</span>}
                  </div>
                  <div className="storage-stat-value" style={{ color: '#ef4444' }}>
                    {fmtBytes(stats.videoBytes)}
                  </div>
                  <div className="storage-stat-sub">
                    {stats.videoCount} video (Bấm để xem danh sách video)
                  </div>
                </div>

                <div
                  className={`storage-stat-card storage-stat-card--image ${typeFilter === 'image' ? 'storage-stat-card--selected' : ''}`}
                  onClick={() => setTypeFilter(typeFilter === 'image' ? 'all' : 'image')}
                  style={{ cursor: 'pointer' }}
                  title="Nhấn để chỉ xem các ảnh"
                >
                  <div className="storage-stat-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>🖼️ Hình ảnh chiếm</span>
                    {typeFilter === 'image' && <span className="storage-active-pill">Đang lọc</span>}
                  </div>
                  <div className="storage-stat-value" style={{ color: '#10b981' }}>
                    {fmtBytes(stats.imageBytes)}
                  </div>
                  <div className="storage-stat-sub">
                    {stats.imageCount} ảnh (Bấm để lọc ảnh)
                  </div>
                </div>
              </div>

              {/* Category Breakdown (Nơi nào chiếm nhiều dung lượng nhất) */}
              <div className="storage-section-box">
                <div className="storage-section-title-bar">
                  <span className="storage-section-heading">Nơi nào chiếm nhiều dung lượng nhất</span>
                  <span className="storage-section-hint">Bấm vào từng nơi để lọc danh sách</span>
                </div>

                <div className="storage-category-list">
                  {stats.categoriesList.map((cat) => {
                    const pct =
                      stats.totalScannedBytes > 0
                        ? Math.round((cat.totalBytes / stats.totalScannedBytes) * 100)
                        : 0
                    const isSelected = categoryFilter === cat.key
                    return (
                      <button
                        key={cat.key}
                        className={`storage-category-row ${isSelected ? 'storage-category-row--active' : ''}`}
                        onClick={() => setCategoryFilter(isSelected ? 'all' : cat.key)}
                        type="button"
                      >
                        <div className="storage-cat-info">
                          <span className="storage-cat-name">{cat.name}</span>
                          <span className="storage-cat-bytes">
                            <b>{fmtBytes(cat.totalBytes)}</b> ({pct}%) · {cat.count} tệp
                            {cat.videoCount > 0 && (
                              <span className="storage-cat-vid-tag"> · {cat.videoCount} video ({fmtBytes(cat.videoBytes)})</span>
                            )}
                          </span>
                        </div>
                        <div className="storage-cat-bar-bg">
                          <div
                            className="storage-cat-bar-fill"
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                  {stats.categoriesList.length === 0 && !loading && (
                    <div className="storage-empty-text">Chưa phát hiện tệp nào trong bộ nhớ.</div>
                  )}
                </div>
              </div>

              {/* Filter Controls Bar */}
              <div className="storage-filter-bar">
                <div className="storage-search-box">
                  <Search size={14} className="storage-search-icon" />
                  <input
                    type="text"
                    placeholder="Tìm tên video, ảnh hoặc thư mục..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="storage-search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="storage-search-clear"
                      onClick={() => setSearchQuery('')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="storage-filter-pills">
                  <button
                    type="button"
                    className={`storage-pill ${typeFilter === 'all' ? 'storage-pill--active' : ''}`}
                    onClick={() => setTypeFilter('all')}
                  >
                    Tất cả ({items.length})
                  </button>
                  <button
                    type="button"
                    className={`storage-pill ${typeFilter === 'video' ? 'storage-pill--active' : ''}`}
                    onClick={() => setTypeFilter('video')}
                  >
                    🎥 Video ({stats.videoCount})
                  </button>
                  <button
                    type="button"
                    className={`storage-pill ${typeFilter === 'image' ? 'storage-pill--active' : ''}`}
                    onClick={() => setTypeFilter('image')}
                  >
                    🖼️ Ảnh ({stats.imageCount})
                  </button>
                  <button
                    type="button"
                    className={`storage-pill ${typeFilter === 'large' ? 'storage-pill--active' : ''}`}
                    onClick={() => setTypeFilter('large')}
                  >
                    ⚡ Lớn &gt; 10MB
                  </button>
                </div>

                <div className="storage-sort-select-wrap">
                  <select
                    className="storage-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="size_desc">Nặng nhất trước</option>
                    <option value="size_asc">Nhẹ nhất trước</option>
                    <option value="date_desc">Mới nhất trước</option>
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="storage-files-container">
                <div className="storage-files-header">
                  <span>
                    Danh sách tệp ({filteredItems.length} kết quả
                    {categoryFilter !== 'all' && ` · Đang lọc: ${stats.categoriesList.find((c) => c.key === categoryFilter)?.name}`}
                    )
                  </span>
                  {categoryFilter !== 'all' && (
                    <button
                      type="button"
                      className="storage-clear-cat-btn"
                      onClick={() => setCategoryFilter('all')}
                    >
                      Bỏ lọc nơi lưu
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="storage-loading-box">
                    <RefreshCw size={24} className="spin" />
                    <span>Đang quét dữ liệu dung lượng tệp...</span>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="storage-empty-box">
                    <AlertCircle size={28} />
                    <span>Không tìm thấy tệp nào phù hợp với bộ lọc hiện tại.</span>
                  </div>
                ) : (
                  <div className="storage-items-list">
                    {filteredItems.map((item, idx) => {
                      const isLarge = item.size_bytes > 10 * 1024 * 1024
                      const fileName = item.name.split('/').pop() || item.name
                      return (
                        <div key={item.id || idx} className="storage-file-row">
                          {/* File Thumbnail or Icon */}
                          <div
                            className={`storage-file-preview ${item.is_video ? 'storage-file-preview--video' : ''}`}
                            onClick={() => setPreviewItem(item)}
                            title="Bấm để xem trước"
                          >
                            {item.is_image ? (
                              <img
                                src={item.public_url}
                                alt={fileName}
                                loading="lazy"
                                onError={(e) => {
                                  ;(e.currentTarget as HTMLElement).style.display = 'none'
                                }}
                              />
                            ) : item.is_video ? (
                              <div className="storage-vid-preview-badge">
                                <Play size={16} />
                              </div>
                            ) : (
                              <Music size={18} />
                            )}
                          </div>

                          {/* File Details */}
                          <div className="storage-file-info">
                            <div className="storage-file-name-line">
                              <span className="storage-file-name" title={item.name}>
                                {fileName}
                              </span>
                              {item.is_video && (
                                <span className="storage-badge-video">Video</span>
                              )}
                              {isLarge && (
                                <span className="storage-badge-heavy">Tệp lớn</span>
                              )}
                            </div>

                            <div className="storage-file-meta-line">
                              <span className="storage-file-cat-pill">
                                {item.category_name}
                              </span>
                              <span className="storage-file-path-text" title={item.name}>
                                {item.name}
                              </span>
                              {item.created_at && (
                                <span className="storage-file-date">
                                  {fmtDateShort(item.created_at)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* File Size */}
                          <div className="storage-file-size-block">
                            <span
                              className={`storage-file-size ${isLarge ? 'storage-file-size--heavy' : ''}`}
                            >
                              {fmtBytes(item.size_bytes)}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="storage-file-actions">
                            <button
                              type="button"
                              className="storage-action-btn storage-action-btn--view"
                              onClick={() => setPreviewItem(item)}
                              title="Xem thử tệp"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button
                              type="button"
                              className="storage-action-btn storage-action-btn--delete"
                              onClick={() => setDeletingItem(item)}
                              title="Xóa tệp này để giải phóng dung lượng"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* SQL Migration Notice if RPC not found */}
              {rpcSupported === false && (
                <div className="storage-rpc-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      Mẹo: Để xem 100% dung lượng quét sâu từng byte của toàn bộ Supabase, hãy chạy hàm SQL tối ưu.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      className="storage-rpc-guide-btn"
                      onClick={() => setShowSqlGuide(!showSqlGuide)}
                    >
                      {showSqlGuide ? 'Ẩn câu lệnh SQL' : 'Xem câu lệnh SQL'}
                    </button>
                    <button
                      type="button"
                      className="storage-rpc-copy-btn"
                      onClick={handleCopySql}
                    >
                      {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedSql ? 'Đã sao chép' : 'Sao chép mã SQL'}</span>
                    </button>
                  </div>

                  {showSqlGuide && (
                    <div style={{ marginTop: 10 }}>
                      <pre className="storage-sql-code-block">{SQL_MIGRATION_SNIPPET}</pre>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'database' && (
            <div className="storage-database-tab">
              <div className="storage-section-title-bar">
                <span className="storage-section-heading">Dung lượng các bảng dữ liệu trong CSDL</span>
                <span className="storage-section-hint">Sắp xếp theo bảng tốn nhiều dung lượng nhất</span>
              </div>

              {tables.length === 0 ? (
                <div className="storage-empty-box">
                  <Database size={28} />
                  <span>
                    Chưa có thống kê bảng CSDL. Hãy chạy lệnh SQL nâng cao trong Supabase SQL Editor để bật tính năng này.
                  </span>
                  <button
                    type="button"
                    className="storage-rpc-copy-btn"
                    onClick={handleCopySql}
                    style={{ marginTop: 12 }}
                  >
                    {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                    <span>Sao chép mã SQL cài đặt</span>
                  </button>
                </div>
              ) : (
                <div className="storage-tables-grid">
                  {tables.map((t) => (
                    <div key={t.table_name} className="storage-table-card">
                      <div className="storage-table-header">
                        <span className="storage-table-name">{t.table_name}</span>
                        <span className="storage-table-total-size">{fmtBytes(t.total_bytes)}</span>
                      </div>
                      <div className="storage-table-body">
                        <span className="storage-table-sub">
                          <b>{t.row_count.toLocaleString('vi-VN')}</b> dòng dữ liệu
                        </span>
                        <span className="storage-table-sub">
                          Chỉ mục (Index): {fmtBytes(t.index_bytes)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Media Preview Modal */}
        {previewItem && (
          <div
            className="storage-preview-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewItem(null)
            }}
          >
            <div className="storage-preview-box">
              <div className="storage-preview-head">
                <span className="storage-preview-title" title={previewItem.name}>
                  {previewItem.name.split('/').pop()}
                </span>
                <button
                  type="button"
                  className="storage-btn-icon"
                  onClick={() => setPreviewItem(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="storage-preview-content">
                {previewItem.is_video ? (
                  <video
                    src={previewItem.public_url}
                    controls
                    autoPlay
                    playsInline
                    className="storage-preview-video-player"
                  />
                ) : previewItem.is_image ? (
                  <img
                    src={previewItem.public_url}
                    alt={previewItem.name}
                    className="storage-preview-img-full"
                  />
                ) : (
                  <div className="storage-preview-unsupported">
                    <Film size={40} />
                    <p>Không hỗ trợ phát trực tiếp định dạng này.</p>
                    <a
                      href={previewItem.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="storage-download-link"
                    >
                      Mở trong tab mới
                    </a>
                  </div>
                )}
              </div>

              <div className="storage-preview-footer">
                <span>Dung lượng: <b>{fmtBytes(previewItem.size_bytes)}</b></span>
                <span>Nơi lưu: <b>{previewItem.category_name}</b></span>
                <a
                  href={previewItem.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="storage-preview-open-link"
                >
                  <ExternalLink size={13} /> Mở tệp gốc
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingItem && (
          <div
            className="storage-confirm-overlay"
            onClick={() => !deletingBusy && setDeletingItem(null)}
          >
            <div className="storage-confirm-box" onClick={(e) => e.stopPropagation()}>
              <div className="storage-confirm-icon">
                <Trash2 size={24} />
              </div>
              <h3 className="storage-confirm-title">Xác nhận xóa tệp?</h3>
              <p className="storage-confirm-desc">
                Bạn có chắc chắn muốn xóa tệp{' '}
                <b style={{ color: 'var(--text-main)' }}>
                  {deletingItem.name.split('/').pop()}
                </b>
                ? Hành động này sẽ giải phóng{' '}
                <b style={{ color: '#ef4444' }}>
                  {fmtBytes(deletingItem.size_bytes)}
                </b>{' '}
                khỏi Supabase Storage và không thể hoàn tác.
              </p>
              <div className="storage-confirm-actions">
                <button
                  type="button"
                  className="storage-confirm-cancel"
                  disabled={deletingBusy}
                  onClick={() => setDeletingItem(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="storage-confirm-delete"
                  disabled={deletingBusy}
                  onClick={() => void confirmDelete()}
                >
                  {deletingBusy ? 'Đang xóa…' : 'Xóa vĩnh viễn'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
