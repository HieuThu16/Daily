import { BookMarked, BookOpen, CheckSquare, Film, Flame, Heart, Moon, Music, NotebookPen, Salad, Youtube } from 'lucide-react'
import type { CompletionSummary } from '../../lib/homeProgress'
import { formatMoney, mealBreakdown, sleepSummary, totalSpend } from '../../lib/report'
import type { UpcomingOccasion } from '../../lib/occasions'
import { countdownLabel } from '../../lib/occasions'
import type { Entry, Habit, HabitLog, Media, NutritionLog, SleepLog, Todo } from '../../types'
import { ProgressRing } from './ProgressRing'

type Props = {
  completion: CompletionSummary
  habits: Habit[]
  todayLogs: HabitLog[]
  todos: Todo[]
  todosDoneToday: Todo[]
  entries: Entry[]
  meals: NutritionLog[]
  sleep: SleepLog[]
  todayMedia?: Media[]
  todayReadingLogs?: any[]
  isToday: boolean
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
  sleep,
  todayMedia = [],
  todayReadingLogs = [],
  isToday,
  nextOccasion,
  onOpen,
}: Props) {
  const habitDone = new Set(todayLogs.filter((l) => l.completed).map((l) => l.habit_id)).size
  const todoTotal = todos.length + todosDoneToday.length
  const spend = totalSpend(meals)
  const byMeal = mealBreakdown(meals)
  const rest = sleepSummary(sleep)

  // Thống kê giải trí trong ngày
  const musicCount = todayMedia.filter((m) => m.type === 'MUSIC').length
  const tvCount = todayMedia.filter((m) => m.type === 'YOUTUBE').length
  const bookCount = todayMedia.filter((m) => m.type === 'BOOK').length + todayReadingLogs.length
  const movieCount = todayMedia.filter((m) => m.type === 'MOVIE').length
  const mangaCount = todayMedia.filter((m) => m.type === 'MANGA').length
  const totalMedia = todayMedia.length + todayReadingLogs.length

  return (
    <div className="report">
      <div className="report-hero">
        <ProgressRing percent={completion.percent} size={92} />
        <div>
          <h2>{completion.percent}% {isToday ? 'hôm nay' : 'ngày này'}</h2>
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
          hint={entries.length ? 'Đã ghi trong ngày' : 'Ngày này chưa viết gì'}
          onClick={() => onOpen('/daily')}
        />
        <Tile
          tone="cyan"
          icon={Salad}
          label="Ăn uống"
          value={formatMoney(spend)}
          hint={meals.length ? `${meals.length} món trong ngày` : 'Chưa ghi bữa nào'}
          onClick={() => onOpen('/nutrition')}
        />
      </div>

      {/* Thống kê giải trí & nghệ thuật trong ngày (Nhạc, TV Show, Sách, Phim, Truyện) */}
      <div className="report-media-section" style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            🎧 Giải trí & Kiến thức {totalMedia > 0 ? `(${totalMedia})` : ''}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mục trong ngày</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
          <button
            type="button"
            onClick={() => onOpen('/music')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'var(--cyan-bg)', color: 'var(--cyan)', border: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <Music size={15} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Nhạc</span>
              <strong style={{ fontSize: '0.86rem' }}>{musicCount} bài</strong>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpen('/books')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'var(--purple-bg)', color: 'var(--purple)', border: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <BookOpen size={15} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Sách</span>
              <strong style={{ fontSize: '0.86rem' }}>{bookCount} mục</strong>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpen('/youtube')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(244, 63, 94, 0.12)', color: 'var(--rose)', border: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <Youtube size={15} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>YouTube</span>
              <strong style={{ fontSize: '0.86rem' }}>{tvCount} video</strong>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpen('/movies')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'var(--rose-bg)', color: 'var(--rose)', border: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <Film size={15} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Phim</span>
              <strong style={{ fontSize: '0.86rem' }}>{movieCount} phim</strong>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpen('/manga')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'var(--emerald-bg)', color: 'var(--emerald)', border: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <BookMarked size={15} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Truyện</span>
              <strong style={{ fontSize: '0.86rem' }}>{mangaCount} bộ</strong>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpen('/bl')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, background: 'rgba(236, 72, 153, 0.12)', color: '#db2777', border: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <Heart size={15} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>Truyện BL</span>
              <strong style={{ fontSize: '0.86rem' }}>Đọc ngay</strong>
            </div>
          </button>
        </div>
      </div>

      <button className="report-sleep" onClick={() => onOpen('/nutrition')}>
        <span className="icon-box icon-box-sm" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>
          <Moon size={15} />
        </span>
        <span className="report-sleep-label">Giấc ngủ</span>
        <strong>{rest.text}</strong>
        <span className="report-sleep-range">{rest.range ?? 'Chưa ghi'}</span>
      </button>

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
