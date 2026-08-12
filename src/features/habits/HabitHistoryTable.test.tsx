import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '../../types'
import { HabitHistoryTable } from './HabitHistoryTable'

afterEach(cleanup)

const dates = ['2026-08-11', '2026-08-12']

const habits: Habit[] = [
  { id: 'good', name: 'Đọc sách', is_active: true, category_id: null, tracking_type: 'CHECK', habit_type: 'GOOD' },
  { id: 'bad', name: 'TikTok', is_active: true, category_id: null, tracking_type: 'CHECK', habit_type: 'BAD' },
]

const logs: HabitLog[] = [
  { habit_id: 'good', date: '2026-08-12', completed: true },
  { habit_id: 'bad', date: '2026-08-12', completed: true },
]

describe('HabitHistoryTable', () => {
  it('colors good and bad check habits while keeping empty cells muted', () => {
    render(<HabitHistoryTable habits={habits} logs={logs} dates={dates} mode="CHECK" />)

    const goodRow = screen.getByRole('row', { name: /Đọc sách.*Tốt/ })
    const badRow = screen.getByRole('row', { name: /TikTok.*Xấu/ })
    expect(goodRow).toHaveClass('habit-history-row-good')
    expect(badRow).toHaveClass('habit-history-row-bad')
    expect(within(goodRow).getByText('Đọc sách')).toHaveClass('habit-history-name-good')
    expect(within(badRow).getByText('TikTok')).toHaveClass('habit-history-name-bad')
    expect(within(goodRow).getByText('Tốt')).toBeInTheDocument()
    expect(within(badRow).getByText('Xấu')).toBeInTheDocument()
    expect(within(goodRow).getByText('✓')).toHaveClass('habit-history-value-good')
    expect(within(badRow).getByText('✓')).toHaveClass('habit-history-value-bad')
    expect(within(goodRow).getByText('-')).toHaveClass('habit-history-empty')
  })

  it('colors numeric values by habit type in the count table', () => {
    const countHabits = habits.map((habit) => ({ ...habit, tracking_type: 'COUNT' as const }))
    const countLogs: HabitLog[] = [
      { habit_id: 'good', date: '2026-08-12', completed: true, value: 10 },
      { habit_id: 'bad', date: '2026-08-12', completed: true, value: 3 },
    ]
    render(<HabitHistoryTable habits={countHabits} logs={countLogs} dates={dates} mode="COUNT" />)

    // Cột "Tổng" cũng hiện đúng con số đó, nên phải tìm trong ô ngày của từng dòng.
    const goodRow = screen.getByRole('row', { name: /Đọc sách.*Tốt/ })
    const badRow = screen.getByRole('row', { name: /TikTok.*Xấu/ })
    expect(within(goodRow).getByText('10', { selector: '.habit-history-value-good' })).toBeInTheDocument()
    expect(within(badRow).getByText('3', { selector: '.habit-history-value-bad' })).toBeInTheDocument()
    expect(within(goodRow).getByText('10', { selector: '.habit-history-total' })).toBeInTheDocument()
  })
})
