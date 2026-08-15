import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryPage } from './LibraryPage'
import { HeaderActionProvider, useHeaderActionSlot } from './HeaderAction'

/** Dựng lại ô hành động của header chung để bấm được nút "+" mà trang đăng ký. */
function HeaderActionSlot() {
  const action = useHeaderActionSlot()
  return action ? <button onClick={action.onClick}>{action.label}</button> : null
}

const { mediaItems } = vi.hoisted(() => ({
  mediaItems: [
    {
      id: 'music-1',
      type: 'MUSIC',
      name: 'Hẹn một mai',
      description: null,
      status: 'COMPLETED',
      is_favorite: true,
      artist: 'Bùi Anh Tuấn',
      music_genre: 'Ballad',
      log_date: '2026-08-12',
      log_time: '10:04',
      audio_url: 'https://example.com/hen-mot-mai.mp3',
      youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
    {
      id: 'book-1',
      type: 'BOOK',
      name: 'Đắc Nhân Tâm',
      description: null,
      status: 'IN_PROGRESS',
      is_favorite: false,
      author: 'Dale Carnegie',
      book_format: 'READ',
      cover_url: 'https://example.com/bia.jpg?v=1',
    },
  ],
}))

vi.mock('./shared', () => ({
  useQuery: (table: string) => ({
    items: table === 'media_items' ? mediaItems : [],
    setItems: vi.fn(),
    loading: false,
    error: '',
    reload: vi.fn(),
  }),
  Empty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Modal: ({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  ),
  DeleteButton: () => <button type="button">Xóa</button>,
}))

vi.mock('./ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn(), showSaveToast: vi.fn() }),
}))

// Phải khai đủ mọi export mà LibraryPage dùng trực tiếp (loadImportedMediaItemIds,
// saveReadingLogEntry) lẫn gián tiếp qua BookImportModal (saveBook) và BookDetailView.
vi.mock('../lib/book/repository', () => ({
  CHARS_PER_PAGE: 1800,
  loadImportedMediaItemIds: vi.fn(async () => new Set<string>()),
  saveReadingLogEntry: vi.fn(async () => null),
  saveBook: vi.fn(),
  loadBookDocument: vi.fn(async () => null),
  loadChapterList: vi.fn(async () => []),
  uploadCover: vi.fn(),
  saveCoverUrl: vi.fn(),
  removeCover: vi.fn(),
}))

vi.mock('../lib/musicShare', () => ({
  shareMusicToAll: vi.fn(async () => 0),
}))

afterEach(cleanup)

