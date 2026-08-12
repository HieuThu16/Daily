import { CheckSquare, NotebookPen, Wallet } from 'lucide-react'
import type { WeekDay } from '../../lib/homeProgress'
import {
  daysWithEntries,
  formatMoney,
  habitRanking,
  todosDoneInWeek,
  weeklyHabitPercent,
  weeklySpend,
} from '../../lib/report'
import type { Entry, Habit, HabitLog, NutritionLog, Todo } from '../../types'

type Props = {
  week: WeekDay[]
  habits: Habit[]
  weekLogs: HabitLog[]
  weekEntries: Entry[]
  weekMeals: NutritionLog[]
  weekTodosDone: Todo[]
  onOpen: (tab: string) => void
}

export function ReportWeek({ week, habits, weekLogs, weekEntries, weekMeals, weekTodosDone, onOpen }: Props) {
  const percents = weeklyHabitPercent(habits, weekLogs, week)
  const spend = weeklySpend(weekMeals, week)
  const written = daysWithEntries(weekEntries, week)
  const ranked = habitRanking(habits, weekLogs, week)
  const best = ranked[0]
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null

  return (
    <div className="report">
      <div className="card report-chart">
        <div className="home-section-head">
          <h3>Hoàn thành thói quen trong tuần</h3>
        </div>
        <div className="week-bars">
          {week.map((day, index) => (
            <div key={day.key} className={'week-bar' + (day.isToday ? ' today' : '')}>
              <span className="week-bar-value">{day.isFuture ? '' : `${percents[index]}%`}</span>
              <div className="week-bar-track">
                <i style={{ height: `${Math.max(percents[index], day.isFuture ? 0 : 3)}%` }} />
              </div>
              <span className="week-bar-label">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="report-grid three">
        <button className="report-tile" onClick={() => onOpen('/nutrition')}>
          <span className="report-tile-head">
            <span className="icon-box icon-box-sm" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan)' }}>
              <Wallet size={15} />
            </span>
            Ăn uống
          </span>
          <strong>{formatMoney(spend.total)}</strong>
          <span className="report-tile-hint">{formatMoney(spend.perDay)}/ngày</span>
          <span className="report-tile-hint">
            {spend.topDay ? `Cao nhất ${spend.topDay.label} · ${formatMoney(spend.topDay.total)}` : 'Chưa ghi bữa nào'}
          </span>
        </button>

        <button className="report-tile" onClick={() => onOpen('/daily')}>
          <span className="report-tile-head">
            <span className="icon-box icon-box-sm" style={{ background: 'var(--emerald-bg)', color: 'var(--emerald)' }}>
              <NotebookPen size={15} />
            </span>
            Nhật ký
          </span>
          <strong>{written}/7</strong>
          <span className="report-tile-hint">ngày có ghi</span>
        </button>

        <button className="report-tile" onClick={() => onOpen('/tasks')}>
          <span className="report-tile-head">
            <span className="icon-box icon-box-sm" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>
              <CheckSquare size={15} />
            </span>
            Việc xong
          </span>
          <strong>{todosDoneInWeek(weekTodosDone, week)}</strong>
          <span className="report-tile-hint">trong tuần này</span>
        </button>
      </div>

      <div className="card report-rank">
        {best ? (
          <>
            <div className="rank-row">
              <span className="rank-tag good">Đều nhất</span>
              <span className="rank-name">{best.habit.name}</span>
              <strong>{best.days}/7</strong>
            </div>
            {worst && (
              <div className="rank-row">
                <span className="rank-tag bad">Hay bỏ nhất</span>
                <span className="rank-name">{worst.habit.name}</span>
                <strong>{worst.days}/7</strong>
              </div>
            )}
          </>
        ) : (
          <p className="home-card-empty">Chưa có thói quen nào để xếp hạng.</p>
        )}
      </div>
    </div>
  )
}
