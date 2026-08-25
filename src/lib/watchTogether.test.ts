import { beforeEach, describe, expect, it, vi } from 'vitest'

const update = vi.fn(() => chain)
const eq = vi.fn(() => chain)
const upsert = vi.fn(async (_rows: any, _opts?: any) => ({ error: null }))
const del = vi.fn(() => chain)
const chain: any = { update, eq, upsert, delete: del, then: (r: any) => r({ error: null }) }

const notifyUsers = vi.fn(async () => {})
vi.mock('./push', () => ({ notifyUsers }))

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'toi@gmail.com' } } }) },
    from: () => chain,
  },
}))

const { filterPeople, emailLabel, saveContactName, shareToPeople, updateMyShareProgress } =
  await import('./watchTogether')
type WatchPerson = import('./watchTogether').WatchPerson

const person = (over: Partial<WatchPerson> = {}): WatchPerson => ({
  id: 'p1',
  email: 'kimy@gmail.com',
  label: 'Kim Ý',
  customName: 'Kim Ý',
  avatarUrl: null,
  ...over,
})

describe('watchTogether', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('chưa gửi cho ai thì không gọi cập nhật tiến độ', async () => {
    await updateMyShareProgress('VIDEO', 'abc', 50, 'Đang xem 50%')
    expect(update).not.toHaveBeenCalled()
  })

  it('gửi cho nhiều Gmail thì mỗi người một dòng, tiến độ kẹp trong 0..100', async () => {
    const n = await shareToPeople(
      [person(), person({ id: 'p2', email: 'hieu@gmail.com', label: 'Hiếu' })],
      { kind: 'VIDEO', refId: 'abc', title: 'Phim' },
    )
    expect(n).toBe(2)
    const rows = upsert.mock.calls[0]?.[0] as any[]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ recipient_id: 'p1', recipient_email: 'kimy@gmail.com', sender_id: 'u1' })
    // Gửi lại lần nữa phải cập nhật đúng dòng cũ chứ không đẻ bản sao.
    expect(upsert.mock.calls[0]?.[1]).toMatchObject({ onConflict: 'sender_id,recipient_id,kind,ref_id' })

    await updateMyShareProgress('VIDEO', 'abc', 140, 'Đã xem hết')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ percent: 100 }))
  })

  it('gửi xong thì bắn thông báo đẩy tới ĐÚNG người nhận', async () => {
    await shareToPeople(
      [person(), person({ id: 'p2', email: 'hieu@gmail.com', label: 'Hiếu' })],
      { kind: 'VIDEO', refId: 'abc', title: 'Phim hay' },
    )
    expect(notifyUsers).toHaveBeenCalledTimes(1)
    const [ids, title, body, url, tag] = notifyUsers.mock.calls[0] as unknown as string[]
    // Chỉ hai người được chọn, không rải cho người thứ ba.
    expect(ids).toEqual(['p1', 'p2'])
    expect(title).toContain('toi')
    expect(body).toBe('Phim hay')
    expect(url).toBe('/watch')
    // Tag riêng cho từng mục: nhiều mục thì hiện nhiều thông báo, không đè nhau.
    expect(tag).toBe('watch-VIDEO-abc')
  })

  it('không chọn ai thì cũng không bắn thông báo', async () => {
    await shareToPeople([], { kind: 'VIDEO', refId: 'abc', title: 'Phim' })
    expect(notifyUsers).not.toHaveBeenCalled()
  })

  it('không chọn ai thì không gọi mạng', async () => {
    expect(await shareToPeople([], { kind: 'VIDEO', refId: 'abc', title: 'Phim' })).toBe(0)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('đặt tên cho Gmail thì lưu; để trống thì gỡ tên đi', async () => {
    await saveContactName('kimy@gmail.com', '  Kim Ý  ')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'kimy@gmail.com', display_name: 'Kim Ý' }),
      expect.objectContaining({ onConflict: 'owner_id,email' }),
    )

    vi.clearAllMocks()
    await saveContactName('kimy@gmail.com', '   ')
    expect(del).toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('lọc danh bạ theo cả tên tự đặt lẫn địa chỉ Gmail', () => {
    const list = [person(), person({ id: 'p2', email: 'hieu@gmail.com', label: 'Hiếu', customName: null })]
    expect(filterPeople(list, 'kim').map((p) => p.id)).toEqual(['p1'])
    expect(filterPeople(list, 'hieu@').map((p) => p.id)).toEqual(['p2'])
    expect(filterPeople(list, '  ')).toHaveLength(2)
  })

  it('không có tên nào thì lấy phần trước @ làm tên', () => {
    expect(emailLabel('kimy@gmail.com')).toBe('kimy')
    expect(emailLabel(null)).toBe('ai đó')
  })
})
