export type Tab = 'home' | 'habit' | 'daily' | 'tasks' | 'people' | 'library' | 'nutrition' | 'money' | 'calendar'

export type NutritionLog = {
  id: string
  meal_slot: 'MORNING' | 'LUNCH' | 'AFTERNOON' | 'EVENING'
  food_name: string
  price: number
  log_date: string
  /** Giờ ăn 'HH:MM'; null với bản ghi cũ. */
  log_time?: string | null
  created_at?: string
}

/** Một giấc ngủ đã ghi; giờ lưu dạng 'HH:MM'. */
export type SleepLog = {
  id: string
  sleep_start: string
  sleep_end: string
  duration_minutes: number
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
  /** Tên thể loại, khớp với task_categories.name. Null = chưa phân loại. */
  category?: string | null
  /** Mục tiêu mà việc này phục vụ. Null = việc lẻ. */
  goal_id?: string | null
}

/** Mục tiêu: tầng trên của công việc. Tiến độ tính từ số task đã xong. */
export type Goal = {
  id: string
  name: string
  note?: string | null
  due_date?: string | null
  created_at: string
  deleted_at?: string | null
}

export type TaskCategory = {
  id: string
  name: string
  created_at: string
  deleted_at?: string | null
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
  /** Tên người đã chia sẻ sách này cho mình; null nếu tự thêm. */
  shared_by?: string | null
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
export type Entry = {
  id: string
  content: string
  entry_date: string
  created_at: string
  entry_type: DailyType
  /** Giờ viết 'HH:MM'; null với bài cũ trước migration daily_entry_time. */
  entry_time?: string | null
  is_favorite?: boolean
  /** Ảnh đính kèm (bucket daily-photos); image_path để xoá file khi gỡ ảnh. */
  image_url?: string | null
  image_path?: string | null
}
/** Người được mời xem sự kiện chung, định danh bằng email đăng nhập. */
export type SharedPartner = { id: string; partner_email: string; created_at?: string }

/** Sự kiện trong nhật ký chung; cả hai bên đều thấy, chỉ chủ mới sửa được. */
export type SharedEvent = {
  id: string
  owner_id: string
  /** Người trong danh bạ mà kỷ niệm này thuộc về. */
  person_id?: string | null
  title: string
  note?: string | null
  event_date: string
  /** 'HH:MM'; rỗng = cả ngày. */
  event_time?: string | null
  location?: string | null
  image_url?: string | null
  image_path?: string | null
  is_favorite?: boolean
  created_at?: string
}

/** Nhóm quan hệ, dùng làm chip trên thẻ người. */
export type PersonGroup = 'FAMILY' | 'FRIEND' | 'COLLEAGUE' | 'OTHER'

export type Person = {
  id: string
  name: string
  group_key?: PersonGroup | null
  avatar_url?: string | null
  notes?: string | null
  /** true = người yêu chung; chỉ người này có tab "Sự kiện chung". */
  is_partner?: boolean
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

/** Ví tiền: tiền mặt hoặc tài khoản ngân hàng nhập tay (không liên kết ngân hàng thật). */
export type Account = {
  id: string
  name: string
  kind: 'CASH' | 'BANK'
  bank_name?: string | null
  account_number?: string | null
  opening_balance: number
  created_at?: string
}

/** Một khoản thu (IN) hoặc chi (OUT); `amount` luôn dương. */
export type MoneyTransaction = {
  id: string
  account_id: string
  direction: 'IN' | 'OUT'
  amount: number
  category: string
  note?: string | null
  /** Khoản này chi cho/nhận từ ai. Null = không gắn với người nào. */
  person_id?: string | null
  log_date: string
  log_time?: string | null
  created_at?: string
}

