import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Circle, CornerDownLeft, ExternalLink, Film, Pause, Play, Plus, Radio, Search, SkipBack, SkipForward, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchYouTubeMeta, youtubeVideoId } from '../../lib/youtubeMeta'
import { Modal } from '../shared'
import './reviewSeries.css'

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
 * Tab Review phim: 1 Kênh = 1 Card.
 * Gộp toàn bộ video review của kênh vào trong card đó, bấm vào xem toàn bộ video.
 */
export function ReviewSeriesView() {
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null)
  const [addChannelOpen, setAddChannelOpen] = useState(false)
  const [addMovieOpen, setAddMovieOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Tải danh sách Kênh Review (1 kênh = 1 card)
  useEffect(() => {
    let alive = true
    setLoading(true)

    void (async () => {
      // 1. Lấy danh sách review creators
      const creatorsRes = await supabase
        ?.from('review_creators')
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
          ?.from('review_videos')
          .select('video_id,creator_id,creator_name,thumbnail,published_at')
          .is('unavailable_at', null)
          .order('published_at', { ascending: false }),
        supabase?.from('review_watched').select('video_id'),
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
          creator_name: c.creator_name || 'Kênh Review Phim',
          creator_id: c.creator_id,
          videoCount: stat.total,
          watchedCount: stat.watched,
          cover: stat.cover,
          lastSyncedAt: c.last_synced_at,
        }
      })

      // Nếu có phim tự thêm
      const manualStat = statsByCreator.get('manual')
      if (manualStat && manualStat.total > 0 && !creators.some((c) => c.creator_id === 'manual')) {
        channelCards.push({
          id: 'manual',
          platform: 'youtube',
          creator_url: '',
          creator_name: 'Phim tự thêm',
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
    if (!window.confirm(`Xoá kênh review "${channel.creator_name}" cùng toàn bộ phim của kênh này?`)) return
    setLoading(true)

    if (channel.id !== 'manual') {
      await supabase?.from('review_creators').delete().eq('id', channel.id)
    }

    if (channel.creator_id) {
      await supabase?.from('review_videos').delete().eq('creator_id', channel.creator_id)
      await supabase?.from('review_series').delete().eq('creator_id', channel.creator_id)
    } else {
      await supabase?.from('review_videos').delete().eq('creator_name', channel.creator_name)
      await supabase?.from('review_series').delete().eq('creator_name', channel.creator_name)
    }

    setReloadKey((k) => k + 1)
  }

  // Mở chi tiết 1 Kênh Review
  if (selectedChannel) {
    return (
      <ReviewChannelDetailView
        channel={selectedChannel}
        onBack={() => {
          setSelectedChannel(null)
          setReloadKey((k) => k + 1)
        }}
      />
    )
  }

  return (
    <section className="rv-page">
      {/* Toolbar */}
      <div className="rv-bar">
        <div className="rv-search-box">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            className="rv-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm kênh review phim…"
          />
        </div>
        <button className="rv-btn primary" onClick={() => setAddChannelOpen(true)}>
          <Radio size={14} /> Thêm kênh
        </button>
        <button className="rv-btn" onClick={() => setAddMovieOpen(true)}>
          <Plus size={14} /> Thêm phim lẻ
        </button>
      </div>

      {needsMigration ? (
        <div className="rv-empty">
          Chưa có bảng review series trên Supabase. Chạy migration <code>20260911000000_review_series.sql</code> trên SQL Editor rồi tải lại trang.
        </div>
      ) : loading ? (
        <div className="rv-empty">Đang tải danh sách kênh review…</div>
      ) : !filteredChannels.length ? (
        <div className="rv-empty">
          {search
            ? `Không tìm thấy kênh nào khớp “${search}”.`
            : 'Chưa có kênh review nào. Bấm “Thêm kênh” rồi dán link YouTube để cào toàn bộ video review.'}
        </div>
      ) : (
        <div className="rv-channel-grid">
          {filteredChannels.map((c) => {
            const isDone = c.videoCount > 0 && c.watchedCount >= c.videoCount
            const percent = c.videoCount > 0 ? Math.round((c.watchedCount / c.videoCount) * 100) : 0

            return (
              <div
                key={c.id}
                className="rv-channel-card"
                onClick={() => setSelectedChannel(c)}
              >
                <div className="rv-channel-cover">
                  {c.cover ? (
                    <img src={c.cover} alt={c.creator_name} loading="lazy" />
                  ) : (
                    <div className="rv-channel-cover-empty">
                      <Film size={36} />
                    </div>
                  )}

                  <span className="rv-badge-live">
                    <Film size={11} /> KÊNH REVIEW
                  </span>

                  <span className="rv-count-pill">
                    {c.videoCount} video
                  </span>

                  {c.watchedCount > 0 && (
                    <span className={`rv-seen-pill${isDone ? ' done' : ''}`}>
                      {isDone ? 'Đã xem hết' : `Đã xem ${c.watchedCount}/${c.videoCount}`}
                    </span>
                  )}
                </div>

                <div className="rv-channel-body">
                  <div className="rv-channel-header">
                    <div className="rv-channel-title">{c.creator_name}</div>
                    <button
                      className="rv-btn"
                      style={{ padding: '4px 6px', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
                      onClick={(e) => void deleteChannel(c, e)}
                      title="Xoá kênh này"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <span className="rv-channel-sub">
                    {c.videoCount > 0 ? `Tổng cộng ${c.videoCount} video review` : 'Chưa có video'}
                  </span>

                  {c.videoCount > 0 && (
                    <div className="rv-channel-progress">
                      <div className="rv-channel-progress-head">
                        <span>Tiến độ xem</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="rv-channel-progress-bar">
                        <div
                          className="rv-channel-progress-fill"
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
        <AddChannelModal
          onClose={() => setAddChannelOpen(false)}
          onSynced={() => setReloadKey((k) => k + 1)}
        />
      )}

      {addMovieOpen && (
        <AddMovieModal
          onClose={() => setAddMovieOpen(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </section>
  )
}

/**
 * Màn hình xem chi tiết 1 Kênh Review (Gộp toàn bộ video review của kênh vào đây).
 */
function ReviewChannelDetailView({
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
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tvshow_playback_rate')
      return saved ? parseFloat(saved) : 1
    } catch {
      return 1
    }
  })

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerBoxRef = useRef<HTMLDivElement>(null)

  const sendYouTubeCommand = (func: string, args: any[] = []) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({
        event: 'command',
        func,
        args,
      }),
      '*'
    )
  }

  const applyPlaybackRate = (rate: number) => {
    setPlaybackRate(rate)
    try {
      localStorage.setItem('tvshow_playback_rate', String(rate))
    } catch {}
    sendYouTubeCommand('setPlaybackRate', [rate])
  }

  useEffect(() => {
    void (async () => {
      let query = supabase
        ?.from('review_videos')
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
        supabase?.from('review_watched').select('video_id'),
      ])

      const rows = (videoRes?.data ?? []) as VideoRow[]
      setVideos(rows)

      const watchedSet = new Set(((watchedRes?.data ?? []) as { video_id: string }[]).map((r) => r.video_id))
      setWatched(watchedSet)

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
      await supabase?.from('review_watched').delete().eq('platform', 'youtube').eq('video_id', videoId)
    } else {
      next.add(videoId)
      setWatched(next)
      await supabase?.from('review_watched').upsert({
        platform: 'youtube',
        video_id: videoId,
        watched_at: new Date().toISOString(),
      })
    }
  }

  const nextVideo = () => {
    if (currentIndex < filteredVideos.length - 1) {
      setPlayingId(filteredVideos[currentIndex + 1].video_id)
      setAutoplay(true)
    }
  }

  const prevVideo = () => {
    if (currentIndex > 0) {
      setPlayingId(filteredVideos[currentIndex - 1].video_id)
      setAutoplay(true)
    }
  }

  const watchedCountInChannel = useMemo(() => {
    return videos.filter((v) => watched.has(v.video_id)).length
  }, [videos, watched])

  const embedBase = currentVideo?.embed_url || (currentVideo?.video_id ? `https://www.youtube-nocookie.com/embed/${currentVideo.video_id}` : '')
  const embedSrc = embedBase ? `${embedBase}${embedBase.includes('?') ? '&' : '?'}autoplay=${autoplay ? 1 : 0}&rel=0&enablejsapi=1` : ''

  return (
    <div className="rv-detail">
      {/* Top Header */}
      <div className="rv-detail-bar">
        <button className="rv-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Danh sách kênh
        </button>
        <div className="rv-detail-title-wrap">
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
            🎬 {channel.creator_name}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            ({videos.length} video)
          </span>
        </div>
      </div>

      {loading ? (
        <div className="rv-empty">Đang tải video review…</div>
      ) : !videos.length ? (
        <div className="rv-empty">Kênh này chưa có video nào.</div>
      ) : (
        <div className="rv-detail-layout">
          {/* Cột trái: Trình phát YouTube */}
          <div ref={playerBoxRef} className="rv-player-box">
            <div className="rv-player-frame">
              {currentVideo && embedSrc ? (
                <iframe
                  ref={iframeRef}
                  src={embedSrc}
                  title={currentVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => {
                    if (playbackRate !== 1) {
                      setTimeout(() => sendYouTubeCommand('setPlaybackRate', [playbackRate]), 400)
                      setTimeout(() => sendYouTubeCommand('setPlaybackRate', [playbackRate]), 1200)
                    }
                  }}
                />
              ) : (
                <div className="rv-channel-cover-empty">Chọn một video để phát</div>
              )}
            </div>

            {currentVideo && (
              <div className="rv-player-info">
                <div className="rv-player-title">{currentVideo.title}</div>
                <div className="rv-player-actions">
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="rv-btn"
                      onClick={prevVideo}
                      disabled={currentIndex <= 0}
                      title="Video trước"
                    >
                      <SkipBack size={13} />
                    </button>
                    <button
                      className="rv-btn"
                      onClick={nextVideo}
                      disabled={currentIndex >= filteredVideos.length - 1}
                      title="Video tiếp theo"
                    >
                      <SkipForward size={13} />
                    </button>
                    <button
                      className={`rv-btn ${watched.has(currentVideo.video_id) ? 'primary' : ''}`}
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

                    {/* Nút bật/tắt nhanh 2x */}
                    <button
                      type="button"
                      className={`rv-btn ${playbackRate === 2 ? 'primary' : ''}`}
                      onClick={() => applyPlaybackRate(playbackRate === 2 ? 1 : 2)}
                      title="Chuyển đổi nhanh tốc độ 2x"
                      style={{ fontWeight: 800 }}
                    >
                      ⚡ {playbackRate === 2 ? 'Đang 2x' : 'Chế độ 2x'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Bảng chọn tốc độ phát */}
                    <div className="rv-speed-group" title="Chọn tốc độ phát">
                      {[1, 1.25, 1.5, 1.75, 2].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          className={`rv-speed-btn ${rate === 2 ? 'is-2x' : ''} ${playbackRate === rate ? 'active' : ''}`}
                          onClick={() => applyPlaybackRate(rate)}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={autoplay}
                        onChange={(e) => setAutoplay(e.target.checked)}
                      />
                      Tự phát tiếp
                    </label>
                    <a
                      href={currentVideo.canonical_url || `https://www.youtube.com/watch?v=${currentVideo.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rv-btn"
                      title="Mở trên YouTube"
                    >
                      <ExternalLink size={13} /> YouTube
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cột phải: Danh sách video */}
          <div className="rv-episodes-box">
            <div className="rv-episodes-head">
              <span className="rv-episodes-head-title">
                Danh sách video ({filteredVideos.length})
              </span>
              <span className="rv-episodes-head-stat">
                Đã xem {watchedCountInChannel}/{videos.length}
              </span>
            </div>

            <input
              className="rv-ep-search"
              placeholder="Tìm video review trong kênh…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="rv-ep-filters">
              <button
                className={`rv-ep-filter-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                Tất cả ({videos.length})
              </button>
              <button
                className={`rv-ep-filter-btn ${filterMode === 'unwatched' ? 'active' : ''}`}
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

            <div className="rv-episodes-list">
              {filteredVideos.map((v, i) => {
                const isPlaying = v.video_id === playingId
                const isWatched = watched.has(v.video_id)
                return (
                  <div
                    key={v.video_id}
                    className={`rv-episode-item ${isPlaying ? 'playing' : ''}`}
                    onClick={() => {
                      setPlayingId(v.video_id)
                      setAutoplay(true)
                      playerBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                    }}
                  >
                    <img
                      src={v.thumbnail || `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`}
                      alt=""
                      className="rv-ep-thumb"
                      loading="lazy"
                    />
                    <div className="tv-ep-text">
                      <span className="rv-ep-name">
                        #{i + 1}. {v.title}
                      </span>
                    </div>
                    <button
                      className={`rv-ep-watch-btn ${isWatched ? 'watched' : ''}`}
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

/** Modal cào kênh YouTube cho Review Phim */
function AddChannelModal({ onClose, onSynced }: { onClose: () => void; onSynced: () => void }) {
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [rows, setRows] = useState<{ url: string; status: 'chờ' | 'đang chạy' | 'xong' | 'lỗi' | 'dừng'; note: string }[]>([])
  const stopRef = useRef(false)

  const post = async (body: any) => {
    const res = await fetch('/api/sync-review', {
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
    <Modal title="📡 Thêm kênh review" onClose={onClose}>
      <textarea
        className="rv-links-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={running}
        placeholder={'Dán link kênh, mỗi dòng một kênh:\nhttps://www.youtube.com/@Cuckickreview\nhttps://www.youtube.com/@phephim'}
      />

      <div className="rv-hint">
        Nhận được <strong>{valid.length}</strong> link kênh. Server sẽ cào toàn bộ video review của kênh và gom thành một thẻ Kênh.
        {invalid.length > 0 && (
          <>
            {' '}
            <span className="rv-bad">{invalid.length} dòng không phải link kênh:</span> {invalid.slice(0, 3).join(', ')}
            {invalid.length > 3 ? '…' : ''}
          </>
        )}
      </div>

      {progress && (
        <div className="rv-progress-box">
          <div className="rv-progress-head">
            <span>{progress.label}</span>
            <span>
              trang {progress.done}/{progress.total}
            </span>
          </div>
          <div className="rv-progress-track">
            <div
              className="rv-progress-fill"
              style={{ width: `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="rv-order" style={{ marginTop: 8 }}>
          {rows.map((r) => (
            <div key={r.url} className="rv-order-row">
              <span className={`rv-run-${r.status === 'lỗi' ? 'bad' : r.status === 'xong' ? 'ok' : 'wait'}`}>
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
        <button className="rv-btn" onClick={onClose} disabled={running}>
          Đóng
        </button>
        {running ? (
          <button className="rv-btn" onClick={() => (stopRef.current = true)}>
            <Pause size={13} /> Tạm dừng
          </button>
        ) : (
          <button className="rv-btn primary" onClick={() => void run()} disabled={!valid.length}>
            {rows.some((r) => r.status === 'dừng') ? 'Chạy tiếp' : `Tải ${valid.length} kênh`}
          </button>
        )}
      </div>
    </Modal>
  )
}

type DraftPart = ParsedVideo & { title: string; thumbnail: string }

/** Modal thêm phim lẻ thủ công */
function AddMovieModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
      title: metas[i]?.title ?? `Phần ${i + 1}`,
      thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    }))
    setParts(drafts)
    if (!movie.trim() && drafts[0]) setMovie(drafts[0].title)
    setBusy(false)
    setStep('order')
  }

  const save = async () => {
    const name = movie.trim()
    if (!name) return setError('Nhập tên phim đã.')
    setBusy(true)
    setError(null)

    const now = new Date().toISOString()
    const seriesKey = `manual:${parts[0].videoId}`

    const { error: seriesError } = await supabase!.from('review_series').upsert(
      {
        series_key: seriesKey,
        platform: 'youtube',
        creator_id: 'manual',
        creator_name: 'Tự thêm',
        title: name,
        movie_id: seriesKey,
        movie_title: name,
        movie_confidence: 1,
        movie_evidence: ['nhập tay'],
        status: 'COMPLETE',
        expected_parts: parts.length,
        found_parts: parts.length,
        missing_parts: [],
        confidence: 1,
        evidence: ['nhập tay'],
        updated_at: now,
      },
      { onConflict: 'series_key' },
    )
    if (seriesError) {
      setBusy(false)
      return setError(`Không lưu được phim: ${seriesError.message}`)
    }

    const { error: videoError } = await supabase!.from('review_videos').upsert(
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
    if (videoError) return setError(`Không lưu được danh sách phần: ${videoError.message}`)
    onSaved()
    onClose()
  }

  return (
    <Modal title="🎬 Thêm phim lẻ" onClose={onClose}>
      {step === 'paste' ? (
        <>
          <textarea
            ref={boxRef}
            className="rv-links-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Dán link video, mỗi dòng một phần:\nhttps://www.youtube.com/watch?v=...\nhttps://youtu.be/...'}
          />
          <button className="rv-btn" onClick={insertNewline} style={{ marginTop: 6 }}>
            <CornerDownLeft size={13} /> Xuống dòng
          </button>
          <div className="rv-hint">
            Nhận được <strong>{valid.length}</strong> link.
            {invalid.length > 0 && (
              <>
                {' '}
                <span className="rv-bad">{invalid.length} dòng không phải link video YouTube:</span>{' '}
                {invalid.slice(0, 3).join(', ')}
                {invalid.length > 3 ? '…' : ''}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="rv-btn" onClick={onClose}>Huỷ</button>
            <button className="rv-btn primary" onClick={() => void loadTitles()} disabled={busy || !valid.length}>
              {busy ? 'Đang đọc tiêu đề…' : `Tiếp — ${valid.length} phần`}
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            className="rv-search"
            style={{ width: '100%', marginBottom: 10 }}
            value={movie}
            onChange={(e) => setMovie(e.target.value)}
            placeholder="Tên phim…"
          />

          <div className="rv-order">
            {parts.map((p, i) => (
              <div key={p.videoId} className="rv-order-row">
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>#{i + 1}</span>
                <img src={p.thumbnail} alt="" style={{ width: 44, height: 28, borderRadius: 4, objectFit: 'cover' }} loading="lazy" />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <button
                  className="rv-btn"
                  style={{ padding: '3px 6px' }}
                  onClick={() => setParts((v) => moveItem(v, i, i - 1))}
                  disabled={i === 0}
                  title="Lên"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  className="rv-btn"
                  style={{ padding: '3px 6px' }}
                  onClick={() => setParts((v) => moveItem(v, i, i + 1))}
                  disabled={i === parts.length - 1}
                  title="Xuống"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  className="rv-btn"
                  style={{ padding: '3px 6px', color: 'var(--rose)' }}
                  onClick={() => setParts((v) => v.filter((_, k) => k !== i))}
                  title="Bỏ phần này"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {error && <div className="rv-hint rv-bad">{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="rv-btn" onClick={() => setStep('paste')}>Quay lại</button>
            <button className="rv-btn primary" onClick={() => void save()} disabled={busy || !parts.length}>
              {busy ? 'Đang lưu…' : `Lưu phim — ${parts.length} phần`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
