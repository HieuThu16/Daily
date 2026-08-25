import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    uploaded: [] as string[],
    /** Cho insert vao shared_events that bai de kiem nhanh bao loi. */
    insertFails: false,
    toasts: [] as string[],
  },
}))

/** Builder gia: moi bo loc tra lai chinh no; insert tra ve dong vua tao. */
function makeQuery(table: string) {
  const chain: Record<string, unknown> = {}
  let inserted: Record<string, unknown> | null = null
  const result = () =>
    table === 'shared_events' && inserted
      ? state.insertFails
        ? { data: null, error: { message: 'khong ghi duoc' } }
        : { data: { id: 'ev1', owner_id: 'me', ...inserted }, error: null }
      : { data: [], error: null }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve)
  for (const m of ['select', 'eq', 'is', 'or', 'order', 'limit', 'gte', 'lte', 'update', 'single', 'maybeSingle']) {
    chain[m] = () => chain
  }
  chain.insert = (payload: Record<string, unknown>) => {
    inserted = payload
    return chain
  }
  return chain
}

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t: string) => makeQuery(t),
    auth: { getUser: async () => ({ data: { user: { id: 'me', email: 'toi@gmail.com' } } }) },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          state.uploaded.push(path)
          return { error: null }
        },
        getPublicUrl: (p: string) => ({ data: { publicUrl: 'https://cdn.test/' + p } }),
        remove: async () => ({ error: null }),
      }),
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => Promise.resolve(),
  },
}))

vi.mock('../ToastContext', () => ({
  useToast: () => ({
    showToast: (m: string) => {
      state.toasts.push(m)
    },
  }),
}))

vi.mock('../../lib/push', () => ({ notifyPartner: async () => {} }))

// Nen anh: gia lap tra ve blob nho, cham mot nhip de kip thay tien trinh.
vi.mock('../../lib/photo', () => ({
  compressForUpload: async () => {
    await new Promise((r) => setTimeout(r, 5))
    return { blob: new Blob(['x']), ext: 'jpg' }
  },
}))

const { SharedEventsView } = await import('./SharedEventsView')

const pick = (n: number) =>
  Array.from({ length: n }, (_, i) => new File([new Uint8Array(8)], `anh${i}.jpg`, { type: 'image/jpeg' }))

beforeEach(() => {
  state.uploaded = []
  state.toasts = []
  state.insertFails = false
})
afterEach(cleanup)

async function openFormAndAttach(count: number) {
  const user = userEvent.setup()
  render(<SharedEventsView personId="p1" personName="Kim Y" />)
  await user.click(await screen.findByRole('button', { name: /Thêm kỷ niệm|Thêm sự kiện|Thêm/i }))
  await user.type(await screen.findByLabelText(/Thông tin sự kiện/i), 'Di bien')
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, pick(count))
  return user
}

describe('SharedEventsView - xu ly nhieu anh', () => {
  it('hien tien trinh khi dang xu ly, roi bao da luu kem so anh', async () => {
    const user = await openFormAndAttach(3)
    await user.click(screen.getByRole('button', { name: /Lưu sự kiện/i }))

    // Dang chay: co dong trang thai cho nguoi dung biet app khong treo
    expect(await screen.findByRole('status')).toBeTruthy()

    await waitFor(() => expect(state.toasts.length).toBeGreaterThan(0), { timeout: 4000 })
    expect(state.uploaded).toHaveLength(3)
    expect(state.toasts.at(-1)).toContain('3 ảnh')
  })

  it('ghi database that bai thi bao chua luu, khong bao thanh cong', async () => {
    state.insertFails = true
    const user = await openFormAndAttach(2)
    await user.click(screen.getByRole('button', { name: /Lưu sự kiện/i }))

    await waitFor(() => expect(state.toasts.length).toBeGreaterThan(0), { timeout: 4000 })
    expect(state.toasts.at(-1)).toContain('Chưa lưu được')
  })
})
