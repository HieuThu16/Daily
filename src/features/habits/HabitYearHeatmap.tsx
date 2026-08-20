import { useMemo } from 'react'
import type { Habit, HabitLog } from '../../types'
import { localDate } from '../../lib/date'
import { startOfWeek, weekdayIndex, WEEKDAY_LABELS } from './historyRange'

const MONTH_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

/** 0 → nền trống, 1 → xanh đậm nhất. Bốn bậc cho dễ phân biệt trên ô 11px. */
function shadeOf(ratio: number) {
  if (ratio <= 0) return 'var(--card-border)'
  if (ratio < 0.34) return 'color-mix(in srgb, var(--emerald) 25%, transparent)'
  if (ratio < 0.67) return 'color-mix(in srgb, var(--emerald) 55%, transparent)'
  if (ratio < 1) return 'color-mix(in srgb, var(--emerald) 80%, transparent)'
  return 'var(--emerald)'
}

/**
 * Nhìn cả năm trong một lưới: mỗi cột là một tuần, mỗi ô là một ngày,
 * đậm nhạt theo tỉ lệ thói quen đã tích trong ngày đó.
 */
export function HabitYearHeatmap({ habits, logs, dates }: { habits: Habit[]; logs: HabitLog[]; dates: string[] }) {
  const today = localDate()

  const ratioByDate = useMemo(() => {
    const doneByDate = new Map<string, Set<string>>()
    for (const log of logs) {
      if (!log.completed) continue
      if (!doneByDate.has(log.date)) doneByDate.set(log.date, new Set())
      doneByDate.get(log.date)!.add(log.habit_id)
    }
    const total = habits.length || 1
    const result = new Map<string, number>()
    for (const day of dates) result.set(day, (doneByDate.get(day)?.size ?? 0) / total)
    return result
  }, [habits, logs, dates])

  // Xếp ngày vào cột tuần (thứ Hai đầu cột) để lưới thẳng hàng như lịch.
  const weeks = useMemo(() => {
    const columns: Array<Array<string | null>> = []
    let current: Array<string | null> = Array(7).fill(null)
    let currentKey = ''
    for (const day of dates) {
      const date = new Date(`${day}T12:00:00`)
      const weekKey = localDate(startOfWeek(date))
      if (weekKey !== currentKey) {
        if (currentKey) columns.push(current)
        current = Array(7).fill(null)
        currentKey = weekKey
      }
      current[weekdayIndex(date)] = day
    }
    if (currentKey) columns.push(current)
    return columns
  }, [dates])

  const streak = useMemo(() => {
    let count = 0
    for (let i = dates.length - 1; i >= 0; i -= 1) {
      const day = dates[i]
      if (day > today) continue
      if ((ratioByDate.get(day) ?? 0) > 0) count += 1
      else break
    }
    return count
  }, [dates, ratioByDate, today])

  const activeDays = useMemo(() => dates.filter((d) => (ratioByDate.get(d) ?? 0) > 0).length, [dates, ratioByDate])

  if (!habits.length) return <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>Chưa có thói quen dạng Tích.</p>

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8, fontSize: '0.78rem' }}>
        <span>🔥 Chuỗi hiện tại: <strong>{streak}</strong> ngày</span>
        <span>✅ Ngày có tích: <strong>{activeDays}</strong>/{dates.length}</span>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 11px)', gap: 3, marginRight: 2 }}>
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={label} style={{ fontSize: '0.55rem', color: 'var(--text-muted)', lineHeight: '11px' }}>
                {i % 2 === 0 ? label : ''}
              </span>
            ))}
          </div>
          {weeks.map((week, i) => (
            <div key={week.find(Boolean) ?? i} style={{ display: 'grid', gridTemplateRows: 'repeat(7, 11px)', gap: 3 }}>
              {week.map((day, row) => {
                const ratio = day ? ratioByDate.get(day) ?? 0 : 0
                return (
                  <span
                    key={day ?? `empty-${row}`}
                    title={day ? `${day} · ${Math.round(ratio * 100)}%` : ''}
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 3,
                      background: day ? shadeOf(ratio) : 'transparent',
                      outline: day === today ? '1.5px solid var(--primary)' : 'none',
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.55rem', color: 'var(--text-muted)', minWidth: 'max-content' }}>
        {MONTH_LABELS.map((m) => (
          <span key={m}>T{m}</span>
        ))}
      </div>
    </div>
  )
}
