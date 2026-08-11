export type Tab = 'home' | 'habit' | 'daily' | 'tasks' | 'library' | 'playtogether'

export type Habit = {
  id: string
  name: string
  is_active: boolean
  category_id: string | null
  tracking_type?: 'CHECK' | 'COUNT'
  habit_type?: 'GOOD' | 'BAD'
  daily_target?: number
}

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
  author?: string | null
  actor?: string | null
  genre?: string | null
  log_date?: string | null
  log_time?: string | null
  created_at?: string | null
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
  is_favorite: boolean
}
export type MovieGenre = { id: string; name: string }
export type MovieActor = { id: string; name: string }
export type BookAuthor = { id: string; name: string }
export type YouTubeChannel = { id: string; name: string }
export type MusicArtist = { id: string; name: string }

export type DailyType = 'FEELING' | 'NEW_THING' | 'SAD_THING' | 'SMALL_WIN'
export type Entry = { id: string; content: string; entry_date: string; created_at: string; entry_type: DailyType }

export type PlayTogetherAccount = {
  id: string
  name: string
  created_at?: string
}

export type PlayTogetherLog = {
  id: string
  account_name: string
  log_date: string
  time_slot: string
  coupons: number
  gems: number
  cards: number
  created_at?: string
}
