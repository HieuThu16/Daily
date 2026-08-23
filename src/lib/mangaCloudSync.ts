import { supabase } from './supabase'
import { MangaReadingLog } from './mangaReadingLog'

/**
 * Đồng bộ hóa toàn bộ tương tác truyện tranh với Supabase.
 */

export interface MangaInteractionRow {
  id?: string
  user_id?: string | null
  manga_type: 'BL' | 'H_MANGA' | 'NGONTINH'
  slug: string
  title?: string | null
  cover_url?: string | null
  is_favorite?: boolean
  is_following?: boolean
  last_chapter?: number | null
  last_chapter_name?: string | null
  last_read_at?: string
}

// 1. Tải danh sách tương tác từ Supabase
export async function fetchRemoteMangaInteractions(type: 'BL' | 'H_MANGA' | 'NGONTINH'): Promise<MangaInteractionRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('manga_interactions')
      .select('*')
      .eq('manga_type', type)

    if (error || !data) return []
    return data as MangaInteractionRow[]
  } catch {
    return []
  }
}

// 2. Đồng bộ 1 bản ghi tương tác lên Supabase
export async function syncMangaInteraction(interaction: MangaInteractionRow): Promise<void> {
  if (!supabase) return
  try {
    const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    const userId = userData?.user?.id || null
    const rowId = `${interaction.manga_type}::${interaction.slug}`

    await supabase
      .from('manga_interactions')
      .upsert({
        id: rowId,
        user_id: userId,
        manga_type: interaction.manga_type,
        slug: interaction.slug,
        title: interaction.title ?? null,
        cover_url: interaction.cover_url ?? null,
        is_favorite: interaction.is_favorite ?? false,
        is_following: interaction.is_following ?? false,
        last_chapter: interaction.last_chapter ?? null,
        last_chapter_name: interaction.last_chapter_name ?? null,
        last_read_at: interaction.last_read_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
  } catch (err) {
    console.warn('[syncMangaInteraction] Lỗi lưu tương tác manga:', err)
  }
}

// 3. Đồng bộ nhật ký đọc manga
export async function syncMangaReadingLogToSupabase(log: MangaReadingLog): Promise<void> {
  if (!supabase) return
  try {
    const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    const userId = userData?.user?.id || null

    await supabase
      .from('manga_reading_logs')
      .upsert({
        id: log.id,
        user_id: userId,
        manga_type: log.mangaType || 'NGONTINH',
        manga_slug: log.mangaSlug,
        manga_title: log.mangaTitle,
        chapter_number: log.chapterNumber,
        chapter_name: log.chapterName || null,
        duration_minutes: log.durationMinutes || 1,
        log_date: log.log_date,
        log_time: log.log_time || null,
        status: log.status || 'READING',
      }, { onConflict: 'id' })
  } catch (err) {
    console.warn('[syncMangaReadingLog] Lỗi lưu log manga:', err)
  }
}

// 4. Đồng bộ truyện tự thêm (Custom Manga)
export async function syncCustomMangaToSupabase(item: {
  id: string
  manga_type: 'BL' | 'H_MANGA'
  slug: string
  title: string
  cover?: string
  author?: string
  description?: string
}): Promise<void> {
  if (!supabase) return
  try {
    const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    const userId = userData?.user?.id || null

    await supabase
      .from('custom_manga')
      .upsert({
        id: item.id,
        user_id: userId,
        manga_type: item.manga_type,
        slug: item.slug,
        title: item.title,
        cover: item.cover || null,
        author: item.author || null,
        description: item.description || null,
      }, { onConflict: 'id' })
  } catch (err) {
    console.warn('[syncCustomManga] Lỗi lưu custom manga:', err)
  }
}
