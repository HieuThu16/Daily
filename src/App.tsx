import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BookMarked, BookOpen, CalendarDays, ChevronRight, CheckSquare, Download, Film, Flame, Heart, HeartHandshake, Home, Languages, Lightbulb, Menu, MonitorPlay, Music, NotebookPen, Pin, PinOff, Plus, Radio, RefreshCw, Salad, Search, Settings, BarChart3, Sparkles, UserRound, Video, Wallet, X, Youtube } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { localDate } from './lib/date'
import type { Tab } from './types'
import { HeaderActionProvider, useHeaderActionSlots, useIsHeaderHidden } from './features/HeaderAction'
import { AsideProvider, useAsideRef } from './features/AsideSlot'
import { HomePage } from './features/home/HomePage'
import { HPinGate } from './features/manga/HPinGate'
import { useTaskReminders } from './features/useTaskReminders'
import { backupReminder, getLastBackupAt } from './lib/backup'
import { startQueueAutoFlush } from './lib/offlineQueue'
import { ErrorBoundary } from './features/ErrorBoundary'
import { SkeletonList } from './features/Skeleton'
import { AudioPlayerProvider } from './features/library/AudioPlayerContext'
import { GlobalMiniPlayer } from './features/library/GlobalMiniPlayer'
import { VideoMiniPlayer, VideoMiniPlayerProvider } from './features/youtube/VideoMiniPlayer'
import { SettingsPage, UpdateToast } from './features/ProfilePage'
import { NotificationCenter } from './features/NotificationCenter'
import { CommandPalette, openCommandPalette } from './features/CommandPalette'
import { ToastProvider, useToast } from './features/ToastContext'
import { PwaUpdateNotification, forceReloadLatestVersion } from './features/PwaUpdateNotification'
import { PushNudgeBanner } from './features/PushNudgeBanner'
import { GlobalCrawlerWatcher } from './features/manga/CrawlChaptersModal'


import { getRemoteAppSetting, saveAppSetting } from './lib/userAppSettings'
import { isUserAuthorizedForH } from './lib/hAuth'
export { isUserAuthorizedForH }

/*
 * Tách gói theo route. Trước đây mọi trang nằm chung một chunk 1.48 MB, nên mở
 * trang chủ vẫn phải tải cả LibraryPage, các reader manga, leaflet, pdfjs…
 * Named export nên phải ánh xạ về `default` cho React.lazy.
 */
/** Khung chờ trong lúc nạp gói của route — giữ chỗ để layout không nhảy. */
function RouteFallback() {
  return (
    <div style={{ padding: 16 }}>
      <SkeletonList rows={5} />
    </div>
  )
}

