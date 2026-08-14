import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { weekDays } from '../../lib/homeProgress'
import { parseLocalDate } from '../../lib/occasions'
import { shiftDate, sleepMinutesOn } from '../../lib/sleep'
import type { Entry, Habit, HabitLog, Media, NutritionLog, Person, PersonOccasion, SleepLog, Todo } from '../../types'

/**
 * Nạp toàn bộ dữ liệu trang Home trong một lượt.
 * Bảng nào chưa có trong database (ví dụ person_occasions khi chưa chạy migration)
 * sẽ trả data null và được coi như danh sách rỗng, không làm hỏng cả trang.
 */
export function useHomeData(dateKey: string = localDate()) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [todayLogs, setTodayLogs] = useState<HabitLog[]>([])
  const [weekLogs, setWeekLogs] = useState<HabitLog[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [todosDoneToday, setTodosDoneToday] = useState<Todo[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [weekEntries, setWeekEntries] = useState<Entry[]>([])
  const [meals, setMeals] = useState<NutritionLog[]>([])
  const [sleep, setSleep] = useState<SleepLog[]>([])
  const [weekSleep, setWeekSleep] = useState<SleepLog[]>([])
  const [weekMeals, setWeekMeals] = useState<NutritionLog[]>([])
  const [weekTodosDone, setWeekTodosDone] = useState<Todo[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [occasions, setOccasions] = useState<PersonOccasion[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  const week = useMemo(() => weekDays(parseLocalDate(dateKey)), [dateKey])

  useEffect(() => {
    ;(async () => {
      if (!supabase) {
        setLoading(false)
        return
      }
      setLoading(true)
      const today = dateKey
      const after = new Date(parseLocalDate(dateKey).getTime() + 86_400_000)
      const tomorrow = `${after.getFullYear()}-${String(after.getMonth() + 1).padStart(2, '0')}-${String(after.getDate()).padStart(2, '0')}`

      const [h, tl, wl, t, td, e, m, o, p, we, nt, nw, wt, sl, sw] = await Promise.all([
        supabase.from('habits').select('*').eq('is_active', true).is('deleted_at', null),
        supabase.from('habit_logs').select('*').eq('date', today),
        supabase.from('habit_logs').select('*').gte('date', week[0].key).lte('date', week[6].key),
        supabase.from('todos').select('*').eq('completed', false).is('deleted_at', null).order('created_at'),
        supabase.from('todos').select('*').eq('completed', true).gte('completed_at', today).lt('completed_at', tomorrow).is('deleted_at', null),
        supabase.from('daily_entries').select('*').eq('entry_date', today).is('deleted_at', null),
        supabase.from('media_items').select('*').eq('status', 'IN_PROGRESS').is('deleted_at', null).limit(5),
        supabase.from('person_occasions').select('*').is('deleted_at', null),
        supabase.from('people').select('*').is('deleted_at', null),
        supabase.from('daily_entries').select('*').gte('entry_date', week[0].key).lte('entry_date', week[6].key).is('deleted_at', null),
        supabase.from('nutrition_logs').select('*').eq('log_date', today).is('deleted_at', null),
        supabase.from('nutrition_logs').select('*').gte('log_date', week[0].key).lte('log_date', week[6].key).is('deleted_at', null),
        supabase.from('todos').select('*').eq('completed', true).gte('completed_at', week[0].key).is('deleted_at', null),
        supabase.from('sleep_logs').select('*').gte('log_date', shiftDate(today, -1)).lte('log_date', today).is('deleted_at', null),
        supabase.from('sleep_logs').select('*').gte('log_date', week[0].key).lte('log_date', week[6].key).is('deleted_at', null),
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
      setWeekEntries((we.data ?? []) as Entry[])
      setMeals((nt.data ?? []) as NutritionLog[])
      setWeekMeals((nw.data ?? []) as NutritionLog[])
      setWeekTodosDone((wt.data ?? []) as Todo[])
      // Chỉ giữ phần giờ rơi vào `today`; start/end vẫn là của cả phiên ngủ.
      setSleep(
        ((sl.data ?? []) as SleepLog[])
          .map((log) => ({ ...log, duration_minutes: sleepMinutesOn(log, today) }))
          .filter((log) => log.duration_minutes > 0),
      )
      setWeekSleep((sw.data ?? []) as SleepLog[])
      setLoading(false)
    })()
  }, [week, dateKey])

  return {
    habits,
    todayLogs,
    weekLogs,
    todos,
    todosDoneToday,
    entries,
    weekEntries,
    meals,
    weekMeals,
    sleep,
    weekSleep,
    weekTodosDone,
    media,
    occasions,
    people,
    week,
    loading,
  }
}
