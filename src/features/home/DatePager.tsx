import { ChevronLeft, ChevronRight } from 'lucide-react'
import { localDate } from '../../lib/date'
import { parseLocalDate } from '../../lib/occasions'
import type { WeekDay } from '../../lib/homeProgress'

type Props = {
  dateKey: string
  week: WeekDay[]
  mode: 'day' | 'week'
  onChange: (dateKey: string) => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

/** Lùi/tiến một ngày (hoặc một tuần) và nút quay về hôm nay. */
export function DatePager({ dateKey, week, mode, onChange }: Props) {
  const date = parseLocalDate(dateKey)
  const today = localDate()
  const step = mode === 'week' ? 7 : 1

  const shift = (days: number) =>
    onChange(toKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)))

  const label =
    mode === 'week'
      ? `${week[0].dayMonth} – ${week[6].dayMonth}`
      : dateKey === today
        ? 'Hôm nay'
        : `${WEEKDAYS[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`

  const isCurrent = mode === 'week' ? week.some((day) => day.key === today) : dateKey === today

  return (
    <div className="date-pager">
      <button
        type="button"
        className="icon"
        onClick={() => shift(-step)}
        aria-label={mode === 'week' ? 'Tuần trước' : 'Ngày trước'}
      >
        <ChevronLeft size={18} />
      </button>

      <div className="date-pager-label">
        <strong>{label}</strong>
        {mode === 'day' && <input type="date" value={dateKey} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Chọn ngày" />}
      </div>

      <button
        type="button"
        className="icon"
        onClick={() => shift(step)}
        aria-label={mode === 'week' ? 'Tuần sau' : 'Ngày sau'}
      >
        <ChevronRight size={18} />
      </button>

      {!isCurrent && (
        <button type="button" className="date-pager-today" onClick={() => onChange(today)}>
          Hôm nay
        </button>
      )}
    </div>
  )
}
