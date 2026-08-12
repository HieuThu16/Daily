import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { weekDays } from '../../lib/homeProgress'
import type { Entry, Habit, HabitLog, Media, Person, PersonOccasion, Todo } from '../../types'
import { useToast } from '../ToastContext'

/**
 * Nạp toàn bộ dữ liệu trang Home trong một lượt.
 * Bảng nào chưa có trong database (ví dụ person_occasions khi chưa chạy migration)
 * sẽ trả data null và được coi như danh sách rỗng, không làm hỏng cả trang.
 */
export function useHomeData() {
  const { showToast } = useToast()
  const [habits, setHabits] = useState<Habit[]>([])
  const [todayLogs, setTodayLogs] = useState<HabitLog[]>([])
  const [weekLogs, setWeekLogs] = useState<HabitLog[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [todosDoneToday, setTodosDoneToday] = useState<Todo[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [occasions, setOccasions] = useState<PersonOccasion[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  const week = useMemo(() => weekDays(), [])

  useEffect(() => {
    ;(async () => {
      if (!supabase) {
        setLoading(false)
        return
      }
      setLoading(true)
      const today = localDate()

      const [h, tl, wl, t, td, e, m, o, p] = await Promise.all([
        supabase.from('habits').select('*').eq('is_active', true).is('deleted_at', null),
        supabase.from('habit_logs').select('*').eq('date', today),
        supabase.from('habit_logs').select('*').gte('date', week[0].key).lte('date', week[6].key),
        supabase.from('todos').select('*').eq('completed', false).is('deleted_at', null).order('created_at'),
        supabase.from('todos').select('*').eq('completed', true).gte('completed_at', today).is('deleted_at', null),
        supabase.from('daily_entries').select('*').eq('entry_date', today).is('deleted_at', null),
        supabase.from('media_items').select('*').eq('status', 'IN_PROGRESS').is('deleted_at', null).limit(5),
        supabase.from('person_occasions').select('*').is('deleted_at', null),
        supabase.from('people').select('*').is('deleted_at', null),
      ])

      setHabits((h.data ?? []) as Habit[])
      setTodayLogs((tl.data ?? []) as HabitLog[])
      setWeekLogs((wl.data ?? []) as HabitLog[])
      setTodos((t.data ?? []) as Todo[])
      setTodosDoneToday((td.data ?? []) as Todo[])
      setEntries((e.data ?? []) as Entry[])
      setMedia((m.data ?? []) as Media[])
      setOccasions((o.data ?? []) as PersonOccasion[])
      setPeople((p.data ?? []) as Person[])
      setLoading(false)
    })()
  }, [week])

  const completedHabitIds = useMemo(
    () => new Set(todayLogs.filter((l) => l.completed).map((l) => l.habit_id)),
    [todayLogs],
  )

  const toggleHabit = async (habit: Habit) => {
    const done = !completedHabitIds.has(habit.id)
    const day = localDate()
    const next = { habit_id: habit.id, date: day, completed: done }
    setTodayLogs((prev) => [...prev.filter((l) => l.habit_id !== habit.id), next])
    setWeekLogs((prev) => [...prev.filter((l) => !(l.habit_id === habit.id && l.date === day)), next])
    await supabase?.from('habit_logs').upsert(next, { onConflict: 'habit_id,date' })
    showToast(
      done
        ? habit.habit_type === 'BAD'
          ? '⚠️ Đã đánh dấu thói quen xấu!'
          : '✅ Đã hoàn thành thói quen!'
        : '🔄 Đã bỏ tích thói quen',
    )
  }

  const toggleTodo = async (todo: Todo) => {
    const completedAt = new Date().toISOString()
    setTodos((prev) => prev.filter((t) => t.id !== todo.id))
    setTodosDoneToday((prev) => [...prev, { ...todo, completed: true, completed_at: completedAt }])
    await supabase?.from('todos').update({ completed: true, completed_at: completedAt }).eq('id', todo.id)
    showToast('✅ Đã hoàn thành công việc!')
  }

  return {
    habits,
    todayLogs,
    weekLogs,
    todos,
    todosDoneToday,
    entries,
    media,
    occasions,
    people,
    week,
    loading,
    completedHabitIds,
    toggleHabit,
    toggleTodo,
  }
}
