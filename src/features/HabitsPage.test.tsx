import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { localDate } from '../lib/date'
import { HabitsPage } from './HabitsPage'

const rows: Record<string, unknown[]> = {
  habits: [
    { id: 'h1', name: 'Tắm', is_active: true, category_id: 'c1', routine: 'MORNING', habit_type: 'GOOD', tracking_type: 'CHECK' },
    { id: 'h2', name: 'Đánh răng tối', is_active: true, category_id: 'c1', routine: 'EVENING', habit_type: 'GOOD', tracking_type: 'CHECK' },
    { id: 'h3', name: 'TikTok', is_active: true, category_id: 'c2', routine: 'EVENING', habit_type: 'BAD', tracking_type: 'COUNT' },
  ],
  habit_categories: [
    { id: 'c1', name: 'Cuộc sống', color: 'var(--emerald)' },
    { id: 'c2', name: 'Mạng xã hội', color: 'var(--blue)' },
  ],
  habit_logs: [],
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const result = { data: rows[table] ?? [], error: null }
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'is', 'order', 'gte', 'lte', 'limit', 'update', 'insert', 'upsert', 'single']) {
        query[method] = vi.fn(() => query)
      }
      query.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve)
      return query
    },
  },
}))

vi.mock('./ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn(), showSaveToast: vi.fn() }),
}))

afterEach(cleanup)

describe('HabitsPage', () => {
  it('hiện thẻ tiến độ, chip lọc và các nhóm thói quen', async () => {
    render(<HabitsPage />)

    expect(await screen.findByText('Tắm')).toBeInTheDocument()
    // Thẻ tiến độ: hai vòng — xanh 0/2 thói quen tốt, đỏ 0/1 thói quen xấu.
    const progress = document.querySelector('.habit-progress-card') as HTMLElement
    expect(within(progress).getByText('0/2')).toBeInTheDocument()
    expect(within(progress).getByText('0/1')).toBeInTheDocument()
    expect(within(progress).getByText('Tốt · làm được')).toBeInTheDocument()
    expect(within(progress).getByText('Xấu · đã lỡ')).toBeInTheDocument()
    // Dòng "0/3 hoàn thành" và câu động viên đã bỏ: số đó đã có sẵn ở tab "Hôm nay".
    expect(within(progress).queryByText(/Chưa lỡ thói quen xấu nào/)).not.toBeInTheDocument()
    expect(within(progress).queryByText(/hoàn thành/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hôm nay 0\/3/ })).toBeInTheDocument()
    // Tiêu đề "Habits" chỉ còn ở header chung của app, trang không dựng lại.
    expect(screen.queryByRole('heading', { name: 'Habits' })).not.toBeInTheDocument()
    // Hai nhóm mặc định
    expect(screen.getByText('Thói quen tích cực')).toBeInTheDocument()
    expect(screen.getByText('Theo dõi số liệu')).toBeInTheDocument()
    // Chip lọc
    expect(screen.getByRole('button', { name: 'Tất cả' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lọc theo chip "Cần hạn chế" chỉ còn thói quen xấu', async () => {
    render(<HabitsPage />)
    await screen.findByText('Tắm')

    await userEvent.click(screen.getByRole('button', { name: 'Cần hạn chế' }))

    expect(screen.getByText('TikTok')).toBeInTheDocument()
    expect(screen.queryByText('Tắm')).not.toBeInTheDocument()
  })

  it('thói quen số liệu có bộ tăng/giảm, thói quen tích thì không', async () => {
    render(<HabitsPage />)
    await screen.findByText('Tắm')

    expect(screen.getByLabelText('Tăng số liệu cho TikTok')).toBeInTheDocument()
    // Ô số nhập tay được, không chỉ bấm +/-.
    expect(screen.getByLabelText('Giá trị hôm nay cho TikTok')).toHaveValue(0)
    // Về 0 thì không giảm được nữa.
    expect(screen.getByLabelText('Giảm số liệu cho TikTok')).toBeDisabled()
    expect(screen.queryByLabelText('Tăng số liệu cho Tắm')).not.toBeInTheDocument()
  })

  it('cho đổi ngày ghi nhận, mặc định là hôm nay', async () => {
    render(<HabitsPage />)
    await screen.findByText('Tắm')

    const picker = screen.getByLabelText('Ngày ghi nhận') as HTMLInputElement
    expect(picker).toHaveValue(localDate())
    fireEvent.change(picker, { target: { value: '2026-08-01' } })
    expect(picker).toHaveValue('2026-08-01')
    expect(screen.getByText('Về hôm nay')).toBeInTheDocument()
  })

  it('mỗi thói quen có nút đánh dấu và nút sửa riêng', async () => {
    render(<HabitsPage />)
    await screen.findByText('Tắm')

    expect(screen.getByLabelText('Đánh dấu Tắm')).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByLabelText('Sửa Tắm'))
    expect(await screen.findByText('Sửa thói quen')).toBeInTheDocument()
  })

  it('hiện nhãn thể loại, loại thói quen và buổi trên từng dòng', async () => {
    render(<HabitsPage />)
    const title = await screen.findByText('Tắm')
    const row = title.closest('.habit-item') as HTMLElement

    expect(within(row).getByText('Cuộc sống')).toBeInTheDocument()
    expect(within(row).getByText(/Thói quen tốt/)).toBeInTheDocument()
    expect(within(row).getByText(/Sáng/)).toBeInTheDocument()
  })
})
