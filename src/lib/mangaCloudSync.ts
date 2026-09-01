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
    const nowIso = new Date().toISOString()
    const today = new Date().toLocaleDateString('sv-SE')
    const nowTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`

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
        last_read_at: interaction.last_read_at ?? nowIso,
        updated_at: nowIso,
      }, { onConflict: 'id' })

    if (interaction.last_chapter) {
      const mediaType = interaction.manga_type === 'H_MANGA' ? 'STORY' : 'MANGA'
      const progressGenre = interaction.manga_type === 'H_MANGA' ? 'H_PROGRESS' : interaction.manga_type
      const { data: existing } = await supabase
        .from('media_items')
        .select('id, description')
        .eq('channel', interaction.slug)
        .eq('genre', progressGenre)
        .limit(1)

      const payload = {
        user_id: userId,
        type: mediaType,
        genre: progressGenre,
        name: interaction.title || interaction.slug,
        channel: interaction.slug,
        current_chapter: interaction.last_chapter,
        status: 'IN_PROGRESS',
        log_date: today,
        log_time: nowTime,
        updated_at: nowIso,
        ...(interaction.cover_url ? { cover_url: interaction.cover_url } : {}),
      }

      if (existing && existing.length > 0) {
        await supabase.from('media_items').update(payload).eq('id', existing[0].id)
      } else {
        await supabase.from('media_items').insert(payload)
      }
    }
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
    const nowIso = new Date().toISOString()

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

    // Đồng bộ sang bảng media_items để kích hoạt Realtime cho tab Xem chung (sử dụng genre H_PROGRESS / BL / NGONTINH để không ghi đè truyện gốc)
    const mediaType = log.mangaType === 'H_MANGA' ? 'STORY' : 'MANGA'
    const progressGenre = log.mangaType === 'H_MANGA' ? 'H_PROGRESS' : log.mangaType
    const { data: existing } = await supabase
      .from('media_items')
      .select('id, description')
      .eq('channel', log.mangaSlug)
      .eq('genre', progressGenre)
      .limit(1)

    const userEmail = userData?.user?.email?.toLowerCase() || ''
    const isKimY = userEmail.includes('kimy') || userEmail.includes('nguyenkimy') || userEmail.includes('ý')
    const userName = isKimY ? 'Kim Ý' : 'Hiếu'

    const payload = {
      user_id: userId,
      type: mediaType,
      genre: progressGenre,
      name: log.mangaTitle || log.mangaSlug,
      channel: log.mangaSlug,
      description: `Đọc bởi ${userName}`,
      current_chapter: log.chapterNumber,
      status: log.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      log_date: log.log_date,
      log_time: log.log_time,
      updated_at: nowIso,
    }

    if (existing && existing.length > 0) {
      await supabase.from('media_items').update(payload).eq('id', existing[0].id)
    } else {
      await supabase.from('media_items').insert(payload)
    }
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
