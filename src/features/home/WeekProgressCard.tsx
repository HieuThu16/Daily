import { Check, TrendingUp } from 'lucide-react'
import { dayStatus, type WeekDay } from '../../lib/homeProgress'
import type { Habit, HabitLog } from '../../types'
import { ProgressRing } from './ProgressRing'

type Props = { week: WeekDay[]; habits: Habit[]; logs: HabitLog[]; todayPercent: number }

export function WeekProgressCard({ week, habits, logs, todayPercent }: Props) {
  return (
    <div className="card home-section-card">
      <div className="home-section-head">
        <h3>
          <TrendingUp size={17} color="var(--emerald)" /> Tiến độ tuần
        </h3>
        <div className="week-legend">
          <span>
            <i style={{ background: 'var(--emerald)' }} />
            Hoàn thành
          </span>
          <span>
            <i style={{ background: 'var(--card-border)' }} />
            Chưa xong
          </span>
        </div>
      </div>

      <div className="week-strip">
        {week.map((day) => {
          const status = dayStatus(day, habits, logs)
          return (
            <div
              key={day.key}
              className={'week-day' + (day.isToday ? ' is-today' : '') + (day.isFuture ? ' is-future' : '')}
            >
              <span className="week-label">{day.label}</span>
              <span className="week-date">{day.dayMonth}</span>
              {status === 'today' ? (
                <ProgressRing percent={todayPercent} size={28} stroke={3} />
              ) : (
                <span className={'week-dot ' + status}>{status === 'done' && <Check size={15} />}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
