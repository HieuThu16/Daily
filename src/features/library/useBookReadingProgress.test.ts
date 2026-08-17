import { renderHook, act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const saveProgress = vi.fn().mockResolvedValue(undefined)
const reportPagesRead = vi.fn().mockResolvedValue(undefined)

vi.mock('../../lib/book/repository', () => ({
  saveProgress: (...args: unknown[]) => saveProgress(...args),
  reportPagesRead: (...args: unknown[]) => reportPagesRead(...args),
  estimatePage: (charOffset: number, totalChars: number, pageCount: number | null) =>
    pageCount ? Math.max(1, Math.round((charOffset / totalChars) * pageCount)) : 1,
}))

const { useBookReadingProgress } = await import('./useBookReadingProgress')

const options = { documentId: 'doc-1', mediaItemId: 'book-1', totalChars: 1000, pageCount: 100 }

const spot = { chapterIdx: 2, charOffset: 400, charCount: 200, ratio: 0.5 }

beforeEach(() => {
  vi.useFakeTimers()
  saveProgress.mockClear()
  reportPagesRead.mockClear()
})

afterEach(() => {
  // Dự án này không bật tự dọn của Testing Library. Không gỡ hook cũ thì
  // listener visibilitychange của chúng còn nguyên và bắn nhầm ở test sau.
  cleanup()
  vi.useRealTimers()
})

describe('useBookReadingProgress', () => {
  it('ghi vị trí đọc xuống database sau khi ngừng cuộn', async () => {
    const { result } = renderHook(() => useBookReadingProgress(options))

    act(() => result.current.report(spot))
    expect(saveProgress).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000)
    })

    // charOffset 400 + ratio 0.5 * charCount 200 = 500 trên tổng 1000 chữ.
    expect(saveProgress).toHaveBeenCalledWith('doc-1', {
      last_chapter_idx: 2,
      last_scroll_ratio: 0.5,
      last_char_offset: 500,
      percent: 50,
    })
  })

  it('gộp nhiều lần cuộn liên tiếp thành một lần ghi', async () => {
    const { result } = renderHook(() => useBookReadingProgress(options))

    act(() => result.current.report(spot))
    act(() => result.current.report({ ...spot, ratio: 0.6 }))
    act(() => result.current.report({ ...spot, ratio: 0.7 }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000)
    })

    expect(saveProgress).toHaveBeenCalledTimes(1)
    expect(saveProgress.mock.calls[0][1].last_scroll_ratio).toBe(0.7)
  })

  // Rời màn đọc là lúc dễ mất tiến độ nhất: nếu chỉ dựa vào hẹn giờ thì đoạn
  // vừa đọc trong vài giây cuối bay mất.
  it('ghi nốt một lần khi rời màn hình đọc', async () => {
    const { result, unmount } = renderHook(() => useBookReadingProgress(options))
    act(() => result.current.report(spot))

    await act(async () => {
      unmount()
      await Promise.resolve()
    })

    expect(saveProgress).toHaveBeenCalledTimes(1)
  })

  it('ghi ngay khi người dùng chuyển sang tab khác', async () => {
    const { result } = renderHook(() => useBookReadingProgress(options))
    act(() => result.current.report(spot))

    await act(async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })

    expect(saveProgress).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('chưa cuộn dòng nào thì không ghi gì', async () => {
    const { unmount } = renderHook(() => useBookReadingProgress(options))

    await act(async () => {
      unmount()
      await Promise.resolve()
    })

    expect(saveProgress).not.toHaveBeenCalled()
  })

  it('sách chưa nhập file thì không ghi gì', async () => {
    const { result } = renderHook(() => useBookReadingProgress({ ...options, documentId: null }))

    act(() => result.current.report(spot))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000)
    })

    expect(saveProgress).not.toHaveBeenCalled()
  })

  it('ghi nhật ký đọc của hôm nay sau khi đã đọc đủ một phút', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const { result } = renderHook(() => useBookReadingProgress(options))
    act(() => result.current.report(spot))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(reportPagesRead).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000)
    })

    expect(reportPagesRead).toHaveBeenCalledWith('book-1', 50)
    visibility.mockRestore()
  })

  it('lỗi khi lưu không làm hỏng việc đọc', async () => {
    saveProgress.mockRejectedValueOnce(new Error('mất mạng'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useBookReadingProgress(options))

    act(() => result.current.report(spot))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000)
    })

    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('không ghi tiến độ hoặc nhật ký đọc khi enabled = false (chế độ tìm kiếm)', async () => {
    const { result, unmount } = renderHook(() => useBookReadingProgress({ ...options, enabled: false }))

    act(() => result.current.report(spot))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000)
    })

    expect(saveProgress).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.flush()
    })
    expect(saveProgress).not.toHaveBeenCalled()

    await act(async () => {
      unmount()
      await Promise.resolve()
    })
    expect(saveProgress).not.toHaveBeenCalled()
    expect(reportPagesRead).not.toHaveBeenCalled()
  })
})
