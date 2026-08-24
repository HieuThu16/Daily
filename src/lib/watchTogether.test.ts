import { beforeEach, describe, expect, it, vi } from 'vitest'

const update = vi.fn(() => chain)
const eq = vi.fn(() => chain)
const upsert = vi.fn(async (_rows: any[], _opts?: any) => ({ error: null }))
const chain: any = { update, eq, upsert, then: (r: any) => r({ error: null }) }

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'a@b.c' } } }) },
    from: () => chain,
  },
}))

const { shareToGroups, updateMyShareProgress } = await import('./watchTogether')

describe('watchTogether', () => {
  beforeEach(() => {
    localStorage.clear()
    update.mockClear()
    upsert.mockClear()
  })

  it('chưa gửi lên nhóm nào thì không gọi cập nhật tiến độ', async () => {
    await updateMyShareProgress('VIDEO', 'abc', 50, 'Đang xem 50%')
    expect(update).not.toHaveBeenCalled()
  })

  it('gửi rồi thì tiến độ được cập nhật và kẹp trong 0..100', async () => {
    await shareToGroups(['g1', 'g2'], { kind: 'VIDEO', refId: 'abc', title: 'Phim' })
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0]?.[0]).toHaveLength(2)

    await updateMyShareProgress('VIDEO', 'abc', 140, 'Đã xem hết')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ percent: 100 }))
  })
})
