import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Bell, BellOff, BookOpen, Calendar, CalendarDays, CheckSquare, Download, Flame, HardDriveDownload, Home, LogOut, NotebookPen, Plus, Salad, Sparkles, SunMoon, UserRound, Wallet } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { disablePush, enablePush, pushEnabled, pushSupported } from './lib/push'
import { localDate, shortDate, vietnameseDate } from './lib/date'
import type { Tab } from './types'
import { HeaderActionProvider, useHeaderActionSlot, useIsHeaderHidden } from './features/HeaderAction'
import { AsideProvider, useAsideRef } from './features/AsideSlot'
import { HomePage } from './features/home/HomePage'
import { HabitsPage } from './features/HabitsPage'
import { DailyPage } from './features/DailyPage'
import { TasksPage } from './features/TasksPage'
import { LibraryPage } from './features/LibraryPage'
import { NutritionPage } from './features/NutritionPage'
import { PeoplePage } from './features/people/PeoplePage'
import { BookReaderPage } from './features/library/BookReaderPage'
import { QuotesPage } from './features/library/QuotesPage'
import { MoneyPage } from './features/MoneyPage'
import { CalendarPage } from './features/CalendarPage'
import { useTaskReminders } from './features/useTaskReminders'
import { exportBackup } from './lib/backup'

const navigation: { id: Tab; label: string; icon: typeof Home; colorClass: string }[] = [
  { id: 'home', label: 'Home', icon: Home, colorClass: 'icon-box-blue' },
  { id: 'habit', label: 'Habits', icon: Flame, colorClass: 'icon-box-amber' },
  { id: 'daily', label: 'Daily', icon: NotebookPen, colorClass: 'icon-box-emerald' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, colorClass: 'icon-box-purple' },
  { id: 'money', label: 'Tiền', icon: Wallet, colorClass: 'icon-box-amber' },
  { id: 'calendar', label: 'Lịch', icon: CalendarDays, colorClass: 'icon-box-blue' },
  { id: 'people', label: 'Người', icon: UserRound, colorClass: 'icon-box-cyan' },
  { id: 'library', label: 'Library', icon: BookOpen, colorClass: 'icon-box-rose' },
  { id: 'nutrition', label: 'Dưỡng', icon: Salad, colorClass: 'icon-box-emerald' },
]

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

