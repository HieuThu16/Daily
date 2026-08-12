import { Check, ChevronRight, Flame } from 'lucide-react'
import type { Habit } from '../../types'

const ROUTINE_LABEL: Record<string, string> = {
  MORNING: '🌅 Sáng (6h–11h)',
  AFTERNOON: '☀️ Trưa (11h–18h)',
  EVENING: '🌙 Tối (18h–6h)',
}

export function currentRoutineSlot(hour = new Date().getHours()): 'MORNING' | 'AFTERNOON' | 'EVENING' {
  if (hour >= 6 && hour < 11) return 'MORNING'
  if (hour >= 11 && hour < 18) return 'AFTERNOON'
  return 'EVENING'
}

type Props = {
  habits: Habit[]
  completedIds: Set<string>
  loading: boolean
  onToggle: (habit: Habit) => void
  onOpenAll: () => void
}

export function HabitsCard({ habits, completedIds, loading, onToggle, onOpenAll }: Props) {
  const slot = currentRoutineSlot()
  const slotHabits = habits.filter((h) => (h.routine ?? 'MORNING') === slot)
  const good = slotHabits.filter((h) => h.habit_type !== 'BAD')
  const bad = slotHabits.filter((h) => h.habit_type === 'BAD')
  const doneCount = (list: Habit[]) => list.filter((h) => completedIds.has(h.id)).length

  const row = (habit: Habit, isBad: boolean) => {
    const done = completedIds.has(habit.id)
    return (
      <div
        key={habit.id}
        className={'check-row ' + (done ? 'checked' : '')}
        onClick={() => onToggle(habit)}
        style={{
          padding: '4px 8px',
          borderRadius: 8,
          margin: 0,
          cursor: 'pointer',
          background: isBad && done ? 'var(--rose-bg)' : undefined,
          border: isBad && done ? '1px solid var(--rose)' : undefined,
        }}
      >
        <span
          className="checkbox"
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: isBad && done ? 'var(--rose)' : undefined,
            borderColor: isBad && done ? 'var(--rose)' : undefined,
          }}
        >
          {done && <Check size={11} style={isBad ? { color: '#fff' } : undefined} />}
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: isBad && done ? 'var(--rose)' : undefined }}>
          {habit.name}
        </span>
      </div>
    )
  }

  return (
    <div className="card home-card">
      <div className="home-card-head">
        <div className="home-card-title">
          <div className="icon-box icon-box-sm icon-box-amber" style={{ width: 24, height: 24 }}>
            <Flame size={14} />
          </div>
          <div>
            <div style={{ lineHeight: 1 }}>Habits</div>
            <small>{ROUTINE_LABEL[slot]}</small>
          </div>
        </div>
        <span className="home-card-count">
          {doneCount(slotHabits)}/{slotHabits.length}
        </span>
      </div>

      <div className="home-card-body">
        {loading ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : slotHabits.length === 0 ? (
          <p className="home-card-empty">Chưa có thói quen nào.</p>
        ) : (
          <>
            {good.length > 0 && (
              <div>
                <div className="home-group-title" style={{ color: 'var(--emerald)' }}>
                  🌟 Thói quen tốt ({doneCount(good)}/{good.length})
                </div>
                <div style={{ display: 'grid', gap: 3 }}>{good.map((h) => row(h, false))}</div>
              </div>
            )}

            {good.length > 0 && bad.length > 0 && <div className="home-divider" />}

            {bad.length > 0 && (
              <div>
                <div className="home-group-title" style={{ color: 'var(--rose)' }}>
                  ⚠️ Thói quen cần bỏ ({doneCount(bad)}/{bad.length})
                </div>
                <div style={{ display: 'grid', gap: 3 }}>{bad.map((h) => row(h, true))}</div>
              </div>
            )}
          </>
        )}
      </div>

      <button type="button" className="home-card-foot" onClick={onOpenAll}>
        Xem tất cả <ChevronRight size={14} />
      </button>
    </div>
  )
}
