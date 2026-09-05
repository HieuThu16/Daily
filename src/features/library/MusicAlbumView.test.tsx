import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MusicAlbumView } from './MusicAlbumView'
import type { Media } from '../../types'

const mockSongs: Media[] = [
  {
    id: 'm1',
    type: 'MUSIC',
    name: 'Kill This Love',
    artist: 'BLACKPINK',
    music_genre: 'KPOP',
    audio_url: 'https://example.com/bp1.mp3',
    status: 'COMPLETED',
    is_favorite: true,
    description: null,
  },
  {
    id: 'm2',
    type: 'MUSIC',
    name: 'Pink Venom (No MP3)',
    artist: 'blackpink',
    music_genre: 'kpop',
    audio_url: null, // Strictly excluded!
    status: 'COMPLETED',
    is_favorite: false,
    description: null,
  },
  {
    id: 'm3',
    type: 'MUSIC',
    name: 'DDU-DU DDU-DU',
    artist: 'blackpink',
    music_genre: 'K-POP',
    audio_url: 'https://example.com/bp2.mp3',
    status: 'COMPLETED',
    is_favorite: false,
    description: null,
  },
  {
    id: 'm4',
    type: 'MUSIC',
    name: 'Sau Lời Từ Khước',
    artist: 'Phan Mạnh Quỳnh',
    music_genre: 'Ballad',
    audio_url: 'https://example.com/pmq.mp3',
    status: 'COMPLETED',
    is_favorite: false,
    description: null,
  },
]

describe('MusicAlbumView', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders artist albums by default and only includes tracks with MP3', () => {
    render(<MusicAlbumView items={mockSongs} />)

    // Mode toggle buttons
    expect(screen.getByRole('tab', { name: /Theo Ca sĩ/ })).toHaveClass('active')
    expect(screen.getByRole('tab', { name: /Theo Dòng nhạc/ })).toBeInTheDocument()

    // BLACKPINK should be grouped with 2 MP3 songs (the 3rd had no MP3)
    expect(screen.getByText('BLACKPINK')).toBeInTheDocument()
    expect(screen.getByText('2 bài MP3')).toBeInTheDocument()

    // Phan Mạnh Quỳnh has 1 MP3 song
    expect(screen.getByText('Phan Mạnh Quỳnh')).toBeInTheDocument()
    expect(screen.getByText('1 bài MP3')).toBeInTheDocument()
  })

  it('switches to genre mode and merges kpop / KPOP into K-Pop album', async () => {
    const user = userEvent.setup()
    render(<MusicAlbumView items={mockSongs} />)

    const genreTab = screen.getByRole('tab', { name: /Theo Dòng nhạc/ })
    await user.click(genreTab)

    expect(genreTab).toHaveClass('active')

    // K-Pop should merge KPOP, kpop, K-POP, and only count MP3 songs (2 tracks)
    expect(screen.getByText('K-Pop')).toBeInTheDocument()
    expect(screen.getByText('2 bài MP3')).toBeInTheDocument()

    // Ballad album (1 track)
    expect(screen.getByText('Ballad')).toBeInTheDocument()
  })

  it('opens album detail when clicking an album card and allows navigating back', async () => {
    const user = userEvent.setup()
    render(<MusicAlbumView items={mockSongs} />)

    // Click on BLACKPINK album card
    const albumCard = screen.getByText('BLACKPINK')
    await user.click(albumCard)

    // Album detail should be visible
    expect(screen.getByText(/Album Ca sĩ/i)).toBeInTheDocument()
    expect(screen.getByText('DANH SÁCH BÀI HÁT (2)')).toBeInTheDocument()
    expect(screen.getByText('Kill This Love')).toBeInTheDocument()
    expect(screen.getByText('DDU-DU DDU-DU')).toBeInTheDocument()
    // Pink Venom had no MP3, so it should not appear!
    expect(screen.queryByText('Pink Venom (No MP3)')).not.toBeInTheDocument()

    // Click back button
    const backBtn = screen.getByRole('button', { name: /Tất cả Album/ })
    await user.click(backBtn)

    // Back to grid
    expect(screen.getByRole('tab', { name: /Theo Ca sĩ/ })).toBeInTheDocument()
  })

  it('filters albums with search input', async () => {
    const user = userEvent.setup()
    render(<MusicAlbumView items={mockSongs} />)

    const searchInput = screen.getByPlaceholderText(/Tìm ca sĩ hoặc bài hát/)
    await user.type(searchInput, 'Phan Mạnh')

    expect(screen.getByText('Phan Mạnh Quỳnh')).toBeInTheDocument()
    expect(screen.queryByText('BLACKPINK')).not.toBeInTheDocument()
  })
})
