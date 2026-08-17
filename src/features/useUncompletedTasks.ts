import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { isOverdue } from '../lib/deadline'
import type { Todo } from '../types'

export const TASKS_UPDATED_EVENT = 'daily-tasks-updated'

/** Kích hoạt thông báo khi có bất kỳ thay đổi nào liên quan tới công việc */
export function notifyTasksChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TASKS_UPDATED_EVENT))
  }
}

export function useUncompletedTasks() {
  const [tasks, setTasks] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUncompleted = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('completed', false)
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (!error && data) {
        setTasks(data as Todo[])
      }
    } catch {
      // Bỏ qua lỗi mạng
    } finally {
      setLoading(false)
    }
  }, [])

  const completeTask = useCallback(async (task: Todo) => {
    // Cập nhật lạc quan (optimistic update)
    setTasks((prev) => prev.filter((t) => t.id !== task.id))

    if (!supabase) {
      notifyTasksChanged()
      return
    }
    const nowIso = new Date().toISOString()
    try {
      // Chỉ báo thay đổi SAU khi Supabase ghi xong: báo sớm thì các nơi nghe sự kiện
      // sẽ đọc lại DB khi task vẫn còn completed = false và việc vừa xong hiện lại.
      const { error } = await supabase
        .from('todos')
        .update({ completed: true, completed_at: nowIso })
        .eq('id', task.id)
      if (error) throw error
      notifyTasksChanged()
    } catch {
      // Nếu lỗi thì hoàn tác
      fetchUncompleted()
    }
  }, [fetchUncompleted])

  useEffect(() => {
    fetchUncompleted()

    const onTasksChanged = () => {
      fetchUncompleted()
    }

    window.addEventListener(TASKS_UPDATED_EVENT, onTasksChanged)
    window.addEventListener('focus', onTasksChanged)

    // Lắng nghe realtime từ Supabase nếu có hỗ trợ
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
    if (supabase) {
      channel = supabase
        .channel('public:todos:bell')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'todos' },
          () => {
            fetchUncompleted()
          },
        )
        .subscribe()
    }

    // Tự động kiểm tra định kỳ mỗi 30 giây
    const interval = setInterval(fetchUncompleted, 30_000)

    return () => {
      window.removeEventListener(TASKS_UPDATED_EVENT, onTasksChanged)
      window.removeEventListener('focus', onTasksChanged)
      clearInterval(interval)
      if (channel && supabase) {
        supabase.removeChannel(channel).catch(() => {})
      }
    }
  }, [fetchUncompleted])

  const count = tasks.length
  const today = localDate()
  const overdueCount = tasks.filter((t) => isOverdue(t)).length
  const todayCount = tasks.filter((t) => t.due_date === today).length

  return {
    tasks,
    count,
    overdueCount,
    todayCount,
    loading,
    reload: fetchUncompleted,
    completeTask,
  }
}
