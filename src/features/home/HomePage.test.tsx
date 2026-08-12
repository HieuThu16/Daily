import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

// Dịp cách hôm nay 3 ngày, tính động để test không phụ thuộc vào ngày chạy.
// Năm gốc 2000 là năm nhuận nên mọi cặp ngày/tháng đều hợp lệ, kể cả 29/02.
const inThreeDays = new Date()
inThreeDays.setDate(inThreeDays.getDate() + 3)
const pad = (n: number) => String(n).padStart(2, '0')
const occasionDate = `2000-${pad(inThreeDays.getMonth() + 1)}-${pad(inThreeDays.getDate())}`

const rows: Record<string, unknown[]> = {
  habits: [
    { id: 'h1', name: 'Đọc sách', is_active: true, category_id: null, routine: 'MORNING', habit_type: 'GOOD' },
    { id: 'h2', name: 'TikTok', is_active: true, category_id: null, routine: 'MORNING', habit_type: 'BAD' },
  ],
  habit_logs: [],
  todos: [{ id: 't1', title: 'Học tiếng Anh', completed: false, created_at: '2026-08-12T07:00:00', priority: 'URGENT' }],
  daily_entries: [{ id: 'e1', content: 'Gặp chú trên đường đi', entry_date: '2026-08-12', created_at: '2026-08-12T08:30:00', entry_type: 'FEELING' }],
  media_items: [{ id: 'm1', name: 'Người đua diều', type: 'BOOK', status: 'IN_PROGRESS', is_favorite: false, description: null }],
  nutrition_logs: [
    { id: 'n1', meal_slot: 'LUNCH', food_name: 'Cơm gà', price: 35000, log_date: '2026-08-12' },
    { id: 'n2', meal_slot: 'EVENING', food_name: 'Phở', price: 50000, log_date: '2026-08-12' },
  ],
  people: [{ id: 'p1', name: 'Linh' }],
  person_occasions: [{ id: 'o1', person_id: 'p1', kind: 'BIRTHDAY', title: '', occasion_date: occasionDate, is_yearly: true }],
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const result = { data: rows[table] ?? [], error: null }
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'is', 'order', 'gte', 'lte', 'limit', 'update', 'upsert']) {
        query[method] = vi.fn(() => query)
      }
      query.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve)
      return query
    },
  },
}))

vi.mock('../ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

afterEach(cleanup)

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )

describe('HomePage', () => {
  it('hiện phần trăm hoàn thành hôm nay', async () => {
    renderHome()
    expect(await screen.findByText(/% hôm nay$/)).toBeInTheDocument()
  })

  it('hiện bốn ô số liệu của ngày', async () => {
    renderHome()
    expect(await screen.findByText('Thói quen')).toBeInTheDocument()
    expect(screen.getByText('Việc cần làm')).toBeInTheDocument()
    expect(screen.getByText('Nhật ký')).toBeInTheDocument()
    expect(screen.getByText('Ăn uống')).toBeInTheDocument()
  })

  it('cộng tiền ăn hôm nay và tách theo bữa', async () => {
    renderHome()
    expect(await screen.findByText('85k')).toBeInTheDocument()
    expect(screen.getByText('35k')).toBeInTheDocument()
    expect(screen.getByText('50k')).toBeInTheDocument()
  })

  it('hiện dịp sắp tới lấy từ tab Người', async () => {
    renderHome()
    expect(await screen.findByText(/Sinh nhật Linh/)).toBeInTheDocument()
  })

  it('chuyển sang báo cáo tuần với biểu đồ bảy ngày', async () => {
    renderHome()
    await userEvent.click(await screen.findByRole('tab', { name: 'Tuần này' }))
    expect(screen.getByText('Hoàn thành thói quen trong tuần')).toBeInTheDocument()
    for (const label of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('Đều nhất')).toBeInTheDocument()
  })
})
