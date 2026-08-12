import type { Habit, HabitLog } from '../../types'
import { WEEKDAY_LABELS, weekdayIndex } from './historyRange'
import './HabitHistoryTable.css'

type Props = {
  habits: Habit[]
  logs: HabitLog[]
  dates: string[]
  mode: 'CHECK' | 'COUNT'
}

export function HabitHistoryTable({ habits, logs, dates, mode }: Props) {
  /** Chế độ gọn khi xem theo tháng (nhiều cột ngày). */
  const compact = dates.length > 10
  return (
    <div className="habit-history-scroll">
      <table className={`habit-history-table${compact ? ' habit-history-table-compact' : ''}`}>
        <thead>
          <tr>
            <th>Thói quen</th>
            {dates.map((date) => (
              <th key={date}>
                <span className="habit-history-weekday">{WEEKDAY_LABELS[weekdayIndex(new Date(`${date}T00:00:00`))]}</span>
                {date.slice(8)}
              </th>
            ))}
            <th className="habit-history-total-col">{mode === 'CHECK' ? 'Ngày' : 'Tổng'}</th>
          </tr>
        </thead>
        <tbody>
          {habits.map((habit) => {
            const isBad = habit.habit_type === 'BAD'
            const type = isBad ? 'bad' : 'good'
            const cells = dates.map((date) => logs.find((item) => item.habit_id === habit.id && item.date === date))
            const total = mode === 'CHECK'
              ? cells.filter((log) => log?.completed).length
              : cells.reduce((sum, log) => sum + (log?.value ?? 0), 0)
            return (
              <tr key={habit.id} className={`habit-history-row-${type}`}>
                <td>
                  <span className={`habit-history-name-${type}`}>{habit.name}</span>
                  <small className={`habit-history-badge habit-history-badge-${type}`}>{isBad ? 'Xấu' : 'Tốt'}</small>
                </td>
                {dates.map((date, i) => {
                  const log = cells[i]
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
                <td className="habit-history-total-col">
                  <span className={`habit-history-total habit-history-total-${type}`}>
{total}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Tổng cộng</td>
            {dates.map((date) => {
              const dayTotal = mode === 'CHECK'
                ? habits.filter((h) => logs.some((l) => l.habit_id === h.id && l.date === date && l.completed)).length
                : habits.reduce((sum, h) => sum + (logs.find((l) => l.habit_id === h.id && l.date === date)?.value ?? 0), 0)
              return <td key={date}>{dayTotal || <span className="habit-history-empty">-</span>}</td>
            })}
            <td className="habit-history-total-col">
              {mode === 'CHECK'
                ? habits.reduce((sum, h) => sum + logs.filter((l) => l.habit_id === h.id && dates.includes(l.date) && l.completed).length, 0)
                : habits.reduce((sum, h) => sum + logs.filter((l) => l.habit_id === h.id && dates.includes(l.date)).reduce((s, l) => s + (l.value ?? 0), 0), 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
