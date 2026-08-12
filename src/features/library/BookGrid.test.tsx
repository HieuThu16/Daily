import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Media } from '../../types'
import { BookGrid } from './BookGrid'

afterEach(cleanup)

const book = (overrides: Partial<Media> & Pick<Media, 'id' | 'name'>): Media => ({
  type: 'BOOK',
  description: null,
  status: 'IN_PROGRESS',
  is_favorite: false,
  book_format: 'READ',
  ...overrides,
})

const items: Media[] = [
  book({ id: 'b1', name: 'Đắc Nhân Tâm', author: 'Dale Carnegie', cover_url: 'https://e.com/1.jpg' }),
  book({ id: 'b2', name: 'Nhà Giả Kim', author: 'Paulo Coelho', status: 'COMPLETED', is_favorite: true }),
  book({ id: 'b3', name: 'Sách nói', status: 'PLANNED', book_format: 'LISTEN' }),
]

describe('BookGrid', () => {
  it('vẽ một ô cho mỗi sách', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3)
  })

  it('ghép trạng thái bằng chữ vào nhãn nút bìa, không chỉ dựa vào màu chấm', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm, đang đọc' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem chi tiết Nhà Giả Kim, đã đọc' })).toBeInTheDocument()
  })

  it('dùng nhãn nghe cho sách định dạng LISTEN', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Xem chi tiết Sách nói, sẽ nghe' })).toBeInTheDocument()
  })

  it('bấm ô bìa mở đúng sách', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<BookGrid items={items} onOpen={onOpen} onToggleFavorite={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Xem chi tiết Nhà Giả Kim, đã đọc' }))

    expect(onOpen).toHaveBeenCalledWith(items[1])
  })

  it('bấm tim không mở màn chi tiết', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onToggleFavorite = vi.fn()
    render(<BookGrid items={items} onOpen={onOpen} onToggleFavorite={onToggleFavorite} />)

    await user.click(screen.getByRole('button', { name: 'Yêu thích Đắc Nhân Tâm' }))

    expect(onToggleFavorite).toHaveBeenCalledWith(items[0])
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('nút tim phản ánh trạng thái yêu thích', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Yêu thích Đắc Nhân Tâm' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Bỏ yêu thích Nhà Giả Kim' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sách chưa có tác giả vẫn hiện một dòng thay chỗ', () => {
    render(<BookGrid items={items} onOpen={vi.fn()} onToggleFavorite={vi.fn()} />)

    expect(screen.getByText('Chưa rõ tác giả')).toBeInTheDocument()
  })
})
