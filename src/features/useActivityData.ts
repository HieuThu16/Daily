import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ActivityInput } from '../lib/activityStats'

type Loaded = Omit<ActivityInput, 'from' | 'days'>

/**
 * Nạp dữ liệu cho khu "Hoạt động" của trang Thống kê.
 *
 * Không dùng `useQuery` chung vì hook đó luôn lọc `deleted_at is null`, mà
 * `habit_logs` và `watch_shares` không có cột đó — truy vấn sẽ lỗi. Ở đây cũng
 * chỉ chọn đúng cột cần thay vì `select('*')`, vì bảng media_items rất nặng.
 *
 * Tải một lần lúc mở trang; đổi khoảng ngày thì lọc tại chỗ, không gọi lại mạng.
 */
export function useActivityData() {
  const [data, setData] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    void (async () => {
      if (!supabase) {
        setLoading(false)
        return
      }
      const db = supabase
      /** Bảng chưa tạo hoặc lỗi mạng thì coi như rỗng — thiếu một mục còn hơn trắng cả trang. */
      const grab = async <T,>(table: string, columns: string, withDeletedAt = true): Promise<T[]> => {
        try {
          let q = db.from(table).select(columns)
          if (withDeletedAt) q = q.is('deleted_at', null)
          const { data: rows, error } = await q.limit(5000)
          if (error) {
            console.warn(`[thống kê] bỏ qua ${table}:`, error.message)
            return []
          }
          return (rows ?? []) as T[]
        } catch (err) {
          console.warn(`[thống kê] bỏ qua ${table}:`, err)
          return []
        }
      }

      const [
        habits, habitLogs, entries, todos, transactions,
        nutritionLogs, sleepLogs, knowledge, english, media, people, shares, me,
      ] = await Promise.all([
        grab<never>('habits', 'id,name,is_active'),
        grab<never>('habit_logs', 'habit_id,date,completed', false),
        grab<never>('daily_entries', 'id,entry_date,entry_type'),
        grab<never>('todos', 'id,completed,completed_at,created_at,due_date,category,postpone_count'),
        grab<never>('transactions', 'id,direction,amount,category,log_date'),
        grab<never>('nutrition_logs', 'food_name,price,meal_slot,log_date'),
        grab<never>('sleep_logs', 'duration_minutes,log_date'),
        grab<never>('knowledge_items', 'id,category,created_at'),
        grab<never>('english_items', 'id,kind,term,created_at'),
        grab<never>('media_items', 'id,type,status,created_at'),
        grab<never>('people', 'id,name,group_key,created_at'),
        grab<never>('watch_shares', 'id,sender_id,sender_email,recipient_email,title,created_at', false),
        db.auth.getUser().then(({ data: d }) => d?.user?.id ?? null).catch(() => null),
      ])

      if (!alive) return
      setData({
        habits, habitLogs, entries, todos, transactions,
        nutritionLogs, sleepLogs, knowledge, english, media, people, shares,
        myUserId: me,
      })
      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [])

  return { data, loading }
}
