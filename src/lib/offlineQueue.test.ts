import { beforeEach, describe, expect, it, vi } from 'vitest'

const results: Array<{ error: { code?: string } | null }> = []
const insert = vi.fn(async () => results.shift() ?? { error: null })
const eq = vi.fn(async () => results.shift() ?? { error: null })
const update = vi.fn(() => ({ eq }))

vi.mock('./supabase', () => ({ supabase: { from: () => ({ insert, update }) } }))

const { flushWriteQueue, getWriteQueue, queueWrite } = await import('./offlineQueue')

beforeEach(() => {
  localStorage.clear()
  results.length = 0
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('offlineQueue', () => {
  it('xếp hàng rồi đẩy hết khi có mạng', async () => {
    queueWrite({ table: 'daily_entries', op: 'insert', payload: { content: 'a' } })
    queueWrite({ table: 'todos', op: 'update', payload: { completed: true }, match: { id: 't1' } })
    expect(getWriteQueue()).toHaveLength(2)

    const result = await flushWriteQueue()
    expect(result).toEqual({ sent: 2, failed: 0, left: 0 })
    expect(getWriteQueue()).toHaveLength(0)
  })

  it('mất mạng thì giữ nguyên hàng đợi', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    queueWrite({ table: 'todos', op: 'insert', payload: { title: 'x' } })

    const result = await flushWriteQueue()
    expect(result.sent).toBe(0)
    expect(getWriteQueue()).toHaveLength(1)
    expect(insert).not.toHaveBeenCalled()
  })

  it('lỗi tạm thời giữ lại, lỗi dữ liệu thì bỏ đi', async () => {
    queueWrite({ table: 'todos', op: 'insert', payload: { title: 'giữ lại' } })
    queueWrite({ table: 'todos', op: 'insert', payload: { title: 'bỏ đi' } })
    results.push({ error: { code: '08006' } }, { error: { code: '23505' } })

    const result = await flushWriteQueue()
    expect(result).toEqual({ sent: 0, failed: 1, left: 1 })
    expect((getWriteQueue()[0].payload as Record<string, unknown>).title).toBe('giữ lại')
  })
})
