import { useEffect, useMemo, useState } from 'react'
import {
  Play, Plus, Search, Video, RefreshCw, ExternalLink,
  ChevronRight, CheckCircle2, Circle, Clock, Check, Copy, Sparkles,
  Layers, User, Flame, Film, Download, AlertCircle, Share2, Link as LinkIcon,
  Loader2, Trash2, ListPlus
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import { extractPartInfo, extractSeriesName, normalizeSeriesKey, groupVideosIntoSeries } from '../../lib/tiktokSeries'
import { getRemoteAppSetting, saveAppSetting } from '../../lib/userAppSettings'
import './tiktok.css'

export type TikTokVideo = {
  id: string
  video_id: string
  series_key: string | null
  creator_id: string | null
  creator_name: string | null
  title: string
  canonical_url: string
  embed_url: string
  thumbnail: string | null
  duration: number | null
  part_number: number | null
  total_parts: number | null
  is_final: boolean
  published_at: string | null
}

export type TikTokSeries = {
  id: string
  series_key: string
  platform: string
  creator_id: string
  creator_name: string
  title: string
  movie_title: string | null
  status: 'COMPLETE' | 'IN_PROGRESS' | 'INCOMPLETE' | 'UNKNOWN' | 'SINGLE'
  found_parts: number
  cover?: string | null
  videos: TikTokVideo[]
}

export type TikTokCreator = {
  id: string
  platform: string
  creator_url: string
  creator_id: string | null
  creator_name: string | null
  videoCount: number
  seriesCount: number
  last_synced_at: string | null
}

const SAMPLE_TIKTOK_DATA: TikTokSeries[] = [
  {
    id: 's1',
    series_key: 'tiktok:reviewphim:squidgame',
    platform: 'tiktok',
    creator_id: 'reviewphim',
    creator_name: 'Review Phim Hay',
    title: 'Trò Chơi Con Mực (Squid Game)',
    movie_title: 'Trò Chơi Con Mực (Squid Game)',
    status: 'COMPLETE',
    found_parts: 5,
    cover: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80',
    videos: [
      {
        id: 'v1',
        video_id: '7123456789012345678',
        series_key: 'tiktok:reviewphim:squidgame',
        creator_id: 'reviewphim',
        creator_name: 'Review Phim Hay',
        title: 'Review Phim Trò Chơi Con Mực P1 - Trò chơi đầu tiên',
        canonical_url: 'https://www.tiktok.com/@reviewphim/video/7123456789012345678',
        embed_url: 'https://www.tiktok.com/embed/v2/7123456789012345678',
        thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80',
        duration: 180,
        part_number: 1,
        total_parts: 5,
        is_final: false,
        published_at: '2026-08-10T10:00:00Z',
      },
      {
        id: 'v2',
        video_id: '7123456789012345679',
        series_key: 'tiktok:reviewphim:squidgame',
        creator_id: 'reviewphim',
        creator_name: 'Review Phim Hay',
        title: 'Review Phim Trò Chơi Con Mực P2 - Tách kẹo đường',
        canonical_url: 'https://www.tiktok.com/@reviewphim/video/7123456789012345679',
        embed_url: 'https://www.tiktok.com/embed/v2/7123456789012345679',
        thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80',
        duration: 195,
        part_number: 2,
        total_parts: 5,
        is_final: false,
        published_at: '2026-08-11T10:00:00Z',
      },
      {
        id: 'v3',
        video_id: '7123456789012345680',
        series_key: 'tiktok:reviewphim:squidgame',
        creator_id: 'reviewphim',
        creator_name: 'Review Phim Hay',
        title: 'Review Phim Trò Chơi Con Mực Phần Cuối - Người chiến thắng',
        canonical_url: 'https://www.tiktok.com/@reviewphim/video/7123456789012345680',
        embed_url: 'https://www.tiktok.com/embed/v2/7123456789012345680',
        thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80',
        duration: 210,
        part_number: 3,
        total_parts: 5,
        is_final: true,
        published_at: '2026-08-12T10:00:00Z',
      },
    ],
  },
]

export function TikTokPage() {
  const { showToast } = useToast()
  const [viewMode, setViewMode] = useState<'series' | 'creators' | 'videos'>('series')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedCreator, setSelectedCreator] = useState<string>('ALL')

  const [seriesList, setSeriesList] = useState<TikTokSeries[]>([])
  const [creatorsList, setCreatorsList] = useState<TikTokCreator[]>([])

  const [loading, setLoading] = useState(true)

  // Player state
  const [activeVideo, setActiveVideo] = useState<TikTokVideo | null>(null)
  const [activeSeries, setActiveSeries] = useState<TikTokSeries | null>(null)
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('daily_tiktok_watched')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    let cancelled = false
    void getRemoteAppSetting<string[]>('tiktok_watched', []).then((remote) => {
      if (!cancelled && remote && remote.length > 0) {
        setWatchedIds((prev) => new Set([...prev, ...remote]))
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false)
  const [importTab, setImportTab] = useState<'paste_links' | 'crawl_channel' | 'ytdlp_json' | 'cli'>('paste_links')
  
  // Tab 1: Paste Links
  const [linksInput, setLinksInput] = useState('')
  const [creatorNameInput, setCreatorNameInput] = useState('')
  const [previewSeries, setPreviewSeries] = useState<any[]>([])

  // Tab 2: Channel URL
  const [channelUrlInput, setChannelUrlInput] = useState('')

  // Tab 3: JSON
  const [jsonInput, setJsonInput] = useState('')

  const [isImporting, setIsImporting] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)

  const toggleWatched = (videoId: string) => {
    setWatchedIds((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) next.delete(videoId)
      else next.add(videoId)
      const arr = [...next]
      try {
        localStorage.setItem('daily_tiktok_watched', JSON.stringify(arr))
        void saveAppSetting('tiktok_watched', arr)
      } catch (err) {
        console.warn(err)
      }
      return next
    })
  }

  const loadData = async () => {
    setLoading(true)
    try {
      if (!supabase) {
        setSeriesList(SAMPLE_TIKTOK_DATA)
        setLoading(false)
        return
      }

      // Fetch TikTok series & videos from database
      const [seriesRes, videosRes, creatorsRes] = await Promise.all([
        supabase.from('review_series').select('*').eq('platform', 'tiktok'),
        supabase.from('review_videos').select('*').eq('platform', 'tiktok'),
        supabase.from('review_creators').select('*').eq('platform', 'tiktok'),
      ])

      const rawSeries = seriesRes.data || []
      const rawVideos = (videosRes.data as TikTokVideo[]) || []
      const rawCreators = creatorsRes.data || []

      if (rawSeries.length === 0 && rawVideos.length === 0) {
        setSeriesList(SAMPLE_TIKTOK_DATA)
      } else {
        const videosBySeries = new Map<string, TikTokVideo[]>()
        for (const v of rawVideos) {
          const key = v.series_key || 'other'
          if (!videosBySeries.has(key)) videosBySeries.set(key, [])
          videosBySeries.get(key)!.push(v)
        }

        const assembledSeries: TikTokSeries[] = rawSeries.map((s) => {
          const sVideos = (videosBySeries.get(s.series_key) || []).sort((a, b) => {
            const pa = a.part_number !== null ? a.part_number : 9999
            const pb = b.part_number !== null ? b.part_number : 9999
            return pa - pb
          })
          return {
            ...s,
            cover: sVideos[0]?.thumbnail || null,
            videos: sVideos,
          }
        })

        setSeriesList(assembledSeries)
      }

      // Format creators
      const assembledCreators: TikTokCreator[] = rawCreators.map((c) => {
        const cSeries = seriesList.filter((s) => s.creator_id === c.creator_id || s.creator_name === c.creator_name)
        const cVideos = cSeries.flatMap((s) => s.videos)
        return {
          id: c.id,
          platform: 'tiktok',
          creator_url: c.creator_url,
          creator_id: c.creator_id,
          creator_name: c.creator_name || c.creator_url.split('@')[1]?.split('/')[0] || 'TikTok Creator',
          videoCount: cVideos.length,
          seriesCount: cSeries.length,
          last_synced_at: c.last_synced_at,
        }
      })
      setCreatorsList(assembledCreators)
    } catch (err) {
      console.error('Lỗi nạp TikTok:', err)
      setSeriesList(SAMPLE_TIKTOK_DATA)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // All individual videos
  const allVideos = useMemo(() => {
    return seriesList.flatMap((s) => s.videos)
  }, [seriesList])

  // Filtered Series
  const filteredSeries = useMemo(() => {
    return seriesList.filter((s) => {
      const matchSearch =
        !searchQuery ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.creator_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.videos.some((v) => v.title.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchCreator = selectedCreator === 'ALL' || s.creator_name === selectedCreator
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'COMPLETE' && s.status === 'COMPLETE') ||
        (statusFilter === 'IN_PROGRESS' && (s.status === 'IN_PROGRESS' || s.status === 'UNKNOWN'))

      return matchSearch && matchCreator && matchStatus
    })
  }, [seriesList, searchQuery, selectedCreator, statusFilter])

  // Real-time Regex Parser for pasted links/captions
  useEffect(() => {
    if (!linksInput.trim()) {
      setPreviewSeries([])
      return
    }

    const lines = linksInput.split('\n').filter((l) => l.trim().length > 0)
    const entries = lines.map((line, idx) => {
      const linkMatch = line.match(/(https?:\/\/[^\s]+)/)
      const url = linkMatch ? linkMatch[1] : `https://www.tiktok.com/@video/fake_${idx}`
      const videoId = url.split('/video/')[1]?.split('?')[0] || `local_${idx + 1}`
      const title = line.replace(url, '').replace(/[|\-_–—:;]+/g, ' ').trim() || `TikTok Video #${idx + 1}`

      return {
        id: videoId,
        title,
        url,
        thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600',
      }
    })

    const creatorName = creatorNameInput.trim() || 'TikTok Creator'
    const grouped = groupVideosIntoSeries(entries, {
      creator_id: creatorName,
      creator_name: creatorName,
      creator_url: `https://www.tiktok.com/@${creatorName}`,
    })
    setPreviewSeries(grouped)
  }, [linksInput, creatorNameInput])

  // Save Previewed Series to Supabase
  const handleSavePreviewSeries = async () => {
    if (previewSeries.length === 0) {
      showToast('⚠️ Không có series nào để lưu', 'delete')
      return
    }

    try {
      setIsImporting(true)
      const creatorName = creatorNameInput.trim() || 'TikTok Creator'
      const creatorInfo = {
        creator_id: creatorName,
        creator_name: creatorName,
        creator_url: `https://www.tiktok.com/@${creatorName}`,
      }

      if (supabase) {
        await supabase.from('review_creators').upsert({
          platform: 'tiktok',
          creator_url: creatorInfo.creator_url,
          creator_id: String(creatorInfo.creator_id),
          creator_name: creatorInfo.creator_name,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'platform,creator_url' })

        for (const s of previewSeries) {
          await supabase.from('review_series').upsert({
            series_key: s.series_key,
            platform: 'tiktok',
            creator_id: String(s.creator_id),
            creator_name: s.creator_name,
            title: s.title,
            movie_title: s.title,
            status: s.status === 'COMPLETE' ? 'COMPLETE' : 'UNKNOWN',
            found_parts: s.found_parts,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'series_key' })

          for (const v of s.videos) {
            await supabase.from('review_videos').upsert({
              platform: 'tiktok',
              video_id: v.video_id,
              series_key: s.series_key,
              creator_id: String(s.creator_id),
              creator_name: s.creator_name,
              title: v.title,
              canonical_url: v.url,
              embed_url: v.embed_url,
              thumbnail: v.thumbnail,
              duration: v.duration,
              part_number: v.part_number,
              total_parts: v.total_parts,
              is_final: v.is_final,
              last_seen_at: new Date().toISOString(),
            }, { onConflict: 'platform,video_id' })
          }
        }
      }

      showToast(`🎉 Đã gom & lưu ${previewSeries.length} bộ series thành công!`, 'supabase')
      setShowImportModal(false)
      setLinksInput('')
      setPreviewSeries([])
      await loadData()
    } catch (err: any) {
      showToast(`❌ Lỗi lưu dữ liệu: ${err.message}`, 'delete')
    } finally {
      setIsImporting(false)
    }
  }

  // Crawl Channel via API
  const handleCrawlChannel = async () => {
    if (!channelUrlInput.trim()) {
      showToast('⚠️ Vui lòng nhập link kênh TikTok (@username)', 'delete')
      return
    }

    try {
      setIsImporting(true)
      const res = await fetch('/api/crawl-tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'crawl_channel',
          channelUrl: channelUrlInput.trim(),
          saveToDb: true,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Cào kênh thất bại')
      }

      showToast(`🎉 Đã cào thành công ${data.total_series} series (${data.total_videos} video)!`, 'supabase')
      setShowImportModal(false)
      setChannelUrlInput('')
      await loadData()
    } catch (err: any) {
      showToast(`❌ ${err.message}`, 'delete')
    } finally {
      setIsImporting(false)
    }
  }

  // Handle JSON Import
  const handleImportJson = async () => {
    if (!jsonInput.trim()) {
      showToast('⚠️ Vui lòng dán nội dung JSON từ yt-dlp', 'delete')
      return
    }

    try {
      setIsImporting(true)
      const parsed = JSON.parse(jsonInput)
      const entries = Array.isArray(parsed) ? parsed : (parsed.entries || [parsed])
      const creatorName = parsed.uploader || parsed.channel || 'tiktok_user'
      const creatorInfo = {
        creator_id: parsed.uploader_id || parsed.channel_id || creatorName,
        creator_name: creatorName,
        creator_url: `https://www.tiktok.com/@${creatorName}`,
      }

      const grouped = groupVideosIntoSeries(entries, creatorInfo)

      if (supabase) {
        await supabase.from('review_creators').upsert({
          platform: 'tiktok',
          creator_url: creatorInfo.creator_url,
          creator_id: String(creatorInfo.creator_id),
          creator_name: creatorInfo.creator_name,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'platform,creator_url' })

        for (const s of grouped) {
          await supabase.from('review_series').upsert({
            series_key: s.series_key,
            platform: 'tiktok',
            creator_id: String(s.creator_id),
            creator_name: s.creator_name,
            title: s.title,
            movie_title: s.title,
            status: s.status === 'COMPLETE' ? 'COMPLETE' : 'UNKNOWN',
            found_parts: s.found_parts,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'series_key' })

          for (const v of s.videos) {
            await supabase.from('review_videos').upsert({
              platform: 'tiktok',
              video_id: v.video_id,
              series_key: s.series_key,
              creator_id: String(s.creator_id),
              creator_name: s.creator_name,
              title: v.title,
              canonical_url: v.url,
              embed_url: v.embed_url,
              thumbnail: v.thumbnail,
              duration: v.duration,
              part_number: v.part_number,
              total_parts: v.total_parts,
              is_final: v.is_final,
              last_seen_at: new Date().toISOString(),
            }, { onConflict: 'platform,video_id' })
          }
        }
      }

      showToast(`🎉 Đã nạp thành công ${grouped.length} series (${entries.length} video)!`, 'supabase')
      setShowImportModal(false)
      setJsonInput('')
      await loadData()
    } catch (err: any) {
      showToast(`❌ Lỗi phân tích JSON: ${err.message}`, 'delete')
    } finally {
      setIsImporting(false)
    }
  }

  const playVideoInSeries = (series: TikTokSeries, video: TikTokVideo) => {
    setActiveSeries(series)
    setActiveVideo(video)
  }

  const playNextVideo = () => {
    if (!activeSeries || !activeVideo) return
    const currentIndex = activeSeries.videos.findIndex((v) => v.video_id === activeVideo.video_id)
    if (currentIndex >= 0 && currentIndex < activeSeries.videos.length - 1) {
      setActiveVideo(activeSeries.videos[currentIndex + 1])
    }
  }

  const playPrevVideo = () => {
    if (!activeSeries || !activeVideo) return
    const currentIndex = activeSeries.videos.findIndex((v) => v.video_id === activeVideo.video_id)
    if (currentIndex > 0) {
      setActiveVideo(activeSeries.videos[currentIndex - 1])
    }
  }

  return (
    <div className="tiktok-page">
      {/* Hero Banner & Global Stats */}
      <section className="tiktok-hero">
        <div className="tiktok-hero-content">
          <h1>
            <Flame size={26} color="#fe2c55" />
            TikTok Series Hub
          </h1>
          <p>Cào và tự động gom phim & review TikTok theo series từng phần (P1, P2, P3...)</p>
        </div>

        <div className="tiktok-hero-stats">
          <div className="tiktok-stat-chip">
            <span className="val">{seriesList.length}</span>
            <span className="lbl">Series</span>
          </div>
          <div className="tiktok-stat-chip">
            <span className="val">{allVideos.length}</span>
            <span className="lbl">Videos</span>
          </div>
          <div className="tiktok-stat-chip">
            <span className="val">{watchedIds.size}</span>
            <span className="lbl">Đã xem</span>
          </div>
        </div>
      </section>

      {/* Control Bar & Actions */}
      <div className="tiktok-bar">
        <div className="tiktok-search-box">
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Tìm theo tên phim, series, creator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* View mode switcher */}
        <div className="tiktok-view-toggle">
          <button
            className={`tiktok-view-btn ${viewMode === 'series' ? 'active' : ''}`}
            onClick={() => setViewMode('series')}
          >
            <Film size={15} /> Theo Series
          </button>
          <button
            className={`tiktok-view-btn ${viewMode === 'videos' ? 'active' : ''}`}
            onClick={() => setViewMode('videos')}
          >
            <Video size={15} /> Toàn bộ Video
          </button>
          <button
            className={`tiktok-view-btn ${viewMode === 'creators' ? 'active' : ''}`}
            onClick={() => setViewMode('creators')}
          >
            <User size={15} /> Kênh
          </button>
        </div>

        {/* Action Buttons */}
        <button className="tiktok-btn primary" onClick={() => setShowImportModal(true)}>
          <Plus size={16} /> Cào / Paste Link
        </button>

        <button className="tiktok-btn" onClick={loadData} title="Tải lại dữ liệu">
          <RefreshCw size={15} className={loading ? 'tv-spin' : ''} />
        </button>
      </div>

      {/* VIEW 1: Theo Series (Phim gom nhóm) */}
      {viewMode === 'series' && (
        <div className="tiktok-series-grid">
          {filteredSeries.map((series) => {
            const hasWatchedAll = series.videos.every((v) => watchedIds.has(v.video_id))
            return (
              <div key={series.series_key} className="tiktok-series-card">
                <div
                  className="tiktok-series-cover"
                  onClick={() => series.videos[0] && playVideoInSeries(series, series.videos[0])}
                >
                  <img
                    src={series.cover || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80'}
                    alt={series.title}
                    loading="lazy"
                  />
                  <div className={`tiktok-series-badge ${series.status === 'COMPLETE' ? 'complete' : 'in-progress'}`}>
                    {series.status === 'COMPLETE' ? 'Đủ bộ' : 'Đang ra'}
                  </div>
                  <div className="tiktok-series-count">{series.videos.length} phần</div>
                </div>

                <div className="tiktok-series-body">
                  <h3 className="tiktok-series-title" title={series.title}>
                    {series.title}
                  </h3>

                  <div className="tiktok-series-meta">
                    <span className="tiktok-series-creator">@{series.creator_name}</span>
                    {hasWatchedAll && (
                      <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                        <CheckCircle2 size={13} /> Đã xem xong
                      </span>
                    )}
                  </div>

                  {/* Horizontal pill list of episodes */}
                  <div className="tiktok-parts-strip">
                    {series.videos.map((vid) => {
                      const isWatched = watchedIds.has(vid.video_id)
                      return (
                        <button
                          key={vid.video_id}
                          className={`tiktok-part-pill ${isWatched ? 'is-watched' : ''}`}
                          onClick={() => playVideoInSeries(series, vid)}
                          title={vid.title}
                        >
                          <Play size={10} fill="currentColor" />
                          {vid.part_number ? `P${vid.part_number}` : 'Tập'}
                          {vid.is_final && ' 🏁'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VIEW 2: Toàn bộ Video */}
      {viewMode === 'videos' && (
        <div className="tiktok-video-grid">
          {allVideos.map((vid) => {
            const isWatched = watchedIds.has(vid.video_id)
            const parentSeries = seriesList.find((s) => s.series_key === vid.series_key)
            return (
              <div
                key={vid.video_id}
                className="tiktok-video-card"
                onClick={() => parentSeries && playVideoInSeries(parentSeries, vid)}
              >
                <div className="tiktok-video-thumb">
                  <img
                    src={vid.thumbnail || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=80'}
                    alt={vid.title}
                    loading="lazy"
                  />
                  {vid.part_number && (
                    <div className="tiktok-video-part-tag">Phần {vid.part_number}</div>
                  )}
                  <div className="tiktok-video-play-btn">
                    <Play size={20} fill="currentColor" />
                  </div>
                </div>
                <div className="tiktok-video-info">
                  <p className="tiktok-video-caption">{vid.title}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>@{vid.creator_name}</span>
                    {isWatched && <span style={{ color: '#10b981' }}>✓ Đã xem</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VIEW 3: Kênh TikTok (Creators) */}
      {viewMode === 'creators' && (
        <div className="tiktok-creator-grid">
          {creatorsList.map((creator) => (
            <div key={creator.creator_url} className="tiktok-creator-card">
              <div className="tiktok-creator-avatar">
                {creator.creator_name?.[0]?.toUpperCase() || 'T'}
              </div>
              <div className="tiktok-creator-details">
                <h4 className="tiktok-creator-name">@{creator.creator_name}</h4>
                <span className="tiktok-creator-sub">{creator.seriesCount} series • {creator.videoCount} video</span>
                <a
                  href={creator.creator_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.75rem', color: '#fe2c55', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}
                >
                  Xem trên TikTok <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {activeVideo && activeSeries && (
        <Modal
          title={`🎬 ${activeSeries.title} ${activeVideo.part_number ? `— Phần ${activeVideo.part_number}` : ''}`}
          onClose={() => setActiveVideo(null)}
        >
          <div className="tiktok-player-modal">
            <iframe
              src={activeVideo.embed_url}
              className="tiktok-player-frame"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={activeVideo.title}
            />

            <div className="tiktok-player-controls">
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="tiktok-btn"
                  onClick={playPrevVideo}
                  disabled={activeSeries.videos.findIndex((v) => v.video_id === activeVideo.video_id) === 0}
                >
                  ← Tập trước
                </button>
                <button
                  className="tiktok-btn primary"
                  onClick={playNextVideo}
                  disabled={activeSeries.videos.findIndex((v) => v.video_id === activeVideo.video_id) === activeSeries.videos.length - 1}
                >
                  Tập tiếp theo →
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`tiktok-btn ${watchedIds.has(activeVideo.video_id) ? 'primary' : ''}`}
                  onClick={() => toggleWatched(activeVideo.video_id)}
                >
                  <Check size={16} />
                  {watchedIds.has(activeVideo.video_id) ? 'Đã xem' : 'Đánh dấu đã xem'}
                </button>
                <a
                  href={activeVideo.canonical_url}
                  target="_blank"
                  rel="noreferrer"
                  className="tiktok-btn"
                >
                  <ExternalLink size={15} /> Mở TikTok
                </a>
              </div>
            </div>

            {/* Series episode selector in player */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
                Tất cả các phần trong bộ ({activeSeries.videos.length} tập):
              </div>
              <div className="tiktok-parts-strip">
                {activeSeries.videos.map((v) => (
                  <button
                    key={v.video_id}
                    className={`tiktok-part-pill ${v.video_id === activeVideo.video_id ? 'is-active' : ''}`}
                    onClick={() => setActiveVideo(v)}
                  >
                    {v.part_number ? `Phần ${v.part_number}` : 'Tập'}
                    {v.is_final && ' 🏁'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Cào & Nhập Video Modal */}
      {showImportModal && (
        <Modal title="⚡ Cào & Nhập Video TikTok Trên Giao Diện" onClose={() => setShowImportModal(false)}>
          <div>
            <div className="tiktok-import-tabs">
              <button
                className={`tiktok-import-tab ${importTab === 'paste_links' ? 'active' : ''}`}
                onClick={() => setImportTab('paste_links')}
              >
                1. 🔗 Dán Link Trực Tiếp (UI)
              </button>
              <button
                className={`tiktok-import-tab ${importTab === 'crawl_channel' ? 'active' : ''}`}
                onClick={() => setImportTab('crawl_channel')}
              >
                2. 🌐 Cào Tự Động Kênh
              </button>
              <button
                className={`tiktok-import-tab ${importTab === 'ytdlp_json' ? 'active' : ''}`}
                onClick={() => setImportTab('ytdlp_json')}
              >
                3. 📋 Dán JSON yt-dlp
              </button>
              <button
                className={`tiktok-import-tab ${importTab === 'cli' ? 'active' : ''}`}
                onClick={() => setImportTab('cli')}
              >
                4. 💻 CLI Terminal
              </button>
            </div>

            {/* TAB 1: PASTE LINKS DIRECTLY ON UI */}
            {importTab === 'paste_links' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Dán danh sách caption kèm link TikTok (mỗi dòng một video). Hệ thống tự nhận diện tên phim, số phần (P1, P2, P3...) và hiển thị preview ngay:
                </p>

                <input
                  type="text"
                  placeholder="Tên kênh / Creator (vd: Review Phim Hay)"
                  value={creatorNameInput}
                  onChange={(e) => setCreatorNameInput(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                />

                <textarea
                  className="tiktok-textarea"
                  placeholder={`Review Phim Avatar P1 https://www.tiktok.com/@creator/video/712345678901\nReview Phim Avatar P2 https://www.tiktok.com/@creator/video/712345678902\nReview Phim Avatar Phần Cuối https://www.tiktok.com/@creator/video/712345678903\nReview Phim Titanic Tập 1 https://www.tiktok.com/@creator/video/712345678904`}
                  value={linksInput}
                  onChange={(e) => setLinksInput(e.target.value)}
                  style={{ minHeight: 140 }}
                />

                {/* LIVE PREVIEW TABLE */}
                {previewSeries.length > 0 && (
                  <div style={{ border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 14px', background: 'var(--bg-main)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fe2c55', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={16} /> Nhận diện được {previewSeries.length} bộ Series:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {previewSeries.map((s, idx) => (
                        <div key={idx} style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '6px 12px', borderRadius: 8 }}>
                          <span style={{ fontWeight: 700 }}>🎬 {s.title}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {s.videos.length} tập ({s.videos.map((v: any) => v.part_number ? `P${v.part_number}` : 'Tập').join(', ')})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  className="tiktok-btn primary"
                  onClick={handleSavePreviewSeries}
                  disabled={isImporting || previewSeries.length === 0}
                  style={{ alignSelf: 'flex-end' }}
                >
                  {isImporting ? <Loader2 size={16} className="tv-spin" /> : <ListPlus size={16} />}
                  {isImporting ? 'Đang lưu vào hệ thống...' : `Lưu & Gom ${previewSeries.length} Series`}
                </button>
              </div>
            )}

            {/* TAB 2: CRAWL CHANNEL AUTOMATICALLY */}
            {importTab === 'crawl_channel' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Nhập link kênh TikTok hoặc `@username`. Server sẽ tự động cào toàn bộ video và gom thành series:
                </p>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="https://www.tiktok.com/@reviewphimhay hoặc @reviewphimhay"
                    value={channelUrlInput}
                    onChange={(e) => setChannelUrlInput(e.target.value)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '0.88rem' }}
                  />
                  <button
                    className="tiktok-btn primary"
                    onClick={handleCrawlChannel}
                    disabled={isImporting || !channelUrlInput.trim()}
                  >
                    {isImporting ? <Loader2 size={16} className="tv-spin" /> : <RefreshCw size={16} />}
                    {isImporting ? 'Đang cào...' : '⚡ Cào Kênh Ngay'}
                  </button>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6, background: 'var(--bg-main)', padding: 12, borderRadius: 10 }}>
                  💡 <strong>Lưu ý:</strong> Quá trình cào toàn bộ video của kênh có thể mất từ 5 - 30 giây tùy theo số lượng video của kênh.
                </div>
              </div>
            )}

            {/* TAB 3: JSON FROM YT-DLP */}
            {importTab === 'ytdlp_json' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Chạy lệnh xuất file JSON trên máy rồi dán toàn bộ nội dung JSON vào ô bên dưới:
                </p>
                <div className="tiktok-code-block">
                  <code>yt-dlp --flat-playlist -J "https://www.tiktok.com/@username" &gt; channel.json</code>
                  <button
                    className="tiktok-btn"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText('yt-dlp --flat-playlist -J "https://www.tiktok.com/@username" > channel.json')
                      setCopiedCmd(true)
                      setTimeout(() => setCopiedCmd(false), 2000)
                    }}
                  >
                    {copiedCmd ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>

                <textarea
                  className="tiktok-textarea"
                  placeholder="Dán nội dung JSON từ file channel.json vào đây..."
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />

                <button
                  className="tiktok-btn primary"
                  onClick={handleImportJson}
                  disabled={isImporting || !jsonInput.trim()}
                  style={{ alignSelf: 'flex-end' }}
                >
                  {isImporting ? 'Đang nạp...' : '🚀 Gom Series & Lưu vào Database'}
                </button>
              </div>
            )}

            {/* TAB 4: CLI INSTRUCTIONS */}
            {importTab === 'cli' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.85rem' }}>
                <p style={{ margin: 0 }}>
                  Bạn có thể chạy trực tiếp pipeline cào & gom series TikTok tự động trong terminal của dự án:
                </p>
                <div>
                  <strong>Node.js (Khuyên dùng):</strong>
                  <div className="tiktok-code-block" style={{ marginTop: 6 }}>
                    <code>node crawl_tiktok.mjs --channel https://www.tiktok.com/@username --supabase</code>
                  </div>
                </div>

                <div>
                  <strong>Python:</strong>
                  <div className="tiktok-code-block" style={{ marginTop: 6 }}>
                    <code>python crawl_tiktok.py --channel https://www.tiktok.com/@username --supabase</code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
