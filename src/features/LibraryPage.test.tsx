import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryPage } from './LibraryPage'

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
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

describe('LibraryPage book navigation', () => {
  it('mở màn chi tiết khi bấm vào thẻ sách', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm' }))

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quay lại thư viện' })).toBeInTheDocument()
  })

  it('mở màn chi tiết bằng phím Enter', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    screen.getByRole('button', { name: 'Xem chi tiết Đắc Nhân Tâm' }).focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: 'Đắc Nhân Tâm' })).toBeInTheDocument()
  })

  it('bấm nút Chỉnh sửa trên thẻ không mở màn chi tiết', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    await user.click(screen.getAllByRole('button', { name: 'Edit item' })[1])

    expect(screen.queryByRole('button', { name: 'Quay lại thư viện' })).not.toBeInTheDocument()
  })

  it('hiện ảnh bìa thay icon trên thẻ sách', () => {
    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: 'Bìa Đắc Nhân Tâm' })).toHaveAttribute(
      'src',
      'https://example.com/bia.jpg?v=1',
    )
  })
})
