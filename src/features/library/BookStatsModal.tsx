import { useMemo, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Flame, History, Target } from 'lucide-react'
import { Modal } from '../shared'
import { localDate } from '../../lib/date'
import { getPeriodRange, shiftPeriodAnchor, type PeriodMode } from '../nutrition/periodData'
import { listenMinutesByDate, pagesReadByDate, summarizePages } from '../../lib/bookStats'
import { useBookReadingSessionLogs, summarizeBookSessions } from '../../lib/bookReadingLog'
import type { BookReadingLog, Media } from '../../types'
import { loadLocal, saveLocal } from '../../lib/persistence'

/** Mục tiêu đọc trong tháng, kiểu Goodreads Reading Challenge nhưng theo tháng. */
const GOAL_KEY = 'daily_book_goal_month'

const MODES: { id: PeriodMode; label: string }[] = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
]

function shortDate(day: string) {
  const [, month, date] = day.split('-')
  return `${Number(date)}/${Number(month)}`
}

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h${rest ? `${rest}m` : ''}` : `${rest}m`
}

/** Thống kê số trang đã đọc theo ngày / tuần / tháng, kèm biểu đồ cột. */
export function BookStatsModal({ logs, books = [], onClose }: { logs: BookReadingLog[]; books?: Media[]; onClose: () => void }) {
  const [goal, setGoal] = useState(() => loadLocal<number>(GOAL_KEY, 2))
  const [mode, setMode] = useState<PeriodMode>('week')
  const [anchor, setAnchor] = useState(localDate())

  const sessionLogs = useBookReadingSessionLogs()
  const bookSessionStats = useMemo(() => summarizeBookSessions(sessionLogs, anchor), [sessionLogs, anchor])

  const range = useMemo(() => getPeriodRange(anchor, mode), [anchor, mode])
  const byDate = useMemo(() => pagesReadByDate(logs, range.days), [logs, range.days])
  const listenByDate = useMemo(() => listenMinutesByDate(logs, range.days), [logs, range.days])
  const summary = useMemo(() => summarizePages(byDate), [byDate])
  const listenTotal = Object.values(listenByDate).reduce((sum, value) => sum + value, 0)
  const max = Math.max(...Object.values(byDate), 1)

  // Danh sách các phiên đọc sách trong khoảng ngày đang chọn
  const rangeSessions = useMemo(() => {
    return sessionLogs.filter((s) => range.days.includes(s.log_date))
  }, [sessionLogs, range.days])

  // Sách xong trong tháng của ngày đang xem, đếm theo ngày ghi nhận (log_date).
  const month = anchor.slice(0, 7)
  const finishedThisMonth = books.filter(
    (b) => b.status === 'COMPLETED' && (b.end_date ?? b.log_date ?? '').startsWith(month),
  ).length
  const goalPercent = goal > 0 ? Math.min(100, Math.round((finishedThisMonth / goal) * 100)) : 0

  const setGoalValue = (value: number) => {
    const next = Math.max(0, Math.min(99, value))
    setGoal(next)
    saveLocal(GOAL_KEY, next)
  }

  return (
    <Modal title="Thống kê đọc sách" onClose={onClose}>
      <div className="nutrition-period-view">
        <div className="task-view-tabs" role="tablist" aria-label="Khoảng thời gian" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {MODES.map((item) => (
            <button key={item.id} role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'on' : undefined} onClick={() => setMode(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button className="icon small" aria-label="Khoảng trước" onClick={() => setAnchor((current) => shiftPeriodAnchor(current, mode, -1))}>
            <ChevronLeft size={16} />
          </button>
          <strong style={{ fontSize: '0.82rem' }}>{range.start === range.end ? shortDate(range.start) : `${shortDate(range.start)} – ${shortDate(range.end)}`}</strong>
          <button className="icon small" aria-label="Khoảng sau" onClick={() => setAnchor((current) => shiftPeriodAnchor(current, mode, 1))}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="nutrition-period-card">
          <h3><Target size={15} /> Mục tiêu tháng {Number(month.slice(5))}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <strong style={{ fontSize: '1.1rem', color: goalPercent >= 100 ? 'var(--emerald)' : 'var(--primary)' }}>
              {finishedThisMonth}/{goal}
            </strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>cuốn đã đọc xong · {goalPercent}%</span>
            <input
              type="number"
              min={0}
              max={99}
              value={goal}
              onChange={(e) => setGoalValue(Number(e.target.value))}
              aria-label="Đặt mục tiêu số sách trong tháng"
              style={{ width: 62, marginLeft: 'auto', fontSize: '0.8rem' }}
            />
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'var(--card-border)', overflow: 'hidden' }}>
            <div style={{ width: `${goalPercent}%`, height: '100%', background: goalPercent >= 100 ? 'var(--emerald)' : 'var(--primary)' }} />
          </div>
        </div>

        <div className="nutrition-period-summary" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
          <div><strong style={{ color: '#2563eb' }}>{summary.total}</strong><span>Tổng trang</span></div>
          <div><strong style={{ color: '#ef4444' }}>🔥 {bookSessionStats.streak}</strong><span>Chuỗi ngày</span></div>
          <div><strong style={{ color: '#8b5cf6' }}>{summary.averagePerActiveDay}</strong><span>TB trang/ngày</span></div>
          <div><strong style={{ color: '#10b981' }}>{summary.activeDays}</strong><span>Ngày đọc</span></div>
        </div>

        <div className="nutrition-period-card">
          <h3><BookOpen size={15} /> Số trang theo ngày</h3>
          <div className="nutrition-chart-scroll">
            <div className="nutrition-period-chart" style={{ minWidth: range.days.length > 10 ? range.days.length * 28 : undefined }}>
              {range.days.map((day) => {
                const value = byDate[day]
                return (
                  <div key={day} className="nutrition-chart-column" aria-label={`Ngày ${shortDate(day)}: ${value} trang`}>
                    <span>{value || '—'}</span>
                    <div><i style={{ height: `${value ? Math.max(5, (value / max) * 100) : 0}%`, background: value ? '#2563eb' : undefined }} /></div>
                    <small>{shortDate(day)}</small>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Lịch sử phiên đọc sách chi tiết (từ lúc nào đến lúc nào, bao nhiêu trang) */}
        {rangeSessions.length > 0 && (
          <div className="nutrition-period-card">
            <h3><History size={15} /> Chi tiết các phiên đọc sách</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {rangeSessions.slice(0, 10).map((session) => {
                const startTime = session.log_time || (session.startTime ? new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')
                const endTime = session.endTime ? new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                const timeStr = startTime && endTime && startTime !== endTime ? `${startTime} - ${endTime}` : startTime

                return (
                  <div
                    key={session.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--bg-main)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-main)' }}>{session.bookTitle}</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {session.log_date} · {timeStr} (~{session.durationMinutes} phút)
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        +{session.pagesRead} trang
                      </span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Trang {session.startPage} → {session.endPage}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {listenTotal > 0 && (
          <div className="nutrition-period-card">
            <h3>🎧 Nghe sách nói</h3>
            <strong style={{ fontSize: '1.1rem', color: '#f59e0b' }}>{duration(listenTotal)}</strong>
          </div>
        )}

        {summary.total === 0 && listenTotal === 0 && <div className="nutrition-period-empty">Chưa có ghi chép đọc sách trong khoảng này</div>}
      </div>
    </Modal>
  )
}
