import { createClient } from '@supabase/supabase-js'
import { withOfflineQueue } from './offlineWrite'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isSupabaseConfigured = Boolean(url && key)
// Bọc để mọi lệnh ghi lúc mất mạng rơi vào hàng đợi thay vì biến mất.
export const supabase = isSupabaseConfigured ? withOfflineQueue(createClient(url, key)) : null
