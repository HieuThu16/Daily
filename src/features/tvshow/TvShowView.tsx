import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Circle, CornerDownLeft, ExternalLink, Film, Pause, Play, Plus, Radio, Search, SkipBack, SkipForward, Trash2, Tv, Video } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchYouTubeMeta, youtubeVideoId } from '../../lib/youtubeMeta'
import { Modal } from '../shared'
import './tvShow.css'

const MISSING_TABLE_CODES = ['42P01', 'PGRST205']

type ChannelItem = {
  id: string
  platform: string
  creator_url: string
  creator_name: string
  creator_id: string | null
  videoCount: number
  watchedCount: number
  cover: string | null
  lastSyncedAt: string | null
}

type VideoRow = {
  id: string
  video_id: string
  series_key: string | null
  creator_id: string | null
  creator_name: string | null
  title: string
  canonical_url: string
  embed_url: string
  thumbnail: string | null
  part_number: number | null
  published_at: string | null
  unavailable_at: string | null
}

export type ParsedVideo = { videoId: string; url: string }

export function parseVideoLinks(text: string) {
  const seen = new Set<string>()
  const valid: ParsedVideo[] = []
  const invalid: string[] = []

  for (const raw of text.split(/[\n,\s]+/)) {
    const line = raw.trim()
    if (!line) continue
    const videoId = youtubeVideoId(line)
    if (!videoId) {
      invalid.push(line)
      continue
    }
    if (seen.has(videoId)) continue
    seen.add(videoId)
    valid.push({ videoId, url: `https://www.youtube.com/watch?v=${videoId}` })
  }

  return { valid, invalid }
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Tab TV Show: 1 Kênh = 1 Card.
 * Gộp toàn bộ video của kênh vào trong card đó, bấm vào xem toàn bộ video.
 */
export function TvShowView() {
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null)
  const [addChannelOpen, setAddChannelOpen] = useState(false)
  const [addVideoOpen, setAddVideoOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Tải danh sách Kênh (1 kênh = 1 card) kèm thống kê video & tiến độ đã xem
  useEffect(() => {
    let alive = true
    setLoading(true)

    void (async () => {
      // 1. Lấy danh sách creators
      const creatorsRes = await supabase
        ?.from('tvshow_creators')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (creatorsRes?.error && MISSING_TABLE_CODES.includes(creatorsRes.error.code ?? '')) {
        if (alive) {
          setNeedsMigration(true)
          setLoading(false)
        }
        return
      }

      const creators = (creatorsRes?.data ?? []) as any[]

      // 2. Lấy danh sách video để tính số lượng, thumbnail và tiến độ cho từng kênh
      const [videosRes, watchedRes] = await Promise.all([
        supabase
          ?.from('tvshow_videos')
          .select('video_id,creator_id,creator_name,thumbnail,published_at')
          .is('unavailable_at', null)
          .order('published_at', { ascending: false }),
        supabase?.from('tvshow_watched').select('video_id'),
      ])

      const allVideos = (videosRes?.data ?? []) as any[]
      const watchedIds = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((w) => w.video_id))

      // Gom video theo creator
      const statsByCreator = new Map<string, { total: number; watched: number; cover: string | null }>()

      for (const v of allVideos) {
        const key = v.creator_id || v.creator_name || 'manual'
        const stat = statsByCreator.get(key) ?? { total: 0, watched: 0, cover: null }
        stat.total += 1
        if (watchedIds.has(v.video_id)) stat.watched += 1
        if (!stat.cover && v.thumbnail) stat.cover = v.thumbnail
        statsByCreator.set(key, stat)
      }

      // Xây dựng danh sách Channel Cards
      const channelCards: ChannelItem[] = creators.map((c) => {
        const key = c.creator_id || c.creator_name || c.id
        const stat = statsByCreator.get(key) || statsByCreator.get(c.creator_name) || { total: 0, watched: 0, cover: null }
        return {
          id: c.id,
          platform: c.platform,
          creator_url: c.creator_url,
          creator_name: c.creator_name || 'Kênh YouTube',
          creator_id: c.creator_id,
          videoCount: stat.total,
          watchedCount: stat.watched,
          cover: stat.cover,
          lastSyncedAt: c.last_synced_at,
        }
      })

      // Nếu có video tự thêm mà không thuộc creator nào trong danh sách
      const manualStat = statsByCreator.get('manual')
      if (manualStat && manualStat.total > 0 && !creators.some((c) => c.creator_id === 'manual')) {
        channelCards.push({
          id: 'manual',
          platform: 'youtube',
          creator_url: '',
          creator_name: 'Video tự thêm',
          creator_id: 'manual',
          videoCount: manualStat.total,
          watchedCount: manualStat.watched,
          cover: manualStat.cover,
          lastSyncedAt: null,
        })
      }

      if (alive) {
        setChannels(channelCards)
        setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [reloadKey])

  const filteredChannels = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return channels
    return channels.filter((c) => c.creator_name.toLowerCase().includes(q))
  }, [channels, search])

  const deleteChannel = async (channel: ChannelItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Xoá kênh "${channel.creator_name}" cùng toàn bộ video của kênh này?`)) return
    setLoading(true)

    if (channel.id !== 'manual') {
      await supabase?.from('tvshow_creators').delete().eq('id', channel.id)
    }

    if (channel.creator_id) {
      await supabase?.from('tvshow_videos').delete().eq('creator_id', channel.creator_id)
      await supabase?.from('tvshow_series').delete().eq('creator_id', channel.creator_id)
    } else {
      await supabase?.from('tvshow_videos').delete().eq('creator_name', channel.creator_name)
      await supabase?.from('tvshow_series').delete().eq('creator_name', channel.creator_name)
    }

    setReloadKey((k) => k + 1)
  }

  // Nếu đang mở chi tiết 1 kênh
  if (selectedChannel) {
    return (
      <ChannelDetailView
        channel={selectedChannel}
        onBack={() => {
          setSelectedChannel(null)
          setReloadKey((k) => k + 1)
        }}
      />
    )
  }

  return (
    <section className="tv-page">
      {/* Toolbar */}
      <div className="tv-bar">
        <div className="tv-search-box">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            className="tv-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm kênh YouTube…"
          />
        </div>
        <button className="tv-btn primary" onClick={() => setAddChannelOpen(true)}>
          <Radio size={14} /> Thêm kênh
        </button>
        <button className="tv-btn" onClick={() => setAddVideoOpen(true)}>
          <Plus size={14} /> Thêm video lẻ
        </button>
      </div>

      {needsMigration ? (
        <div className="tv-empty">
          Chưa có bảng TV Show trên Supabase. Chạy migration <code>20260915000000_tvshow_channels.sql</code> trên SQL Editor rồi tải lại trang.
        </div>
      ) : loading ? (
        <div className="tv-empty">Đang tải danh sách kênh…</div>
      ) : !filteredChannels.length ? (
        <div className="tv-empty">
          {search
            ? `Không tìm thấy kênh nào khớp “${search}”.`
            : 'Chưa có kênh nào. Bấm “Thêm kênh” rồi dán link YouTube để cào toàn bộ video về.'}
        </div>
      ) : (
        <div className="tv-channel-grid">
          {filteredChannels.map((c) => {
            const isDone = c.videoCount > 0 && c.watchedCount >= c.videoCount
            const percent = c.videoCount > 0 ? Math.round((c.watchedCount / c.videoCount) * 100) : 0

            return (
              <div
                key={c.id}
                className="tv-channel-card"
                onClick={() => setSelectedChannel(c)}
              >
                <div className="tv-channel-cover">
                  {c.cover ? (
                    <img src={c.cover} alt={c.creator_name} loading="lazy" />
                  ) : (
                    <div className="tv-channel-cover-empty">
                      <Tv size={36} />
                    </div>
                  )}

                  <span className="tv-badge-live">
                    <Radio size={11} /> KÊNH
                  </span>

                  <span className="tv-count-pill">
                    {c.videoCount} video
                  </span>

                  {c.watchedCount > 0 && (
                    <span className={`tv-seen-pill${isDone ? ' done' : ''}`}>
                      {isDone ? 'Đã xem hết' : `Đã xem ${c.watchedCount}/${c.videoCount}`}
                    </span>
                  )}
                </div>

                <div className="tv-channel-body">
                  <div className="tv-channel-header">
                    <div className="tv-channel-title">{c.creator_name}</div>
                    <button
                      className="tv-btn"
                      style={{ padding: '4px 6px', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
                      onClick={(e) => void deleteChannel(c, e)}
                      title="Xoá kênh này"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <span className="tv-channel-sub">
                    {c.videoCount > 0 ? `Tổng cộng ${c.videoCount} video` : 'Chưa có video'}
                  </span>

                  {c.videoCount > 0 && (
                    <div className="tv-channel-progress">
                      <div className="tv-channel-progress-head">
                        <span>Tiến độ xem</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="tv-channel-progress-bar">
                        <div
                          className="tv-channel-progress-fill"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {addChannelOpen && (
        <AddTvShowChannelModal
          onClose={() => setAddChannelOpen(false)}
          onSynced={() => setReloadKey((k) => k + 1)}
        />
      )}

      {addVideoOpen && (
        <AddTvShowMovieModal
          onClose={() => setAddVideoOpen(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </section>
  )
}

/**
 * Màn hình xem chi tiết 1 Kênh (Gộp toàn bộ video của kênh vào đây).
 * Thiết kế giao diện khớp chuẩn mẫu (Image 2) của người dùng.
 */
function ChannelDetailView({
  channel,
  onBack,
}: {
  channel: ChannelItem
  onBack: () => void
}) {
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [autoplay, setAutoplay] = useState(false)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unwatched' | 'watched'>('all')

  useEffect(() => {
    void (async () => {
      let query = supabase
        ?.from('tvshow_videos')
        .select('id,video_id,series_key,creator_id,creator_name,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at')
        .is('unavailable_at', null)

      if (channel.id === 'manual') {
        query = query?.eq('creator_id', 'manual')
      } else if (channel.creator_id) {
        query = query?.or(`creator_id.eq.${channel.creator_id},creator_name.eq.${channel.creator_name}`)
      } else {
        query = query?.eq('creator_name', channel.creator_name)
      }

      const [videoRes, watchedRes] = await Promise.all([
        query?.order('part_number', { ascending: true, nullsFirst: false }).order('published_at', { ascending: false }),
        supabase?.from('tvshow_watched').select('video_id'),
      ])

      const rows = (videoRes?.data ?? []) as VideoRow[]
      setVideos(rows)

      const watchedSet = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((r) => r.video_id))
      setWatched(watchedSet)

      // Mặc định phát video chưa xem đầu tiên
      const firstUnwatched = rows.find((r) => !watchedSet.has(r.video_id))
      setPlayingId(firstUnwatched ? firstUnwatched.video_id : rows[0]?.video_id ?? null)
      setLoading(false)
    })()
  }, [channel])

  const filteredVideos = useMemo(() => {
    let result = videos
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((v) => v.title.toLowerCase().includes(q))
    }
    if (filterMode === 'unwatched') {
      result = result.filter((v) => !watched.has(v.video_id))
    } else if (filterMode === 'watched') {
      result = result.filter((v) => watched.has(v.video_id))
    }
    return result
  }, [videos, search, filterMode, watched])

  const currentIndex = filteredVideos.findIndex((v) => v.video_id === playingId)
  const currentVideo = currentIndex >= 0 ? filteredVideos[currentIndex] : filteredVideos[0]

  const toggleWatched = async (videoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const isWatched = watched.has(videoId)
    const next = new Set(watched)
    if (isWatched) {
      next.delete(videoId)
      setWatched(next)
      await supabase?.from('tvshow_watched').delete().eq('platform', 'youtube').eq('video_id', videoId)
    } else {
      next.add(videoId)
      setWatched(next)
      await supabase?.from('tvshow_watched').upsert({
        platform: 'youtube',
        video_id: videoId,
        watched_at: new Date().toISOString(),
      })
    }
  }

  const nextVideo = () => {
    if (currentIndex < filteredVideos.length - 1) {
      setPlayingId(filteredVideos[currentIndex + 1].video_id)
    }
  }

  const prevVideo = () => {
    if (currentIndex > 0) {
      setPlayingId(filteredVideos[currentIndex - 1].video_id)
    }
  }

  const watchedCountInChannel = useMemo(() => {
    return videos.filter((v) => watched.has(v.video_id)).length
  }, [videos, watched])

  return (
    <div className="tv-detail">
      {/* Top Header */}
      <div className="tv-detail-bar">
        <button className="tv-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Danh sách kênh
        </button>
        <div className="tv-detail-title-wrap">
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
            📺 {channel.creator_name}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            ({videos.length} video)
          </span>
        </div>
      </div>

      {loading ? (
        <div className="tv-empty">Đang tải video…</div>
      ) : !videos.length ? (
        <div className="tv-empty">Kênh này chưa có video nào.</div>
      ) : (
        <div className="tv-detail-layout">
          {/* Cột trái: Trình phát YouTube */}
          <div className="tv-player-box">
            <div className="tv-player-frame">
              {currentVideo ? (
                <iframe
                  src={`${currentVideo.embed_url}?autoplay=${autoplay ? 1 : 0}&rel=0`}
                  title={currentVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="tv-channel-cover-empty">Chọn một video để phát</div>
              )}
            </div>

            {currentVideo && (
              <div className="tv-player-info">
                <div className="tv-player-title">{currentVideo.title}</div>
                <div className="tv-player-actions">
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className="tv-btn"
                      onClick={prevVideo}
                      disabled={currentIndex <= 0}
                      title="Video trước"
                    >
                      <SkipBack size={13} />
                    </button>
                    <button
                      className="tv-btn"
                      onClick={nextVideo}
                      disabled={currentIndex >= filteredVideos.length - 1}
                      title="Video tiếp theo"
                    >
                      <SkipForward size={13} />
                    </button>
                    <button
                      className={`tv-btn ${watched.has(currentVideo.video_id) ? 'primary' : ''}`}
                      onClick={() => void toggleWatched(currentVideo.video_id)}
                    >
                      {watched.has(currentVideo.video_id) ? (
                        <>
                          <CheckCircle2 size={14} /> Đã xem
                        </>
                      ) : (
                        <>
                          <Circle size={14} /> Đánh dấu đã xem
                        </>
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={autoplay}
                        onChange={(e) => setAutoplay(e.target.checked)}
                      />
                      Tự phát tiếp
                    </label>
                    <a
                      href={currentVideo.canonical_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tv-btn"
                      title="Mở trên YouTube"
                    >
                      <ExternalLink size={13} /> YouTube
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cột phải: Danh sách video (Khớp 100% style Image 2) */}
          <div className="tv-episodes-box">
            {/* Header: Danh sách video (X) | Đã xem Y/X */}
            <div className="tv-episodes-head">
              <span className="tv-episodes-head-title">
                Danh sách video ({filteredVideos.length})
              </span>
              <span className="tv-episodes-head-stat">
                Đã xem {watchedCountInChannel}/{videos.length}
              </span>
            </div>

            {/* Ô tìm kiếm & lọc */}
            <input
              className="tv-ep-search"
              placeholder="Tìm video trong kênh…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="tv-ep-filters">
              <button
                className={`tv-ep-filter-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                Tất cả ({videos.length})
              </button>
              <button
                className={`tv-ep-filter-btn ${filterMode === 'unwatched' ? 'active' : ''}`}
                onClick={() => setFilterMode('unwatched')}
              >
                Chưa xem ({videos.length - watchedCountInChannel})
              </button>
              <button
                className={`tv-ep-filter-btn ${filterMode === 'watched' ? 'active' : ''}`}
                onClick={() => setFilterMode('watched')}
              >
                Đã xem ({watchedCountInChannel})
              </button>
            </div>

            {/* List các item video */}
            <div className="tv-episodes-list">
              {filteredVideos.map((v, i) => {
                const isPlaying = v.video_id === playingId
                const isWatched = watched.has(v.video_id)
                return (
                  <div
                    key={v.video_id}
                    className={`tv-episode-item ${isPlaying ? 'playing' : ''}`}
                    onClick={() => setPlayingId(v.video_id)}
                  >
                    <img
                      src={v.thumbnail || `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`}
                      alt=""
                      className="tv-ep-thumb"
                      loading="lazy"
                    />
                    <div className="tv-ep-text">
                      <span className="tv-ep-name">
                        #{i + 1}. {v.title}
                      </span>
                    </div>
                    <button
                      className={`tv-ep-watch-btn ${isWatched ? 'watched' : ''}`}
                      onClick={(e) => void toggleWatched(v.video_id, e)}
                      title={isWatched ? 'Đánh dấu chưa xem' : 'Đánh dấu đã xem'}
                    >
                      {isWatched ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Modal cào kênh YouTube */
function AddTvShowChannelModal({ onClose, onSynced }: { onClose: () => void; onSynced: () => void }) {
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [rows, setRows] = useState<{ url: string; status: 'chờ' | 'đang chạy' | 'xong' | 'lỗi' | 'dừng'; note: string }[]>([])
  const stopRef = useRef(false)

  const post = async (body: any) => {
    const res = await fetch('/api/sync-tvshow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
    return json
  }

  const isChannelUrl = (raw: string) => {
    try {
      const u = new URL(raw.trim())
      const host = u.hostname.replace(/^www\./, '')
      return host === 'youtube.com' || host.endsWith('.youtube.com')
    } catch {
      return false
    }
  }

  const urls = useMemo(
    () => [...new Set(text.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean))],
    [text],
  )
  const valid = useMemo(() => urls.filter(isChannelUrl), [urls])
  const invalid = useMemo(() => urls.filter((u) => !isChannelUrl(u)), [urls])

  const runChannel = async (url: string, at: number) => {
    const { plan } = await post({ action: 'plan', creatorUrl: url })
    let saved = 0
    let pages = 0

    for (let entryIndex = 0; entryIndex < plan.entries.length; entryIndex++) {
      const entry = plan.entries[entryIndex]
      let pageToken: string | undefined

      do {
        if (stopRef.current) return { saved, pages, stopped: true }

        const { outcome } = await post({ action: 'page', plan, cursor: { entryIndex, pageToken } })
        saved += outcome.saved
        pages++

        setProgress({ done: pages, total: Math.max(plan.totalPages, pages), label: entry.name })
        setRows((prev) =>
          prev.map((r, k) => (k === at ? { ...r, note: `${plan.channelName} — đã lưu ${saved} video mới` } : r)),
        )
        if (outcome.saved > 0) onSynced()

        if (entry.isUploads && outcome.allKnown && pages > 1) break

        pageToken = outcome.nextPageToken
      } while (pageToken)
    }

    await post({ action: 'finish', creatorUrl: url, saved, pages })
    return { saved, pages, stopped: false }
  }

  const run = async () => {
    stopRef.current = false
    setRunning(true)
    setRows(valid.map((url) => ({ url, status: 'chờ', note: '' })))

    for (let i = 0; i < valid.length; i++) {
      if (stopRef.current) {
        setRows((prev) => prev.map((r, k) => (k >= i ? { ...r, status: 'dừng' } : r)))
        break
      }
      setRows((prev) => prev.map((r, k) => (k === i ? { ...r, status: 'đang chạy' } : r)))
      try {
        const { saved, stopped } = await runChannel(valid[i], i)
        setRows((prev) =>
          prev.map((r, k) =>
            k === i ? { ...r, status: stopped ? 'dừng' : 'xong', note: `đã lưu ${saved} video mới` } : r,
          ),
        )
      } catch (error: any) {
        setRows((prev) =>
          prev.map((r, k) => (k === i ? { ...r, status: 'lỗi', note: String(error?.message ?? error) } : r)),
        )
      }
    }

    setProgress(null)
    setRunning(false)
    onSynced()
  }

  return (
    <Modal title="📡 Thêm kênh YouTube" onClose={onClose}>
      <textarea
        className="tv-links-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={running}
        placeholder={'Dán link kênh, mỗi dòng một kênh:\nhttps://www.youtube.com/@web5ngay\nhttps://www.youtube.com/@tri_ky_cam_xuc'}
      />

      <div className="tv-hint">
        Nhận được <strong>{valid.length}</strong> link kênh. Server sẽ cào toàn bộ video & playlist của kênh và gom thành một thẻ Kênh.
        {invalid.length > 0 && (
          <>
            {' '}
            <span className="tv-bad">{invalid.length} dòng không phải link kênh YouTube:</span> {invalid.slice(0, 3).join(', ')}
            {invalid.length > 3 ? '…' : ''}
          </>
        )}
      </div>

      {progress && (
        <div className="tv-progress-box">
          <div className="tv-progress-head">
            <span>{progress.label}</span>
            <span>
              trang {progress.done}/{progress.total}
            </span>
          </div>
          <div className="tv-progress-track">
            <div
              className="tv-progress-fill"
              style={{ width: `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="tv-order">
          {rows.map((r) => (
            <div key={r.url} className="tv-order-row">
              <span className={`tv-run-${r.status === 'lỗi' ? 'bad' : r.status === 'xong' ? 'ok' : 'wait'}`}>
                {r.status}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {r.url}
                {r.note && ` · ${r.note}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="tv-btn" onClick={onClose} disabled={running}>
          Đóng
        </button>
        {running ? (
          <button className="tv-btn" onClick={() => (stopRef.current = true)}>
            <Pause size={13} /> Tạm dừng
          </button>
        ) : (
          <button className="tv-btn primary" onClick={() => void run()} disabled={!valid.length}>
            {rows.some((r) => r.status === 'dừng') ? 'Chạy tiếp' : `Tải ${valid.length} kênh`}
          </button>
        )}
      </div>
    </Modal>
  )
}

type DraftPart = ParsedVideo & { title: string; thumbnail: string }

/** Modal thêm video lẻ */
function AddTvShowMovieModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<'paste' | 'order'>('paste')
  const [text, setText] = useState('')
  const [movie, setMovie] = useState('')
  const [parts, setParts] = useState<DraftPart[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boxRef = useRef<HTMLTextAreaElement>(null)
  const { valid, invalid } = useMemo(() => parseVideoLinks(text), [text])

  const insertNewline = () => {
    const box = boxRef.current
    const at = box?.selectionStart ?? text.length
    const end = box?.selectionEnd ?? at
    setText(text.slice(0, at) + '\n' + text.slice(end))
    requestAnimationFrame(() => {
      box?.focus()
      box?.setSelectionRange(at + 1, at + 1)
    })
  }

  const loadTitles = async () => {
    setBusy(true)
    const metas = await Promise.all(valid.map((v) => fetchYouTubeMeta(v.url)))
    const drafts: DraftPart[] = valid.map((v, i) => ({
      ...v,
      title: metas[i]?.title ?? `Video ${i + 1}`,
      thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    }))
    setParts(drafts)
    if (!movie.trim() && drafts[0]) setMovie(drafts[0].title)
    setBusy(false)
    setStep('order')
  }

  const save = async () => {
    const name = movie.trim()
    if (!name) return setError('Nhập tên video / chủ đề.')
    setBusy(true)
    setError(null)

    const now = new Date().toISOString()
    const seriesKey = `manual:${parts[0].videoId}`

    const { error: videoError } = await supabase!.from('tvshow_videos').upsert(
      parts.map((p, i) => ({
        platform: 'youtube',
        video_id: p.videoId,
        series_key: seriesKey,
        creator_id: 'manual',
        creator_name: 'Tự thêm',
        title: p.title,
        canonical_url: p.url,
        embed_url: `https://www.youtube.com/embed/${p.videoId}`,
        thumbnail: p.thumbnail,
        part_number: i + 1,
        total_parts: parts.length,
        is_final: i === parts.length - 1,
        part_confidence: 1,
        last_seen_at: now,
      })),
      { onConflict: 'platform,video_id' },
    )
    setBusy(false)
    if (videoError) return setError(`Không lưu được danh sách video: ${videoError.message}`)
    onSaved()
    onClose()
  }

  return (
    <Modal title="📺 Thêm video lẻ" onClose={onClose}>
      {step === 'paste' ? (
        <>
          <textarea
            ref={boxRef}
            className="tv-links-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Dán link video, mỗi dòng một video:\nhttps://www.youtube.com/watch?v=...\nhttps://youtu.be/...'}
          />
          <button className="tv-btn" onClick={insertNewline} style={{ marginTop: 6 }}>
            <CornerDownLeft size={13} /> Xuống dòng
          </button>
          <div className="tv-hint">
            Nhận được <strong>{valid.length}</strong> link video.
            {invalid.length > 0 && (
              <>
                {' '}
                <span className="tv-bad">{invalid.length} dòng không phải link YouTube:</span>{' '}
                {invalid.slice(0, 3).join(', ')}
                {invalid.length > 3 ? '…' : ''}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="tv-btn" onClick={onClose}>Huỷ</button>
            <button className="tv-btn primary" onClick={() => void loadTitles()} disabled={busy || !valid.length}>
              {busy ? 'Đang đọc tiêu đề…' : `Tiếp — ${valid.length} video`}
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            className="tv-search"
            style={{ width: '100%', marginBottom: 10 }}
            value={movie}
            onChange={(e) => setMovie(e.target.value)}
            placeholder="Tên video / danh sách…"
          />

          <div className="tv-order">
            {parts.map((p, i) => (
              <div key={p.videoId} className="tv-order-row">
                <span style={{ fontWeight: 700, color: 'var(--amber)' }}>#{i + 1}</span>
                <img src={p.thumbnail} alt="" style={{ width: 44, height: 28, borderRadius: 4, objectFit: 'cover' }} loading="lazy" />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <button
                  className="tv-btn"
                  style={{ padding: '3px 6px' }}
                  onClick={() => setParts((v) => moveItem(v, i, i - 1))}
                  disabled={i === 0}
                  title="Lên"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  className="tv-btn"
                  style={{ padding: '3px 6px' }}
                  onClick={() => setParts((v) => moveItem(v, i, i + 1))}
                  disabled={i === parts.length - 1}
                  title="Xuống"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  className="tv-btn"
                  style={{ padding: '3px 6px', color: 'var(--rose)' }}
                  onClick={() => setParts((v) => v.filter((_, k) => k !== i))}
                  title="Bỏ video này"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {error && <div className="tv-hint tv-bad">{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="tv-btn" onClick={() => setStep('paste')}>Quay lại</button>
            <button className="tv-btn primary" onClick={() => void save()} disabled={busy || !parts.length}>
              {busy ? 'Đang lưu…' : `Lưu ${parts.length} video`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
