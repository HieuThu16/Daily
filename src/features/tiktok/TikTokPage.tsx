import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Home, Compass, Bookmark, RefreshCw, ExternalLink,
  CheckCircle2, Share2, Loader2, X, ChevronUp, ChevronDown,
  MessageCircle, Music2, ArrowLeft, Play,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ToastContext'
import { getRemoteAppSetting, saveAppSetting } from '../../lib/userAppSettings'
import './tiktok.css'

export type FeedVideo = {
  video_id: string
  title: string
  canonical_url: string
  embed_url: string
  play_url?: string | null
  thumbnail: string | null
  duration: number | null
  creator_id: string | null
  creator_name: string | null
  avatar: string | null
  comment_count: number | null
  share_count: number | null
  play_count: number | null
  music: string | null
  published_at: string | null
}

type FeedTab = 'foryou' | 'library'

type CommentState = { loading: boolean; items: any[]; error?: string }

/** 1234567 -> "1.2M", giống cách TikTok rút gọn số liệu. */
function formatCount(n: number | null): string {
  if (n === null || n === undefined) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function TikTokPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState<FeedTab>('foryou')
  const [videos, setVideos] = useState<FeedVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef<Set<string>>(new Set())

  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('daily_tiktok_watched')
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>()
    } catch {
      return new Set<string>()
    }
  })

  const [muted, setMuted] = useState(true)
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})

  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Record<string, CommentState>>({})

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

  /** Feed "Dành cho bạn": xin video đề xuất ngẫu nhiên từ TikTok qua API của mình. */
  const fetchForYou = useCallback(async (): Promise<FeedVideo[]> => {
    const res = await fetch('/api/crawl-tiktok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'feed', count: 20 }),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || 'Không tải được video')
    return data.videos || []
  }, [])

  /** Feed "Kho của tôi": video TikTok đã lưu trong Supabase, xáo trộn cho giống feed thật. */
  const fetchLibrary = useCallback(async (): Promise<FeedVideo[]> => {
    if (!supabase) return []
    const { data, error: dbErr } = await supabase
      .from('review_videos')
      .select('*')
      .eq('platform', 'tiktok')
      .limit(300)
    if (dbErr) throw new Error(dbErr.message)
    return shuffle(data || []).map((v: any) => ({
      video_id: v.video_id,
      title: v.title,
      canonical_url: v.canonical_url,
      embed_url: v.embed_url || `https://www.tiktok.com/embed/v2/${v.video_id}`,
      thumbnail: v.thumbnail,
      duration: v.duration,
      creator_id: v.creator_id,
      creator_name: v.creator_name,
      avatar: null,
      comment_count: null,
      share_count: null,
      play_count: null,
      music: null,
      published_at: v.published_at,
    }))
  }, [])

  const loadFeed = useCallback(
    async (mode: 'replace' | 'append') => {
      if (mode === 'replace') {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }
      try {
        const fresh = tab === 'foryou' ? await fetchForYou() : await fetchLibrary()
        if (mode === 'replace') {
          seenIds.current = new Set(fresh.map((v) => v.video_id))
          setVideos(fresh)
          setIndex(0)
          scrollRef.current?.scrollTo({ top: 0 })
          if (fresh.length === 0) {
            setError(
              tab === 'library'
                ? 'Kho của bạn chưa có video TikTok nào.'
                : 'Chưa lấy được video đề xuất. Thử làm mới lại nhé.',
            )
          }
        } else {
          const unique = fresh.filter((v) => !seenIds.current.has(v.video_id))
          unique.forEach((v) => seenIds.current.add(v.video_id))
          if (unique.length > 0) setVideos((prev) => [...prev, ...unique])
        }
      } catch (err: any) {
        if (mode === 'replace') setError(err.message)
        else showToast(`⚠️ ${err.message}`, 'delete')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [tab, fetchForYou, fetchLibrary, showToast],
  )

  useEffect(() => {
    void loadFeed('replace')
  }, [loadFeed])

  // Chỉ slide đang xem mới phát, các slide khác dừng lại cho đỡ tốn băng thông
  useEffect(() => {
    videos.forEach((v, i) => {
      const el = videoRefs.current[v.video_id]
      if (!el) return
      if (i === index) void el.play().catch(() => {})
      else el.pause()
    })
  }, [index, videos])

  const scrollToIndex = (i: number, smooth = true) => {
    const el = scrollRef.current
    if (!el) return
    const target = Math.max(0, Math.min(videos.length - 1, i))
    el.scrollTo({ top: target * el.clientHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el || el.clientHeight === 0) return
    const i = Math.max(0, Math.min(videos.length - 1, Math.round(el.scrollTop / el.clientHeight)))
    if (i !== index) setIndex(i)
    // Feed vô tận: gần cuối thì xin thêm video mới
    if (i >= videos.length - 3 && !loadingMore && videos.length > 0) {
      void loadFeed('append')
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        scrollToIndex(index + 1)
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        scrollToIndex(index - 1)
      }
      if (e.key === 'Escape') setShowComments(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, videos.length])

  const loadComments = useCallback(
    async (videoId: string) => {
      setComments((p) => {
        if (p[videoId]) return p
        return { ...p, [videoId]: { loading: true, items: [] } }
      })
      try {
        const res = await fetch('/api/crawl-tiktok', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_comments', videoId }),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Không tải được bình luận')
        setComments((p) => ({ ...p, [videoId]: { loading: false, items: data.comments || [] } }))
      } catch (err: any) {
        setComments((p) => ({ ...p, [videoId]: { loading: false, items: [], error: err.message } }))
      }
    },
    [],
  )

  const current = videos[index]

  useEffect(() => {
    if (showComments && current && !comments[current.video_id]) {
      void loadComments(current.video_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComments, current?.video_id])

  const copyLink = (url: string) => {
    void navigator.clipboard.writeText(url)
    showToast('📋 Đã copy link video', 'supabase')
  }

  return (
    <div className="tt-app">
      {/* ---- Sidebar trái (desktop) ---- */}
      <aside className="tt-sidebar">
        <div className="tt-logo">
          <Music2 size={26} />
          <span>TikTok</span>
        </div>

        <nav className="tt-nav">
          <button
            className={`tt-nav-item ${tab === 'foryou' ? 'active' : ''}`}
            onClick={() => setTab('foryou')}
          >
            <Home size={24} />
            <span>Dành cho bạn</span>
          </button>
          <button
            className={`tt-nav-item ${tab === 'library' ? 'active' : ''}`}
            onClick={() => setTab('library')}
          >
            <Bookmark size={24} />
            <span>Kho của tôi</span>
          </button>
          <button className="tt-nav-item" onClick={() => loadFeed('replace')}>
            <Compass size={24} />
            <span>Làm mới feed</span>
          </button>
        </nav>

        <div className="tt-sidebar-foot">
          <button className="tt-nav-item small" onClick={() => navigate('/home')}>
            <ArrowLeft size={20} />
            <span>Về Daily</span>
          </button>
          <p className="tt-sidebar-note">
            {watchedIds.size} video đã xem
          </p>
        </div>
      </aside>

      {/* ---- Feed chính ---- */}
      <main className="tt-main">
        {/* Thanh tab nổi trên đầu, giống app điện thoại */}
        <div className="tt-topbar">
          <button className="tt-top-back" onClick={() => navigate('/home')} title="Về Daily">
            <ArrowLeft size={22} />
          </button>
          <div className="tt-top-tabs">
            <button className={tab === 'foryou' ? 'active' : ''} onClick={() => setTab('foryou')}>
              Dành cho bạn
            </button>
            <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>
              Kho của tôi
            </button>
          </div>
          <button className="tt-top-refresh" onClick={() => loadFeed('replace')} title="Làm mới">
            <RefreshCw size={20} className={loading ? 'tv-spin' : ''} />
          </button>
        </div>

        {loading && (
          <div className="tt-state">
            <Loader2 size={34} className="tv-spin" />
            <p>Đang lấy video cho bạn...</p>
          </div>
        )}

        {!loading && error && (
          <div className="tt-state">
            <Play size={34} />
            <p>{error}</p>
            <button className="tt-state-btn" onClick={() => loadFeed('replace')}>
              <RefreshCw size={16} /> Thử lại
            </button>
          </div>
        )}

        {!loading && !error && videos.length > 0 && (
          <div className="tt-scroll" ref={scrollRef} onScroll={handleScroll}>
            {videos.map((vid, i) => {
              const near = Math.abs(i - index) <= 1
              const isWatched = watchedIds.has(vid.video_id)
              return (
                <section className="tt-slide" key={`${vid.video_id}-${i}`}>
                  <div className="tt-stage">
                    <div className="tt-player">
                      {near && vid.play_url ? (
                        <video
                          ref={(el) => {
                            videoRefs.current[vid.video_id] = el
                          }}
                          src={`/api/tiktok-video?url=${encodeURIComponent(vid.play_url)}`}
                          poster={vid.thumbnail || undefined}
                          loop
                          playsInline
                          muted={muted}
                          autoPlay={i === index}
                          onClick={() => setMuted((m) => !m)}
                        />
                      ) : near ? (
                        <iframe
                          src={vid.embed_url}
                          title={vid.title || vid.video_id}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <div className="tt-player-ph">
                          {vid.thumbnail && <img src={vid.thumbnail} alt="" loading="lazy" />}
                        </div>
                      )}

                      {i === index && vid.play_url && muted && (
                        <button className="tt-unmute" onClick={() => setMuted(false)}>
                          🔇 Chạm để bật tiếng
                        </button>
                      )}

                      <div className="tt-overlay">
                        <span className="tt-author">@{vid.creator_id || vid.creator_name || 'tiktok'}</span>
                        {vid.title && <p className="tt-caption">{vid.title}</p>}
                        {vid.music && (
                          <span className="tt-music">
                            <Music2 size={13} /> {vid.music}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rail hành động bên phải — không có nút tim theo yêu cầu */}
                    <div className="tt-rail">
                      <div className="tt-rail-avatar">
                        {vid.avatar ? (
                          <img src={vid.avatar} alt="" loading="lazy" />
                        ) : (
                          <span>{(vid.creator_name || 'T')[0].toUpperCase()}</span>
                        )}
                      </div>

                      <button
                        className={`tt-rail-btn ${isWatched ? 'on' : ''}`}
                        onClick={() => toggleWatched(vid.video_id)}
                        title={isWatched ? 'Bỏ đánh dấu đã xem' : 'Đánh dấu đã xem'}
                      >
                        <span className="tt-rail-icon">
                          <CheckCircle2 size={28} />
                        </span>
                        <span className="tt-rail-label">{isWatched ? 'Đã xem' : 'Xem'}</span>
                      </button>

                      <button
                        className={`tt-rail-btn ${showComments && i === index ? 'on' : ''}`}
                        onClick={() => {
                          if (i !== index) scrollToIndex(i, false)
                          setShowComments((s) => !s)
                        }}
                        title="Bình luận"
                      >
                        <span className="tt-rail-icon">
                          <MessageCircle size={28} />
                        </span>
                        <span className="tt-rail-label">{formatCount(vid.comment_count) || 'Bình luận'}</span>
                      </button>

                      <button className="tt-rail-btn" onClick={() => copyLink(vid.canonical_url)} title="Chia sẻ">
                        <span className="tt-rail-icon">
                          <Share2 size={28} />
                        </span>
                        <span className="tt-rail-label">{formatCount(vid.share_count) || 'Chia sẻ'}</span>
                      </button>

                      <a
                        className="tt-rail-btn"
                        href={vid.canonical_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Mở trên TikTok"
                      >
                        <span className="tt-rail-icon">
                          <ExternalLink size={26} />
                        </span>
                        <span className="tt-rail-label">TikTok</span>
                      </a>

                      <div className="tt-rail-disc" aria-hidden>
                        <Music2 size={18} />
                      </div>
                    </div>
                  </div>
                </section>
              )
            })}

            {loadingMore && (
              <div className="tt-more">
                <Loader2 size={20} className="tv-spin" /> Đang tải thêm video...
              </div>
            )}
          </div>
        )}

        {/* Nút lên/xuống kiểu TikTok web */}
        {!loading && !error && videos.length > 0 && (
          <div className="tt-updown">
            <button onClick={() => scrollToIndex(index - 1)} disabled={index === 0} title="Video trước (↑)">
              <ChevronUp size={22} />
            </button>
            <button
              onClick={() => scrollToIndex(index + 1)}
              disabled={index >= videos.length - 1}
              title="Video sau (↓)"
            >
              <ChevronDown size={22} />
            </button>
          </div>
        )}
      </main>

      {/* ---- Panel bình luận ---- */}
      {showComments && current && (
        <aside className="tt-comments">
          <div className="tt-comments-head">
            <span>
              Bình luận
              {comments[current.video_id]?.items.length
                ? ` (${comments[current.video_id].items.length})`
                : ''}
            </span>
            <button onClick={() => setShowComments(false)} title="Đóng">
              <X size={20} />
            </button>
          </div>

          <div className="tt-comments-body">
            {(!comments[current.video_id] || comments[current.video_id].loading) && (
              <div className="tt-comments-state">
                <Loader2 size={22} className="tv-spin" /> Đang tải bình luận...
              </div>
            )}
            {comments[current.video_id]?.error && (
              <div className="tt-comments-state">⚠️ {comments[current.video_id].error}</div>
            )}
            {comments[current.video_id] &&
              !comments[current.video_id].loading &&
              !comments[current.video_id].error &&
              comments[current.video_id].items.length === 0 && (
                <div className="tt-comments-state">Chưa có bình luận nào.</div>
              )}

            {comments[current.video_id]?.items.map((c: any) => (
              <div className="tt-comment" key={c.id}>
                {c.avatar ? (
                  <img className="tt-comment-av" src={c.avatar} alt="" loading="lazy" />
                ) : (
                  <div className="tt-comment-av fb">{(c.author || '?')[0].toUpperCase()}</div>
                )}
                <div className="tt-comment-main">
                  <span className="tt-comment-author">{c.author}</span>
                  <p>{c.text}</p>
                  <span className="tt-comment-meta">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : ''}
                    {c.likes > 0 ? ` · ${formatCount(c.likes)} thích` : ''}
                    {c.reply_count > 0 ? ` · ${c.reply_count} trả lời` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  )
}
