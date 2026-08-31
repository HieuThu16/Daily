import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NutritionPage } from './NutritionPage'

const foodRows = [
  { id: 'f1', meal_slot: 'LUNCH', food_name: 'Cơm trưa', price: 50_000, log_date: '2026-08-12', log_time: '12:00', created_at: '2026-08-12T12:00:00Z' },
]

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (_table?: string) => {
      const result = { data: foodRows, error: null }
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

describe('NutritionPage (Ăn uống)', () => {
  it('hiển thị giao diện theo dõi ăn uống với 4 bữa ăn', async () => {
    render(<NutritionPage />)

    expect(screen.getByText('Theo dõi ăn uống')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Sáng' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Trưa' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Chiều' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Tối' })).toBeInTheDocument()
  })

  it('chuyển sang xem theo tuần và lọc theo bữa', async () => {
    const user = userEvent.setup()
    render(<NutritionPage />)

    await user.click(screen.getByRole('button', { name: 'Tuần' }))

    expect(screen.getByRole('group', { name: 'Lọc theo bữa' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Cơm trưa')).toBeInTheDocument())
  })

  it('gợi ý món ăn và tự điền giá khi chọn món', async () => {
    const user = userEvent.setup()
    render(<NutritionPage />)

    // Mở modal thêm bữa sáng
    const addMorningBtn = await screen.findByRole('button', { name: 'Sáng' })
    await user.click(addMorningBtn)

    const foodInput = screen.getByPlaceholderText('Gõ hoặc chọn món: Cơm tấm, Phở bò…')
    expect(foodInput).toBeInTheDocument()

    // Focus input để hiện gợi ý combobox
    await user.click(foodInput)

    // Tìm món gợi ý trong combobox
    const phoBoItem = await screen.findByText('🍲 Phở bò')
    expect(phoBoItem).toBeInTheDocument()

    // Click chọn món Phở bò -> tự động fill tên món và giá tiền
    await user.click(phoBoItem)

    expect(foodInput).toHaveValue('Phở bò')
    const priceInput = screen.getByPlaceholderText('Ví dụ: 35k hoặc 35000')
    expect(priceInput).toHaveValue('45000')
  })
})
