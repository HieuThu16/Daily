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
