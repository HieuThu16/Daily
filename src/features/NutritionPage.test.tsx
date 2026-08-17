import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NutritionPage } from './NutritionPage'

const foodRows = [
  { id: 'f1', meal_slot: 'LUNCH', food_name: 'Cơm trưa', price: 50_000, log_date: '2026-08-12', log_time: '12:00', created_at: '2026-08-12T12:00:00Z' },
]
const sleepRows = [
  { id: 's1', sleep_start: '22:00', sleep_end: '06:00', duration_minutes: 480, log_date: '2026-08-12', created_at: '2026-08-12T06:00:00Z' },
]

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const result = { data: table === 'nutrition_logs' ? foodRows : sleepRows, error: null }
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'is', 'order', 'range', 'gte', 'lte', 'update', 'insert', 'single']) {
        query[method] = vi.fn(() => query)
      }
      query.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve)
      return query
    },
  },
}))

vi.mock('./ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

afterEach(cleanup)

describe('NutritionPage period navigation', () => {
  it('keeps only food and sleep tabs and preserves daily add controls', async () => {
    render(<NutritionPage />)

    expect(screen.getByRole('button', { name: 'Ăn uống' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ngủ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thống kê' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Sáng' })).toBeInTheDocument()
  })

  it('shows meal filters and period food history in week mode', async () => {
    const user = userEvent.setup()
    render(<NutritionPage />)

    await user.click(screen.getByRole('button', { name: 'Tuần' }))

    expect(screen.getByRole('group', { name: 'Lọc theo bữa' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Cơm trưa')).toBeInTheDocument())
  })

  it('shows sleep history in sleep week mode', async () => {
    const user = userEvent.setup()
    render(<NutritionPage />)

    await user.click(screen.getByRole('button', { name: 'Ngủ' }))
    await user.click(screen.getByRole('button', { name: 'Tuần' }))

    await waitFor(() => expect(screen.getByText('22:00 → 06:00')).toBeInTheDocument())
    expect(screen.getByText('Đêm đủ giấc')).toBeInTheDocument()
  })
})