const HabitsPage = lazy(() => import('./features/HabitsPage').then((m) => ({ default: m.HabitsPage })))
const DailyPage = lazy(() => import('./features/DailyPage').then((m) => ({ default: m.DailyPage })))
const TasksPage = lazy(() => import('./features/TasksPage').then((m) => ({ default: m.TasksPage })))
const LibraryPage = lazy(() => import('./features/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const TikTokPage = lazy(() => import('./features/tiktok/TikTokPage').then((m) => ({ default: m.TikTokPage })))
const NutritionPage = lazy(() => import('./features/NutritionPage').then((m) => ({ default: m.NutritionPage })))
const UsageStatsPage = lazy(() => import('./features/UsageStatsPage').then((m) => ({ default: m.UsageStatsPage })))
const PeoplePage = lazy(() => import('./features/people/PeoplePage').then((m) => ({ default: m.PeoplePage })))
const WatchTogetherPage = lazy(() => import('./features/watch/WatchTogetherPage').then((m) => ({ default: m.WatchTogetherPage })))
const BookReaderPage = lazy(() => import('./features/library/BookReaderPage').then((m) => ({ default: m.BookReaderPage })))
const QuotesPage = lazy(() => import('./features/library/QuotesPage').then((m) => ({ default: m.QuotesPage })))
const MoneyPage = lazy(() => import('./features/MoneyPage').then((m) => ({ default: m.MoneyPage })))
const CalendarPage = lazy(() => import('./features/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const BLMangaPage = lazy(() => import('./features/manga/BLMangaPage').then((m) => ({ default: m.BLMangaPage })))
const BLMangaDetailPage = lazy(() => import('./features/manga/BLMangaDetailPage').then((m) => ({ default: m.BLMangaDetailPage })))
const NgontinhMangaPage = lazy(() => import('./features/manga/NgontinhMangaPage').then((m) => ({ default: m.NgontinhMangaPage })))
const NgontinhDetailPage = lazy(() => import('./features/manga/NgontinhDetailPage').then((m) => ({ default: m.NgontinhDetailPage })))
const NgontinhReaderPage = lazy(() => import('./features/manga/NgontinhReaderPage').then((m) => ({ default: m.NgontinhReaderPage })))
const HMangaPage = lazy(() => import('./features/manga/HMangaPage').then((m) => ({ default: m.HMangaPage })))
const HMangaDetailPage = lazy(() => import('./features/manga/HMangaDetailPage').then((m) => ({ default: m.HMangaDetailPage })))
const HMangaReaderPage = lazy(() => import('./features/manga/HMangaReaderPage').then((m) => ({ default: m.HMangaReaderPage })))
const HMangaScreenshotPage = lazy(() => import('./features/manga/HMangaScreenshotPage').then((m) => ({ default: m.HMangaScreenshotPage })))
const EnglishPage = lazy(() => import('./features/english/EnglishPage').then((m) => ({ default: m.EnglishPage })))
const KnowledgePage = lazy(() => import('./features/knowledge/KnowledgePage').then((m) => ({ default: m.KnowledgePage })))
const YoutubeView = lazy(() => import('./features/youtube/YoutubeView').then((m) => ({ default: m.YoutubeView })))
const YoutubeWatchPage = lazy(() => import('./features/youtube/YoutubeWatchPage').then((m) => ({ default: m.YoutubeWatchPage })))
const ShareTarget = lazy(() => import('./features/ShareTarget').then((m) => ({ default: m.ShareTarget })))


const BASE_NAVIGATION: { id: Tab; label: string; icon: typeof Home; colorClass: string }[] = [
  { id: 'home', label: 'Home', icon: Home, colorClass: 'icon-box-blue' },
  { id: 'habit', label: 'Habits', icon: Flame, colorClass: 'icon-box-amber' },
  { id: 'daily', label: 'Daily', icon: NotebookPen, colorClass: 'icon-box-emerald' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, colorClass: 'icon-box-purple' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, colorClass: 'icon-box-rose' },
  { id: 'youtubeshorts', label: 'YouTube Shorts', icon: Video, colorClass: 'icon-box-rose' },
  { id: 'tiktok', label: 'TikTok', icon: Flame, colorClass: 'icon-box-rose' },
  { id: 'music', label: 'Nhạc', icon: Music, colorClass: 'icon-box-cyan' },
  { id: 'movies', label: 'Phim', icon: Film, colorClass: 'icon-box-rose' },
  { id: 'books', label: 'Sách', icon: BookOpen, colorClass: 'icon-box-purple' },
  { id: 'bl', label: 'Truyện BL', icon: Heart, colorClass: 'icon-box-rose' },
  { id: 'ngontinh', label: 'Ngôn Tình', icon: HeartHandshake, colorClass: 'icon-box-rose' },
  { id: 'manga', label: 'Truyện', icon: BookMarked, colorClass: 'icon-box-emerald' },
  { id: 'english', label: 'English', icon: Languages, colorClass: 'icon-box-cyan' },
  { id: 'knowledge', label: 'Kiến thức', icon: Lightbulb, colorClass: 'icon-box-purple' },
  { id: 'money', label: 'Tiền', icon: Wallet, colorClass: 'icon-box-amber' },
  { id: 'calendar', label: 'Lịch', icon: CalendarDays, colorClass: 'icon-box-blue' },
  { id: 'people', label: 'Người', icon: UserRound, colorClass: 'icon-box-cyan' },
  { id: 'watch', label: 'Xem chung', icon: MonitorPlay, colorClass: 'icon-box-purple' },
  { id: 'nutrition', label: 'Dưỡng', icon: Salad, colorClass: 'icon-box-emerald' },
  { id: 'usage', label: 'Thống kê', icon: BarChart3, colorClass: 'icon-box-cyan' },
  { id: 'settings', label: 'Cài đặt', icon: Settings, colorClass: 'icon-box-slate' },
]

const H_NAV_ITEM: { id: Tab; label: string; icon: typeof Home; colorClass: string } = {
  id: 'truyenh',
  label: 'Truyện H',
  icon: Flame,
  colorClass: 'icon-box-rose',
}

const RECENT_TABS_STORAGE_KEY = 'daily_recent_tabs'
const PINNED_TABS_STORAGE_KEY = 'daily_pinned_tabs'
/** Ngày đã nhắc sao lưu gần nhất, để đừng nhắc lại nhiều lần trong ngày. */
const BACKUP_NUDGE_KEY = 'daily_backup_nudged_on'
const THEME_STORAGE_KEY = 'daily_theme'
const DEFAULT_PRIMARY_TABS: Tab[] = ['home', 'habit', 'daily', 'tasks', 'youtube']
const BOTTOM_NAV_SIZE = 5
/** Trần số tab được ghim. Ghim quá thì báo lỗi thay vì âm thầm đẩy cái cũ ra. */
const MAX_PINNED_TABS = 7

/** Đưa `ids` lên đầu, đệm cho đủ 5 ô bằng tab mặc định rồi tới phần còn lại. */
function padRecentTabs(ids: Tab[], currentNav = BASE_NAVIGATION): Tab[] {
  const combined = [...ids]
  for (const tab of [...DEFAULT_PRIMARY_TABS, ...currentNav.map((n) => n.id)]) {
    if (!combined.includes(tab)) combined.push(tab)
  }
  return combined.slice(0, BOTTOM_NAV_SIZE)
}

function readSavedTabs(storageKey: string, currentNav = BASE_NAVIGATION): Tab[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (Array.isArray(parsed)) {
      const validIds = new Set<string>(currentNav.map((n) => n.id))
      return parsed.filter((id): id is Tab => validIds.has(id))
    }
  } catch (error) {
    console.warn('Không đọc được tab đã lưu:', error)
  }
  return []
}

/** Tab người dùng tự ghim: luôn đứng đầu bottom nav, không bị MRU đẩy đi. */
function getPinnedTabs(currentNav = BASE_NAVIGATION): Tab[] {
  return readSavedTabs(PINNED_TABS_STORAGE_KEY, currentNav).slice(0, MAX_PINNED_TABS)
}

function getSavedRecentTabs(currentNav = BASE_NAVIGATION): Tab[] {
  return padRecentTabs(readSavedTabs(RECENT_TABS_STORAGE_KEY, currentNav), currentNav)
}

function Login({ user }: { user: unknown }) {
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    // Read error descriptions returned by Supabase OAuth redirect in hash or search params
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const searchParams = new URLSearchParams(window.location.search)
    const errDesc = hashParams.get('error_description') || searchParams.get('error_description') || hashParams.get('error') || searchParams.get('error')
    if (errDesc) {
      setErrorMessage(decodeURIComponent(errDesc.replace(/\+/g, ' ')))
    }
  }, [])

  const login = async () => {
    if (!supabase) return
    setBusy(true)
    setErrorMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) {
      setErrorMessage(error.message)
      setBusy(false)
    }
  }

  if (user) return <Navigate to="/home" replace />

  return (
    <main className="login">
      <div className="login-card">
        <div style={{ display: 'inline-flex', padding: 12, borderRadius: 16, background: 'var(--primary-gradient)', color: 'white', marginBottom: 16, boxShadow: '0 8px 24px rgba(37, 99, 235, 0.3)' }}>
          <Sparkles size={28} />
        </div>
        <span className="eyebrow">YOUR PERSONAL SPACE</span>
        <h1>A calmer place<br />for your everyday.</h1>
        <p>Journal, habits, tasks, ideas, and your personal library — all in one thoughtful blue & white space.</p>
        
        {errorMessage && (
          <div className="notice" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: 12, borderRadius: 12, marginBottom: 16, fontSize: '0.875rem', textAlign: 'left' }}>
            <strong>Đăng nhập thất bại:</strong> {errorMessage}
          </div>
        )}

        {isSupabaseConfigured ? (
          <button className="primary" onClick={login} disabled={busy} style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
            {busy ? 'Connecting…' : 'Continue with Google'}
          </button>
        ) : (
          <p className="notice" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', padding: 12, borderRadius: 12, fontWeight: 600 }}>
            Add Supabase variables in <code>.env</code> to sign in.
          </p>
        )}
      </div>
    </main>
  )
}

