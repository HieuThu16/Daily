import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.fn(async () => ({ error: null }))
vi.mock('./supabase', () => ({ supabase: { from: () => ({ upsert }) } }))

const { getReadyRegistration, pushEnabled } = await import('./push')

const fakeSub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  getKey: () => new Uint8Array([1, 2, 3]).buffer,
}

/** Dung service worker gia: getRegistration tra ve `now`, ready resolve sau `readyDelay`. */
function stubServiceWorker(now: unknown, ready: unknown, readyDelay = 0) {
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistration: async () => now,
      ready: new Promise((resolve) => setTimeout(() => resolve(ready), readyDelay)),
    },
    permissions: undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-key')
  vi.stubGlobal('Notification', { permission: 'granted' })
  vi.stubGlobal('PushManager', function () {})
  vi.stubGlobal('window', { PushManager: function () {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('getReadyRegistration', () => {
  it('co san thi tra ve ngay', async () => {
    stubServiceWorker({ tag: 'now' }, { tag: 'ready' })
    expect(await getReadyRegistration()).toEqual({ tag: 'now' })
  })

  it('CHUA co thi CHO ready - day dung luc tai lai trang', async () => {
    stubServiceWorker(undefined, { tag: 'ready' }, 5)
    expect(await getReadyRegistration()).toEqual({ tag: 'ready' })
  })

  it('may chua tung dang ky SW thi bo cuoc theo han gio, khong treo mai', async () => {
    // ready khong bao gio resolve
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: async () => undefined, ready: new Promise(() => {}) },
    })
    expect(await getReadyRegistration(20)).toBeUndefined()
  })
})

describe('pushEnabled', () => {
  it('tai lai trang, SW chua kip kich hoat -> VAN bao dang bat', async () => {
    const reg = { pushManager: { getSubscription: async () => fakeSub } }
    stubServiceWorker(undefined, reg, 5)
    expect(await pushEnabled()).toBe(true)
  })

  it('khong co dang ky nao thi bao tat', async () => {
    const reg = { pushManager: { getSubscription: async () => null } }
    stubServiceWorker(reg, reg)
    expect(await pushEnabled()).toBe(false)
    expect(upsert).not.toHaveBeenCalled()
  })
})
