import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { dueSoon, reminderText } from '../lib/reminders'
import { shiftDate } from '../lib/sleep'
import type { Todo } from '../types'
import { useToast } from './ToastContext'

const CHECK_EVERY_MS = 60_000

/**
 * Nhắc việc còn ≤2 tiếng nữa tới hạn mà chưa làm xong.
 * ponytail: chỉ chạy khi app đang mở (toast + Notification của trình duyệt).
 * Muốn nhắc lúc app đã đóng thì cần Web Push — service worker + VAPID + server đẩy.
 */
export function useTaskReminders() {
  const { showToast } = useToast()
  const notified = useRef(new Set<string>())

  useEffect(() => {
    if (!supabase) return
    let alive = true

    const check = async () => {
      const today = localDate()
      const { data } = await supabase!
        .from('todos')
        .select('id, title, completed, due_date, due_time')
        .eq('completed', false)
        .gte('due_date', today)
        .lte('due_date', shiftDate(today, 1))
        .is('deleted_at', null)
      if (!alive || !data) return

      // Khoá theo cả mốc hạn: dời hạn thì được nhắc lại, và Set không phình mãi vì
      // mỗi vòng chỉ giữ đúng các việc còn trong tầm truy vấn (hôm nay + ngày mai).
      const keyOf = (todo: Pick<Todo, 'id' | 'due_date' | 'due_time'>) => `${todo.id}@${todo.due_date}T${todo.due_time ?? ''}`
      const live = new Set((data as Todo[]).map(keyOf))
      notified.current.forEach((key) => {
        if (!live.has(key)) notified.current.delete(key)
      })

      dueSoon(data as Todo[]).forEach((todo) => {
        const key = keyOf(todo)
        if (notified.current.has(key)) return
        notified.current.add(key)
        const text = reminderText(todo)
        showToast(`⏰ ${todo.title} — ${text}`, 'info')
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Sắp tới hạn', { body: `${todo.title} — ${text}`, tag: todo.id })
        }
      })
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [showToast])
}