function Shell({ children, user }: { children: React.ReactNode; user: unknown }) {
  const { showToast } = useToast()
  const nav = useNavigate()
  const path = useLocation().pathname
  // Chế độ tối phải sống qua lần tải lại, nếu không mỗi lần mở app lại về sáng.
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved) return saved === 'dark'
    } catch (error) {
      console.warn('Không đọc được giao diện đã lưu:', error)
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })
  const headerActions = useHeaderActionSlots()
  const isHeaderHidden = useIsHeaderHidden()
  const asideRef = useAsideRef()
  const [menuOpen, setMenuOpen] = useState(false)
  // Mặc định tất cả các nhóm đều MỞ HẾT (expanded). collapsedGroups lưu những nhóm người dùng chủ động bấm thu gọn.
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  // Đổi trang thì đóng ngăn kéo trên mobile
  useEffect(() => {
    setMenuOpen(false)
  }, [path])

  // PWA Install Prompt
  const deferredPrompt = useRef<Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as typeof deferredPrompt.current
      setCanInstall(true)
    }
    const onInstalled = () => {
      setInstalled(true)
      setCanInstall(false)
      deferredPrompt.current = null
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstallPWA = async () => {
    if (!deferredPrompt.current) return
    await deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      setCanInstall(false)
    }
    deferredPrompt.current = null
  }

  const navigation = useMemo(() => {
    const list = [...BASE_NAVIGATION]
    const ngontinhIdx = list.findIndex((n) => n.id === 'ngontinh')
    if (ngontinhIdx >= 0) {
      list.splice(ngontinhIdx + 1, 0, H_NAV_ITEM)
    } else {
      list.push(H_NAV_ITEM)
    }
    return list
  }, [])

  const navGroups = useMemo(() => [
    { title: 'Tổng quan', ids: ['home', 'calendar'] as Tab[] },
    { title: 'Nhịp ngày', ids: ['habit', 'daily', 'tasks'] as Tab[] },
    { title: 'Giải trí & Video', ids: ['youtube', 'youtubeshorts', 'tiktok', 'music', 'movies', 'manga'] as Tab[] },
    { title: 'Sách & Truyện online', ids: ['books', 'bl', 'ngontinh', 'truyenh'] as Tab[] },
    { title: 'Tiền & sức khoẻ', ids: ['money', 'nutrition'] as Tab[] },
    { title: 'Kiến thức & con người', ids: ['english', 'knowledge', 'people', 'watch'] as Tab[] },
    { title: 'Hệ thống', ids: ['usage', 'settings'] as Tab[] },
  ], [])

  const activeTabItem = navigation.find((n) => path === '/' + n.id || path.startsWith('/' + n.id + '/')) ?? navigation[0]
  const ActiveIcon = activeTabItem.icon

  // 5 tab gần nhất người dùng đã truy cập cho thanh điều hướng dưới đáy (bottom nav)
  const [recentTabs, setRecentTabs] = useState<Tab[]>(() => getSavedRecentTabs(navigation))

  useEffect(() => {
    const currentTabId = navigation.find((n) => path === '/' + n.id || path.startsWith('/' + n.id + '/'))?.id
    if (currentTabId) {
      setRecentTabs((prev) => {
        const top5 = padRecentTabs([currentTabId, ...prev.filter((id) => id !== currentTabId)], navigation)
        try {
          localStorage.setItem(RECENT_TABS_STORAGE_KEY, JSON.stringify(top5))
        } catch (error) {
          console.warn('Không lưu được tab gần đây:', error)
        }
        return top5
      })
    }
  }, [path, navigation])

  const [pinnedTabs, setPinnedTabs] = useState<Tab[]>(() => getPinnedTabs(navigation))

  useEffect(() => {
    let cancelled = false
    void getRemoteAppSetting<Tab[]>('pinned_tabs', []).then((remote) => {
      if (!cancelled && remote && Array.isArray(remote) && remote.length > 0) {
        setPinnedTabs(remote)
        try {
          localStorage.setItem(PINNED_TABS_STORAGE_KEY, JSON.stringify(remote))
        } catch {}
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const togglePin = (id: Tab) => {
    if (!pinnedTabs.includes(id) && pinnedTabs.length >= MAX_PINNED_TABS) {
      alert(`Chỉ ghim được tối đa ${MAX_PINNED_TABS} tab. Bỏ ghim một tab khác trước đã.`)
      return
    }
    setPinnedTabs((prev) => {
      const next = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
      try {
        localStorage.setItem(PINNED_TABS_STORAGE_KEY, JSON.stringify(next))
        void saveAppSetting('pinned_tabs', next)
      } catch (error) {
        console.warn('Không lưu được tab đã ghim:', error)
      }
      return next
    })
  }

  // Tab ghim đứng trước, phần còn lại lấp bằng tab vừa dùng gần đây.
  const dynamicPrimaryNavigation = useMemo(() => {
    const ids = [...pinnedTabs, ...recentTabs.filter((id) => !pinnedTabs.includes(id))].slice(0, BOTTOM_NAV_SIZE)
    return ids
      .map((id) => navigation.find((n) => n.id === id))
      .filter((item): item is (typeof navigation)[number] => item !== undefined)
  }, [recentTabs, pinnedTabs, navigation])

  useTaskReminders()

  // Có mạng lại (hoặc quay lại tab) thì đẩy nốt những gì đã ghi lúc offline.
  useEffect(() => {
    return startQueueAutoFlush(({ sent, failed }) => {
      if (sent) showToast(`☁️ Đã đồng bộ ${sent} mục ghi lúc offline.`, 'supabase')
      if (failed) showToast(`⚠️ ${failed} mục ghi offline không đồng bộ được, đã bỏ qua.`, 'delete')
    })
  }, [showToast])

  // Nhắc sao lưu, tối đa một lần mỗi ngày: dữ liệu chỉ nằm một chỗ trên Supabase.
  useEffect(() => {
    const message = backupReminder(getLastBackupAt())
    if (!message) return
    const today = localDate()
    if (localStorage.getItem(BACKUP_NUDGE_KEY) === today) return
    localStorage.setItem(BACKUP_NUDGE_KEY, today)
    const timer = setTimeout(() => showToast(`💾 ${message} Vào Hồ sơ → Tải dữ liệu về máy.`, 'info'), 3000)
    return () => clearTimeout(timer)
  }, [showToast])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light')
    } catch (error) {
      console.warn('Không lưu được giao diện:', error)
    }
  }, [dark])

  return (
    <div className="app-shell">
      {/* Điều hướng dọc của desktop: Phân nhóm rõ ràng, mở sẵn toàn bộ, có thể vuốt/cuộn mượt mà */}
      <aside className="side-nav">
        <div className="side-nav-brand">
          <div className="brand-icon">
            <Sparkles size={18} />
          </div>
          <span>Daily</span>
        </div>

        <nav className="side-nav-list">
          {navGroups.map((group) => {
            const isOpen = !collapsedGroups[group.title] || group.ids.includes(activeTabItem.id)
            return (
              <div key={group.title} className={`nav-group-section ${isOpen ? 'is-open' : 'is-collapsed'}`}>
                <button
                  type="button"
                  className="nav-group-header"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={isOpen}
                  title="Bấm để ẩn / hiện nhóm"
                >
                  <span>{group.title}</span>
                  <ChevronRight size={13} className={`nav-group-chevron ${isOpen ? 'rotated' : ''}`} />
                </button>
                {isOpen && (
                  <div className="nav-group-items">
                    {group.ids.map((id) => {
                      const item = navigation.find((n) => n.id === id)
                      if (!item) return null
                      const Icon = item.icon
                      const isActive = path === '/' + id
                      return (
                        <button
                          key={id}
                          className={isActive ? 'active' : ''}
                          onClick={() => nav('/' + id, { viewTransition: true })}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <div className={`nav-icon-wrapper ${item.colorClass}`}>
                            <Icon size={17} />
                          </div>
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>

      {!isHeaderHidden && (
        <header>
          <div className="brand">
            <button className="mobile-menu-btn" aria-label="Mở danh sách nghiệp vụ" onClick={() => setMenuOpen(true)}>
              <Menu size={20} />
            </button>
            <div className={`brand-icon ${activeTabItem.colorClass}`}>
              <ActiveIcon size={20} />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{activeTabItem.label}</span>
          </div>
          <div className="header-actions">
            <button className="header-action" aria-label="Tìm kiếm (Ctrl+K)" title="Tìm kiếm (Ctrl+K)" onClick={openCommandPalette}>
              <Search size={20} />
            </button>
            <button
              className="header-action"
              aria-label="Tải lại bản mới nhất (F5)"
              title="Tải lại bản mới nhất (Xóa cache PWA)"
              onClick={() => {
                void forceReloadLatestVersion()
              }}
            >
              <RefreshCw size={18} />
            </button>
            <NotificationCenter />
            {headerActions.map((a) => (
              <button key={a.label} className="header-action" aria-label={a.label} title={a.label} onClick={a.onClick}>
                {a.icon === 'radio' ? <Radio size={20} /> : a.icon === 'download' ? <Download size={20} /> : <Plus size={20} />}
              </button>
            ))}
          </div>

        </header>
      )}

      {/* Ngăn kéo điện thoại: mở sẵn toàn bộ theo nhóm, có thể vuốt xuống cuộn mượt mà */}
      {menuOpen && (
        <div className="mobile-drawer-backdrop" role="presentation" onClick={() => setMenuOpen(false)}>
          <aside className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-head">
              <div className="brand-icon"><Sparkles size={18} /></div>
              <span>Daily</span>
              <button className="icon" aria-label="Đóng" onClick={() => setMenuOpen(false)}><X size={18} /></button>
            </div>
            <nav className="mobile-drawer-list">
              {navGroups.map((group) => {
                const isOpen = !collapsedGroups[group.title] || group.ids.includes(activeTabItem.id)
                return (
                  <div key={group.title} className={`drawer-group ${isOpen ? 'is-open' : 'is-collapsed'}`}>
                    <button
                      type="button"
                      className="drawer-group-head"
                      onClick={() => toggleGroup(group.title)}
                      aria-expanded={isOpen}
                    >
                      <span>{group.title}</span>
                      <ChevronRight size={16} className={`drawer-group-chevron ${isOpen ? 'rotated' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="drawer-group-body">
                        {group.ids.map((id) => {
                          const item = navigation.find((n) => n.id === id)
                          if (!item) return null
                          const Icon = item.icon
                          return (
                            <div key={id} className="drawer-item-row">
                              <button
                                className={path === '/' + id ? 'active' : ''}
                                onClick={() => {
                                  nav('/' + id, { viewTransition: true })
                                  setMenuOpen(false)
                                }}
                              >
                                <div className={`nav-icon-wrapper ${item.colorClass}`}><Icon size={17} /></div>
                                <span>{item.label}</span>
                              </button>
                              <button
                                type="button"
                                className={`drawer-pin-btn ${pinnedTabs.includes(id) ? 'is-pinned' : ''}`}
                                onClick={() => togglePin(id)}
                                aria-pressed={pinnedTabs.includes(id)}
                                aria-label={pinnedTabs.includes(id) ? `Bỏ ghim ${item.label}` : `Ghim ${item.label} vào thanh dưới`}
                                title={pinnedTabs.includes(id) ? 'Bỏ ghim khỏi thanh dưới' : 'Ghim vào thanh dưới'}
                              >
                                {pinnedTabs.includes(id) ? <Pin size={14} /> : <PinOff size={14} />}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </aside>
        </div>
      )}

      <nav className="bottom-nav">
        {dynamicPrimaryNavigation.map(({ id, label, icon: Icon, colorClass }) => (
          <button key={id} className={path === '/' + id ? 'active' : ''} onClick={() => nav('/' + id, { viewTransition: true })}>
            <div className={`nav-icon-wrapper ${colorClass}`}>
              <Icon size={18} />
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className={`content page-${activeTabItem.id}`}>
        {path === '/settings' ? (
          <SettingsPage
            user={user as { email?: string | null; full_name?: string | null; avatar_url?: string | null; created_at?: string | null }}
            dark={dark}
            onToggleDark={() => setDark((isDark) => !isDark)}
            canInstall={canInstall && !installed}
            onInstallPWA={handleInstallPWA}
          />
        ) : (
          // key theo đường dẫn: đổi tab là boundary dựng lại, thoát được tab đang lỗi.
          <ErrorBoundary key={path}>{children}</ErrorBoundary>
        )}
      </main>

      {/* Cột phụ desktop. Luôn dựng, CSS quyết định có hiện hay không. */}
      <aside className="side-rail" ref={asideRef} />

      <CommandPalette tabs={navigation.map((n) => ({ id: n.id, label: n.label, group: navGroups.find((g) => g.ids.includes(n.id))?.title ?? '' }))} />

    </div>
  )
}

function Protected({ user }: { user: unknown }) {
  if (!user) return <Navigate to="/login" replace />

  // Lưu ngày tham gia lần đầu vào localStorage
  if (user && typeof user === 'object' && 'created_at' in user) {
    const u = user as { created_at?: string }
    if (u.created_at && !localStorage.getItem('daily_joined_at')) {
      localStorage.setItem('daily_joined_at', u.created_at)
    }
  }

  return (
    <ToastProvider>
      <AudioPlayerProvider>
        <HeaderActionProvider>
          <AsideProvider>
          <VideoMiniPlayerProvider>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Màn hình đọc chiếm trọn màn hình nên nằm ngoài Shell, không bị header và bottom nav che. */}
              <Route path="/read/:mediaItemId" element={<BookReaderPage />} />
              {/* TikTok chạy toàn màn hình như app thật nên cũng nằm ngoài Shell. */}
              <Route path="/tiktok" element={<TikTokPage />} />
              <Route path="/quotes/:mediaItemId" element={<QuotesPage />} />
              <Route path="/quotes" element={<QuotesPage />} />
              <Route
                path="*"
                element={
                  <Shell user={user}>
                    <Routes>
                      <Route path="/home" element={<HomePage />} />
                      <Route path="/habit" element={<HabitsPage />} />
                      <Route path="/daily" element={<DailyPage />} />
                      <Route path="/tasks" element={<TasksPage />} />
                      <Route path="/share" element={<ShareTarget />} />
                      <Route path="/youtube" element={<YoutubeView />} />
                      <Route path="/youtube/watch/:videoId" element={<YoutubeWatchPage />} />
                      <Route path="/youtubeshorts" element={<YoutubeView isShorts />} />
                      <Route path="/youtubeshorts/watch/:videoId" element={<YoutubeWatchPage />} />
                      <Route path="/tvshow" element={<Navigate to="/youtube" replace />} />
                      <Route path="/reviews" element={<Navigate to="/youtube" replace />} />
                      <Route path="/music" element={<LibraryPage defaultType="MUSIC" />} />
                      <Route path="/books" element={<LibraryPage defaultType="BOOK" />} />
                      <Route path="/movies" element={<LibraryPage defaultType="MOVIE" />} />
                      <Route path="/manga" element={<LibraryPage defaultType="MANGA" />} />
                      <Route path="/bl" element={<BLMangaPage />} />
                      <Route path="/bl/:slug" element={<BLMangaDetailPage />} />
                      <Route path="/ngontinh" element={<NgontinhMangaPage />} />
                      <Route path="/ngontinh/:slug" element={<NgontinhDetailPage />} />
                      <Route path="/ngontinh/:slug/read/:chapterNum" element={<NgontinhReaderPage />} />
                      <Route path="/truyenh" element={<HPinGate><HMangaPage /></HPinGate>} />
                      <Route path="/truyenh/screenshots" element={<HPinGate><HMangaScreenshotPage /></HPinGate>} />
                      <Route path="/truyenh/:slug" element={<HPinGate><HMangaDetailPage /></HPinGate>} />
                      <Route path="/truyenh/:slug/read/:chapterNum" element={<HPinGate><HMangaReaderPage /></HPinGate>} />
                      <Route path="/english" element={<EnglishPage />} />
                      <Route path="/knowledge" element={<KnowledgePage />} />
                      <Route path="/people" element={<PeoplePage />} />
                      <Route path="/watch" element={<WatchTogetherPage />} />
                      <Route path="/library" element={<Navigate to="/books" replace />} />
                      <Route path="/nutrition" element={<NutritionPage />} />
                      <Route path="/money" element={<MoneyPage />} />
                      <Route path="/calendar" element={<CalendarPage />} />
                      <Route path="/usage" element={<UsageStatsPage />} />
                      <Route path="/settings" element={null} />
                      <Route path="*" element={<Navigate to="/home" replace />} />
                    </Routes>
                  </Shell>
                }
              />
            </Routes>
            </Suspense>
            <GlobalMiniPlayer />
            <VideoMiniPlayer />
            {/* Thanh tiến độ cào chapter nền & Báo cáo kết quả sau 5 phút */}
            <GlobalCrawlerWatcher />
            {/* Toast cập nhật: hiện toàn cục khi có bản cập nhật mới chưa xem */}
            <UpdateToast />
            {/* PWA Service Worker Update Notification Banner */}
            <PwaUpdateNotification />
            {/* Nhắc bật thông báo khi có người gửi lời nhắc cho mình. */}
            <PushNudgeBanner />
          </VideoMiniPlayerProvider>
        </AsideProvider>

        </HeaderActionProvider>
      </AudioPlayerProvider>
    </ToastProvider>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<unknown>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) {
        setUser(s?.user ?? null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) return <div className="center">Loading your space…</div>

  return (
    <Routes>
      <Route path="/login" element={<Login user={user} />} />
      <Route path="/*" element={<Protected user={user} />} />
    </Routes>
  )
}

export { localDate }
