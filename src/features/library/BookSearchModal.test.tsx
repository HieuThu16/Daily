import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BookSearchModal } from './BookSearchModal'
import * as repository from '../../lib/book/repository'

vi.mock('../../lib/book/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/book/repository')>()
  return {
    ...actual,
    searchBookContent: vi.fn(),
  }
})

const mockChapters = [
  { id: 'ch-1', idx: 0, title: 'Khởi đầu', char_count: 500, char_offset: 0 },
  { id: 'ch-2', idx: 1, title: 'Hành trình', char_count: 600, char_offset: 500 },
]

describe('BookSearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('không hiển thị khi isOpen = false', () => {
    const { container } = render(
      <BookSearchModal
        isOpen={false}
        onClose={vi.fn()}
        documentId="doc-1"
        chapters={mockChapters}
        activeChapterIdx={0}
        onSelectResult={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('tìm kiếm trong toàn bộ sách khi scope = all', async () => {
    const mockResults = [
      {
        chapterIdx: 1,
        chapterTitle: 'Hành trình',
        chapterId: 'ch-2',
        matchIndex: 1,
        snippetBefore: 'Bắt đầu một ',
        matchText: 'ước mơ',
        snippetAfter: ' tuyệt vời phía trước',
        fullMatchText: 'Bắt đầu một ước mơ tuyệt vời',
        chapterContent: 'Bắt đầu một ước mơ tuyệt vời phía trước',
      },
    ]
    vi.mocked(repository.searchBookContent).mockResolvedValue(mockResults)

    const onSelectResult = vi.fn()
    const onClose = vi.fn()

    render(
      <BookSearchModal
        isOpen={true}
        onClose={onClose}
        documentId="doc-1"
        chapters={mockChapters}
        activeChapterIdx={0}
        onSelectResult={onSelectResult}
      />,
    )

    const input = screen.getByPlaceholderText(/Nhập từ hoặc cụm từ cần tìm/i)
    fireEvent.change(input, { target: { value: 'ước mơ' } })

    // Bấm Enter hoặc đợi debounce
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(repository.searchBookContent).toHaveBeenCalledWith('doc-1', 'ước mơ')
    })

    await waitFor(() => {
      expect(screen.getByText(/Chương 2: Hành trình/i)).toBeInTheDocument()
      expect(screen.getByText('ước mơ')).toBeInTheDocument()
    })

    // Nhấn vào kết quả
    const resultItem = screen.getByText(/Chương 2: Hành trình/i).closest('button')
    expect(resultItem).not.toBeNull()
    fireEvent.click(resultItem!)

    expect(onSelectResult).toHaveBeenCalledWith({
      chapterIdx: 1,
      matchText: 'ước mơ',
      snippet: 'Bắt đầu một ước mơ tuyệt vời',
      chapterContent: 'Bắt đầu một ước mơ tuyệt vời phía trước',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('tìm kiếm trong chương hiện tại khi scope = current', async () => {
    const currentContent = 'Đoạn một của chương đầu tiên. Ước mơ của tôi là đi khắp thế giới. Kết thúc.'
    const onSelectResult = vi.fn()
    const onClose = vi.fn()

    render(
      <BookSearchModal
        isOpen={true}
        onClose={onClose}
        documentId="doc-1"
        chapters={mockChapters}
        activeChapterIdx={0}
        currentChapterContent={currentContent}
        onSelectResult={onSelectResult}
      />,
    )

    // Chuyển sang scope Chương 1
    const currentScopeBtn = screen.getByRole('button', { name: /Chương 1/i })
    fireEvent.click(currentScopeBtn)

    const input = screen.getByPlaceholderText(/Nhập từ hoặc cụm từ cần tìm/i)
    fireEvent.change(input, { target: { value: 'ước mơ' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText(/Chương 1: Khởi đầu/i)).toBeInTheDocument()
    })

    // Không cần gọi supabase searchBookContent vì tìm client-side trong chương hiện tại
    expect(repository.searchBookContent).not.toHaveBeenCalled()
  })

  it('đóng modal khi nhấn phím Escape hoặc nút đóng', () => {
    const onClose = vi.fn()
    render(
      <BookSearchModal
        isOpen={true}
        onClose={onClose}
        documentId="doc-1"
        chapters={mockChapters}
        activeChapterIdx={0}
        onSelectResult={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText(/Nhập từ hoặc cụm từ cần tìm/i)
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    const closeBtn = screen.getByRole('button', { name: /Đóng tìm kiếm/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
