import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Circle, Clapperboard, CornerDownLeft, ExternalLink, Film, Pause, Play, Plus, Radio, Search, SkipBack, SkipForward, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchYouTubeMeta, youtubeVideoId } from '../../lib/youtubeMeta'
import { Modal } from '../shared'
import type { CompletionStatus } from '../../lib/reviewSeries/types'
import './reviewSeries.css'

/** Bảng chưa được tạo trên Supabase — cần chạy migration 20260911000000_review_series.sql. */
const MISSING_TABLE_CODES = ['42P01', 'PGRST205']

/** Số thẻ mỗi lần tải. Kho có hàng nghìn series nên không thể lấy hết một lượt. */
const PAGE_SIZE = 48

type SeriesRow = {
  series_key: string
  platform: string
  creator_name: string | null
  title: string
  movie_title: string | null
  status: CompletionStatus
  expected_parts: number | null
  found_parts: number
  missing_parts: number[]
}

type VideoRow = {
  id: string
  video_id: string
  series_key: string | null
  title: string
  canonical_url: string
  embed_url: string
  thumbnail: string | null
  part_number: number | null
  published_at: string | null
  unavailable_at: string | null
}

/** Nhãn tiếng Việt + màu cho từng trạng thái đủ/thiếu phần. */
const STATUS: Record<CompletionStatus, { label: string; color: string }> = {
  COMPLETE: { label: 'Đủ phần', color: 'var(--green, #16a34a)' },
  POSSIBLY_COMPLETE: { label: 'Có thể đủ', color: 'var(--cyan, #0891b2)' },
  INCOMPLETE: { label: 'Còn thiếu', color: 'var(--amber, #d97706)' },
  STALLED: { label: 'Ngưng ra', color: 'var(--text-muted)' },
  UNKNOWN: { label: 'Chưa rõ', color: 'var(--text-muted)' },
  ERROR: { label: 'Lỗi', color: 'var(--rose, #e11d48)' },
}

const statusOf = (s: CompletionStatus) => STATUS[s] ?? STATUS.UNKNOWN

export type ParsedVideo = { videoId: string; url: string }

/**
 * Tách ô nhập nhiều dòng thành danh sách video theo đúng thứ tự đã dán —
 * thứ tự dán chính là thứ tự phần, người dùng chỉnh lại được trước khi lưu.
 */
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

