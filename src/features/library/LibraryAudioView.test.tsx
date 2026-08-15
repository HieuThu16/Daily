import { Layers, BookOpen, BookMarked, Film, Tv, Music } from 'lucide-react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Media } from '../../types'
import { LibraryAudioAction, LibraryAudioDetail, LibraryCategoryBar } from './LibraryAudioView'

afterEach(cleanup)

const categories = [
  { id: 'ALL', label: 'Tất cả thể loại', icon: Layers, color: 'blue', bg: 'lightblue' },
  { id: 'BOOK', label: 'Sách', icon: BookOpen, color: 'purple', bg: 'lavender' },
  { id: 'MANGA', label: 'Truyện', icon: BookMarked, color: 'green', bg: 'honeydew' },
  { id: 'MOVIE', label: 'Phim', icon: Film, color: 'red', bg: 'mistyrose' },
  { id: 'YOUTUBE', label: 'YouTube', icon: Tv, color: 'orange', bg: 'oldlace' },
  { id: 'MUSIC', label: 'Âm nhạc', icon: Music, color: 'cyan', bg: 'azure' },
]

const withAudio: Media = {
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
}

const withoutAudio: Media = {
  ...withAudio,
  id: 'music-2',
  name: 'Chưa có MP3',
  audio_url: null,
}

describe('LibraryCategoryBar', () => {
  it('keeps all six category controls in one category bar', () => {
    render(<LibraryCategoryBar selectedType="ALL" categories={categories} onSelect={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Thể loại thư viện' })).toHaveClass('library-category-bar')
    expect(screen.getAllByRole('button')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Tất cả thể loại' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('LibraryAudioAction', () => {
  it('opens listening for an item with stored audio', async () => {
    const user = userEvent.setup()
    const onListen = vi.fn()
    render(<LibraryAudioAction item={withAudio} onListen={onListen} onAddMp3={vi.fn()} />)

    const listenButton = screen.getByRole('button', { name: 'Nghe Hẹn một mai' })
    expect(listenButton.textContent).toBe('')
    expect(listenButton).toHaveAttribute('title', 'Nghe Hẹn một mai')

    await user.click(listenButton)

    expect(onListen).toHaveBeenCalledWith(withAudio)
  })

  it('opens editing for an item without stored audio', async () => {
    const user = userEvent.setup()
    const onAddMp3 = vi.fn()
    render(<LibraryAudioAction item={withoutAudio} onListen={vi.fn()} onAddMp3={onAddMp3} />)

    const addButton = screen.getByRole('button', { name: 'Thêm MP3 cho Chưa có MP3' })
    expect(addButton.textContent).toBe('')
    expect(addButton).toHaveAttribute('title', 'Thêm MP3 cho Chưa có MP3')

    await user.click(addButton)

    expect(onAddMp3).toHaveBeenCalledWith(withoutAudio)
  })

  it('mục không nghe được vẫn chiếm một ô để lưới nút khỏi lệch dòng', () => {
    const book: Media = { ...withAudio, id: 'book-1', type: 'BOOK', name: 'Một cuốn sách' }
    const { container } = render(<LibraryAudioAction item={book} onListen={vi.fn()} onAddMp3={vi.fn()} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container.querySelector('.library-audio-slot')).toBeInTheDocument()
  })
})

describe('LibraryAudioDetail', () => {
  it('shows one focused player and returns to the library', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<LibraryAudioDetail item={withAudio} onBack={onBack} onEdit={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Hẹn một mai' })).toBeInTheDocument()
    expect(screen.getByText('Bùi Anh Tuấn')).toBeInTheDocument()
    expect(screen.getByText('Ballad')).toBeInTheDocument()
    expect(screen.getByText(/2026-08-12/)).toBeInTheDocument()
    expect(screen.getByText(/10:04/)).toBeInTheDocument()
    expect(document.querySelectorAll('audio')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Mở trên YouTube' })).toHaveAttribute('href', withAudio.youtube_url)

    await user.click(screen.getByRole('button', { name: 'Quay lại thư viện' }))

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('renders shared_by badge and triggers onShareToAll when available', async () => {
    const user = userEvent.setup()
    const onShareToAll = vi.fn()
    const sharedItem: Media = {
      ...withAudio,
      shared_by: 'Minh',
    }

    render(<LibraryAudioDetail item={sharedItem} onBack={vi.fn()} onEdit={vi.fn()} onShareToAll={onShareToAll} />)

    expect(screen.getByText('🎵 Do Minh chia sẻ')).toBeInTheDocument()

    const shareBtn = screen.getByRole('button', { name: 'Chia sẻ cho mọi người' })
    expect(shareBtn).toBeInTheDocument()
    await user.click(shareBtn)
    expect(onShareToAll).toHaveBeenCalledWith(sharedItem)
  })

  it('renders upcoming playlist queue and allows switching tracks', async () => {
    const user = userEvent.setup()
    const onSelectTrack = vi.fn()
    const track2: Media = {
      ...withAudio,
      id: 'music-2',
      name: 'Nơi này có anh',
      artist: 'Sơn Tùng M-TP',
    }

    render(
      <LibraryAudioDetail
        item={withAudio}
        playlist={[withAudio, track2]}
        onSelectTrack={onSelectTrack}
        onBack={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(screen.getByText('Danh sách phát (2)')).toBeInTheDocument()
    expect(screen.getByText('Nơi này có anh')).toBeInTheDocument()

    // Bấm chuyển sang bài thứ 2 trong danh sách
    await user.click(screen.getByText('Nơi này có anh'))
    expect(onSelectTrack).toHaveBeenCalledWith(track2)
  })

  it('controls playback with play/pause and next/prev buttons', async () => {
    const user = userEvent.setup()
    const track2: Media = {
      ...withAudio,
      id: 'music-2',
      name: 'Bài hát thứ hai',
    }

    render(
      <LibraryAudioDetail
        item={withAudio}
        playlist={[withAudio, track2]}
        onBack={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    const playBtn = screen.getByRole('button', { name: 'Phát' })
    expect(playBtn).toBeInTheDocument()
    await user.click(playBtn)

    const nextBtn = screen.getByRole('button', { name: 'Bài tiếp theo' })
    expect(nextBtn).toBeInTheDocument()
    await user.click(nextBtn)

    expect(await screen.findByRole('heading', { name: 'Bài hát thứ hai' })).toBeInTheDocument()
  })
})

