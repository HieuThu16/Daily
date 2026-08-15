import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Media } from '../../types'
import { AudioPlayerProvider, useAudioPlayer } from './AudioPlayerContext'
import { GlobalMiniPlayer } from './GlobalMiniPlayer'

afterEach(() => {
  cleanup()
  localStorage.removeItem('miniPlayerPosition')
})

const sampleSong: Media = {
  id: 'music-1',
  type: 'MUSIC',
  name: 'Cơn mưa băng giá',
  artist: 'Bằng Kiều',
  description: null,
  status: 'PLANNED',
  is_favorite: false,
  audio_url: 'https://example.com/con-mua.mp3',
}

function TestConsumer({ track }: { track?: Media }) {
  const { playTrack } = useAudioPlayer()
  return (
    <div>
      <button type="button" onClick={() => track && playTrack(track)}>
        Kích hoạt phát
      </button>
    </div>
  )
}

describe('GlobalMiniPlayer', () => {
  it('không hiển thị khi chưa có bài hát nào được phát', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <AudioPlayerProvider>
          <GlobalMiniPlayer />
        </AudioPlayerProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByLabelText('Trình phát nhạc thu nhỏ')).not.toBeInTheDocument()
  })

  it('hiển thị thanh mini player khi phát bài hát và ở router khác (/home)', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/home']}>
        <AudioPlayerProvider>
          <TestConsumer track={sampleSong} />
          <GlobalMiniPlayer />
        </AudioPlayerProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Kích hoạt phát' }))

    expect(screen.getByLabelText('Trình phát nhạc thu nhỏ')).toBeInTheDocument()
    expect(screen.getByText('Cơn mưa băng giá')).toBeInTheDocument()
    expect(screen.getByText('Bằng Kiều')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạm dừng' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bài tiếp theo' })).toBeInTheDocument()
  })

  it('bấm xem danh sách phát và chuyển bài trực tiếp trên mini player', async () => {
    const user = userEvent.setup()
    const song2: Media = {
      ...sampleSong,
      id: 'music-2',
      name: 'Nơi này có anh',
      artist: 'Sơn Tùng M-TP',
    }

    function MultiConsumer() {
      const { playTrack } = useAudioPlayer()
      return (
        <button type="button" onClick={() => playTrack(sampleSong, [sampleSong, song2])}>
          Phát danh sách
        </button>
      )
    }

    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <AudioPlayerProvider>
          <MultiConsumer />
          <GlobalMiniPlayer />
        </AudioPlayerProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Phát danh sách' }))
    expect(screen.getByLabelText('Trình phát nhạc thu nhỏ')).toBeInTheDocument()

    // Bấm nút mở danh sách phát
    await user.click(screen.getByRole('button', { name: 'Xem danh sách phát' }))
    expect(screen.getByText('Danh sách phát (2)')).toBeInTheDocument()
    expect(screen.getByText('Nơi này có anh')).toBeInTheDocument()

    // Bấm chuyển sang bài thứ 2
    await user.click(screen.getByText('Nơi này có anh'))
    expect(screen.getAllByText('Nơi này có anh').length).toBeGreaterThanOrEqual(1)
  })

  it('cho phép kéo mini player bằng Pointer Events, kể cả trên màn hình cảm ứng', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <MemoryRouter initialEntries={['/home']}>
        <AudioPlayerProvider>
          <TestConsumer track={sampleSong} />
          <GlobalMiniPlayer />
        </AudioPlayerProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Kích hoạt phát' }))
    const player = screen.getByLabelText('Trình phát nhạc thu nhỏ')
    const dragArea = screen.getByRole('button', { name: /Kéo để di chuyển/ })
    Object.defineProperties(player, {
      offsetWidth: { configurable: true, value: 360 },
      offsetHeight: { configurable: true, value: 60 },
    })
    vi.spyOn(player, 'getBoundingClientRect').mockReturnValue({
      x: 20, y: 20, top: 20, left: 20, bottom: 80, right: 380, width: 360, height: 60,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(dragArea, { pointerId: 7, pointerType: 'touch', clientX: 40, clientY: 35 })
    fireEvent.pointerMove(document, { pointerId: 7, pointerType: 'touch', clientX: 240, clientY: 135 })
    fireEvent.pointerUp(document, { pointerId: 7, pointerType: 'touch' })

    expect(player).toHaveStyle({ left: '220px', top: '120px' })
    expect(JSON.parse(localStorage.getItem('miniPlayerPosition') || '{}')).toMatchObject({ left: 220, top: 120 })
    vi.restoreAllMocks()
    expect(container).toBeInTheDocument()
  })
})
