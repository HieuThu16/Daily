import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PeoplePage } from './PeoplePage'

const rows: Record<string, unknown[]> = {
  people: [
    { id: 'p1', name: 'Nguyễn Thuỳ Linh', group_key: 'FAMILY' },
    { id: 'p2', name: 'Minh', group_key: 'FRIEND' },
  ],
  person_occasions: [],
  person_interests: [],
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const result = { data: rows[table] ?? [], error: null }
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'is', 'order', 'range', 'insert', 'update', 'upsert', 'delete', 'single', 'maybeSingle']) {
        query[method] = vi.fn(() => query)
      }
      query.then = (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve)
      return query
    },
  },
}))

vi.mock('../ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

afterEach(cleanup)

describe('PeoplePage', () => {
  it('hiện danh sách người kèm chữ cái đầu', async () => {
    render(<PeoplePage />)
    await userEvent.click(screen.getByRole('button', { name: /Người thân/ }))
    expect(await screen.findByText('Nguyễn Thuỳ Linh')).toBeInTheDocument()
    expect(screen.getByText('NL')).toBeInTheDocument()
  })

  it('lọc theo ô tìm kiếm', async () => {
    render(<PeoplePage />)
    await userEvent.click(screen.getByRole('button', { name: /Người thân/ }))
    await screen.findByText('Nguyễn Thuỳ Linh')
    await userEvent.type(screen.getByLabelText('Tìm theo tên'), 'minh')
    expect(screen.queryByText('Nguyễn Thuỳ Linh')).not.toBeInTheDocument()
    expect(screen.getByText('Minh')).toBeInTheDocument()
  })

  it('mở được form thêm dịp', async () => {
    render(<PeoplePage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm dịp' }))
    expect(screen.getByLabelText('Loại dịp')).toBeInTheDocument()
    expect(screen.getByLabelText('Gắn với người')).toBeInTheDocument()
  })

  it('hiện chip nhóm của từng người', async () => {
    render(<PeoplePage />)
    await userEvent.click(screen.getByRole('button', { name: /Người thân/ }))
    expect((await screen.findAllByText('Gia đình')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Bạn bè')).length).toBeGreaterThan(0)
  })

  it('lọc theo nhóm', async () => {
    render(<PeoplePage />)
    await userEvent.click(screen.getByRole('button', { name: /Người thân/ }))
    await screen.findByText('Minh')
    const buttons = screen.getAllByRole('button', { name: 'Bạn bè' })
    await userEvent.click(buttons[0])
    expect(screen.queryByText('Nguyễn Thuỳ Linh')).not.toBeInTheDocument()
    expect(screen.getByText('Minh')).toBeInTheDocument()
  })

  it('mở màn chi tiết khi bấm vào một người', async () => {
    render(<PeoplePage />)
    await userEvent.click(screen.getByRole('button', { name: /Người thân/ }))
    await userEvent.click(await screen.findByText('Minh'))
    expect(await screen.findByLabelText('Thêm sở thích')).toBeInTheDocument()
  })
})

