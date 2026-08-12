import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FoodPeriodView, PeriodSelector, SleepPeriodView } from './NutritionPeriodViews'
import type { NutritionLog, SleepLog } from './periodData'

afterEach(cleanup)

const days = ['2026-08-10', '2026-08-11', '2026-08-12']
const foodLogs: NutritionLog[] = [
  { id: '1', meal_slot: 'MORNING', food_name: 'Phở', price: 40_000, log_date: '2026-08-10', log_time: '07:00' },
  { id: '2', meal_slot: 'LUNCH', food_name: 'Cơm', price: 55_000, log_date: '2026-08-12', log_time: '12:00' },
]
const sleepLogs: SleepLog[] = [
  { id: 's1', sleep_start: '22:00', sleep_end: '06:00', log_date: '2026-08-10', duration_minutes: 480 },
  { id: 's2', sleep_start: '23:00', sleep_end: '05:00', log_date: '2026-08-12', duration_minutes: 360 },
]

describe('PeriodSelector', () => {
  it('exposes the selected period and changes to week', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PeriodSelector value="day" onChange={onChange} />)

    expect(screen.getByRole('button', { name: 'Ngày' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Tuần' }))
    expect(onChange).toHaveBeenCalledWith('week')
  })
})

describe('FoodPeriodView', () => {
  it('shows summaries, chart dates, and newest history first', () => {
    render(<FoodPeriodView logs={foodLogs} days={days} mealFilter="ALL" onMealFilter={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('95.000đ')).toBeInTheDocument()
    expect(screen.getByLabelText('Ăn uống 12/8: 55.000đ')).toBeInTheDocument()
    const groups = screen.getAllByTestId('food-date-group')
    expect(groups[0]).toHaveTextContent('12/8/2026')
    expect(groups[1]).toHaveTextContent('10/8/2026')
  })

  it('requests exactly one meal filter', async () => {
    const user = userEvent.setup()
    const onMealFilter = vi.fn()
    render(<FoodPeriodView logs={foodLogs} days={days} mealFilter="ALL" onMealFilter={onMealFilter} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Trưa' }))
    expect(onMealFilter).toHaveBeenCalledWith('LUNCH')
  })
})

describe('SleepPeriodView', () => {
  it('shows total, average, target nights, chart, and history', () => {
    render(<SleepPeriodView logs={sleepLogs} days={days} onDelete={vi.fn()} />)

    expect(screen.getByText('14h')).toBeInTheDocument()
    expect(screen.getByText('7h')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByLabelText('Giấc ngủ 10/8: 8h')).toBeInTheDocument()
    expect(screen.getByText('22:00 → 06:00')).toBeInTheDocument()
  })
})
