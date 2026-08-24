import { createClient } from '@supabase/supabase-js'

/**
 * Cổng vào chung cho mọi endpoint dưới /api.
 *
 * Trước đây chỉ `cron-sync` kiểm tra token, còn các route cào/đồng bộ thì mở toang
 * trên domain public — ai biết URL cũng gọi được, mà bên trong chúng ghi Supabase
 * bằng service_role và đốt quota YouTube.
 *
 * Hai đường vào hợp lệ:
 *  - Vercel Cron gửi `Authorization: Bearer <CRON_SECRET>`
 *  - Người dùng đã đăng nhập trong app gửi access token của Supabase
 *
 * Trả `null` là qua cổng; trả object là đã `res.status(...).json(...)` rồi, chỗ gọi
 * chỉ việc `return`.
 */
export async function requireAuth(req: any, res: any): Promise<{ blocked: true } | null> {
  const { CRON_SECRET, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

  const token = String(req.headers?.authorization ?? '').replace(/^Bearer /, '')
  if (!token) {
    res.status(401).json({ error: 'Không có quyền' })
    return { blocked: true }
  }

  if (CRON_SECRET && token === CRON_SECRET) return null

  if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server thiếu khoá Supabase' })
    return { blocked: true }
  }

  const auth = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await auth.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Không có quyền' })
    return { blocked: true }
  }
  return null
}
