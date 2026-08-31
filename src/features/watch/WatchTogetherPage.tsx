import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ExternalLink,
  Inbox,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  Sparkles,
  Play,
  Search,
  Users,
  CheckCircle2,
  Film,
  BookOpen,
  Headphones,
  FileText,
  X,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ToastContext'
import { Avatar, RenameContactModal } from './WatchTogetherButton'
import {
  emailLabel,
  rememberRef,
  unshare,
  updateMyShareProgress,
  useMyUserId,
  usePeople,
  useWatchFeed,
  type WatchPerson,
  type WatchShare,
  type WatchKind,
} from '../../lib/watchTogether'
import { useVideoProgressMap } from '../../lib/videoProgress'
import { getVideoStatusSets, useVideoStatusListener } from '../../lib/videoStatus'
import { useMangaReadingLogs } from '../../lib/mangaReadingLog'

const KIND_META: Record<WatchKind, { label: string; icon: LucideIcon; color: string }> = {
  VIDEO: { label: 'Video', icon: Film, color: '#8b5cf6' },
  MANGA: { label: 'Truyện', icon: BookOpen, color: '#10b981' },
  MUSIC: { label: 'Nhạc', icon: Headphones, color: '#f59e0b' },
  BOOK: { label: 'Sách', icon: FileText, color: '#06b6d4' },
  OTHER: { label: 'Khác', icon: Sparkles, color: '#ec4899' },
}

type Box = 'INBOX' | 'SENT'
type FilterState = 'ALL' | 'BOTH_WATCHING' | 'BOTH_DONE' | 'WAITING' | 'VIDEO' | 'MANGA'

interface ProgressInfo {
  percent: number
  text: string
  isDone: boolean
  isStarted: boolean
}

interface DualProgressPair {
  share: WatchShare
  partnerPerson?: WatchPerson
  partnerLabel: string
  partnerAvatarUrl?: string | null
  partnerProgress: ProgressInfo
  myProgress: ProgressInfo
  syncState: 'BOTH_DONE' | 'BOTH_WATCHING' | 'MY_DONE_WAITING' | 'PARTNER_DONE_WAITING' | 'MY_STARTED' | 'PARTNER_STARTED' | 'NOT_STARTED'
  syncBadgeLabel: string
  syncBadgeVariant: 'success' | 'watching' | 'waiting' | 'partner' | 'info' | 'neutral'
  diffPercent: number
}

/**
 * Trang Xem Chung: Đồng bộ và hiển thị song song tiến độ của CẢ 2 NGƯỜI
 * (Bạn và Người thương / Vợ / Chồng) với giao diện hiện đại, trực quan theo thời gian thực.
 */
