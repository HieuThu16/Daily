import { act, renderHook } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { useIncrementalList } from './shared'

beforeAll(() => {
  // jsdom chưa có IntersectionObserver; hook chỉ cần nó tồn tại để đăng ký.
  ;(globalThis as any).IntersectionObserver = class {
    observe() {}
    disconnect() {}
  }
})

describe('useIncrementalList', () => {
  it('bắt đầu bằng một mẻ và nới dần tới hết', () => {
    const { result } = renderHook(() => useIncrementalList(100, 40))
    expect(result.current.visibleCount).toBe(40)
    expect(result.current.remaining).toBe(60)

    act(() => result.current.showMore())
    expect(result.current.visibleCount).toBe(80)

    act(() => result.current.showMore())
    expect(result.current.visibleCount).toBe(100)
    expect(result.current.hasMore).toBe(false)
  })

  it('đổi bộ lọc thì đếm lại từ đầu', () => {
    const { result, rerender } = renderHook(({ key }) => useIncrementalList(100, 40, key), {
      initialProps: { key: 'all' },
    })
    act(() => result.current.showMore())
    expect(result.current.visibleCount).toBe(80)

    rerender({ key: 'unwatched' })
    expect(result.current.visibleCount).toBe(40)
  })
})
