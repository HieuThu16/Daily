import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Headphones,
  History,
  Target,
  TrendingUp,
} from 'lucide-react'
import { localDate } from '../../lib/date'
import { getPeriodRange, shiftPeriodAnchor, type PeriodMode } from '../nutrition/periodData'
import { listenMinutesByDate, pagesReadByDate, summarizePages } from '../../lib/bookStats'
import { useBookReadingSessionLogs, summarizeBookSessions } from '../../lib/bookReadingLog'
import type { BookReadingLog, Media } from '../../types'
import { loadLocal, saveLocal } from '../../lib/persistence'
import { useQuery } from '../shared'
import { useHideHeader } from '../HeaderAction'
import './bookStats.css'

const GOAL_KEY = 'daily_book_goal_month'

type DetailTab = 'chart' | 'top_books' | 'sessions'

const MODES: { id: PeriodMode; label: string }[] = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
]

function shortDate(day: string) {
  const [, month, date] = day.split('-')
  return `${Number(date)}/${Number(month)}`
}

function fullDateLabel(day: string) {
  const [year, month, date] = day.split('-')
  return `${Number(date)}/${Number(month)}/${year}`
}

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h ${rest ? `${rest}m` : ''}` : `${rest} phút`
}

export function BookStatsPage() {
  const navigate = useNavigate()
  useHideHeader(false)

  const [goal, setGoal] = useState(() => loadLocal<number>(GOAL_KEY, 2))
  const [mode, setMode] = useState<PeriodMode>('week')
  const [anchor, setAnchor] = useState(localDate())
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('chart')

  // Queries
  const bookReadingLogsQuery = useQuery<BookReadingLog>('book_reading_logs')
  const mediaItemsQuery = useQuery<Media>('media_items')
  const sessionLogs = useBookReadingSessionLogs()

  const logs = bookReadingLogsQuery.items
  const books = useMemo(
    () => mediaItemsQuery.items.filter((m) => m.type === 'BOOK'),
    [mediaItemsQuery.items],
  )

  const bookSessionStats = useMemo(() => summarizeBookSessions(sessionLogs, anchor), [sessionLogs, anchor])
  const range = useMemo(() => getPeriodRange(anchor, mode), [anchor, mode])
  const byDate = useMemo(() => pagesReadByDate(logs, range.days), [logs, range.days])
  const listenByDate = useMemo(() => listenMinutesByDate(logs, range.days), [logs, range.days])
  const summary = useMemo(() => summarizePages(byDate), [byDate])
  const listenTotal = Object.values(listenByDate).reduce((sum, value) => sum + value, 0)
  const maxPages = Math.max(...Object.values(byDate), 1)

  // Danh sách các phiên đọc sách trong khoảng ngày đang chọn
  const rangeSessions = useMemo(() => {
    return sessionLogs.filter((s) => range.days.includes(s.log_date))
  }, [sessionLogs, range.days])

  // Tổng thời gian đọc thực tế trong khoảng này
  const totalDurationMinutes = useMemo(() => {
    return rangeSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0)
  }, [rangeSessions])

  // Sách đọc nhiều nhất trong khoảng này
  const topBooksInRange = useMemo(() => {
    const map = new Map<string, { mediaItemId: string; title: string; author?: string | null; pages: number; sessionsCount: number }>()
    for (const s of rangeSessions) {
      const existing = map.get(s.mediaItemId)
      if (existing) {
        existing.pages += s.pagesRead || 0
        existing.sessionsCount += 1
      } else {
        map.set(s.mediaItemId, {
          mediaItemId: s.mediaItemId,
          title: s.bookTitle,
          author: s.bookAuthor,
          pages: s.pagesRead || 0,
          sessionsCount: 1,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.pages - a.pages)
  }, [rangeSessions])

  // Sách xong trong tháng của ngày đang xem
  const currentMonthStr = anchor.slice(0, 7)
  const finishedThisMonth = books.filter(
    (b) => b.status === 'COMPLETED' && (b.end_date ?? b.log_date ?? '').startsWith(currentMonthStr),
  ).length
  const goalPercent = goal > 0 ? Math.min(100, Math.round((finishedThisMonth / goal) * 100)) : 0

  const setGoalValue = (value: number) => {
    const next = Math.max(0, Math.min(99, value))
    setGoal(next)
    saveLocal(GOAL_KEY, next)
  }

  const rangeTitle = useMemo(() => {
    if (mode === 'day') {
      return fullDateLabel(anchor)
    }
    if (mode === 'month') {
      const [year, m] = anchor.split('-')
      return `Tháng ${Number(m)}/${year}`
    }
    return `${shortDate(range.start)} – ${shortDate(range.end)}`
  }, [mode, anchor, range])

  return (
    <div className="book-stats-page">
      {/* 1. Header tinh gọn */}
      <header className="book-stats-header">
        <button
          type="button"
          className="book-stats-back-btn"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1)
            } else {
              navigate('/books')
            }
          }}
          title="Quay lại kho sách"
        >
          <ArrowLeft size={14} />
          <span>Sách</span>
        </button>

        {/* Period Mode Selector */}
        <div className="book-stats-period-pills">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`book-stats-period-pill ${mode === item.id ? 'active' : ''}`}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* 2. Date Navigator */}
      <div className="book-stats-nav-bar">
        <button
          type="button"
          className="book-stats-nav-btn"
          onClick={() => setAnchor((current) => shiftPeriodAnchor(current, mode, -1))}
          title="Khoảng trước"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="book-stats-nav-label">
          <Calendar size={13} color="var(--primary)" />
          <span>{rangeTitle}</span>
        </div>
        <button
          type="button"
          className="book-stats-nav-btn"
          onClick={() => setAnchor((current) => shiftPeriodAnchor(current, mode, 1))}
          title="Khoảng sau"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* 3. Monthly Reading Challenge Goal Card */}
      <div className="book-stats-goal-card">
        <div className="book-stats-goal-head">
          <div className="book-stats-goal-title">
            <Target size={15} color="var(--purple)" />
            <span>Mục tiêu tháng {Number(currentMonthStr.slice(5))}</span>
          </div>
          <div className="book-stats-goal-input-wrap">
            <span>Chỉ tiêu:</span>
            <input
              type="number"
              min={0}
              max={99}
              value={goal}
              onChange={(e) => setGoalValue(Number(e.target.value))}
              aria-label="Đặt mục tiêu số sách trong tháng"
              className="book-stats-goal-input"
            />
            <span>cuốn</span>
          </div>
        </div>
        <div className="book-stats-goal-bar-bg">
          <div
            className="book-stats-goal-bar-fill"
            style={{
              width: `${goalPercent}%`,
              background: goalPercent >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #6366f1, #a855f7)',
            }}
          />
        </div>
        <div className="book-stats-goal-foot">
          <span>
            Đã xong <strong style={{ color: 'var(--text-main)' }}>{finishedThisMonth}</strong> / {goal} cuốn
          </span>
          <span style={{ color: goalPercent >= 100 ? '#10b981' : 'var(--primary)' }}>
            {goalPercent >= 100 ? '🎉 Đạt mục tiêu!' : `${goalPercent}%`}
          </span>
        </div>
      </div>

      {/* 4. KPI Summary Cards Grid */}
      <div className="book-stats-grid">
        {/* Card 1: Tổng số trang */}
        <div className="book-stats-card">
          <div className="book-stats-card-top">
            <span className="book-stats-card-title">Tổng trang</span>
            <div className="book-stats-card-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)' }}>
              <BookOpen size={14} />
            </div>
          </div>
          <div className="book-stats-card-value" style={{ color: 'var(--primary)' }}>
            {summary.total}
          </div>
          <div className="book-stats-card-sub">
            Cao nhất: <strong>{summary.best}</strong> trang
          </div>
        </div>

        {/* Card 2: Chuỗi ngày đọc */}
        <div className="book-stats-card">
          <div className="book-stats-card-top">
            <span className="book-stats-card-title">Chuỗi ngày</span>
            <div className="book-stats-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
              <Flame size={14} />
            </div>
          </div>
          <div className="book-stats-card-value" style={{ color: '#ef4444' }}>
            🔥 {bookSessionStats.streak}
          </div>
          <div className="book-stats-card-sub">
            Đọc liên tục
          </div>
        </div>

        {/* Card 3: Trung bình / ngày */}
        <div className="book-stats-card">
          <div className="book-stats-card-top">
            <span className="book-stats-card-title">TB / ngày</span>
            <div className="book-stats-card-icon" style={{ background: 'rgba(168, 85, 247, 0.12)', color: 'var(--purple)' }}>
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="book-stats-card-value" style={{ color: 'var(--purple)' }}>
            {summary.averagePerActiveDay}
          </div>
          <div className="book-stats-card-sub">
            {summary.activeDays} ngày có đọc
          </div>
        </div>

        {/* Card 4: Thời gian đọc */}
        <div className="book-stats-card">
          <div className="book-stats-card-top">
            <span className="book-stats-card-title">Thời gian</span>
            <div className="book-stats-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <Clock size={14} />
            </div>
          </div>
          <div className="book-stats-card-value" style={{ color: '#10b981' }}>
            {totalDurationMinutes > 0 ? duration(totalDurationMinutes) : `${summary.activeDays} ngày`}
          </div>
          <div className="book-stats-card-sub">
            {rangeSessions.length > 0 ? `${rangeSessions.length} phiên đọc` : 'Ghi nhận'}
          </div>
        </div>
      </div>

      {/* 5. Ba Tab Chi Tiết (Biểu đồ ngày / Sách đọc nhiều / Lịch sử phiên) */}
      <div className="book-stats-detail-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeDetailTab === 'chart'}
          className={`book-stats-detail-tab ${activeDetailTab === 'chart' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab('chart')}
        >
          <BarChart3 size={14} />
          <span>Số trang theo ngày</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeDetailTab === 'top_books'}
          className={`book-stats-detail-tab ${activeDetailTab === 'top_books' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab('top_books')}
        >
          <Award size={14} />
          <span>Sách đọc nhiều</span>
          {topBooksInRange.length > 0 && (
            <span className="book-stats-detail-tab-badge">{topBooksInRange.length}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeDetailTab === 'sessions'}
          className={`book-stats-detail-tab ${activeDetailTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab('sessions')}
        >
          <History size={14} />
          <span>Lịch sử phiên</span>
          {rangeSessions.length > 0 && (
            <span className="book-stats-detail-tab-badge">{rangeSessions.length}</span>
          )}
        </button>
      </div>

      {/* 6. Nội dung hiển thị theo Tab đang chọn */}
      <div className="book-stats-detail-card">
        {/* TAB 1: Biểu đồ số trang theo ngày */}
        {activeDetailTab === 'chart' && (
          <div className="book-stats-chart-scroll">
            <div
              className="book-stats-chart-columns"
              style={{
                minWidth: range.days.length > 7 ? range.days.length * 32 : undefined,
              }}
            >
              {range.days.map((day) => {
                const val = byDate[day] || 0
                const heightPct = val > 0 ? Math.max(8, (val / maxPages) * 100) : 0

                return (
                  <div
                    key={day}
                    className="book-stats-bar-item"
                    title={`Ngày ${shortDate(day)}: ${val} trang`}
                  >
                    <span className={`book-stats-bar-val ${val === 0 ? 'zero' : ''}`}>
                      {val > 0 ? val : '—'}
                    </span>
                    <div className="book-stats-bar-track">
                      <div
                        className="book-stats-bar-fill"
                        style={{
                          height: `${heightPct}%`,
                          background: val === maxPages && val > 0 ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)' : undefined,
                        }}
                      />
                    </div>
                    <span className="book-stats-bar-label">{shortDate(day)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Sách đọc nhiều nhất */}
        {activeDetailTab === 'top_books' && (
          <div>
            {topBooksInRange.length > 0 ? (
              <div>
                {topBooksInRange.map((item, idx) => (
                  <div
                    key={item.mediaItemId}
                    className="book-stats-top-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/read/${item.mediaItemId}`)}
                    title="Mở đọc sách"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: idx === 0 ? '#fef3c7' : 'var(--card-border)',
                          color: idx === 0 ? '#b45309' : 'var(--text-muted)',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {item.title}
                        </div>
                        {item.author && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {item.author}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.8rem' }}>
                        {item.pages} trang
                      </span>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                        {item.sessionsCount} phiên
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="book-stats-empty">
                Chưa có sách nào được đọc trong khoảng này
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Lịch sử phiên đọc chi tiết */}
        {activeDetailTab === 'sessions' && (
          <div>
            {rangeSessions.length > 0 ? (
              <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
                {rangeSessions.map((session) => {
                  const startTime = session.log_time || (session.startTime ? new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
                  const endTime = session.endTime ? new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                  const timeStr = startTime && endTime && startTime !== endTime ? `${startTime} – ${endTime}` : startTime

                  return (
                    <div key={session.id} className="book-stats-session-item">
                      <div className="book-stats-session-left">
                        <span className="book-stats-session-title">{session.bookTitle}</span>
                        <span className="book-stats-session-meta">
                          {shortDate(session.log_date)} · {timeStr} (~{session.durationMinutes || 1} phút)
                        </span>
                      </div>
                      <div className="book-stats-session-right">
                        <span className="book-stats-session-pages">+{session.pagesRead} trang</span>
                        <span className="book-stats-session-range">
                          Trang {session.startPage} → {session.endPage}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="book-stats-empty">
                Chưa có dữ liệu phiên đọc sách trong khoảng này
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audiobook Listening Stats if any */}
      {listenTotal > 0 && (
        <div className="book-stats-card" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="book-stats-card-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
              <Headphones size={15} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Sách nói
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Thời lượng nghe trong khoảng này
              </div>
            </div>
          </div>
          <strong style={{ fontSize: '0.95rem', color: '#f59e0b' }}>{duration(listenTotal)}</strong>
        </div>
      )}
    </div>
  )
}