export function WatchTogetherPage() {
  const { shares, loading, reload } = useWatchFeed()
  const { people, reload: reloadPeople } = usePeople()
  const myId = useMyUserId()
  const [box, setBox] = useState<Box>('INBOX')
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState<FilterState>('ALL')
  const [renaming, setRenaming] = useState<WatchPerson | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Lắng nghe tiến độ Video & Trạng thái xem
  const progressMap = useVideoProgressMap()
  const [watchedSet, setWatchedSet] = useState<Set<string>>(() => {
    const tv = getVideoStatusSets('tvshow')
    const rev = getVideoStatusSets('review')
    return new Set([...tv.watchedSet, ...rev.watchedSet])
  })

  useVideoStatusListener(() => {
    const tv = getVideoStatusSets('tvshow')
    const rev = getVideoStatusSets('review')
    setWatchedSet(new Set([...tv.watchedSet, ...rev.watchedSet]))
  })

  // Lịch sử đọc Truyện
  const mangaLogs = useMangaReadingLogs()

  /** Email → Người trong danh bạ */
  const byEmail = useMemo(() => {
    const map = new Map<string, WatchPerson>()
    for (const p of people) map.set(p.email.toLowerCase(), p)
    return map
  }, [people])

  const inboxShares = useMemo(() => shares.filter((s) => s.sender_id !== myId), [shares, myId])
  const sentShares = useMemo(() => shares.filter((s) => s.sender_id === myId), [shares, myId])

  // Xử lý làm mới dữ liệu
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await reload()
      reloadPeople()
      showToast('🔄 Đã làm mới danh sách xem chung', 'info')
    } catch {
      showToast('Không thể làm mới danh sách', 'error')
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  // Chuyển đổi và tính toán Tiến độ Cả 2 Người cho từng mục
  const dualInboxPairs = useMemo(() => {
    return inboxShares.map((s): DualProgressPair => {
      const email = s.sender_email
      const person = email ? byEmail.get(email.toLowerCase()) : undefined
      const partnerLabel = person?.label ?? emailLabel(email)

      // 1. Tiến độ của Đối phương (Người gửi cho mình)
      const partnerPercent = Math.max(0, Math.min(100, Math.round(s.percent || 0)))
      const partnerDone = partnerPercent >= 90
      const partnerStarted = partnerPercent > 0
      const partnerText = s.progress_text || (partnerDone ? 'Đã xem xong' : partnerStarted ? `Đang xem ${partnerPercent}%` : 'Chưa xem')

      // 2. Tiến độ của Bạn (Người nhận)
      let myPercent = 0
      let myText = 'Chưa xem'

      // Tìm dòng phản hồi nếu có
      const myReciprocal = shares.find(
        (other) => other.sender_id === myId && other.ref_id === s.ref_id && other.kind === s.kind
      )

      if (s.kind === 'VIDEO') {
        const vProg = progressMap[s.ref_id]
        const isWatched = watchedSet.has(s.ref_id) || (vProg?.percent ?? 0) >= 90 || vProg?.status === 'COMPLETED'
        myPercent = isWatched ? 100 : Math.max(vProg?.percent ?? 0, myReciprocal?.percent ?? 0)
        myText = isWatched ? 'Đã xem xong' : myPercent > 0 ? `Đang xem ${myPercent}%` : 'Chưa xem'
      } else if (s.kind === 'MANGA') {
        const mLog = mangaLogs.find(
          (l) => l.mangaSlug === s.ref_id || (l.mangaTitle && l.mangaTitle.toLowerCase() === s.title.toLowerCase())
        )
        if (mLog) {
          if (mLog.status === 'COMPLETED') {
            myPercent = 100
            myText = 'Đã đọc xong'
          } else {
            myPercent = Math.min(95, Math.max(15, mLog.chapterNumber * 5))
            myText = `Đã đọc Chap ${mLog.chapterNumber}`
          }
        } else if (myReciprocal) {
          myPercent = myReciprocal.percent
          myText = myReciprocal.progress_text || (myPercent >= 90 ? 'Đã đọc xong' : `Đang đọc ${myPercent}%`)
        } else {
          myPercent = 0
          myText = 'Chưa đọc'
        }
      } else {
        if (myReciprocal) {
          myPercent = myReciprocal.percent
          myText = myReciprocal.progress_text || (myPercent >= 90 ? 'Đã xong' : `Đang xem ${myPercent}%`)
        }
      }

      const myDone = myPercent >= 90
      const myStarted = myPercent > 0

      // 3. Phân tích Trạng thái đồng bộ (Sync State)
      let syncState: DualProgressPair['syncState'] = 'NOT_STARTED'
      let syncBadgeLabel = '💤 Cả hai chưa bắt đầu'
      let syncBadgeVariant: DualProgressPair['syncBadgeVariant'] = 'neutral'
      const diffPercent = Math.abs(myPercent - partnerPercent)

      if (myDone && partnerDone) {
        syncState = 'BOTH_DONE'
        syncBadgeLabel = '🎉 Cả 2 đã xem xong!'
        syncBadgeVariant = 'success'
      } else if (myDone && !partnerDone) {
        syncState = 'MY_DONE_WAITING'
        syncBadgeLabel = `⏳ Bạn đã xem xong · Đang đợi ${partnerLabel}`
        syncBadgeVariant = 'waiting'
      } else if (!myDone && partnerDone) {
        syncState = 'PARTNER_DONE_WAITING'
        syncBadgeLabel = `👀 ${partnerLabel} đã xem xong · Đến lượt bạn xem!`
        syncBadgeVariant = 'partner'
      } else if (myStarted && partnerStarted) {
        syncState = 'BOTH_WATCHING'
        if (myPercent >= partnerPercent + 5) {
          syncBadgeLabel = `⚡ Bạn đang xem trước (+${diffPercent}%)`
        } else if (partnerPercent >= myPercent + 5) {
          syncBadgeLabel = `🔥 ${partnerLabel} đang xem trước (+${diffPercent}%)`
        } else {
          syncBadgeLabel = '🍿 Cả hai đang cùng theo dõi (tiến độ tương đương)'
        }
        syncBadgeVariant = 'watching'
      } else if (myStarted && !partnerStarted) {
        syncState = 'MY_STARTED'
        syncBadgeLabel = `▶️ Bạn đang xem ${myPercent}% · ${partnerLabel} chưa bắt đầu`
        syncBadgeVariant = 'info'
      } else if (!myStarted && partnerStarted) {
        syncState = 'PARTNER_STARTED'
        syncBadgeLabel = `✨ ${partnerLabel} đang xem ${partnerPercent}% · Hãy vào xem cùng nhé!`
        syncBadgeVariant = 'partner'
      }

      return {
        share: s,
        partnerPerson: person,
        partnerLabel,
        partnerAvatarUrl: person?.avatarUrl,
        partnerProgress: { percent: partnerPercent, text: partnerText, isDone: partnerDone, isStarted: partnerStarted },
        myProgress: { percent: myPercent, text: myText, isDone: myDone, isStarted: myStarted },
        syncState,
        syncBadgeLabel,
        syncBadgeVariant,
        diffPercent,
      }
    })
  }, [inboxShares, shares, byEmail, myId, progressMap, watchedSet, mangaLogs])

  const dualSentPairs = useMemo(() => {
    return sentShares.map((s): DualProgressPair => {
      const email = s.recipient_email
      const person = email ? byEmail.get(email.toLowerCase()) : undefined
      const partnerLabel = person?.label ?? emailLabel(email)

      // 1. Tiến độ của Bạn (Người gửi)
      let myPercent = Math.max(0, Math.min(100, Math.round(s.percent || 0)))
      if (s.kind === 'VIDEO') {
        const vProg = progressMap[s.ref_id]
        if (watchedSet.has(s.ref_id) || (vProg?.percent ?? 0) >= 90) {
          myPercent = 100
        } else if (vProg?.percent) {
          myPercent = Math.max(myPercent, vProg.percent)
        }
      }
      const myDone = myPercent >= 90
      const myStarted = myPercent > 0
      const myText = s.progress_text || (myDone ? 'Đã xem xong' : myStarted ? `Đang xem ${myPercent}%` : 'Chưa xem')

      // 2. Tiến độ của Đối phương (Người nhận)
      const partnerReciprocal = shares.find(
        (other) => other.sender_id === s.recipient_id && other.ref_id === s.ref_id && other.kind === s.kind
      )
      const partnerPercent = partnerReciprocal ? Math.max(0, Math.min(100, Math.round(partnerReciprocal.percent || 0))) : 0
      const partnerDone = partnerPercent >= 90
      const partnerStarted = partnerPercent > 0
      const partnerText = partnerReciprocal?.progress_text || (partnerDone ? 'Đã xem xong' : partnerStarted ? `Đang xem ${partnerPercent}%` : 'Chưa xem')

      // 3. Phân tích Trạng thái đồng bộ
      let syncState: DualProgressPair['syncState'] = 'NOT_STARTED'
      let syncBadgeLabel = '💤 Cả hai chưa bắt đầu'
      let syncBadgeVariant: DualProgressPair['syncBadgeVariant'] = 'neutral'
      const diffPercent = Math.abs(myPercent - partnerPercent)

      if (myDone && partnerDone) {
        syncState = 'BOTH_DONE'
        syncBadgeLabel = '🎉 Cả 2 đã xem xong!'
        syncBadgeVariant = 'success'
      } else if (myDone && !partnerDone) {
        syncState = 'MY_DONE_WAITING'
        syncBadgeLabel = `⏳ Bạn đã xem xong · Đang đợi ${partnerLabel}`
        syncBadgeVariant = 'waiting'
      } else if (!myDone && partnerDone) {
        syncState = 'PARTNER_DONE_WAITING'
        syncBadgeLabel = `👀 ${partnerLabel} đã xem xong · Đến lượt bạn xem!`
        syncBadgeVariant = 'partner'
      } else if (myStarted && partnerStarted) {
        syncState = 'BOTH_WATCHING'
        if (myPercent >= partnerPercent + 5) {
          syncBadgeLabel = `⚡ Bạn đang xem trước (+${diffPercent}%)`
        } else if (partnerPercent >= myPercent + 5) {
          syncBadgeLabel = `🔥 ${partnerLabel} đang xem trước (+${diffPercent}%)`
        } else {
          syncBadgeLabel = '🍿 Cả hai đang cùng theo dõi (tiến độ tương đương)'
        }
        syncBadgeVariant = 'watching'
      } else if (myStarted && !partnerStarted) {
        syncState = 'MY_STARTED'
        syncBadgeLabel = `▶️ Bạn đang xem ${myPercent}% · ${partnerLabel} chưa bắt đầu`
        syncBadgeVariant = 'info'
      } else if (!myStarted && partnerStarted) {
        syncState = 'PARTNER_STARTED'
        syncBadgeLabel = `✨ ${partnerLabel} đang xem ${partnerPercent}% · Hãy vào xem cùng nhé!`
        syncBadgeVariant = 'partner'
      }

      return {
        share: s,
        partnerPerson: person,
        partnerLabel,
        partnerAvatarUrl: person?.avatarUrl,
        partnerProgress: { percent: partnerPercent, text: partnerText, isDone: partnerDone, isStarted: partnerStarted },
        myProgress: { percent: myPercent, text: myText, isDone: myDone, isStarted: myStarted },
        syncState,
        syncBadgeLabel,
        syncBadgeVariant,
        diffPercent,
      }
    })
  }, [sentShares, shares, byEmail, myId, progressMap, watchedSet])

  // Danh sách hiển thị theo Hộp thư và Bộ lọc
  const activePairs = box === 'INBOX' ? dualInboxPairs : dualSentPairs

  // Đồng bộ tiến độ thực tế lên Supabase watch_shares 1 lần mỗi khi có tiến độ mới (chống loop re-render giật giật)
  const syncedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!supabase || !myId) return
    activePairs.forEach((pair) => {
      const kind = pair.share.kind
      const refId = pair.share.ref_id
      const myLocalPercent = pair.myProgress.percent
      const myLocalText = pair.myProgress.text
      const syncKey = `${kind}:${refId}:${myLocalPercent}`

      if (myLocalPercent > 0 && !syncedRef.current.has(syncKey)) {
        syncedRef.current.add(syncKey)
        void updateMyShareProgress(kind, refId, myLocalPercent, myLocalText)
      }
    })
  }, [activePairs, myId])

  // Thống kê nhanh
  const stats = useMemo(() => {
    let bothWatching = 0
    let bothDone = 0
    let waiting = 0

    activePairs.forEach((p) => {
      if (p.syncState === 'BOTH_DONE') bothDone++
      else if (p.syncState === 'BOTH_WATCHING') bothWatching++
      else if (p.syncState === 'MY_DONE_WAITING' || p.syncState === 'PARTNER_DONE_WAITING') waiting++
    })

    return {
      total: activePairs.length,
      bothWatching,
      bothDone,
      waiting,
    }
  }, [activePairs])

  // Lọc theo tìm kiếm và tiêu chí
  const filteredPairs = useMemo(() => {
    let result = activePairs

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (p) =>
          p.share.title.toLowerCase().includes(q) ||
          p.partnerLabel.toLowerCase().includes(q) ||
          (p.share.subtitle && p.share.subtitle.toLowerCase().includes(q))
      )
    }

    if (filterState === 'BOTH_WATCHING') {
      result = result.filter((p) => p.syncState === 'BOTH_WATCHING')
    } else if (filterState === 'BOTH_DONE') {
      result = result.filter((p) => p.syncState === 'BOTH_DONE')
    } else if (filterState === 'WAITING') {
      result = result.filter((p) => p.syncState === 'MY_DONE_WAITING' || p.syncState === 'PARTNER_DONE_WAITING')
    } else if (filterState === 'VIDEO') {
      result = result.filter((p) => p.share.kind === 'VIDEO')
    } else if (filterState === 'MANGA') {
      result = result.filter((p) => p.share.kind === 'MANGA')
    }

    return result
  }, [activePairs, search, filterState])

  // Mở mục để xem / đọc
  const openItem = (s: WatchShare) => {
    rememberRef(`${s.kind}:${s.ref_id}`)
    if (s.kind === 'VIDEO') {
      navigate(`/youtube/watch/${s.ref_id}`, {
        state: {
          from: '/watch',
          fromLabel: 'Xem chung',
          title: s.title,
          channelName: s.subtitle || undefined,
          thumbnail: s.thumbnail,
        },
      })
    } else if (s.kind === 'MANGA') {
      if (s.url && s.url.startsWith('/')) {
        navigate(s.url)
      } else if (s.url) {
        window.open(s.url, '_blank', 'noopener')
      } else {
        navigate(`/manga`)
      }
    } else if (s.url) {
      if (s.url.startsWith('/')) {
        navigate(s.url)
      } else {
        window.open(s.url, '_blank', 'noopener')
      }
    } else {
      showToast('Mục này không có đường mở trực tiếp.', 'info')
    }
  }

  // Gỡ mục khỏi danh sách xem chung
  const remove = async (s: WatchShare) => {
    if (!confirm(`Gỡ "${s.title}" khỏi danh sách xem chung?`)) return
    try {
      await unshare(s.id)
      void reload()
      showToast('🗑️ Đã gỡ khỏi xem chung', 'info')
    } catch (err) {
      showToast(`❌ Không gỡ được: ${err instanceof Error ? err.message : err}`, 'error')
    }
  }

  return (
    <div className="watch-page-container">
      {/* 1. HERO BANNER & THỐNG KÊ NHANH */}
      <div className="watch-hero-card">
        <div className="watch-hero-header">
          <div className="watch-hero-title-group">
            <div className="watch-hero-icon-wrap">
              <Users size={17} className="watch-hero-sparkle" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="watch-hero-title">Xem Chung Cùng Nhau</h1>
              <p className="watch-hero-subtitle">
                Đồng bộ tiến độ video & truyện theo thời gian thực giữa hai người
              </p>
            </div>
          </div>

          <button
            type="button"
            className={`watch-refresh-pill ${isRefreshing ? 'spinning' : ''}`}
            onClick={() => void handleRefresh()}
            title="Làm mới tiến độ"
          >
            <RefreshCw size={13} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Thanh Thống Kê Nhanh */}
        <div className="watch-stats-grid">
          <div className="watch-stat-box" onClick={() => setFilterState('ALL')}>
            <span className="watch-stat-number">{stats.total}</span>
            <span className="watch-stat-label">Tổng mục</span>
          </div>
          <div
            className={`watch-stat-box ${filterState === 'BOTH_WATCHING' ? 'active' : ''}`}
            onClick={() => setFilterState(filterState === 'BOTH_WATCHING' ? 'ALL' : 'BOTH_WATCHING')}
          >
            <span className="watch-stat-number highlight-fire">🔥 {stats.bothWatching}</span>
            <span className="watch-stat-label">Cùng xem</span>
          </div>
          <div
            className={`watch-stat-box ${filterState === 'BOTH_DONE' ? 'active' : ''}`}
            onClick={() => setFilterState(filterState === 'BOTH_DONE' ? 'ALL' : 'BOTH_DONE')}
          >
            <span className="watch-stat-number highlight-check">🎉 {stats.bothDone}</span>
            <span className="watch-stat-label">Xong cả 2</span>
          </div>
          <div
            className={`watch-stat-box ${filterState === 'WAITING' ? 'active' : ''}`}
            onClick={() => setFilterState(filterState === 'WAITING' ? 'ALL' : 'WAITING')}
          >
            <span className="watch-stat-number highlight-wait">⏳ {stats.waiting}</span>
            <span className="watch-stat-label">Đang đợi</span>
          </div>
        </div>
      </div>

      {/* 2. THANH ĐIỀU HƯỚNG TAB & BỘ LỌC TÌM KIẾM */}
      <div className="watch-controls-bar">
        <div className="watch-tabs-segmented">
          <button
            type="button"
            className={`watch-tab-segment ${box === 'INBOX' ? 'active' : ''}`}
            onClick={() => setBox('INBOX')}
          >
            <Inbox size={15} />
            <span>Được gửi cho mình</span>
            <span className="watch-tab-badge">{dualInboxPairs.length}</span>
          </button>
          <button
            type="button"
            className={`watch-tab-segment ${box === 'SENT' ? 'active' : ''}`}
            onClick={() => setBox('SENT')}
          >
            <Send size={15} />
            <span>Mình đã gửi</span>
            <span className="watch-tab-badge">{dualSentPairs.length}</span>
          </button>
        </div>

        {/* Ô Tìm Kiếm Nhanh */}
        <div className="watch-search-wrap">
          <Search size={15} className="watch-search-icon" />
          <input
            type="text"
            className="watch-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề, người gửi..."
          />
          {search && (
            <button type="button" className="watch-search-clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Bộ Lọc Thể Loại & Trạng Thái Nhanh */}
      <div className="watch-filter-chips-row">
        {([
          { id: 'ALL', label: 'Tất cả' },
          { id: 'BOTH_WATCHING', label: '🔥 Đang cùng xem' },
          { id: 'BOTH_DONE', label: '🎉 Xong cả hai' },
          { id: 'WAITING', label: '⏳ Đang đợi' },
          { id: 'VIDEO', label: '🎬 Video' },
          { id: 'MANGA', label: '📖 Truyện' },
        ] as const).map((f) => (
          <button
            key={f.id}
            type="button"
            className={`watch-filter-chip ${filterState === f.id ? 'active' : ''}`}
            onClick={() => setFilterState(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 3. DANH SÁCH MỤC XEM CHUNG VỚI DUAL PROGRESS */}
      {loading ? (
        <div className="watch-loading-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="watch-skeleton-card" />
          ))}
        </div>
      ) : filteredPairs.length === 0 ? (
        <div className="watch-empty-state">
          <div className="watch-empty-icon-glow">
            {box === 'INBOX' ? <Inbox size={32} /> : <Send size={32} />}
          </div>
          <h3 className="watch-empty-title">
            {search || filterState !== 'ALL'
              ? 'Không tìm thấy mục xem chung phù hợp'
              : box === 'INBOX'
              ? 'Chưa có ai gửi mục xem chung cho bạn'
              : 'Bạn chưa gửi mục xem chung nào'}
          </h3>
          <p className="watch-empty-desc">
            {box === 'INBOX'
              ? 'Khi đối phương bấm “Xem chung” trên bất kỳ Video, Truyện tranh hay Sách nào, tiến độ sẽ tự động hiển thị ở đây.'
              : 'Hãy mở Video YouTube hoặc Truyện yêu thích, nhấn nút “Xem chung” để cùng theo dõi với người thương nhé!'}
          </p>
          {(search || filterState !== 'ALL') && (
            <button
              type="button"
              className="tv-btn primary"
              style={{ marginTop: 10, padding: '8px 18px', borderRadius: 12, fontSize: '0.82rem' }}
              onClick={() => {
                setSearch('')
                setFilterState('ALL')
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="watch-cards-list">
          {filteredPairs.map((pair) => (
            <DualShareCard
              key={pair.share.id}
              pair={pair}
              box={box}
              onOpen={() => openItem(pair.share)}
              onRename={pair.partnerPerson ? () => setRenaming(pair.partnerPerson!) : undefined}
              onRemove={() => void remove(pair.share)}
            />
          ))}
        </div>
      )}

      {/* Modal Đổi Tên Liên Hệ */}
      {renaming && (
        <RenameContactModal
          person={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => {
            setRenaming(null)
            reloadPeople()
          }}
        />
      )}
    </div>
  )
}

/**
 * Thẻ hiển thị Song Song Tiến Độ Của Cả 2 Người (Dual Progress Card)
 */
function DualShareCard({
  pair,
  box,
  onOpen,
  onRename,
  onRemove,
}: {
  pair: DualProgressPair
  box: Box
  onOpen: () => void
  onRename?: () => void
  onRemove?: () => void
}) {
  const { share: s, partnerLabel, partnerPerson, partnerProgress, myProgress, syncBadgeLabel, syncBadgeVariant } = pair
  const kindMeta = KIND_META[s.kind] || KIND_META.OTHER
  const KindIcon = kindMeta.icon

  // Format ngày/giờ gửi
  const timeAgo = useMemo(() => {
    try {
      const d = new Date(s.updated_at || s.created_at)
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }, [s.updated_at, s.created_at])

  return (
    <article className={`watch-card-dual ${pair.syncState === 'BOTH_DONE' ? 'both-done-glow' : ''}`}>
      {/* KHỐI TRÊN: ẢNH + TIÊU ĐỀ + THÔNG TIN NGƯỜI GỬI + CÁC NÚT THAO TÁC */}
      <div className="watch-card-top-row">
        {/* Ảnh thumbnail nhỏ gọn có nút Play overlay */}
        <div className="watch-thumb-wrapper" onClick={onOpen} role="button" tabIndex={0}>
          {s.thumbnail ? (
            <img src={s.thumbnail} alt={s.title} className="watch-thumb-img" loading="lazy" />
          ) : (
            <div className="watch-thumb-placeholder">
              <KindIcon size={18} />
            </div>
          )}
          {/* Badge phân loại media */}
          <span className="watch-kind-pill" style={{ background: `linear-gradient(135deg, ${kindMeta.color}, #4f46e5)` }}>
            <KindIcon size={9} />
            <span>{kindMeta.label}</span>
          </span>

          {/* Hover Play Button */}
          <div className="watch-thumb-play-overlay">
            <Play size={16} fill="#ffffff" />
          </div>
        </div>

        {/* Thông tin chính */}
        <div className="watch-card-main-info">
          <h3 className="watch-card-title-text" onClick={onOpen} title={s.title}>
            {s.title}
          </h3>

          <div className="watch-card-meta-line">
            {partnerPerson ? (
              <span className="watch-partner-chip" onClick={onRename} title="Bấm để đổi tên">
                <Avatar person={partnerPerson} size={15} />
                <span className="watch-partner-name">
                  {box === 'INBOX' ? 'Từ' : 'Gửi'} <b>{partnerLabel}</b>
                </span>
              </span>
            ) : (
              <span className="watch-partner-chip">
                <Users size={12} />
                <span className="watch-partner-name">
                  {box === 'INBOX' ? 'Từ' : 'Gửi'} <b>{partnerLabel}</b>
                </span>
              </span>
            )}

            {s.subtitle && <span className="watch-card-subtitle-tag">{s.subtitle}</span>}
            {timeAgo && <span className="watch-card-time-text">· {timeAgo}</span>}
          </div>
        </div>

        {/* Nút thao tác nhanh bên phải */}
        <div className="watch-card-action-buttons">
          <button
            type="button"
            className="watch-btn-play-primary"
            onClick={onOpen}
            title={s.kind === 'MANGA' ? 'Đọc ngay' : 'Xem ngay'}
          >
            <Play size={12} fill="currentColor" />
            <span>{s.kind === 'MANGA' ? 'Đọc' : 'Xem'}</span>
          </button>

          {onRename && (
            <button
              type="button"
              className="watch-btn-icon-soft"
              onClick={onRename}
              title="Đặt tên cho người này"
              aria-label="Đổi tên liên hệ"
            >
              <Pencil size={13} />
            </button>
          )}

          {onRemove && (
            <button
              type="button"
              className="watch-btn-icon-soft danger"
              onClick={onRemove}
              title="Gỡ khỏi xem chung"
              aria-label="Gỡ mục này"
            >
              <Trash2 size={13} />
            </button>
          )}

          <button
            type="button"
            className="watch-btn-icon-soft"
            onClick={onOpen}
            title="Mở nội dung"
            aria-label="Mở"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* KHỐI DƯỚI: BẢNG TIẾN ĐỘ CẢ 2 NGƯỜI (DUAL PROGRESS COMPACT) */}
      <div className="watch-dual-progress-box">
        {/* Header tiến độ: Sync badge */}
        <div className="watch-dual-progress-head">
          <div className={`watch-sync-status-badge ${syncBadgeVariant}`}>
            <Sparkles size={11} />
            <span>{syncBadgeLabel}</span>
          </div>
        </div>

        {/* Lưới hiển thị 2 thanh tiến độ dạng inline row gọn gàng */}
        <div className="watch-dual-bars-grid">
          {/* 1. TIẾN ĐỘ CỦA BẠN (MÌNH) */}
          <div className="watch-person-progress-row my-progress">
            <div className="watch-person-identity">
              <span className="watch-person-avatar-pill you">👤</span>
              <span className="watch-person-title">Bạn (Mình)</span>
            </div>

            <div className="watch-progress-track">
              <div
                className={`watch-progress-fill you ${myProgress.isDone ? 'done' : ''}`}
                style={{ width: `${Math.min(100, Math.max(0, myProgress.percent))}%` }}
              />
            </div>

            <span className={`watch-person-status-chip ${myProgress.isDone ? 'done' : myProgress.isStarted ? 'in-progress' : 'unwatched'}`}>
              {myProgress.isDone && <CheckCircle2 size={10} />}
              {myProgress.text}
            </span>
          </div>

          {/* 2. TIẾN ĐỘ CỦA ĐỐI PHƯƠNG */}
          <div className="watch-person-progress-row partner-progress">
            <div className="watch-person-identity">
              {partnerPerson ? (
                <Avatar person={partnerPerson} size={15} />
              ) : (
                <span className="watch-person-avatar-pill partner">👰</span>
              )}
              <span className="watch-person-title">{partnerLabel}</span>
            </div>

            <div className="watch-progress-track">
              <div
                className={`watch-progress-fill partner ${partnerProgress.isDone ? 'done' : ''}`}
                style={{ width: `${Math.min(100, Math.max(0, partnerProgress.percent))}%` }}
              />
            </div>

            <span className={`watch-person-status-chip partner ${partnerProgress.isDone ? 'done' : partnerProgress.isStarted ? 'in-progress' : 'unwatched'}`}>
              {partnerProgress.isDone && <CheckCircle2 size={10} />}
              {partnerProgress.text}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
