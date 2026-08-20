import { beforeEach, describe, expect, it } from 'vitest'
import { withOfflineQueue } from './offlineWrite'
import { getWriteQueue } from './offlineQueue'

/** Client giả: chỉ cần đủ hình dạng để lớp bọc có cái mà đi xuyên qua khi online. */
function fakeClient(calls: string[]) {
  const builder = {
    insert: (..._a: unknown[]) => { calls.push('insert'); return builder },
    update: (..._a: unknown[]) => { calls.push('update'); return builder },
    delete: (..._a: unknown[]) => { calls.push('delete'); return builder },
    eq: (..._a: unknown[]) => builder,
    select: (..._a: unknown[]) => builder,
    single: (..._a: unknown[]) => builder,
  }
  return { from: (table: string) => { calls.push(`from:${table}`); return builder } }
}

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })

describe('withOfflineQueue', () => {
  beforeEach(() => {
    localStorage.clear()
    setOnline(true)
  })

  it('có mạng thì không xen vào, lệnh đi thẳng tới client thật', () => {
    const calls: string[] = []
    const client = withOfflineQueue(fakeClient(calls))
    client.from('todos').insert({ title: 'a' })
    expect(calls).toEqual(['from:todos', 'insert'])
    expect(getWriteQueue()).toHaveLength(0)
  })

  it('mất mạng thì xếp lệnh insert vào hàng đợi và trả lại dòng vừa ghi', async () => {
    setOnline(false)
    const client = withOfflineQueue(fakeClient([]))
    const { data, error } = (await client
      .from('transactions')
      .insert({ amount: 50_000 })
      .select()
      .single()) as unknown as { data: { id: string; amount: number }; error: null }

    expect(error).toBeNull()
    expect(data.amount).toBe(50_000)
    // Có id sẵn để màn hình hiện ngay, và để lúc đẩy lên không sinh bản thứ hai.
    expect(data.id).toMatch(/[0-9a-f-]{36}/)

    await Promise.resolve()
    const queue = getWriteQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ table: 'transactions', op: 'insert' })
    expect((queue[0].payload as { id: string }).id).toBe(data.id)
  })

  it('mất mạng thì lệnh update giữ lại điều kiện eq để sau đẩy đúng dòng', async () => {
    setOnline(false)
    const client = withOfflineQueue(fakeClient([]))
    await client.from('habits').update({ is_active: false }).eq('id', 'h-1')

    await Promise.resolve()
    const [queued] = getWriteQueue()
    expect(queued).toMatchObject({ table: 'habits', op: 'update', match: { id: 'h-1' } })
    expect(queued.payload).toEqual({ is_active: false })
  })

  it('mất mạng thì lệnh delete cũng vào hàng đợi, không mất thao tác', async () => {
    setOnline(false)
    const client = withOfflineQueue(fakeClient([]))
    const { error } = (await client.from('media_items').delete().eq('id', 'm-9')) as unknown as { error: null }

    expect(error).toBeNull()
    await Promise.resolve()
    expect(getWriteQueue()[0]).toMatchObject({ table: 'media_items', op: 'delete', match: { id: 'm-9' } })
  })

  it('không đụng tới thứ khác của client, ví dụ auth', () => {
    const client = withOfflineQueue({ from: () => ({}), auth: { user: 'u1' } })
    expect(client.auth.user).toBe('u1')
  })
})
