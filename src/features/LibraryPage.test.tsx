import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    render(<LibraryPage />)

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
