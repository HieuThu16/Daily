import { CloudMoon, Moon, Pencil, Trash2, UtensilsCrossed } from 'lucide-react'
import {
  aggregateSleepByDate,
  filterFoodLogs,
  groupLogsByDate,
  summarizeFood,
  summarizeSleep,
  type MealFilter,
  type MealSlot,
  type NutritionLog,
  type PeriodMode,
  type SleepLog,
} from './periodData'
import './NutritionPeriodViews.css'

const MEALS: { slot: MealFilter; label: string; color: string; emoji: string }[] = [
  { slot: 'ALL', label: 'Tất cả', color: 'var(--primary)', emoji: '🍽️' },
  { slot: 'MORNING', label: 'Sáng', color: '#f59e0b', emoji: '🌅' },
  { slot: 'LUNCH', label: 'Trưa', color: '#10b981', emoji: '☀️' },
  { slot: 'AFTERNOON', label: 'Chiều', color: '#f97316', emoji: '🌤️' },
  { slot: 'EVENING', label: 'Tối', color: '#6366f1', emoji: '🌙' },
]

const mealBySlot = Object.fromEntries(MEALS.slice(1).map((meal) => [meal.slot, meal])) as Record<MealSlot, (typeof MEALS)[number]>

function money(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
}

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h${rest ? `${rest}m` : ''}` : `${rest}m`
}

function shortDate(value: string) {
  const [, month, day] = value.split('-').map(Number)
  return `${day}/${month}`
}

function fullDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const weekday = new Date(value + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'short' })
  return `${weekday}, ${day}/${month}/${year}`
}

function sleepQuality(minutes: number) {
  if (minutes >= 450) return { label: 'Đủ giấc', color: '#10b981' }
  if (minutes >= 360) return { label: 'Tạm ổn', color: '#f59e0b' }
  return { label: 'Thiếu ngủ', color: '#ef4444' }
}

export function PeriodSelector({ value, onChange }: { value: PeriodMode; onChange: (mode: PeriodMode) => void }) {
  return (
    <div className="nutrition-period-selector" role="group" aria-label="Khoảng thời gian">
      {([['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']] as const).map(([mode, label]) => (
        <button key={mode} type="button" aria-pressed={value === mode} onClick={() => onChange(mode)}>{label}</button>
      ))}
    </div>
  )
}

function SummaryCards({ items }: { items: { label: string; value: string; color: string }[] }) {
  return (
    <div className="nutrition-period-summary">
      {items.map((item) => (
        <div key={item.label}>
          <strong style={{ color: item.color }}>{item.value}</strong>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export function FoodPeriodView({ logs, days, mealFilter, onMealFilter, onDelete, onEdit }: {
  logs: NutritionLog[]
  days: string[]
  mealFilter: MealFilter
  onMealFilter: (slot: MealFilter) => void
  onDelete: (id: string) => void
  onEdit?: (log: NutritionLog) => void
}) {
  const filtered = filterFoodLogs(logs, mealFilter)
  const summary = summarizeFood(filtered, days)
  const groups = groupLogsByDate(filtered)
  const max = Math.max(...Object.values(summary.byDate), 1)

  return (
    <div className="nutrition-period-view">
      <div className="nutrition-meal-filter" role="group" aria-label="Lọc theo bữa">
        {MEALS.map((meal) => (
          <button key={meal.slot} type="button" aria-label={meal.label} aria-pressed={mealFilter === meal.slot} onClick={() => onMealFilter(meal.slot)}>
            <span>{meal.emoji}</span>{meal.label}
          </button>
        ))}
      </div>

      <SummaryCards items={[
        { label: 'Tổng chi', value: money(summary.total), color: 'var(--primary)' },
        { label: 'Trung bình/ngày', value: money(summary.averagePerDay), color: '#f97316' },
        { label: 'Số món', value: String(summary.itemCount), color: '#10b981' },
      ]} />

      <div className="nutrition-period-card">
        <h3><UtensilsCrossed size={15} /> Chi tiêu theo ngày</h3>
        <div className="nutrition-chart-scroll">
          <div className="nutrition-period-chart" style={{ minWidth: days.length > 10 ? days.length * 28 : undefined }}>
            {days.map((day) => {
              const value = summary.byDate[day]
              return (
                <div key={day} className="nutrition-chart-column" aria-label={`Ăn uống ${shortDate(day)}: ${money(value)}`}>
                  <span>{value ? money(value) : '—'}</span>
                  <div><i style={{ height: `${value ? Math.max(5, value / max * 100) : 0}%` }} /></div>
                  <small>{shortDate(day)}</small>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {groups.length ? groups.map(([date, entries]) => (
        <section key={date} className="nutrition-period-card nutrition-history-group" data-testid="food-date-group">
          <header><strong>{fullDate(date)}</strong><span>{money(entries.reduce((sum, item) => sum + item.price, 0))}</span></header>
          {entries.map((entry) => {
            const meal = mealBySlot[entry.meal_slot]
            return (
              <div key={entry.id} className="nutrition-history-row">
                <span className="nutrition-history-icon" style={{ color: meal.color }}>{meal.emoji}</span>
                <div><strong>{entry.food_name}</strong><small>{meal.label}{entry.log_time ? ` · ${entry.log_time}` : ''}</small></div>
                <b style={{ color: meal.color }}>{money(entry.price)}</b>
                <div className="nutrition-history-actions">
                  {onEdit && (
                    <button type="button" aria-label={`Sửa ${entry.food_name}`} onClick={() => onEdit(entry)} style={{ color: 'var(--text-muted)' }}>
                      <Pencil size={14} />
                    </button>
                  )}
                  <button type="button" aria-label={`Xóa ${entry.food_name}`} onClick={() => onDelete(entry.id)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </section>
      )) : <div className="nutrition-period-empty">Chưa có dữ liệu ăn uống trong khoảng này</div>}
    </div>
  )
}

export function SleepPeriodView({
  logs,
  days,
  onDelete,
  onEdit,
  onDream,
}: {
  logs: SleepLog[]
  days: string[]
  onDelete: (id: string) => void
  onEdit?: (log: SleepLog) => void
  onDream?: (log: SleepLog) => void
}) {
  const summary = summarizeSleep(logs)
  const byDate = aggregateSleepByDate(logs, days)
  const groups = groupLogsByDate(logs)
  const max = Math.max(...Object.values(byDate), 1)

  return (
    <div className="nutrition-period-view">
      <SummaryCards items={[
        { label: 'Trung bình/đêm', value: duration(summary.averagePerNight), color: '#6366f1' },
        { label: 'Tổng thời gian', value: duration(summary.totalMinutes), color: '#8b5cf6' },
        { label: 'Đêm đủ giấc', value: String(summary.targetNights), color: '#10b981' },
      ]} />

      <div className="nutrition-period-card">
        <h3><Moon size={15} /> Giấc ngủ theo ngày</h3>
        <div className="nutrition-chart-scroll">
          <div className="nutrition-period-chart" style={{ minWidth: days.length > 10 ? days.length * 28 : undefined }}>
            {days.map((day) => {
              const value = byDate[day]
              const quality = sleepQuality(value)
              return (
                <div key={day} className="nutrition-chart-column" aria-label={`Giấc ngủ ${shortDate(day)}: ${value ? duration(value) : '—'}`}>
                  <span>{value ? duration(value) : '—'}</span>
                  <div><i style={{ height: `${value ? Math.max(5, value / max * 100) : 0}%`, background: value ? quality.color : undefined }} /></div>
                  <small>{shortDate(day)}</small>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {groups.length ? groups.map(([date, entries]) => (
        <section key={date} className="nutrition-period-card nutrition-history-group">
          <header><strong>{fullDate(date)}</strong><span>{duration(entries.reduce((sum, item) => sum + item.duration_minutes, 0))}</span></header>
          {entries.map((entry) => {
            const quality = sleepQuality(entry.duration_minutes)
            return (
              <div key={entry.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="nutrition-history-row">
                  <span className="nutrition-history-icon sleep"><Moon size={16} /></span>
                  <div><strong>{entry.sleep_start} → {entry.sleep_end}</strong><small style={{ color: quality.color }}>{quality.label}</small></div>
                  <b style={{ color: quality.color }}>{duration(entry.duration_minutes)}</b>
                  <div className="nutrition-history-actions">
                    {onDream && (
                      <button type="button" aria-label={`Ghi giấc mơ ${entry.sleep_start}`} title={entry.dream ? 'Sửa giấc mơ' : 'Thêm giấc mơ'} onClick={() => onDream(entry)} style={{ color: '#8b5cf6' }}>
                        <CloudMoon size={15} />
                      </button>
                    )}
                    {onEdit && (
                      <button type="button" aria-label={`Sửa giấc ngủ ${entry.sleep_start}`} title="Sửa phiên ngủ" onClick={() => onEdit(entry)} style={{ color: 'var(--text-muted)' }}>
                        <Pencil size={14} />
                      </button>
                    )}
                    <button type="button" aria-label={`Xóa giấc ngủ ${entry.sleep_start}`} title="Xoá phiên ngủ" onClick={() => onDelete(entry.id)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                {entry.dream && (
                  <div
                    onClick={() => onDream?.(entry)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: '2px 0 6px 36px', padding: '5px 9px', background: 'var(--bg-main)', borderRadius: 7, fontSize: '0.76rem', color: 'var(--text-main)', borderLeft: '3px solid #8b5cf6', cursor: onDream ? 'pointer' : 'default' }}
                  >
                    <CloudMoon size={13} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ flex: 1 }}>{entry.dream}</span>
                    {onDream && <Pencil size={11} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 3 }} />}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )) : <div className="nutrition-period-empty">Chưa có dữ liệu giấc ngủ trong khoảng này</div>}
    </div>
  )
}
