import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '../../types'
import { HabitMonthCalendar } from './HabitMonthCalendar'
import { monthDates } from './historyRange'

afterEach(cleanup)

const dates = monthDates(new Date('2026-08-12T12:00:00'))

const habit = (over: Partial<Habit>): Habit => ({
  id: 'h', name: 'Đọc sách', is_active: true, category_id: null, tracking_type: 'CHECK', habit_type: 'GOOD', ...over,
})

describe('HabitMonthCalendar', () => {
  it('chừa ô trống đầu tháng cho đúng cột thứ và tô ngày đã làm', () => {
    const logs: HabitLog[] = [{ habit_id: 'h', date: '2026-08-03', completed: true }]
    const { container } = render(<HabitMonthCalendar habits={[habit({})]} logs={logs} dates={dates} mode="CHECK" />)

    // 1/8/2026 là thứ Bảy → 5 ô trống trước đó.
    expect(container.querySelectorAll('.habit-month-blank')).toHaveLength(5)
    expect(screen.getByTitle('2026-08-03')).toHaveClass('habit-month-cell-good')
    expect(screen.getByTitle('2026-08-04')).not.toHaveClass('habit-month-cell-good')
    expect(screen.getByText('1 ngày')).toBeInTheDocument()
  })

  it('cộng tổng số liệu và hiện giá trị trong ô', () => {
    const logs: HabitLog[] = [
      { habit_id: 'h', date: '2026-08-03', completed: true, value: 30 },
      { habit_id: 'h', date: '2026-08-05', completed: true, value: 45 },
    ]
    render(<HabitMonthCalendar habits={[habit({ tracking_type: 'COUNT', habit_type: 'BAD' })]} logs={logs} dates={dates} mode="COUNT" />)

    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByTitle('2026-08-05')).toHaveTextContent('45')
    expect(screen.getByTitle('2026-08-05')).toHaveClass('habit-month-cell-bad')
    expect(screen.getByText('2 ngày có ghi nhận')).toBeInTheDocument()
  })
})
