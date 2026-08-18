import { describe, expect, it, vi } from 'vitest'
import { mapWithProgress } from './mapWithProgress'

describe('mapWithProgress', () => {
  it('báo tiến độ theo từng phần tử, không theo mẻ', async () => {
    const seen: number[] = []
    await mapWithProgress([1, 2, 3, 4, 5], async () => {}, {
      concurrency: 2,
      onProgress: (done, total) => {
        expect(total).toBe(5)
        seen.push(done)
      },
    })
    expect(seen).toEqual([1, 2, 3, 4, 5])
  })

  it('chạy đúng mỗi phần tử một lần và không vượt mức song song', async () => {
    let running = 0
    let peak = 0
    const worker = vi.fn(async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 1))
      running -= 1
    })
    await mapWithProgress(Array.from({ length: 10 }, (_, i) => i), worker, { concurrency: 3 })
    expect(worker).toHaveBeenCalledTimes(10)
    expect(peak).toBeLessThanOrEqual(3)
  })

  it('danh sách rỗng thì không gọi worker', async () => {
    const worker = vi.fn(async () => {})
    await mapWithProgress([], worker)
    expect(worker).not.toHaveBeenCalled()
  })

  it('ném lỗi ra ngoài khi một phần tử thất bại', async () => {
    await expect(
      mapWithProgress([1, 2, 3], async (n) => {
        if (n === 2) throw new Error('hỏng')
      }, { concurrency: 1 }),
    ).rejects.toThrow('hỏng')
  })
})
