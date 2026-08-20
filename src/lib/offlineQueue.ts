import { supabase } from './supabase'
import { loadLocal, saveLocal } from './persistence'

const QUEUE_KEY = 'daily_write_queue'
const EVENT_NAME = 'daily_write_queue_changed'

export type QueuedWrite = {
  id: string
  table: string
  op: 'insert' | 'update'
  payload: Record<string, unknown>
  /** Với 'update': điều kiện eq, thường là { id: '...' }. */
  match?: Record<string, string>
  queuedAt: string
}

export const getWriteQueue = (): QueuedWrite[] => loadLocal<QueuedWrite[]>(QUEUE_KEY, [])

function setQueue(rows: QueuedWrite[]) {
  saveLocal(QUEUE_KEY, rows)
  window.dispatchEvent(new Event(EVENT_NAME))
}

/** Xếp một lệnh ghi vào hàng đợi để đẩy lên khi có mạng. */
export function queueWrite(entry: Omit<QueuedWrite, 'id' | 'queuedAt'>): QueuedWrite {
  const queued: QueuedWrite = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  }
  setQueue([...getWriteQueue(), queued])
  return queued
}

/**
 * Đẩy hết hàng đợi lên Supabase, giữ nguyên thứ tự đã xếp.
 * Lệnh hỏng vì mất mạng thì để lại chờ lượt sau; hỏng vì dữ liệu sai
 * (bảng không có, vi phạm ràng buộc) thì bỏ đi, giữ lại chỉ tắc mãi hàng đợi.
 */
export async function flushWriteQueue(): Promise<{ sent: number; failed: number; left: number }> {
  const queue = getWriteQueue()
  if (!supabase || queue.length === 0 || !navigator.onLine) {
    return { sent: 0, failed: 0, left: queue.length }
  }

  const remaining: QueuedWrite[] = []
  let sent = 0
  let failed = 0

  for (const item of queue) {
    try {
      const table = supabase.from(item.table)
      let error
      if (item.op === 'insert') {
        ;({ error } = await table.insert(item.payload))
      } else {
        let query = table.update(item.payload)
        for (const [column, value] of Object.entries(item.match ?? {})) query = query.eq(column, value)
        ;({ error } = await query)
      }

      if (!error) sent += 1
      else if (isPermanent(error)) failed += 1
      else remaining.push(item)
    } catch {
      // Lỗi mạng ném ra ngoài: giữ lại để thử tiếp.
      remaining.push(item)
    }
  }

  setQueue(remaining)
  return { sent, failed, left: remaining.length }
}

/** Lỗi do dữ liệu/schema thì thử lại bao nhiêu lần cũng hỏng. */
function isPermanent(error: { code?: string | null }): boolean {
  const code = error.code ?? ''
  return code.startsWith('42') || code.startsWith('23') || code.startsWith('PGRST')
}

/**
 * Tự đẩy hàng đợi khi máy có mạng lại hoặc khi quay lại tab.
 * ponytail: chưa dùng Background Sync API của service worker nên chỉ chạy lúc app đang mở;
 * muốn đẩy cả khi app đóng thì phải chuyển VitePWA sang injectManifest và tự viết sw.
 */
export function startQueueAutoFlush(onFlushed?: (result: { sent: number; failed: number; left: number }) => void) {
  const run = () => {
    void flushWriteQueue().then((result) => {
      if (result.sent || result.failed) onFlushed?.(result)
    })
  }

  run()
  window.addEventListener('online', run)
  window.addEventListener('focus', run)
  return () => {
    window.removeEventListener('online', run)
    window.removeEventListener('focus', run)
  }
}
