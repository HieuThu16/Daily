import { describe, expect, it, vi } from 'vitest'
import { rafThrottle } from './rafThrottle'

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

describe('rafThrottle', () => {
  it('gọi dồn 100 lần chỉ chạy đúng 1 lần, và giữ tham số mới nhất', async () => {
    const spy = vi.fn()
    const throttled = rafThrottle(spy)
    for (let i = 0; i < 100; i++) throttled(i as never)

    expect(spy).not.toHaveBeenCalled()
    await nextFrame()
    await nextFrame()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(99)
  })

  it('cancel thì nhịp đang chờ không chạy nữa', async () => {
    const spy = vi.fn()
    const throttled = rafThrottle(spy)
    throttled()
    throttled.cancel()
    await nextFrame()
    await nextFrame()
    expect(spy).not.toHaveBeenCalled()
  })
})
