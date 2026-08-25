import { supabase } from './supabase'
import { loadLocal, saveLocal } from './persistence'

/**
 * Hook/Helper đồng bộ cài đặt người dùng giữa LocalStorage và Supabase.
 * - Đọc tức thì từ LocalStorage (0ms latency, chạy được offline)
 * - Tự động tải bản mới nhất từ Supabase khi online và hợp nhất
 * - Khi lưu: cập nhật LocalStorage ngay lập tức và đẩy lên Supabase ngầm
 */

export async function getRemoteAppSetting<T>(key: string, defaultValue: T): Promise<T> {
  const localVal = loadLocal<T>(key, defaultValue)
  if (!supabase) return localVal

  try {
    // RLS đã lọc theo chủ, nhưng lọc luôn ở đây cho rõ ý và tránh maybeSingle()
    // vỡ nếu còn sót dòng cũ dùng chung.
    const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    const userId = userData?.user?.id ?? null

    let query = supabase.from('user_app_settings').select('setting_value').eq('setting_key', key)
    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query.maybeSingle()

    if (!error && data?.setting_value !== undefined && data?.setting_value !== null) {
      const remoteVal = data.setting_value as T
      saveLocal(key, remoteVal)
      return remoteVal
    }
  } catch (err) {
    console.warn(`[getRemoteAppSetting] Lỗi nạp setting ${key}:`, err)
  }

  return localVal
}

export async function saveAppSetting<T>(key: string, value: T): Promise<void> {
  // 1. Lưu ngay vào local
  saveLocal(key, value)

  // 2. Đẩy lên Supabase ngầm
  if (!supabase) return

  try {
    const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    const userId = userData?.user?.id || null

    await supabase
      .from('user_app_settings')
      .upsert({
        setting_key: key,
        user_id: userId,
        setting_value: value as any,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,setting_key' })
  } catch (err) {
    console.warn(`[saveAppSetting] Lỗi đẩy setting ${key} lên Supabase:`, err)
  }
}
