import { supabase } from './supabase'
import { localDate } from './date'

/** Mọi bảng dữ liệu của người dùng. Thêm bảng mới thì nhớ thêm vào đây. */
export const BACKUP_TABLES = [
  'accounts',
  'transactions',
  'habits',
  'habit_categories',
  'habit_logs',
  'todos',
  'task_postpones',
  'ideas',
  'daily_entries',
  'people',
  'person_daily_logs',
  'person_daily_photos',
  'person_interests',
  'person_occasions',
  'media_items',
  'book_reading_logs',
  'book_documents',
  'book_authors',
  'movie_actors',
  'movie_genres',
  'music_artists',
  'youtube_channels',
  'nutrition_logs',
  'sleep_logs',
] as const

export type BackupFile = {
  exported_at: string
  tables: Record<string, unknown[]>
  failed: string[]
}

/**
 * Tải hết dữ liệu về thành một object JSON.
 * Bảng nào lỗi (chưa chạy migration) thì ghi vào `failed` thay vì làm hỏng cả bản sao lưu.
 */
export async function collectBackup(): Promise<BackupFile> {
  if (!supabase) throw new Error('Chưa cấu hình Supabase')
  const tables: Record<string, unknown[]> = {}
  const failed: string[] = []

  await Promise.all(
    BACKUP_TABLES.map(async (table) => {
      const { data, error } = await supabase!.from(table).select('*')
      if (error) failed.push(table)
      else tables[table] = data ?? []
    }),
  )

  return { exported_at: new Date().toISOString(), tables, failed }
}

/** Tạo file .json và bấm tải xuống. */
export function downloadJson(content: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportBackup() {
  const backup = await collectBackup()
  downloadJson(backup, `my-space-backup-${localDate()}.json`)
  return backup
}