describe('LibraryPage audio navigation', () => {
  it('keeps players out of the list and opens one focused player', async () => {
    const user = userEvent.setup()
    // LibraryPage dùng useNavigate cho nút Đọc sách nên cần một Router bao ngoài.
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('group', { name: 'Thể loại thư viện' }).querySelectorAll('button')).toHaveLength(6)
    expect(document.querySelectorAll('audio')).toHaveLength(0)
    expect(screen.queryByText(/2026-08-12/)).not.toBeInTheDocument()
    expect(screen.queryByText(/10:04/)).not.toBeInTheDocument()

    // Ở "Tất cả", Tổng thể là bảng thống kê từng thư viện; bấm thẻ Nhạc mới ra danh sách.
    expect(screen.queryByRole('button', { name: 'Nghe Hẹn một mai' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Mở thư viện Nhạc, 1 mục/ }))

    await user.click(screen.getByRole('button', { name: 'Nghe Hẹn một mai' }))

    expect(screen.getByRole('heading', { name: 'Hẹn một mai' })).toBeInTheDocument()
    expect(document.querySelectorAll('audio')).toHaveLength(1)
    expect(screen.getByText(/2026-08-12/)).toBeInTheDocument()
    expect(screen.getByText(/10:04/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quay lại thư viện' }))

    expect(document.querySelectorAll('audio')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Nghe Hẹn một mai' })).toBeInTheDocument()
  })
})

describe('LibraryPage add form', () => {
  const openAddFor = async (categoryLabel: string) => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <HeaderActionProvider>
          <HeaderActionSlot />
          <LibraryPage />
        </HeaderActionProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: categoryLabel }))
    await user.click(screen.getByRole('button', { name: /^Thêm / }))
    return user
  }

  it('bỏ ảnh bìa và mặc định "Chưa nghe" (PLANNED) cho form nhạc', async () => {
    await openAddFor('Nhạc')

    expect(screen.queryByPlaceholderText(/Dán link ảnh bìa/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tải ảnh lên/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('PLANNED')
  })

  it('cho sách có ô ảnh bìa kèm nút tải lên và xem mẫu', async () => {
    await openAddFor('Sách')

    expect(screen.getByPlaceholderText(/Dán link ảnh bìa/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tải ảnh lên/ })).toBeInTheDocument()
    // Chưa có ảnh thì nút xem mẫu bị khoá, tránh mở modal rỗng.
    expect(screen.getByRole('button', { name: /Xem mẫu/ })).toBeDisabled()
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('PLANNED')
  })

  it('mở modal xem mẫu sau khi dán link ảnh bìa', async () => {
    const user = await openAddFor('Sách')

    await user.type(screen.getByPlaceholderText(/Dán link ảnh bìa/), 'https://example.com/bia.jpg')
    await user.click(screen.getByRole('button', { name: /Xem mẫu/ }))

    expect(screen.getByAltText('Xem mẫu ảnh bìa')).toHaveAttribute('src', 'https://example.com/bia.jpg')
  })
})

describe('LibraryPage book navigation', () => {
  const renderLibrary = () => {
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )
    return userEvent.setup()
  }

  /** Tab "Tất cả" là bảng tổng quan từng thư viện, phải vào Sách mới thấy đầu sách. */
  const openBooks = async () => {
    const user = renderLibrary()
    await user.click(screen.getByRole('button', { name: 'Sách' }))
    return user
  }

  it('thư viện Sách hiện lưới bìa thay cho danh sách dòng', async () => {
    await openBooks()

    expect(document.querySelector('.book-grid')).toBeInTheDocument()
    expect(document.querySelector('.library-media-card')).not.toBeInTheDocument()
  })

  it('bấm ô bìa trong lưới mở màn chi tiết', async () => {
    const user = await openBooks()

    await user.click(screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm, đang đọc' }))

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quay lại thư viện' })).toBeInTheDocument()
  })

  it('mở màn chi tiết bằng phím Enter', async () => {
    const user = await openBooks()

    screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm, đang đọc' }).focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
  })

  // Ảnh trong lưới để alt rỗng có chủ đích: tên sách đã nằm trong aria-label của
  // nút bao ngoài, thêm alt nữa thì screen reader đọc hai lần. Nên kiểm src trực tiếp.
  it('hiện ảnh bìa trong lưới', async () => {
    await openBooks()

    expect(document.querySelector('.book-grid-cover img')).toHaveAttribute(
      'src',
      'https://example.com/bia.jpg?v=1',
    )
  })

  it('ghi trang từ màn chi tiết đóng màn đó và mở modal', async () => {
    const user = await openBooks()

    await user.click(screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm, đang đọc' }))
    await user.click(await screen.findByRole('button', { name: /Ghi trang/ }))

    // Màn chi tiết phải đóng, nếu không modal sẽ không được mount và không hiện gì.
    expect(screen.queryByRole('button', { name: 'Quay lại thư viện' })).not.toBeInTheDocument()
    expect(screen.getByText(/Ghi trang đọc/)).toBeInTheDocument()
  })

  it('quay lại thư viện từ màn chi tiết', async () => {
    const user = await openBooks()

    await user.click(screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm, đang đọc' }))
    await user.click(await screen.findByRole('button', { name: 'Quay lại thư viện' }))

    expect(document.querySelector('.book-grid')).toBeInTheDocument()
  })
})
