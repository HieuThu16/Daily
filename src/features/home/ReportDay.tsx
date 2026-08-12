import { CheckSquare, Flame, NotebookPen, Salad } from 'lucide-react'
import type { CompletionSummary } from '../../lib/homeProgress'
import { formatMoney, mealBreakdown, totalSpend } from '../../lib/report'
import type { UpcomingOccasion } from '../../lib/occasions'
import { countdownLabel } from '../../lib/occasions'
import type { Entry, Habit, HabitLog, NutritionLog, Todo } from '../../types'
import { ProgressRing } from './ProgressRing'

type Props = {
  completion: CompletionSummary
  habits: Habit[]
  todayLogs: HabitLog[]
  todos: Todo[]
  todosDoneToday: Todo[]
  entries: Entry[]
  meals: NutritionLog[]
  nextOccasion: UpcomingOccasion | null
  onOpen: (tab: string) => void
}

/** Một ô số liệu; bấm vào mở tab tương ứng. */
function Tile({
  tone,
  icon: Icon,
  label,
  value,
  hint,
  percent,
  onClick,
}: {
  tone: string
  icon: typeof Flame
  label: string
  value: string
  hint: string
  percent?: number
  onClick: () => void
}) {
  return (
    <button className="report-tile" onClick={onClick}>
      <span className="report-tile-head">
        <span className="icon-box icon-box-sm" style={{ background: `var(--${tone}-bg)`, color: `var(--${tone})` }}>
          <Icon size={15} />
        </span>
        {label}
      </span>
      <strong>{value}</strong>
      {percent === undefined ? (
        <span className="report-tile-hint">{hint}</span>
      ) : (
        <>
          <span className="report-bar">
            <i style={{ width: `${percent}%`, background: `var(--${tone})` }} />
          </span>
          <span className="report-tile-hint">{hint}</span>
        </>
      )}
    </button>
  )
}

export function ReportDay({
  completion,
  habits,
  todayLogs,
  todos,
  todosDoneToday,
  entries,
  meals,
  nextOccasion,
  onOpen,
}: Props) {
  const habitDone = new Set(todayLogs.filter((l) => l.completed).map((l) => l.habit_id)).size
  const todoTotal = todos.length + todosDoneToday.length
  const spend = totalSpend(meals)
  const byMeal = mealBreakdown(meals)

  return (
    <div className="report">
      <div className="report-hero">
        <ProgressRing percent={completion.percent} size={92} />
        <div>
          <h2>{completion.percent}% hôm nay</h2>
          <p>
            {completion.total === 0
              ? 'Chưa có thói quen hay việc nào để theo dõi.'
              : completion.remaining === 0
                ? 'Xong hết rồi, nghỉ ngơi thôi.'
                : `Còn ${completion.remaining} mục chưa xong.`}
          </p>
        </div>
      </div>

      <div className="report-grid">
        <Tile
          tone="amber"
          icon={Flame}
          label="Thói quen"
          value={`${habitDone}/${habits.length}`}
          hint={habits.length - habitDone === 0 ? 'Đã làm hết' : `Còn ${habits.length - habitDone} chưa làm`}
          percent={habits.length ? Math.round((habitDone / habits.length) * 100) : 0}
          onClick={() => onOpen('/habit')}
        />
        <Tile
          tone="purple"
          icon={CheckSquare}
          label="Việc cần làm"
          value={`${todosDoneToday.length}/${todoTotal}`}
          hint={todos.length === 0 ? 'Không còn việc nào' : `Còn ${todos.length} việc`}
          percent={todoTotal ? Math.round((todosDoneToday.length / todoTotal) * 100) : 0}
          onClick={() => onOpen('/tasks')}
        />
        <Tile
          tone={entries.length ? 'emerald' : 'rose'}
          icon={NotebookPen}
          label="Nhật ký"
          value={entries.length ? `${entries.length} mục` : 'Chưa ghi'}
          hint={entries.length ? 'Đã ghi hôm nay' : 'Hôm nay chưa viết gì'}
          onClick={() => onOpen('/daily')}
        />
        <Tile
          tone="cyan"
          icon={Salad}
          label="Ăn uống"
          value={formatMoney(spend)}
          hint={meals.length ? `${meals.length} món hôm nay` : 'Chưa ghi bữa nào'}
          onClick={() => onOpen('/nutrition')}
        />
      </div>

      <div className="report-meals">
        {byMeal.map((meal) => (
          <div key={meal.slot} className={'report-meal' + (meal.count ? '' : ' empty')}>
            <span>{meal.label}</span>
            <strong>{formatMoney(meal.total)}</strong>
          </div>
        ))}
      </div>

      {nextOccasion && (
        <button className="report-note" onClick={() => onOpen('/people')}>
          🎂 {nextOccasion.label}
          <span>{countdownLabel(nextOccasion.days)}</span>
        </button>
      )}
    </div>
  )
}
