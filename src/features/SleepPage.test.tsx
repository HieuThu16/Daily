import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SleepPage } from './SleepPage'

const sleepRows = [
  { id: 's1', sleep_start: '22:00', sleep_end: '06:00', duration_minutes: 480, log_date: '2026-08-12', created_at: '2026-08-12T06:00:00Z', dream: 'Mơ thấy đi du lịch' },
]

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const result = { data: sleepRows, error: null }
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'is', 'order', 'range', 'gte', 'lte', 'update', 'insert', 'single', 'in']) {
        query[method] = vi.fn(() => query)
      }
      query.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve)
      return query
    },
  },
}))

vi.mock('./ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

afterEach(cleanup)

describe('SleepPage (Theo dõi giấc ngủ)', () => {
  it('hiển thị tiêu đề và nút ghi giấc ngủ', async () => {
    render(<SleepPage />)

    expect(screen.getByText('Theo dõi giấc ngủ')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Ghi giấc ngủ/i })).toBeInTheDocument()
  })

  it('chuyển sang xem theo tuần hiển thị lịch sử giấc ngủ', async () => {
    const user = userEvent.setup()
    render(<SleepPage />)

    await user.click(screen.getByRole('button', { name: 'Tuần' }))

    await waitFor(() => expect(screen.getByText('22:00 → 06:00')).toBeInTheDocument())
    expect(screen.getByText('Đêm đủ giấc')).toBeInTheDocument()
  })
})