function Shell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate()
  const path = useLocation().pathname
  const [dark, setDark] = useState(false)
  const headerAction = useHeaderActionSlot()
  const isHeaderHidden = useIsHeaderHidden()
  const asideRef = useAsideRef()

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
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setCanInstall(false)
      deferredPrompt.current = null
    })
    return () => window.removeEventListener('beforeinstallprompt', handler)
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

  // Thông báo đẩy: bật rồi thì nhắc việc tới cả khi app đã đóng.
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  useEffect(() => {
    void pushEnabled().then(setPushOn)
  }, [])

  const togglePush = async () => {
    setPushBusy(true)
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
      } else {
        await enablePush()
        setPushOn(true)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không bật được thông báo.')
    } finally {
      setPushBusy(false)
    }
  }

  const activeTabItem = navigation.find((n) => path === '/' + n.id) ?? navigation[0]
  const ActiveIcon = activeTabItem.icon

  useTaskReminders()

  const [backingUp, setBackingUp] = useState(false)
  const handleBackup = async () => {
    setBackingUp(true)
    try {
      const backup = await exportBackup()
      if (backup.failed.length) alert(`Đã tải bản sao lưu. Bỏ qua bảng chưa có: ${backup.failed.join(', ')}`)
    } catch {
      alert('Chưa sao lưu được — kiểm tra kết nối Supabase.')
    }
    setBackingUp(false)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  return (
    <div className="app-shell">
      {/* Điều hướng dọc của desktop. Trên điện thoại CSS ẩn đi, thanh tab dưới
          đáy vẫn là thứ điều hướng duy nhất. */}
      <aside className="side-nav">
        <div className="side-nav-brand">
          <div className="brand-icon">
            <Sparkles size={18} />
          </div>
          <span>Daily</span>
        </div>

        <nav className="side-nav-list">
          {navigation.map(({ id, label, icon: Icon, colorClass }) => {
            const isActive = path === '/' + id
            return (
              <button key={id} className={isActive ? 'active' : ''} onClick={() => nav('/' + id)} aria-current={isActive ? 'page' : undefined}>
                <div className={`nav-icon-wrapper ${colorClass}`}>
                  <Icon size={17} />
                </div>
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        <div className="side-nav-foot">
          {canInstall && !installed && (
            <button className="side-nav-mini" onClick={handleInstallPWA} title="Cài đặt ứng dụng về máy">
              <Download size={16} /> <span>Cài đặt</span>
            </button>
          )}
          <button className="side-nav-mini" onClick={handleBackup} disabled={backingUp} title="Tải toàn bộ dữ liệu về máy dạng JSON">
            <HardDriveDownload size={16} /> <span>{backingUp ? 'Đang tải…' : 'Sao lưu'}</span>
          </button>
          {pushSupported() && (
            <button
              className="side-nav-mini"
              onClick={() => void togglePush()}
              disabled={pushBusy}
              title={pushOn ? 'Tắt nhắc việc qua thông báo' : 'Bật nhắc việc kể cả khi đóng app'}
            >
              {pushOn ? <Bell size={16} /> : <BellOff size={16} />} <span>{pushOn ? 'Đang nhắc' : 'Bật nhắc'}</span>
            </button>
          )}
          <button className="side-nav-mini" onClick={() => setDark(!dark)} title="Đổi giao diện sáng/tối">
            <SunMoon size={16} /> <span>{dark ? 'Sáng' : 'Tối'}</span>
          </button>
          <button className="side-nav-mini is-danger" onClick={() => supabase?.auth.signOut()} title="Đăng xuất">
            <LogOut size={16} /> <span>Thoát</span>
          </button>
        </div>
      </aside>

      {!isHeaderHidden && (
        <header>
          <div className="brand">
            <div className={`brand-icon ${activeTabItem.colorClass}`}>
              <ActiveIcon size={20} />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{activeTabItem.label}</span>
          </div>
          <div className="header-date">
            <Calendar size={14} />
            <span className="header-date-full">{vietnameseDate()}</span>
            <span className="header-date-short">{shortDate()}</span>
          </div>
          <div className="header-actions">
            {headerAction && (
              <button className="header-action" aria-label={headerAction.label} title={headerAction.label} onClick={headerAction.onClick}>
                <Plus size={20} />
              </button>
            )}

            {/* PWA Install Button */}
            {canInstall && !installed && (
              <button
                aria-label="Cài đặt ứng dụng"
                className="icon"
                onClick={handleInstallPWA}
                title="Cài đặt ứng dụng về máy"
                style={{
                  color: 'var(--primary)',
                  background: 'var(--primary-light)',
                  borderRadius: 10,
                  padding: '5px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: '1px solid var(--primary)',
                }}
              >
                <Download size={15} />
                <span style={{ display: 'none' }} className="pwa-install-label">Cài PWA</span>
              </button>
            )}
            <button aria-label="Toggle theme" className="icon header-only" onClick={() => setDark(!dark)} style={{ color: dark ? '#fbbf24' : '#2563eb' }}>
              <SunMoon size={20} />
            </button>
            <button aria-label="Sign out" className="icon danger header-only" onClick={() => supabase?.auth.signOut()}>
              <LogOut size={20} />
            </button>
          </div>
        </header>
      )}

      <nav className="bottom-nav">
        {navigation.map(({ id, label, icon: Icon, colorClass }) => (
          <button key={id} className={path === '/' + id ? 'active' : ''} onClick={() => nav('/' + id)}>
            <div className={`nav-icon-wrapper ${colorClass}`}>
              <Icon size={18} />
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className={`content page-${activeTabItem.id}`}>{children}</main>

      {/* Cột phụ desktop. Luôn dựng, CSS quyết định có hiện hay không. */}
      <aside className="side-rail" ref={asideRef} />
    </div>
  )
}

import { ToastProvider } from './features/ToastContext'

function Protected({ user }: { user: unknown }) {
  if (!user) return <Navigate to="/login" replace />

  return (
    <ToastProvider>
      <HeaderActionProvider>
      <AsideProvider>
      <Routes>
        {/* Màn hình đọc chiếm trọn màn hình nên nằm ngoài Shell, không bị header và bottom nav che. */}
        <Route path="/read/:mediaItemId" element={<BookReaderPage />} />
        <Route path="/quotes/:mediaItemId" element={<QuotesPage />} />
        <Route path="/quotes" element={<QuotesPage />} />
        <Route
          path="*"
          element={
            <Shell>
              <Routes>
                <Route path="/home" element={<HomePage />} />
                <Route path="/habit" element={<HabitsPage />} />
                <Route path="/daily" element={<DailyPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/people" element={<PeoplePage />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/nutrition" element={<NutritionPage />} />
                <Route path="/money" element={<MoneyPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </Shell>
          }
        />
      </Routes>
      </AsideProvider>
      </HeaderActionProvider>
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
