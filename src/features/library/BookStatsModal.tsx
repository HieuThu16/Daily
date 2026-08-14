import { useMemo, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { Modal } from '../shared'
import { localDate } from '../../lib/date'
import { getPeriodRange, shiftPeriodAnchor, type PeriodMode } from '../nutrition/periodData'
import { listenMinutesByDate, pagesReadByDate, summarizePages } from '../../lib/bookStats'
import type { BookReadingLog } from '../../types'

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
export function BookStatsModal({ logs, onClose }: { logs: BookReadingLog[]; onClose: () => void }) {
  const [mode, setMode] = useState<PeriodMode>('week')
  const [anchor, setAnchor] = useState(localDate())

  const range = useMemo(() => getPeriodRange(anchor, mode), [anchor, mode])
  const byDate = useMemo(() => pagesReadByDate(logs, range.days), [logs, range.days])
  const listenByDate = useMemo(() => listenMinutesByDate(logs, range.days), [logs, range.days])
  const summary = useMemo(() => summarizePages(byDate), [byDate])
  const listenTotal = Object.values(listenByDate).reduce((sum, value) => sum + value, 0)
  const max = Math.max(...Object.values(byDate), 1)

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

        <div className="nutrition-period-summary">
          <div><strong style={{ color: '#2563eb' }}>{summary.total}</strong><span>Tổng trang</span></div>
          <div><strong style={{ color: '#8b5cf6' }}>{summary.averagePerActiveDay}</strong><span>TB mỗi ngày đọc</span></div>
          <div><strong style={{ color: '#10b981' }}>{summary.activeDays}</strong><span>Ngày có đọc</span></div>
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
