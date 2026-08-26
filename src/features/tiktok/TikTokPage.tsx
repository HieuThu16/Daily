import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Home, Compass, Bookmark, RefreshCw, ExternalLink,
  CheckCircle2, Share2, Loader2, X, ChevronUp, ChevronDown,
  MessageCircle, Music2, ArrowLeft, Play, Search, Download, Plus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import { getRemoteAppSetting, saveAppSetting } from '../../lib/userAppSettings'
import './tiktok.css'
import { apiPost } from '../../lib/apiFetch'

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

type FeedTab = 'foryou' | 'library' | 'search'

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

/** Dòng trong kho Supabase -> video của feed. Dùng chung cho tab Kho và tìm kiếm. */
function mapLibraryRows(rows: any[]): FeedVideo[] {
  return rows.map((v: any) => ({
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
}

/** Số ngày coi là "mới"; video mới hơn mốc này được đẩy lên trước. */
const RECENT_DAYS = 240

/**
 * Đẩy video mới đăng lên trước, nhưng vẫn xáo trong từng nhóm.
 * Xếp thuần theo ngày thì mở lần nào cũng đúng thứ tự đó, chán ngay.
 */
export function preferRecent(list: FeedVideo[], now = Date.now()): FeedVideo[] {
  const cutoff = now - RECENT_DAYS * 86_400_000
  const fresh: FeedVideo[] = []
  const older: FeedVideo[] = []
  for (const v of list) {
    const t = v.published_at ? Date.parse(v.published_at) : NaN
    ;(Number.isFinite(t) && t >= cutoff ? fresh : older).push(v)
  }
  return [...shuffle(fresh), ...shuffle(older)]
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

  const [muted, setMuted] = useState(false)
  const [query, setQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
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
  /**
   * Feed "Dành cho bạn": lấy KHO TRƯỚC rồi mới gọi TikTok.
   *
   * Gọi TikTok mất vài giây và hay bị chặn — phải dò qua 13 trang hashtag rồi
   * mới có kết quả. Kho Supabase thì trả về gần như tức thì, nên hiện kho ra
   * cho xem ngay, còn video mới của TikTok thì nối vào sau.
   *
   * Ưu tiên video mới đăng: xáo trong nhóm mới trước rồi mới tới nhóm cũ, để
   * feed vừa mới vừa không lặp y hệt mỗi lần mở.
   */
  const fetchForYou = useCallback(async (): Promise<FeedVideo[]> => {
    let fromLibrary: FeedVideo[] = []
    if (supabase) {
      try {
        const { data } = await supabase
          .from('review_videos')
          .select('*')
          .eq('platform', 'tiktok')
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(200)
        fromLibrary = preferRecent(mapLibraryRows(data ?? []))
      } catch (err) {
        console.warn('[tiktok] không đọc được kho:', err)
      }
    }

    if (fromLibrary.length >= 8) {
      // Đủ xem rồi: gọi TikTok ngầm để lần mở sau có video mới, khỏi bắt chờ.
      void apiPost('/api/crawl-tiktok', { action: 'feed', count: 20 }, 'x').catch(() => {})
      return fromLibrary
    }

    const data = await apiPost('/api/crawl-tiktok', { action: 'feed', count: 20 }, 'Không tải được video')
    return [...fromLibrary, ...(data.videos || [])]
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
    return shuffle(mapLibraryRows(data || []))
  }, [])

  /**
   * Tìm kiếm: kho của mình TRƯỚC, rồi mới tới TikTok.
   *
   * TikTok không cho tìm toàn văn từ server — API tìm thật của họ đòi chữ ký
   * X-Bogus/msToken. Phía TikTok chỉ tra được hashtag và @kênh, nên gõ chữ
   * thường sẽ trượt. Kho của mình thì tìm trong tiêu đề được thật, lại nhanh.
   */
  const fetchSearch = useCallback(async (): Promise<FeedVideo[]> => {
    const q = searchTerm.trim()
    if (!q) return []

    const results: FeedVideo[] = []
    const seen = new Set<string>()
    const add = (list: FeedVideo[]) => {
      for (const v of list) {
        if (v.video_id && !seen.has(v.video_id)) {
          seen.add(v.video_id)
          results.push(v)
        }
      }
    }

    // 1. Kho của mình — tìm thật trong tiêu đề và tên kênh.
    if (supabase && !q.startsWith('@')) {
      try {
        const pattern = `%${q.replace(/[%_]/g, '')}%`
        const { data } = await supabase
          .from('review_videos')
          .select('*')
          .eq('platform', 'tiktok')
          .or(`title.ilike.${pattern},creator_name.ilike.${pattern}`)
          .limit(100)
        add(mapLibraryRows(data ?? []))
      } catch (err) {
        console.warn('[tiktok] không tìm được trong kho:', err)
      }
    }

    // 2. TikTok: hashtag hoặc @kênh. Hỏng thì vẫn còn kết quả trong kho.
    try {
      const data = await apiPost('/api/crawl-tiktok', { action: 'search', query: q }, 'Không tìm được video')
      add(data.videos || [])
    } catch (err) {
      if (results.length === 0) throw err
      console.warn('[tiktok] TikTok không trả kết quả:', err)
    }

    return results
  }, [searchTerm])

  const loadFeed = useCallback(
    async (mode: 'replace' | 'append') => {
      if (mode === 'replace') {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }
      try {
        const fresh =
          tab === 'search' ? await fetchSearch() : tab === 'foryou' ? await fetchForYou() : await fetchLibrary()
        if (mode === 'replace') {
          seenIds.current = new Set(fresh.map((v) => v.video_id))
          setVideos(fresh)
          setIndex(0)
          scrollRef.current?.scrollTo({ top: 0 })
          if (fresh.length === 0) {
            setError(
              tab === 'library'
                ? 'Kho của bạn chưa có video TikTok nào.'
                : tab === 'search'
                  ? `Không tìm thấy video nào cho "${searchTerm}".`
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
    [tab, searchTerm, fetchForYou, fetchLibrary, fetchSearch, showToast],
  )

  useEffect(() => {
    void loadFeed('replace')
  }, [loadFeed])

  // Chỉ slide đang xem mới phát, các slide khác dừng lại cho đỡ tốn băng thông
  useEffect(() => {
    videos.forEach((v, i) => {
      const el = videoRefs.current[v.video_id]
      if (!el) return
      if (i === index) {
        el.muted = muted
        void el.play().catch(() => {
          // Trình duyệt chặn autoplay có tiếng -> phát im lặng, hiện nút bật tiếng
          el.muted = true
          setMuted(true)
          void el.play().catch(() => {})
        })
      }
      else el.pause()
    })
  }, [index, videos, muted])

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
    if (tab !== 'search' && i >= videos.length - 3 && !loadingMore && videos.length > 0) {
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
        const data = await apiPost('/api/crawl-tiktok', { action: 'get_comments', videoId }, 'Không tải được bình luận')
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

  const [crawling, setCrawling] = useState(false)
  const [addChannelOpen, setAddChannelOpen] = useState(false)
  const [crawlProgress, setCrawlProgress] = useState('')

  /**
   * Cào cả kênh: gom ID từ embed + kho lưu trữ Wayback, rồi lấy metadata theo từng lô
   * (TikTok chặn tốc độ nên phải chia nhỏ, chạy vài phút cho kênh nhiều video).
   */
  const crawlChannel = async (fromUsername?: string) => {
    const username = fromUsername || current?.creator_id || current?.creator_name
    if (!username) return
    setCrawling(true)
    setCrawlProgress('đang tìm video...')
    try {
      const idsData = await apiPost(
        '/api/crawl-tiktok',
        { action: 'channel_ids', channelUrl: `https://www.tiktok.com/@${username}` },
        'Không tìm được video của kênh',
      )
      const ids: string[] = idsData.ids || []
      if (ids.length === 0) throw new Error(`Không tìm thấy video nào của @${username}`)

      showToast(`🔎 Tìm thấy ${ids.length} video của @${username}, bắt đầu lưu...`, 'supabase')
      let saved = 0
      for (let i = 0; i < ids.length; i += 20) {
        const batch = ids.slice(i, i + 20)
        const data = await apiPost('/api/crawl-tiktok', { action: 'channel_meta', username, ids: batch }, 'Lỗi khi lưu video')
        saved += data.saved || 0
        setCrawlProgress(`${saved}/${ids.length}`)
      }
      showToast(`✅ Đã lưu ${saved} video của @${username} vào Kho`, 'supabase')
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`, 'delete')
    } finally {
      setCrawling(false)
      setCrawlProgress('')
    }
  }

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
        {/* Thanh trên: chỉ ô tìm và nút nhập kênh. Nút quay lại / làm mới /
            cào kênh đã bỏ — cào kênh đang xem chuyển xuống hàng nút bên video. */}
        <div className="tt-topbar">
          <div className="tt-top-tabs">
            <button className={tab === 'foryou' ? 'active' : ''} onClick={() => setTab('foryou')}>
              Dành cho bạn
            </button>
            <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}>
              Kho của tôi
            </button>
            {searchTerm && (
              <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>
                🔍 {searchTerm}
              </button>
            )}
          </div>
          <form
            className="tt-search"
            onSubmit={(e) => {
              e.preventDefault()
              const q = query.trim()
              if (!q) return
              setSearchTerm(q)
              setTab('search')
            }}
          >
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm trong kho, hoặc #hashtag / @kênh"
            />
          </form>
          <button
            type="button"
            className="tt-add-channel"
            onClick={() => setAddChannelOpen(true)}
            title="Nhập link kênh TikTok để cào về Kho"
          >
            <Plus size={16} /> Nhập kênh
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

                      <button
                        className="tt-rail-btn"
                        disabled={crawling}
                        onClick={() => void crawlChannel(vid.creator_id || vid.creator_name || undefined)}
                        title={`Cào toàn bộ kênh @${vid.creator_id || vid.creator_name} về Kho`}
                      >
                        {crawling ? <Loader2 size={22} className="tv-spin" /> : <Download size={22} />}
                        <span>{crawling ? crawlProgress || '…' : 'Cào kênh'}</span>
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

      {addChannelOpen && (
        <AddTikTokChannelModal
          busy={crawling}
          progress={crawlProgress}
          onClose={() => setAddChannelOpen(false)}
          onSubmit={(username) => {
            setAddChannelOpen(false)
            void crawlChannel(username)
          }}
        />
      )}
    </div>
  )
}

/** Lấy @tên kênh từ link TikTok dán vào, hoặc từ chính chuỗi người dùng gõ. */
export function parseTikTokUsername(input: string): string {
  const text = input.trim()
  if (!text) return ''
  const fromUrl = text.match(/tiktok\.com\/@([\w.-]+)/i)
  if (fromUrl) return fromUrl[1]
  return text.replace(/^@/, '').replace(/[^\w.-]/g, '')
}

/** Dán link kênh TikTok để cào toàn bộ video về Kho — giống nút thêm kênh bên YouTube. */
function AddTikTokChannelModal({
  busy,
  progress,
  onClose,
  onSubmit,
}: {
  busy: boolean
  progress: string
  onClose: () => void
  onSubmit: (username: string) => void
}) {
  const [text, setText] = useState('')
  const username = parseTikTokUsername(text)

  return (
    <Modal title="Nhập kênh TikTok" onClose={onClose}>
      <label>
        Link kênh hoặc @tên
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://www.tiktok.com/@tenkenh  hoặc  @tenkenh"
        />
      </label>

      {username && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '8px 0 0' }}>
          Sẽ cào kênh <b>@{username}</b> về Kho của tôi. Kênh nhiều video thì chạy vài phút —
          TikTok chặn tốc độ nên phải lấy từng lô.
        </p>
      )}

      <button
        type="button"
        className="primary"
        style={{ width: '100%', marginTop: 12 }}
        disabled={!username || busy}
        onClick={() => onSubmit(username)}
      >
        {busy ? progress || 'Đang cào…' : 'Bắt đầu cào'}
      </button>
    </Modal>
  )
}
