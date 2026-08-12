import type { Habit, HabitLog } from '../../types'
import { WEEKDAY_LABELS, weekdayIndex } from './historyRange'
import './HabitMonthCalendar.css'

type Props = {
  habits: Habit[]
  logs: HabitLog[]
  dates: string[]
  mode: 'CHECK' | 'COUNT'
}

/** Lịch tháng thu nhỏ cho từng thói quen: mỗi ô là một ngày. */
export function HabitMonthCalendar({ habits, logs, dates, mode }: Props) {
  const leadingBlanks = dates.length ? weekdayIndex(new Date(`${dates[0]}T00:00:00`)) : 0

  return (
    <div className="habit-month-grid">
      {habits.map((habit) => {
        const isBad = habit.habit_type === 'BAD'
        const type = isBad ? 'bad' : 'good'
        const cells = dates.map((date) => logs.find((l) => l.habit_id === habit.id && l.date === date))
        const doneDays = cells.filter((log) => log?.completed || (log?.value ?? 0) > 0).length
        const sum = cells.reduce((total, log) => total + (log?.value ?? 0), 0)

        return (
          <div key={habit.id} className={`habit-month-card habit-month-card-${type}`}>
            <div className="habit-month-head">
              <span className={`habit-history-name-${type}`}>{habit.name}</span>
              <strong className={`habit-month-total habit-month-total-${type}`}>
                {mode === 'CHECK' ? `${doneDays} ngày` : `${sum}`}
              </strong>
            </div>

            <div className="habit-month-days">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className="habit-month-weekday">{label}</span>
              ))}
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <span key={`blank-${i}`} className="habit-month-cell habit-month-blank" />
              ))}
              {dates.map((date, i) => {
                const log = cells[i]
                const value = log?.value ?? 0
                const active = Boolean(log?.completed) || value > 0
                return (
                  <span
                    key={date}
                    title={date}
                    className={`habit-month-cell${active ? ` habit-month-cell-${type}` : ''}`}
                  >
                    {mode === 'COUNT' && active ? value : date.slice(8).replace(/^0/, '')}
                  </span>
                )
              })}
            </div>

            {mode === 'COUNT' && (
              <small className="habit-month-foot">{doneDays} ngày có ghi nhận</small>
            )}
          </div>
        )
      })}
    </div>
  )
}
