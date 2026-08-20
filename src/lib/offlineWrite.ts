import { queueWrite } from './offlineQueue'

/** Những lệnh làm đổi dữ liệu; `select` vẫn để đi thẳng ra mạng như cũ. */
const WRITE_OPS = ['insert', 'update', 'upsert', 'delete'] as const
type WriteOp = (typeof WRITE_OPS)[number]

type Row = Record<string, unknown>

/**
 * Bọc client Supabase để lúc mất mạng, lệnh ghi được xếp vào hàng đợi thay vì
 * ném lỗi mạng rồi mất luôn thao tác.
 *
 * Bọc ở đây thay vì sửa từng chỗ gọi, vì cả app có hơn trăm chỗ ghi nằm rải rác;
 * một lớp bọc phủ hết, và tab nào thêm sau cũng tự được phủ theo.
 *
 * ponytail: chỉ chặn `from()`. Tải ảnh lên `storage` mất mạng vẫn hỏng như trước —
 * file nhị phân không nhét vừa localStorage, muốn làm phải chuyển sang IndexedDB.
 */
export function withOfflineQueue<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (prop !== 'from' || typeof value !== 'function') return value

      return (table: string) => {
        const builder = value.call(target, table)
        if (navigator.onLine) return builder

        return new Proxy(builder as object, {
          get(b, method, r) {
            if (typeof method === 'string' && (WRITE_OPS as readonly string[]).includes(method)) {
              return (payload: Row | Row[]) => queuedResult(table, method as WriteOp, payload)
            }
            return Reflect.get(b, method, r)
          },
        })
      }
    },
  })
}

/**
 * Đứng thay cho kết quả Supabase khi đang offline: nuốt tiếp cả chuỗi
 * `.eq().select().single()` rồi trả về đúng những dòng vừa ghi, để màn hình
 * hiện ngay như lúc có mạng.
 */
export function queuedResult(table: string, op: WriteOp, payload: Row | Row[]) {
  const rows: Row[] = op === 'delete' ? [] : (Array.isArray(payload) ? payload : [payload]).map((row) => ({ ...row }))
  // Tự sinh id để UI có khoá dùng ngay, và để lệnh đẩy lên sau không tạo bản thứ hai.
  if (op === 'insert' || op === 'upsert') rows.forEach((row) => { row.id ??= crypto.randomUUID() })

  const match: Record<string, string> = {}
  let single = false

  // Xếp hàng ở microtask kế tiếp, lúc đó chuỗi .eq() đã chạy xong nên `match` mới đủ.
  queueMicrotask(() => {
    queueWrite({
      table,
      op: op === 'upsert' ? 'insert' : op,
      payload: op === 'delete' ? {} : rows.length === 1 ? rows[0] : ({ rows } as unknown as Row),
      match,
    })
  })

  const stub: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined
        if (prop === 'then') {
          return (resolve: (value: unknown) => unknown) =>
            Promise.resolve(
              resolve({
                data: op === 'delete' ? null : single ? (rows[0] ?? null) : rows,
                error: null,
                count: rows.length,
                status: 200,
                statusText: 'OK (chờ đồng bộ)',
              }),
            )
        }
        if (prop === 'eq') return (column: string, value: unknown) => { match[column] = String(value); return stub }
        if (prop === 'single' || prop === 'maybeSingle') return () => { single = true; return stub }
        // .select(), .order(), .is()… chỉ là mắt xích trung gian, trả lại chính nó.
        return () => stub
      },
    },
  )

  return stub
}
