import { formatLunar, hasLeapMonth, lunarMonthLength, lunarToSolar, solarToLunar } from '../../lib/lunar'
import { parseLocalDate } from '../../lib/occasions'
import type { OccasionCalendar } from '../../types'

type Props = {
  /** Luôn là ngày dương 'YYYY-MM-DD' — nhập kiểu âm vẫn quy về dương để lưu. */
  value: string
  onChange: (value: string) => void
  calendar: OccasionCalendar
  onCalendarChange: (calendar: OccasionCalendar) => void
  label?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Ô chọn ngày gạt được Dương ↔ Âm, luôn hiện ngày tương ứng ở lịch còn lại. */
export function DualCalendarDate({ value, onChange, calendar, onCalendarChange, label = 'Ngày' }: Props) {
  const solar = value ? parseLocalDate(value) : new Date()
  const lunar = solarToLunar(solar)
  const leapAvailable = hasLeapMonth(lunar.month, lunar.year)

  const setLunar = (next: Partial<typeof lunar>) => {
    const merged = { ...lunar, ...next }
    const isLeap = merged.isLeap && hasLeapMonth(merged.month, merged.year)
    const day = Math.min(merged.day, lunarMonthLength(merged.month, merged.year, isLeap))
    onChange(toIso(lunarToSolar(day, merged.month, merged.year, isLeap)))
  }

  return (
    <div className="dual-date">
      <div className="dual-date-head">
        <span>{label}</span>
        <div className="dual-date-toggle" role="group" aria-label="Loại lịch">
          {(['SOLAR', 'LUNAR'] as OccasionCalendar[]).map((option) => (
            <button
              key={option}
              type="button"
              className={calendar === option ? 'active' : ''}
              aria-pressed={calendar === option}
              onClick={() => onCalendarChange(option)}
            >
              {option === 'SOLAR' ? 'Dương' : 'Âm'}
            </button>
          ))}
        </div>
      </div>

      {calendar === 'SOLAR' ? (
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} dương lịch`} />
      ) : (
        <div className="dual-date-lunar">
          <select
            value={lunar.day}
            onChange={(e) => setLunar({ day: Number(e.target.value) })}
            aria-label="Ngày âm"
          >
            {Array.from({ length: lunarMonthLength(lunar.month, lunar.year, lunar.isLeap) }, (_, i) => i + 1).map(
              (d) => (
                <option key={d} value={d}>
                  Ngày {d}
                </option>
              ),
            )}
          </select>
          <select
            value={lunar.month}
            onChange={(e) => setLunar({ month: Number(e.target.value), isLeap: false })}
            aria-label="Tháng âm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={lunar.year}
            onChange={(e) => setLunar({ year: Number(e.target.value) })}
            aria-label="Năm âm"
          />
          {leapAvailable && (
            <label className="check">
              <input
                type="checkbox"
                checked={lunar.isLeap}
                onChange={(e) => setLunar({ isLeap: e.target.checked })}
              />
              Tháng nhuận
            </label>
          )}
        </div>
      )}

      <p className="dual-date-hint">
        {calendar === 'SOLAR'
          ? `↔ ${formatLunar(lunar)}`
          : `↔ ${solar.getDate()}/${solar.getMonth() + 1}/${solar.getFullYear()} dương`}
      </p>
    </div>
  )
}
