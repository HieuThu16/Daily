export type Tab = 'home' | 'habit' | 'daily' | 'tasks' | 'library'
export type Habit = { id: string; name: string; is_active: boolean; category_id: string | null; tracking_type?: 'CHECK' | 'COUNT'; daily_target?: number }
export type HabitCategory = { id: string; name: string; color: string }
export type HabitLog = { habit_id: string; date: string; completed: boolean; value?: number }
export type Todo = {
  id: string
  title: string
  completed: boolean
  created_at: string
  completed_at?: string | null
  due_date?: string | null
}
export type Idea = { id: string; title: string; content: string; created_at: string }
export type Media = {
  id: string
  type: 'BOOK' | 'MOVIE' | 'YOUTUBE' | 'MUSIC'
  name: string
  description: string | null
  channel?: string | null
  artist?: string | null
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
  is_favorite: boolean
}
export type DailyType = 'FEELING' | 'NEW_THING' | 'SAD_THING' | 'SMALL_WIN'
export type Entry = { id: string; content: string; entry_date: string; created_at: string; entry_type: DailyType }
