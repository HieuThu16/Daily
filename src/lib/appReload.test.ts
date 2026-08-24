import { afterEach, describe, expect, it, vi } from 'vitest'
import { FORCE_RELOAD_FLAG, forceReloadLatestVersion } from '../lib/appReload'

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('forceReloadLatestVersion', () => {
  it('dọn service worker và cache rồi mới nạp lại', async () => {
    const unregister = vi.fn().mockResolvedValue(true)
    const deleteCache = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
    })
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(['precache-v1']), delete: deleteCache })

    const reload = vi.fn()
    await forceReloadLatestVersion(reload)

    expect(unregister).toHaveBeenCalled()
    expect(deleteCache).toHaveBeenCalledWith('precache-v1')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('bước dọn treo thì vẫn nạp lại, không đứng im', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: () => new Promise(() => {}) }, // treo hẳn
    })

    const reload = vi.fn()
    void forceReloadLatestVersion(reload)

    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2600)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('bật cờ để main.tsx đừng tải lại cắt ngang', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([]) } })
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() })

    await forceReloadLatestVersion(vi.fn())
    expect(sessionStorage.getItem(FORCE_RELOAD_FLAG)).toBe('1')
  })
})
