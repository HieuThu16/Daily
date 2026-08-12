import { Layers, BookOpen, BookMarked, Film, Tv, Music } from 'lucide-react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LibraryCategoryBar } from './LibraryAudioView'

const categories = [
  { id: 'ALL', label: 'Tất cả thể loại', icon: Layers, color: 'blue', bg: 'lightblue' },
  { id: 'BOOK', label: 'Sách', icon: BookOpen, color: 'purple', bg: 'lavender' },
  { id: 'MANGA', label: 'Truyện', icon: BookMarked, color: 'green', bg: 'honeydew' },
  { id: 'MOVIE', label: 'Phim', icon: Film, color: 'red', bg: 'mistyrose' },
  { id: 'YOUTUBE', label: 'YouTube', icon: Tv, color: 'orange', bg: 'oldlace' },
  { id: 'MUSIC', label: 'Âm nhạc', icon: Music, color: 'cyan', bg: 'azure' },
]

describe('LibraryCategoryBar', () => {
  it('keeps all six category controls in one category bar', () => {
    render(<LibraryCategoryBar selectedType="ALL" categories={categories} onSelect={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Thể loại thư viện' })).toHaveClass('library-category-bar')
    expect(screen.getAllByRole('button')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Tất cả thể loại' })).toHaveAttribute('aria-pressed', 'true')
  })
})
