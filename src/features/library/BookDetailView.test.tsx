import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  uploadCover: vi.fn(),
  saveCoverUrl: vi.fn(),
  removeCover: vi.fn(),
}))

vi.mock('../../lib/book/cover', () => ({ blobToCover: vi.fn() }))

import { blobToCover } from '../../lib/book/cover'
import { loadBookDocument, loadChapterList, removeCover, saveCoverUrl, uploadCover } from '../../lib/book/repository'

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
  it('hiện thông tin sách và mục lục đầy đủ', async () => {
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
    expect(screen.getByText('Dale Carnegie')).toBeInTheDocument()
    expect(screen.getByText(/PDF/)).toBeInTheDocument()
    expect(screen.getByText('dac-nhan-tam.pdf', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()

    // Tên khả truy cập của nút chương gồm cả số thứ tự và số trang ("2 Chương 1 · … 92 tr"),
    // nên đếm qua chính thẻ <ol> thay vì khớp tên.
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(3)
  })

  it('đánh dấu chương đang đọc', async () => {
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    const current = await screen.findByRole('button', { name: /Nếu muốn lấy mật/ })
    expect(current).toHaveAttribute('aria-current', 'true')
  })

  it('bấm một chương thì mở màn đọc đúng chương đó', async () => {
    const user = userEvent.setup()
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /Bí mật lớn nhất/ }))

    expect(navigate).toHaveBeenCalledWith('/read/book-1?chapter=2')
  })

  it('nút Đọc tiếp mở màn đọc ở vị trí đã lưu', async () => {
    const user = userEvent.setup()
    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /Đọc tiếp/ }))

    expect(navigate).toHaveBeenCalledWith('/read/book-1')
  })

  it('quay lại thư viện', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<BookDetailView item={item} onBack={onBack} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Quay lại thư viện' }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('BookDetailView với sách chưa nhập file', () => {
  it('hiện empty state và ẩn nút Đọc tiếp', async () => {
    vi.mocked(loadBookDocument).mockResolvedValue(null)

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    expect(await screen.findByText(/Chưa nhập file cho sách này/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đọc tiếp/ })).not.toBeInTheDocument()
    expect(loadChapterList).not.toHaveBeenCalled()
  })
})

describe('BookDetailView đổi ảnh bìa', () => {
  // Input chọn ảnh bị ẩn (display:none) và có accept="image/*". `userEvent.upload` lọc
  // file theo accept nên không gửi được file .txt, còn fireEvent.change thì luôn gửi —
  // đúng thứ cần cho ca "file không phải ảnh".
  const pickFile = (file: File) =>
    fireEvent.change(screen.getByLabelText('Chọn ảnh bìa mới'), { target: { files: [file] } })

  it('lưu bìa mới và báo lên Library', async () => {
    const onCoverChange = vi.fn()
    const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' })
    vi.mocked(blobToCover).mockResolvedValue(jpeg)
    vi.mocked(uploadCover).mockResolvedValue('https://example.com/bia.jpg?v=2')

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={onCoverChange} />)
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    pickFile(new File(['anh'], 'bia.png', { type: 'image/png' }))

    await waitFor(() => expect(onCoverChange).toHaveBeenCalledWith('book-1', 'https://example.com/bia.jpg?v=2'))
    expect(uploadCover).toHaveBeenCalledWith('book-1', jpeg)
    expect(saveCoverUrl).toHaveBeenCalledWith('book-1', 'https://example.com/bia.jpg?v=2')
  })

  it('báo lỗi và giữ bìa cũ khi file không phải ảnh', async () => {
    const onCoverChange = vi.fn()
    vi.mocked(blobToCover).mockResolvedValue(null)

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={onCoverChange} />)
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    pickFile(new File(['van ban'], 'ghi-chu.txt', { type: 'text/plain' }))

    expect(await screen.findByText('File này không phải ảnh hợp lệ.')).toBeInTheDocument()
    expect(onCoverChange).not.toHaveBeenCalled()
    expect(uploadCover).not.toHaveBeenCalled()
  })

  it('chặn ảnh lớn hơn 15MB trước khi giải mã', async () => {
    const onCoverChange = vi.fn()

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={onCoverChange} />)
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    const huge = new File(['x'], 'to.png', { type: 'image/png' })
    Object.defineProperty(huge, 'size', { value: 16 * 1024 * 1024 })
    pickFile(huge)

    expect(await screen.findByText('Ảnh quá lớn (tối đa 15MB).')).toBeInTheDocument()
    expect(blobToCover).not.toHaveBeenCalled()
    expect(onCoverChange).not.toHaveBeenCalled()
  })

  it('xoá bìa', async () => {
    const user = userEvent.setup()
    const onCoverChange = vi.fn()
    vi.mocked(blobToCover).mockResolvedValue(null)
    vi.mocked(removeCover).mockResolvedValue(undefined)

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={onCoverChange} />)
    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })

    await user.click(screen.getByRole('button', { name: 'Xoá ảnh bìa' }))

    await waitFor(() => expect(onCoverChange).toHaveBeenCalledWith('book-1', null))
    expect(removeCover).toHaveBeenCalledWith('book-1')
  })
})

describe('BookDetailView khi tải lỗi', () => {
  it('hiện lỗi tải riêng biệt với sách chưa nhập, và Thử lại nạp lại được', async () => {
    const user = userEvent.setup()
    vi.mocked(loadChapterList).mockRejectedValueOnce(new Error('Mất kết nối mạng.'))

    render(<BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

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
      <BookDetailView item={item} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />,
    )

    await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })
    expect(screen.getByText('Đọc lần cuối')).toBeInTheDocument()

    const otherItem: Media = { ...item, id: 'book-2', name: 'Sách khác' }
    vi.mocked(loadBookDocument).mockRejectedValueOnce(new Error('Mất kết nối mạng.'))

    rerender(<BookDetailView item={otherItem} onBack={vi.fn()} onEdit={vi.fn()} onCoverChange={vi.fn()} />)

    await screen.findByText(/Không tải được thông tin sách/)
    expect(screen.queryByText('Đọc lần cuối')).not.toBeInTheDocument()
  })
})
