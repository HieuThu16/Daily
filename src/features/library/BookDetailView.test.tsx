import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookChapterMeta, BookDocument, Media } from '../../types'
import { BookDetailView } from './BookDetailView'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))

vi.mock('../../lib/book/repository', () => ({
  CHARS_PER_PAGE: 1800,
  loadBookDocument: vi.fn(),
  loadChapterList: vi.fn(),
}))

import { loadBookDocument, loadChapterList } from '../../lib/book/repository'

const item: Media = {
  id: 'book-1',
  type: 'BOOK',
  name: 'Đắc Nhân Tâm',
  description: null,
  status: 'IN_PROGRESS',
  is_favorite: false,
  author: 'Dale Carnegie',
  book_format: 'READ',
  cover_url: 'https://example.com/bia.jpg?v=1',
  start_date: '2026-07-12',
}

const document_: BookDocument = {
  id: 'doc-1',
  media_item_id: 'book-1',
  source_format: 'PDF',
  source_filename: 'dac-nhan-tam.pdf',
  total_chars: 400_000,
  page_count: 210,
  est_pages: 210,
  chapter_count: 3,
  last_chapter_idx: 1,
  last_scroll_ratio: 0.4,
  last_char_offset: 150_000,
  percent: 42,
  last_read_at: '2026-08-12T14:30:00.000Z',
}

/** Props ghi tiến độ/lịch sử dùng chung cho các test không quan tâm tới chúng. */
const logProps = { onLogProgress: vi.fn(), onShowHistory: vi.fn(), logCount: 0 }

const chapters: BookChapterMeta[] = [
  { id: 'c0', idx: 0, title: 'Lời nói đầu', char_count: 20_000, char_offset: 0 },
  { id: 'c1', idx: 1, title: 'Chương 1 · Nếu muốn lấy mật', char_count: 180_000, char_offset: 20_000 },
  { id: 'c2', idx: 2, title: 'Chương 2 · Bí mật lớn nhất', char_count: 200_000, char_offset: 200_000 },
]

beforeEach(() => {
  vi.mocked(loadBookDocument).mockResolvedValue(document_)
  vi.mocked(loadChapterList).mockResolvedValue(chapters)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BookDetailView với sách đã nhập file', () => {
  it('mở ra là ở tab Mục lục, phần Thông tin ẩn đi', async () => {
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />)

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
    expect(screen.getByText('Dale Carnegie')).toBeInTheDocument()
    expect(await screen.findByText('42%')).toBeInTheDocument()

    expect(screen.getByRole('tab', { name: /Mục lục \(3\)/ })).toHaveAttribute('aria-selected', 'true')
    // Tên khả truy cập của nút chương gồm cả số thứ tự và số trang ("2 Chương 1 · … 92 tr"),
    // nên đếm qua chính thẻ <ol> thay vì khớp tên.
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(3)
    expect(screen.getByText(/PDF/)).not.toBeVisible()
  })

  it('đổi sang tab Thông tin thì hiện dữ liệu sách và giấu mục lục', async () => {
    const user = userEvent.setup()
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />)

    await user.click(await screen.findByRole('tab', { name: 'Thông tin' }))

    expect(screen.getByText(/PDF/)).toBeVisible()
    expect(screen.getByText('dac-nhan-tam.pdf', { exact: false })).toBeVisible()
    // getByRole bỏ qua phần tử ẩn nên phải lấy thẳng từ DOM mới kiểm được.
    expect(document.querySelector('.library-book-toc')).not.toBeVisible()
  })

  it('đánh dấu chương đang đọc', async () => {
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />)

    const current = await screen.findByRole('button', { name: /Nếu muốn lấy mật/ })
    expect(current).toHaveAttribute('aria-current', 'true')
  })

  it('bấm một chương thì mở màn đọc đúng chương đó', async () => {
    const user = userEvent.setup()
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />)

    await user.click(await screen.findByRole('button', { name: /Bí mật lớn nhất/ }))

    expect(navigate).toHaveBeenCalledWith('/read/book-1?chapter=2')
  })

  it('nút Đọc tiếp mở màn đọc ở vị trí đã lưu', async () => {
    const user = userEvent.setup()
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />)

    await user.click(await screen.findByRole('button', { name: /Đọc tiếp/ }))

    expect(navigate).toHaveBeenCalledWith('/read/book-1')
  })

  it('quay lại thư viện', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<BookDetailView item={item} onBack={onBack} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />)

    await user.click(screen.getByRole('button', { name: 'Quay lại thư viện' }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('BookDetailView với sách chưa nhập file', () => {
  it('hiện empty state và ẩn nút Đọc tiếp', async () => {
    vi.mocked(loadBookDocument).mockResolvedValue(null)

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />)

    expect(await screen.findByText(/Chưa nhập file cho sách này/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đọc tiếp/ })).not.toBeInTheDocument()
    expect(loadChapterList).not.toHaveBeenCalled()
  })
})

