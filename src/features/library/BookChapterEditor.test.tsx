import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RawChapter } from '../../lib/book/types'
import { BookChapterEditor } from './BookChapterEditor'

afterEach(cleanup)

const chapters: RawChapter[] = [
  { title: 'Chương 1', content: 'Nội dung một.' },
  { title: 'Chương 2', content: 'Nội dung hai.' },
  { title: 'Chương 3', content: 'Nội dung ba.' },
]

describe('BookChapterEditor', () => {
  it('hiện mọi chương kèm số chữ', () => {
    render(<BookChapterEditor chapters={chapters} onChange={vi.fn()} />)

    expect(screen.getByDisplayValue('Chương 1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Chương 3')).toBeInTheDocument()
    expect(screen.getAllByText(/ký tự/)).toHaveLength(3)
  })

  it('đổi tên chương trả về danh sách đã cập nhật', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BookChapterEditor chapters={chapters} onChange={onChange} />)

    await user.type(screen.getByDisplayValue('Chương 2'), '!')

    expect(onChange).toHaveBeenLastCalledWith([
      chapters[0],
      { title: 'Chương 2!', content: 'Nội dung hai.' },
      chapters[2],
    ])
  })

  it('xoá chương gộp nội dung vào chương liền trên', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BookChapterEditor chapters={chapters} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Xoá chương Chương 2' }))

    expect(onChange).toHaveBeenCalledWith([
      { title: 'Chương 1', content: 'Nội dung một.\n\nNội dung hai.' },
      chapters[2],
    ])
  })

  it('gộp chương vào chương liền trên và giữ lại tiêu đề bị gộp', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BookChapterEditor chapters={chapters} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Gộp Chương 3 vào chương trên' }))

    expect(onChange).toHaveBeenCalledWith([
      chapters[0],
      { title: 'Chương 2', content: 'Nội dung hai.\n\nChương 3\n\nNội dung ba.' },
    ])
  })

  it('chương đầu tiên không có nút xoá hay gộp', () => {
    render(<BookChapterEditor chapters={chapters} onChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Xoá chương Chương 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gộp Chương 1 vào chương trên' })).not.toBeInTheDocument()
  })
})
