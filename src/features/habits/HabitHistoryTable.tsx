import type { Habit, HabitLog } from '../../types'
import './HabitHistoryTable.css'

type Props = {
  habits: Habit[]
  logs: HabitLog[]
  dates: string[]
  mode: 'CHECK' | 'COUNT'
}

export function HabitHistoryTable({ habits, logs, dates, mode }: Props) {
  return (
    <div className="habit-history-scroll">
      <table className="habit-history-table">
        <thead>
          <tr>
            <th>Thói quen</th>
            {dates.map((date) => <th key={date}>{date.slice(8)}</th>)}
          </tr>
        </thead>
        <tbody>
          {habits.map((habit) => {
            const isBad = habit.habit_type === 'BAD'
            const type = isBad ? 'bad' : 'good'
            return (
              <tr key={habit.id} className={`habit-history-row-${type}`}>
                <td>
                  <span className={`habit-history-name-${type}`}>{habit.name}</span>
                  <small className={`habit-history-badge habit-history-badge-${type}`}>{isBad ? 'Xấu' : 'Tốt'}</small>
                </td>
                {dates.map((date) => {
                  const log = logs.find((item) => item.habit_id === habit.id && item.date === date)
                  const value = mode === 'CHECK'
                    ? (log?.completed ? '✓' : null)
                    : (log?.value ?? (log?.completed ? '✓' : null))
                  return (
                    <td key={date}>
                      {value !== null
                        ? <span className={`habit-history-value-${type}`}>{value}</span>
                        : <span className="habit-history-empty">-</span>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
