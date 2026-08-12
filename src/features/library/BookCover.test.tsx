import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BookCover } from './BookCover'

afterEach(cleanup)

describe('BookCover', () => {
  it('hiện ảnh khi có url', () => {
    render(<BookCover url="https://example.com/bia.jpg?v=1" alt="Bìa Đắc Nhân Tâm" size="thumb" />)

    const image = screen.getByRole('img', { name: 'Bìa Đắc Nhân Tâm' })
    expect(image).toHaveAttribute('src', 'https://example.com/bia.jpg?v=1')
    expect(image).toHaveClass('book-cover-thumb')
  })

  it('hiện placeholder khi chưa có url', () => {
    const { container } = render(<BookCover url={null} alt="Bìa Đắc Nhân Tâm" size="large" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('.book-cover-placeholder')).toBeInTheDocument()
  })

  it('chuyển sang placeholder khi ảnh tải lỗi', () => {
    const { container } = render(<BookCover url="https://example.com/hong.jpg" alt="Bìa" size="thumb" />)

    fireEvent.error(screen.getByRole('img', { name: 'Bìa' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('.book-cover-placeholder')).toBeInTheDocument()
  })

  it('thử lại ảnh mới sau khi ảnh cũ lỗi', () => {
    const { rerender } = render(<BookCover url="https://example.com/hong.jpg" alt="Bìa" size="thumb" />)
    fireEvent.error(screen.getByRole('img', { name: 'Bìa' }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    rerender(<BookCover url="https://example.com/moi.jpg?v=2" alt="Bìa" size="thumb" />)

    expect(screen.getByRole('img', { name: 'Bìa' })).toHaveAttribute('src', 'https://example.com/moi.jpg?v=2')
  })

  it('dùng được cỡ grid cho ô bìa trong lưới', () => {
    const { container, rerender } = render(
      <BookCover url="https://example.com/bia.jpg" alt="Bìa" size="grid" />,
    )
    expect(screen.getByRole('img', { name: 'Bìa' })).toHaveClass('book-cover-grid')

    rerender(<BookCover url={null} alt="Bìa" size="grid" />)
    expect(container.querySelector('.book-cover-placeholder')).toHaveClass('book-cover-grid')
  })
})
