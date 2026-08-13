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

  it('bỏ ảnh bìa và mặc định "Đã nghe" cho form nhạc', async () => {
    await openAddFor('Nhạc')

    expect(screen.queryByPlaceholderText(/Dán link ảnh bìa/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tải ảnh lên/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('COMPLETED')
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