/** Đổi chỗ hai phần tử. Dùng cho nút lên/xuống khi sắp thứ tự phần. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Tab Review phim: lưới thẻ series gom từ YouTube / TikTok, bấm vào xem ngay tại chỗ. */
export function ReviewSeriesView() {
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [covers, setCovers] = useState<Record<string, string>>({})
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [openSeries, setOpenSeries] = useState<SeriesRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [channelOpen, setChannelOpen] = useState(false)
  // Tăng lên sau khi thêm phim để bắt lưới tải lại; đổi `query` không đủ vì
  // React bỏ qua setState khi giá trị y hệt.
  const [reloadKey, setReloadKey] = useState(0)

  /** Ảnh bìa: lấy video đầu của mỗi series vừa tải, một lượt cho cả trang. */
  const loadCovers = async (rows: SeriesRow[]) => {
    const keys = rows.map((r) => r.series_key)
    if (!keys.length) return
    const res = await supabase
      ?.from('review_videos')
      .select('series_key,thumbnail,part_number')
      .in('series_key', keys)
      .not('thumbnail', 'is', null)
      .order('part_number', { ascending: true, nullsFirst: false })
    const next: Record<string, string> = {}
    for (const v of (res?.data ?? []) as { series_key: string; thumbnail: string }[]) {
      if (!next[v.series_key]) next[v.series_key] = v.thumbnail
    }
    setCovers((prev) => ({ ...next, ...prev }))
  }

  /** Đếm số phần đã xem của từng phim trong trang — một truy vấn cho cả lưới. */
  const loadSeenCounts = async (rows: SeriesRow[]) => {
    const keys = rows.map((r) => r.series_key)
    if (!keys.length) return
    const res = await supabase?.from('review_watched').select('series_key').in('series_key', keys)
    const next: Record<string, number> = {}
    for (const r of (res?.data ?? []) as { series_key: string }[]) {
      next[r.series_key] = (next[r.series_key] ?? 0) + 1
    }
    setSeenCounts((prev) => ({ ...prev, ...next }))
  }

  const fetchPage = async (from: number, q: string) => {
    let req = supabase
      ?.from('review_series')
      .select('series_key,platform,creator_name,title,movie_title,status,expected_parts,found_parts,missing_parts')
      .is('deleted_at', null)
    if (q) req = req?.or(`movie_title.ilike.%${q}%,title.ilike.%${q}%,creator_name.ilike.%${q}%`)
    const res = await req
      ?.order('found_parts', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (res?.error && MISSING_TABLE_CODES.includes(res.error.code ?? '')) setNeedsMigration(true)
    const rows = (res?.data ?? []) as SeriesRow[]
    setHasMore(rows.length === PAGE_SIZE)
    void loadCovers(rows)
    void loadSeenCounts(rows)
    return rows
  }

  // Gõ xong 300ms mới gọi server, không bắn một request mỗi phím.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let alive = true
    setLoading(true)
    void (async () => {
      const rows = await fetchPage(0, query)
      if (!alive) return
      setSeries(rows)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, reloadKey])

  const loadMore = async () => {
    setLoadingMore(true)
    const rows = await fetchPage(series.length, query)
    setSeries((prev) => [...prev, ...rows])
    setLoadingMore(false)
  }

  if (openSeries) {
    return <SeriesDetail series={openSeries} onBack={() => setOpenSeries(null)} />
  }

  return (
    <section className="rv-page">
      <div className="rv-bar">
        <Search size={15} style={{ color: 'var(--text-muted)' }} />
        <input
          className="rv-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm tên phim, kênh…"
        />
        <button className="rv-btn" onClick={() => setChannelOpen(true)}>
          <Radio size={14} /> Thêm kênh
        </button>
        <button className="rv-btn primary" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Thêm phim
        </button>
      </div>

      {needsMigration ? (
        <div className="rv-empty">
          Chưa có bảng review series. Chạy migration <code>20260911000000_review_series.sql</code>.
        </div>
      ) : loading ? (
        <div className="rv-empty">Đang tải…</div>
      ) : !series.length ? (
        <div className="rv-empty">
          {query ? `Không có phim nào khớp “${query}”.` : 'Chưa có phim nào. Bấm “Thêm phim” rồi dán link.'}
        </div>
      ) : (
        <>
          <div className="rv-grid">
            {series.map((s) => {
              const st = statusOf(s.status)
              const cover = covers[s.series_key]
              const seen = seenCounts[s.series_key] ?? 0
              return (
                <button key={s.series_key} className="rv-card" onClick={() => setOpenSeries(s)}>
                  <div className="rv-thumb">
                    {cover ? (
                      <img src={cover} alt="" loading="lazy" />
                    ) : (
                      <div className="rv-thumb-empty">
                        <Film size={26} />
                      </div>
                    )}
                    <span className="rv-badge" style={{ color: st.color }}>
                      {st.label}
                    </span>
                    <span className="rv-count">
                      {s.found_parts}
                      {s.expected_parts ? `/${s.expected_parts}` : ''} phần
                    </span>
                    {seen > 0 && (
                      <span className={`rv-seen-pill${seen >= s.found_parts ? ' done' : ''}`}>
                        {seen >= s.found_parts ? 'Đã xem xong' : `Đã xem ${seen}/${s.found_parts}`}
                      </span>
                    )}
                  </div>
                  <div className="rv-card-body">
                    <span className="rv-card-title">{s.movie_title || s.title}</span>
                    <span className="rv-card-sub">{s.creator_name || s.platform}</span>
                    {s.missing_parts?.length > 0 && (
                      <span className="rv-missing">
                        Thiếu phần {s.missing_parts.slice(0, 6).join(', ')}
                        {s.missing_parts.length > 6 ? '…' : ''}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {hasMore && (
            <button
              className="rv-btn"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              style={{ alignSelf: 'center' }}
            >
              {loadingMore ? 'Đang tải…' : 'Tải thêm'}
            </button>
          )}
        </>
      )}

      {addOpen && <AddMovieModal onClose={() => setAddOpen(false)} onSaved={() => setReloadKey((k) => k + 1)} />}
      {channelOpen && (
        <AddChannelModal onClose={() => setChannelOpen(false)} onSynced={() => setReloadKey((k) => k + 1)} />
      )}
    </section>
  )
}

/** Màn xem: trình phát nhúng bên trái, danh sách phần bên phải. */
function SeriesDetail({ series, onBack }: { series: SeriesRow; onBack: () => void }) {
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [autoplay, setAutoplay] = useState(false)

  useEffect(() => {
    void (async () => {
      const [videoRes, watchedRes] = await Promise.all([
        supabase
          ?.from('review_videos')
          .select('id,video_id,series_key,title,canonical_url,embed_url,thumbnail,part_number,published_at,unavailable_at')
          .eq('series_key', series.series_key)
          .order('part_number', { ascending: true, nullsFirst: false })
          .order('published_at', { ascending: true }),
        supabase?.from('review_watched').select('video_id').eq('series_key', series.series_key),
      ])

      const rows = (videoRes?.data ?? []) as VideoRow[]
      const seen = new Set((watchedRes?.data ?? []).map((r: { video_id: string }) => r.video_id))
      setVideos(rows)
      setWatched(seen)
      // Mở sẵn phần chưa xem đầu tiên; xem hết rồi thì quay về phần đầu.
      const next = rows.find((v) => !v.unavailable_at && !seen.has(v.video_id))
      setPlayingId((next ?? rows.find((v) => !v.unavailable_at))?.id ?? null)
      setLoading(false)
    })()
  }, [series.series_key])

  /** Đánh dấu đã xem / bỏ đánh dấu. Cập nhật giao diện trước rồi mới ghi. */
  const toggleWatched = async (video: VideoRow) => {
    const isWatched = watched.has(video.video_id)
    setWatched((prev) => {
      const next = new Set(prev)
      if (isWatched) next.delete(video.video_id)
      else next.add(video.video_id)
      return next
    })

    const { error } = isWatched
      ? await supabase!.from('review_watched').delete().eq('platform', 'youtube').eq('video_id', video.video_id)
      : await supabase!.from('review_watched').upsert(
          { platform: 'youtube', video_id: video.video_id, series_key: series.series_key },
          { onConflict: 'user_id,platform,video_id' },
        )

    // Ghi hỏng thì trả giao diện về đúng sự thật, không để người dùng tin nhầm.
    if (error) {
      setWatched((prev) => {
        const next = new Set(prev)
        if (isWatched) next.add(video.video_id)
        else next.delete(video.video_id)
        return next
      })
    }
  }

  const playing = useMemo(() => videos.find((v) => v.id === playingId) ?? null, [videos, playingId])
  const st = statusOf(series.status)

  // Chỉ tự chạy khi người dùng tự chọn phần; mở trang mà video tự phát là phiền.
  const playable = useMemo(() => videos.filter((v) => !v.unavailable_at), [videos])
  const at = playable.findIndex((v) => v.id === playingId)

  const jump = (step: number) => {
    const next = playable[at + step]
    if (!next) return
    setPlayingId(next.id)
    setAutoplay(true)
    if (!watched.has(next.video_id)) void toggleWatched(next)
  }

  return (
    <section className="rv-page">
      <div className="rv-bar">
        <button className="rv-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Quay lại
        </button>
        <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: '0.92rem' }}>
          {series.movie_title || series.title}
        </span>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: st.color }}>{st.label}</span>
      </div>

      <div className="rv-detail">
        <div>
          <div className="rv-player-wrap">
            {playing ? (
              <iframe
                key={playing.id}
                src={autoplay ? `${playing.embed_url}?autoplay=1` : playing.embed_url}
                title={playing.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="rv-thumb-empty">
                <Clapperboard size={30} />
              </div>
            )}
          </div>

          {playing && (
            <>
              <div style={{ marginTop: 8, fontSize: '0.86rem', fontWeight: 700, lineHeight: 1.35 }}>
                {playing.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button className="rv-btn" onClick={() => jump(-1)} disabled={at <= 0}>
                  <SkipBack size={13} /> Phần trước
                </button>
                <button className="rv-btn" onClick={() => jump(1)} disabled={at < 0 || at >= playable.length - 1}>
                  Phần sau <SkipForward size={13} />
                </button>
                <span style={{ flex: 1 }} />
                <a className="rv-btn" href={playing.canonical_url} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} /> Mở trên YouTube
                </a>
              </div>
            </>
          )}

          <div className="rv-hint">
            {series.creator_name || series.platform} · {series.found_parts}
            {series.expected_parts ? `/${series.expected_parts}` : ''} phần
            {videos.length > 0 && ` · đã xem ${watched.size}/${videos.length}`}
            {series.missing_parts?.length ? ` · thiếu phần ${series.missing_parts.join(', ')}` : ''}
          </div>
        </div>

        <div className="rv-episodes">
          {loading ? (
            <div className="rv-hint" style={{ padding: 8 }}>
              Đang tải…
            </div>
          ) : (
            videos.map((v) => {
              const seen = watched.has(v.video_id)
              return (
                <div
                  key={v.id}
                  className={`rv-episode${v.id === playingId ? ' active' : ''}${v.unavailable_at ? ' gone' : ''}${seen ? ' seen' : ''}`}
                >
                  <button
                    className="rv-episode-main"
                    onClick={() => {
                      if (v.unavailable_at) return
                      setPlayingId(v.id)
                      setAutoplay(true)
                      // Bấm xem là coi như đã xem; bỏ đánh dấu bằng nút bên phải.
                      if (!seen) void toggleWatched(v)
                    }}
                    title={v.unavailable_at ? 'Video đã bị gỡ khỏi nền tảng' : v.title}
                  >
                    {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" /> : <Play size={14} />}
                    <span className="rv-episode-title">
                      {v.part_number ? `#${v.part_number} · ` : ''}
                      {v.title}
                    </span>
                  </button>
                  <button
                    className="rv-seen-btn"
                    onClick={() => void toggleWatched(v)}
                    aria-pressed={seen}
                    title={seen ? 'Bỏ đánh dấu đã xem' : 'Đánh dấu đã xem'}
                  >
                    {seen ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}

/** Nhận ra link kênh YouTube: /@handle, /channel/UC…, /c/…, /user/… */
export function isChannelUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.replace(/^www\./, '')
    if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return false
    return /^\/(@[^/]+|channel\/UC[\w-]+|c\/[^/]+|user\/[^/]+)/.test(parsed.pathname)
  } catch {
    return false
  }
}

type ChannelState = { url: string; status: 'chờ' | 'đang chạy' | 'xong' | 'dừng' | 'lỗi'; note: string }

const post = async (body: unknown) => {
  const res = await fetch('/api/sync-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

/**
 * Dán link kênh, server tải hết video rồi tự gom thành series theo phim.
 *
 * Chạy tuần tự từng kênh: quota YouTube tính theo lượt gọi, bắn song song chỉ
 * làm cạn quota nhanh hơn chứ không nhanh hơn bao nhiêu.
 */
function AddChannelModal({ onClose, onSynced }: { onClose: () => void; onSynced: () => void }) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ChannelState[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  // Cờ dừng đọc ngay trong vòng lặp nên phải là ref — state cập nhật bất đồng bộ,
  // vòng lặp sẽ chạy thêm cả trang nữa mới thấy.
  const stopRef = useRef(false)

  const urls = useMemo(
    () => [...new Set(text.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean))],
    [text],
  )
  const valid = useMemo(() => urls.filter(isChannelUrl), [urls])
  const invalid = useMemo(() => urls.filter((u) => !isChannelUrl(u)), [urls])

  /** Tải một kênh, trang một, ghi ngay từng trang. Trả số video đã lưu. */
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

        // Uploads xếp mới nhất trước: gặp nguyên trang toàn video đã có nghĩa là
        // phần còn lại cũng đã có, khỏi duyệt tiếp cho tốn quota.
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
        placeholder={'Dán link kênh, mỗi dòng một kênh:\nhttps://www.youtube.com/@Cúckickreview\nhttps://www.youtube.com/@phephim'}
      />

      <div className="rv-hint">
        Nhận được <strong>{valid.length}</strong> link kênh. Server sẽ tải video rồi tự gom thành từng phim.
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
              <span className="rv-episode-title">
                {r.url}
                {r.note && ` · ${r.note}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rv-hint">
        Mỗi lần bấm lấy khoảng <strong>300 video mới nhất</strong> mỗi playlist — serverless bị cắt sau 60 giây. Muốn
        vét sạch kênh vài nghìn video thì chạy <code>npm run crawl:reviews</code> ở máy.
      </div>

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

/**
 * Thêm một phim: dán một hoặc nhiều link video, sắp thứ tự phần rồi lưu.
 *
 * Tiêu đề lấy qua oEmbed công khai nên không cần API key — link hỏng hay video
 * riêng tư thì vẫn lưu được, chỉ là để tạm tên theo số phần.
 */
function AddMovieModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<'paste' | 'order'>('paste')
  const [text, setText] = useState('')
  const [movie, setMovie] = useState('')
  const [parts, setParts] = useState<DraftPart[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boxRef = useRef<HTMLTextAreaElement>(null)

  const { valid, invalid } = useMemo(() => parseVideoLinks(text), [text])

  /** Chèn xuống dòng ngay tại con trỏ — bàn phím điện thoại hay thiếu phím này. */
  const insertNewline = () => {
    const box = boxRef.current
    const at = box?.selectionStart ?? text.length
    const end = box?.selectionEnd ?? at
    setText(text.slice(0, at) + '\n' + text.slice(end))
    // Đặt lại con trỏ sau khi React vẽ xong, nếu không nó nhảy về cuối ô.
    requestAnimationFrame(() => {
      box?.focus()
      box?.setSelectionRange(at + 1, at + 1)
    })
  }

  /** Đọc tiêu đề từng video rồi sang bước sắp thứ tự. */
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
        // Người dùng tự khai đủ danh sách nên đây là bằng chứng cứng nhất.
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
    <Modal title="🎬 Thêm phim" onClose={onClose}>
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
            Nhận được <strong>{valid.length}</strong> link. Một link cũng được — khi đó phim chỉ có một phần.
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
                <span className="rv-order-num">#{i + 1}</span>
                <img src={p.thumbnail} alt="" loading="lazy" />
                <span className="rv-episode-title">{p.title}</span>
                <button
                  className="rv-btn rv-icon"
                  onClick={() => setParts((v) => moveItem(v, i, i - 1))}
                  disabled={i === 0}
                  title="Lên"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  className="rv-btn rv-icon"
                  onClick={() => setParts((v) => moveItem(v, i, i + 1))}
                  disabled={i === parts.length - 1}
                  title="Xuống"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  className="rv-btn rv-icon"
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
