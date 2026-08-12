export type Tab = 'home' | 'habit' | 'daily' | 'tasks' | 'people' | 'library' | 'playtogether' | 'nutrition'

export type NutritionLog = {
  id: string
  meal_slot: 'MORNING' | 'LUNCH' | 'AFTERNOON' | 'EVENING'
  food_name: string
  price: number
  log_date: string
  created_at?: string
}

export type Habit = {
  id: string
  name: string
  is_active: boolean
  category_id: string | null
  tracking_type?: 'CHECK' | 'COUNT'
  habit_type?: 'GOOD' | 'BAD'
  routine?: 'MORNING' | 'AFTERNOON' | 'EVENING'
  daily_target?: number
}

export type HabitCategory = { id: string; name: string; color: string }
export type HabitLog = { habit_id: string; date: string; completed: boolean; value?: number }
export type TaskDifficulty = 'EASY' | 'NORMAL' | 'HARD'
export type TaskPriority = 'NORMAL' | 'URGENT'

export type Todo = {
  id: string
  title: string
  completed: boolean
  created_at: string
  completed_at?: string | null
  due_date?: string | null
  /** Giờ hạn chót 'HH:MM'. Null/rỗng = cả ngày. */
  due_time?: string | null
  difficulty?: TaskDifficulty
  priority?: TaskPriority
  postpone_count?: number
  postpone_minutes?: number
}

export type TaskPostpone = {
  id: string
  todo_id: string
  minutes: number
  reason?: string | null
  prev_due_date?: string | null
  prev_due_time?: string | null
  new_due_date?: string | null
  new_due_time?: string | null
  created_at: string
}
export type Idea = { id: string; title: string; content: string; created_at: string }
export type BookFormat = 'READ' | 'LISTEN'

export type Media = {
  id: string
  type: 'BOOK' | 'MOVIE' | 'YOUTUBE' | 'MUSIC' | 'MANGA'
  name: string
  description: string | null
  channel?: string | null
  artist?: string | null
  author?: string | null
  actor?: string | null
  genre?: string | null
  music_genre?: string | null
  youtube_url?: string | null
  audio_url?: string | null
  current_chapter?: number | null
  start_date?: string | null
  end_date?: string | null
  log_date?: string | null
  log_time?: string | null
  created_at?: string | null
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
  is_favorite: boolean
  book_format?: BookFormat | null
  cover_url?: string | null
}

export type BookReadingLog = {
  id: string
  media_item_id: string
  log_date: string
  page?: number | null
  listen_hours: number
  listen_minutes: number
  note?: string | null
  created_at?: string
}
export type BookSourceFormat = 'PDF' | 'EPUB'

/** Một cuốn sách đã nhập từ file PDF/EPUB, gắn 1:1 với một media_items type BOOK. */
export type BookDocument = {
  id: string
  media_item_id: string
  source_format: BookSourceFormat
  source_filename: string | null
  total_chars: number
  page_count: number | null
  est_pages: number
  chapter_count: number
  last_chapter_idx: number
  last_scroll_ratio: number
  last_char_offset: number
  percent: number
  last_read_at?: string | null
}

/** Mục lục: chương không kèm nội dung, để mở sách không phải tải cả cuốn. */
export type BookChapterMeta = {
  id: string
  idx: number
  title: string
  char_count: number
  char_offset: number
}

export type MovieGenre = { id: string; name: string }
export type MovieActor = { id: string; name: string }
export type BookAuthor = { id: string; name: string }
export type YouTubeChannel = { id: string; name: string }
export type MusicArtist = { id: string; name: string }
export type MusicGenre = { id: string; name: string }

export type DailyType = 'FEELING' | 'NEW_THING' | 'SAD_THING' | 'SMALL_WIN'
export type Entry = { id: string; content: string; entry_date: string; created_at: string; entry_type: DailyType }
/** Nhóm quan hệ, dùng làm chip trên thẻ người. */
export type PersonGroup = 'FAMILY' | 'FRIEND' | 'COLLEAGUE' | 'OTHER'

export type Person = {
  id: string
  name: string
  group_key?: PersonGroup | null
  avatar_url?: string | null
  notes?: string | null
  created_at?: string
}

/** Ảnh đính kèm nhật ký của một người trong một ngày. */
export type PersonDailyPhoto = {
  id: string
  person_id: string
  log_date: string
  url: string
  storage_path?: string | null
  created_at?: string
}
export type PersonInterest = { id: string; person_id: string; label: string; created_at?: string }
export type PersonDailyLog = { id: string; person_id: string; log_date: string; content: string; updated_at?: string; created_at?: string }

export type OccasionKind = 'BIRTHDAY' | 'ANNIVERSARY'

/** Lịch dùng để lặp lại dịp hằng năm. */
export type OccasionCalendar = 'SOLAR' | 'LUNAR'

/** Dịp đáng nhớ. `person_id` null = dịp không gắn với ai. */
export type PersonOccasion = {
  id: string
  person_id: string | null
  kind: OccasionKind
  title: string
  occasion_date: string
  is_yearly: boolean
  /** Mặc định 'SOLAR'. 'LUNAR' = lặp theo ngày âm của `occasion_date`. */
  calendar?: OccasionCalendar
  created_at?: string
}

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
