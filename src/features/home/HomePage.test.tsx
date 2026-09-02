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
const now = new Date()
const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

const rows: Record<string, unknown[]> = {
  habits: [
    { id: 'h1', name: 'Đọc sách', is_active: true, category_id: null, routine: 'MORNING', habit_type: 'GOOD' },
    { id: 'h2', name: 'TikTok', is_active: true, category_id: null, routine: 'MORNING', habit_type: 'BAD' },
  ],
  habit_logs: [],
  todos: [{ id: 't1', title: 'Học tiếng Anh', completed: false, created_at: '2026-08-12T07:00:00', priority: 'URGENT' }],
  daily_entries: [
    { id: 'e1', content: 'Gặp chú trên đường đi', entry_date: '2026-08-12', created_at: '2026-08-12T08:30:00', entry_type: 'FEELING' },
    { id: 'e2', content: 'Câu nói đáng nhớ hôm nay', entry_date: todayKey, created_at: `${todayKey}T09:00:00`, entry_type: 'FEELING', is_favorite: true },
  ],
  media_items: [
    { id: 'm1', name: 'Người đua diều', type: 'BOOK', status: 'IN_PROGRESS', is_favorite: false, description: null },
    { id: 'm2', name: 'Rằng Em Mãi Ở Bên', type: 'MUSIC', status: 'COMPLETED', is_favorite: true, artist: 'BÍCH PHƯƠNG', description: null, log_date: todayKey },
  ],

  // log_date bám ngày chạy test vì giấc ngủ nay được chia theo ngày thật, không còn cộng cả phiên.
  sleep_logs: [{ id: 's1', sleep_start: '23:00', sleep_end: '06:30', duration_minutes: 450, log_date: todayKey }],
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
      for (const method of ['select', 'eq', 'is', 'order', 'range', 'gte', 'gt', 'lte', 'lt', 'limit', 'update', 'upsert']) {
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

/** Home mở thẳng vào Review ngày; các phép kiểm số liệu phải sang tab Thống kê trước. */
const renderStatsTab = async () => {
  renderHome()
  await userEvent.click(await screen.findByRole('tab', { name: /Thống kê ngày/i }))
}

describe('HomePage', () => {
  it('hiện phần trăm hoàn thành hôm nay', async () => {
    await renderStatsTab()
    expect(await screen.findByText(/% hôm nay$/)).toBeInTheDocument()
  })

  it('hiện bốn ô số liệu của ngày', async () => {
    await renderStatsTab()
    expect(await screen.findByText('Thói quen')).toBeInTheDocument()
    expect(screen.getByText('Việc cần làm')).toBeInTheDocument()
    expect(screen.getByText('Nhật ký')).toBeInTheDocument()
    expect(screen.getByText('Ăn uống')).toBeInTheDocument()
  })

  it('cộng tiền ăn hôm nay và tách theo bữa', async () => {
    await renderStatsTab()
    expect(await screen.findByText('85k')).toBeInTheDocument()
    expect(screen.getByText('35k')).toBeInTheDocument()
    expect(screen.getByText('50k')).toBeInTheDocument()
  })

  it('hiện dịp sắp tới lấy từ tab Người', async () => {
    await renderStatsTab()
    expect(await screen.findByText(/Sinh nhật Linh/)).toBeInTheDocument()
  })

  it('hiện tổng giờ ngủ trong ngày', async () => {
    await renderStatsTab()
    expect(await screen.findByText('Giấc ngủ')).toBeInTheDocument()
    // Giấc 23:00→06:30 qua đêm: ngày 12 chỉ nhận 1h, 6h30 còn lại thuộc ngày 13.
    expect(screen.getByText('1h')).toBeInTheDocument()
    expect(screen.getByText('23:00 → 06:30')).toBeInTheDocument()
  })

  it('đổi sang ngày khác và quay lại hôm nay được', async () => {
    await renderStatsTab()
    expect(await screen.findByText('Hôm nay')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Ngày trước'))
    expect(screen.queryByText(/% hôm nay/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hôm nay' }))
    expect(await screen.findByText(/% hôm nay/)).toBeInTheDocument()
  })

  it('chuyển sang báo cáo tuần với biểu đồ bảy ngày', async () => {
    renderHome()
    await userEvent.click(await screen.findByRole('tab', { name: 'Tuần' }))
    expect(screen.getByText('Hoàn thành thói quen trong tuần')).toBeInTheDocument()
    for (const label of ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('Đều nhất')).toBeInTheDocument()
  })

  it('làm nổi bật nhật ký và bài nhạc đã yêu thích trong ngày', async () => {
    renderHome()
    await userEvent.click(await screen.findByRole('tab', { name: /Review ngày/i }))
    expect(await screen.findByText('Câu nói đáng nhớ hôm nay')).toBeInTheDocument()
    expect(screen.getAllByText(/Yêu thích/).length).toBeGreaterThan(0)
  })


  it('mở Home là vào thẳng Thống kê ngày, có nút ghi nhanh và bấm qua lại được', async () => {
    renderHome()
    // Mặc định đã là Thống kê ngày, kèm nút ghi nhanh ăn/ngủ.
    const foodBtn = await screen.findByRole('button', { name: /Thêm bữa ăn/i })
    const sleepBtn = screen.getByRole('button', { name: /Thêm giấc ngủ/i })
    expect(foodBtn).toBeInTheDocument()
    expect(sleepBtn).toBeInTheDocument()

    // Bấm Thêm bữa ăn -> mở modal đầy đủ
    await userEvent.click(foodBtn)
    expect(await screen.findByPlaceholderText(/Gõ hoặc chọn món/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lưu món ăn/i })).toBeInTheDocument()

    // Đóng modal
    await userEvent.click(screen.getByRole('button', { name: /Đóng/i }))

    // Bấm Thêm giấc ngủ -> mở modal đầy đủ
    await userEvent.click(sleepBtn)
    expect(await screen.findByText(/Ghi giấc ngủ & Giấc mơ/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Kể lại giấc mơ/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lưu giấc ngủ/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Đóng/i }))

    await userEvent.click(screen.getByRole('tab', { name: /Review ngày/i }))
    expect(await screen.findByText('Dòng thời gian cả ngày')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /Thống kê ngày/i }))
    expect(await screen.findByText('Thói quen')).toBeInTheDocument()
  })
})
