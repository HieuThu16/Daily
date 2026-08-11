import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CheckSquare, Flame, Gamepad2, Home, LogOut, NotebookPen, Sparkles, SunMoon } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { localDate } from './lib/date'
import type { Tab } from './types'
import { HomePage } from './features/HomePage'
import { HabitsPage } from './features/HabitsPage'
import { DailyPage } from './features/DailyPage'
import { TasksPage } from './features/TasksPage'
import { LibraryPage } from './features/LibraryPage'
import { PlayTogetherPage } from './features/PlayTogetherPage'

const navigation: { id: Tab; label: string; icon: typeof Home; colorClass: string }[] = [
  { id: 'home', label: 'Home', icon: Home, colorClass: 'icon-box-blue' },
  { id: 'habit', label: 'Habits', icon: Flame, colorClass: 'icon-box-amber' },
  { id: 'daily', label: 'Daily', icon: NotebookPen, colorClass: 'icon-box-emerald' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, colorClass: 'icon-box-purple' },
  { id: 'library', label: 'Library', icon: BookOpen, colorClass: 'icon-box-rose' },
  { id: 'playtogether', label: 'Game', icon: Gamepad2, colorClass: 'icon-box-cyan' },
]

function Login() {
  const [busy, setBusy] = useState(false)
  const login = async () => {
    if (!supabase) return
    setBusy(true)
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })
    setBusy(false)
  }

  return (
    <main className="login">
      <div className="login-card">
        <div style={{ display: 'inline-flex', padding: 12, borderRadius: 16, background: 'var(--primary-gradient)', color: 'white', marginBottom: 16, boxShadow: '0 8px 24px rgba(37, 99, 235, 0.3)' }}>
          <Sparkles size={28} />
        </div>
        <span className="eyebrow">YOUR PERSONAL SPACE</span>
        <h1>A calmer place<br />for your everyday.</h1>
        <p>Journal, habits, tasks, ideas, and your personal library — all in one thoughtful blue & white space.</p>
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

  const activeTabItem = navigation.find((n) => path === '/' + n.id) ?? navigation[0]
  const ActiveIcon = activeTabItem.icon

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  return (
    <div className="app-shell">
      <header>
        <div className="brand">
          <div className={`brand-icon ${activeTabItem.colorClass}`}>
            <ActiveIcon size={20} />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{activeTabItem.label}</span>
        </div>
        <div className="header-actions">
          <button aria-label="Toggle theme" className="icon" onClick={() => setDark(!dark)} style={{ color: dark ? '#fbbf24' : '#2563eb' }}>
            <SunMoon size={20} />
          </button>
          <button aria-label="Sign out" className="icon danger" onClick={() => supabase?.auth.signOut()}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

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

      <main className="content">{children}</main>
    </div>
  )
}

import { ToastProvider } from './features/ToastContext'

function Protected() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<unknown>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  if (loading) return <div className="center">Loading your space…</div>
  if (!user) return <Navigate to="/login" replace />

  return (
    <ToastProvider>
      <Shell>
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/habit" element={<HabitsPage />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/playtogether" element={<PlayTogetherPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Shell>
    </ToastProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<Protected />} />
    </Routes>
  )
}

export { localDate }