describe('BookDetailView khi tải lỗi', () => {
  it('hiện lỗi tải riêng biệt với sách chưa nhập, và Thử lại nạp lại được', async () => {
    const user = userEvent.setup()
    vi.mocked(loadChapterList).mockRejectedValueOnce(new Error('Mất kết nối mạng.'))

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />)

    expect(await screen.findByText(/Không tải được thông tin sách/)).toBeInTheDocument()
    expect(screen.queryByText(/Chưa nhập file cho sách này/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    // loadChapterList đã hết lượt reject-một-lần, lần gọi lại dùng mock mặc định (thành công).
    expect(await screen.findByRole('button', { name: /Bí mật lớn nhất/ })).toBeInTheDocument()
  })
})

describe('BookDetailView không rò rỉ dữ liệu giữa các sách', () => {
  it('sách sau tải lỗi không còn hiện dữ liệu của sách trước', async () => {
    const { rerender } = render(
      <BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />,
    )

    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })
    expect(screen.getByText('Đọc lần cuối')).toBeInTheDocument()

    const otherItem: Media = { ...item, id: 'book-2', name: 'Sách khác' }
    vi.mocked(loadBookDocument).mockRejectedValueOnce(new Error('Mất kết nối mạng.'))

    rerender(<BookDetailView item={otherItem} onBack={vi.fn()} onEdit={vi.fn()} onStatusChange={vi.fn()} {...logProps} />)

    await screen.findByText(/Không tải được thông tin sách/)
    expect(screen.queryByText('Đọc lần cuối')).not.toBeInTheDocument()
  })
})

describe('BookDetailView đổi trạng thái', () => {
  it('chọn trạng thái mới gọi onStatusChange', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn()

    render(
      <BookDetailView
        item={item}
        onBack={vi.fn()}
        onEdit={vi.fn()}
       
        onStatusChange={onStatusChange}
        {...logProps}
      />,
    )
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'COMPLETED')

    expect(onStatusChange).toHaveBeenCalledWith(item, 'COMPLETED')
  })

  it('sách định dạng LISTEN dùng nhãn nghe', async () => {
    render(
      <BookDetailView
        item={{ ...item, book_format: 'LISTEN' }}
        onBack={vi.fn()}
        onEdit={vi.fn()}
       
        onStatusChange={vi.fn()}
        {...logProps}
      />,
    )
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    expect(screen.getByRole('option', { name: 'Đang nghe' })).toBeInTheDocument()
  })
})

describe('BookDetailView ghi tiến độ', () => {
  it('mở ghi trang và xem lịch sử', async () => {
    const user = userEvent.setup()
    const onLogProgress = vi.fn()
    const onShowHistory = vi.fn()

    render(
      <BookDetailView
        item={item}
        onBack={vi.fn()}
        onEdit={vi.fn()}
       
        onStatusChange={vi.fn()}
        onLogProgress={onLogProgress}
        onShowHistory={onShowHistory}
        logCount={3}
      />,
    )
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    await user.click(screen.getByRole('button', { name: /Ghi trang/ }))
    expect(onLogProgress).toHaveBeenCalledWith(item)

    await user.click(screen.getByRole('button', { name: /Lịch sử/ }))
    expect(onShowHistory).toHaveBeenCalledWith(item)
    expect(screen.getByRole('button', { name: /Lịch sử/ })).toHaveTextContent('3')
  })

  it('sách định dạng LISTEN hiện Ghi giờ', async () => {
    render(
      <BookDetailView
        item={{ ...item, book_format: 'LISTEN' }}
        onBack={vi.fn()}
        onEdit={vi.fn()}
       
        onStatusChange={vi.fn()}
        onLogProgress={vi.fn()}
        onShowHistory={vi.fn()}
        logCount={0}
      />,
    )
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    expect(screen.getByRole('button', { name: /Ghi giờ/ })).toBeInTheDocument()
  })

  it('sách chưa bắt đầu không hiện nút ghi tiến độ', async () => {
    render(
      <BookDetailView
        item={{ ...item, status: 'PLANNED' }}
        onBack={vi.fn()}
        onEdit={vi.fn()}
       
        onStatusChange={vi.fn()}
        onLogProgress={vi.fn()}
        onShowHistory={vi.fn()}
        logCount={0}
      />,
    )
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    expect(screen.queryByRole('button', { name: /Ghi trang/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Lịch sử/ })).not.toBeInTheDocument()
  })
})
