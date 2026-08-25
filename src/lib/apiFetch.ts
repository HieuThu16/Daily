import { supabase } from './supabase'

/**
 * `fetch` cho các route dưới /api, tự đính access token của phiên đăng nhập.
 *
 * Các route đó chạy bằng service_role và đốt quota YouTube, nên phía server đã
 * khoá lại (xem `api/_auth.ts`). Gói ở một chỗ để mọi chỗ gọi khỏi tự nhớ gắn header.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = (await supabase?.auth.getSession())?.data?.session?.access_token
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

/**
 * Đọc thân phản hồi thành JSON, và khi KHÔNG phải JSON thì báo đúng chuyện gì đã xảy ra.
 *
 * `await res.json()` trần chỉ ném "Unexpected token '<'…" — che mất nguyên nhân thật
 * (hàm serverless vỡ lúc nạp, Vercel timeout 504, tường đăng nhập trả HTML…).
 * Ở đây kèm luôn mã HTTP và một mẩu thân phản hồi để lần ra ngay.
 */
export async function readJson(res: Response, fallbackMessage: string): Promise<any> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    // Trang lỗi HTML thường mở đầu bằng <!DOCTYPE hoặc <html.
    const snippet = text.trim().slice(0, 120).replace(/\s+/g, ' ')
    const kind = /^\s*</.test(text) ? 'trang HTML' : 'dữ liệu lạ'
    throw new Error(`${fallbackMessage} — máy chủ trả về ${kind} (HTTP ${res.status}): ${snippet}`)
  }
}

/**
 * POST JSON tới một route /api rồi trả về thân phản hồi đã phân giải.
 * Gộp cả ba bước hay quên: đính token, phân giải an toàn, và ném lỗi của server.
 */
export async function apiPost<T = any>(url: string, body: unknown, fallbackMessage: string): Promise<T> {
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await readJson(res, fallbackMessage)
  if (!res.ok || data?.error) throw new Error(data?.error || `${fallbackMessage} (HTTP ${res.status})`)
  return data as T
}
