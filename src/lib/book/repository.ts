import { supabase } from '../supabase'
import { localDate } from '../date'
import type { BookChapterMeta, BookDocument, BookReadingLog } from '../../types'
import { splitLongChapters, withOffsets } from './chapters'
import type { RawBook } from './types'

export const CHARS_PER_PAGE = 1800
const CHAPTER_INSERT_BATCH = 20

function client() {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  return supabase
}

/** Số trang ước tính tại một vị trí trong sách. */
export function estimatePage(charOffset: number, totalChars: number, pageCount: number | null): number {
  if (pageCount && totalChars > 0) {
    return Math.max(1, Math.min(pageCount, Math.round((charOffset / totalChars) * pageCount)))
  }
  return Math.max(1, Math.round(charOffset / CHARS_PER_PAGE) + 1)
}

/** Lưu sách đã bóc tách. Xoá tài liệu cũ của cùng media item trước khi ghi bản mới. */
export async function saveBook(mediaItemId: string, book: RawBook): Promise<BookDocument> {
  const db = client()
  const chapters = withOffsets(splitLongChapters(book.chapters))
  const totalChars = chapters.reduce((sum, chapter) => sum + chapter.charCount, 0)
  const estPages = book.pageCount ?? Math.max(1, Math.round(totalChars / CHARS_PER_PAGE))

  await db.from('book_documents').delete().eq('media_item_id', mediaItemId)

  const { data: document, error } = await db
    .from('book_documents')
    .insert({
      media_item_id: mediaItemId,
      source_format: book.sourceFormat,
      source_filename: book.sourceFilename,
      total_chars: totalChars,
      page_count: book.pageCount,
      est_pages: estPages,
      chapter_count: chapters.length,
    })
    .select()
    .single()

  if (error || !document) throw new Error(error?.message ?? 'Không lưu được sách.')

  const rows = chapters.map((chapter) => ({
    document_id: document.id,
    idx: chapter.idx,
    title: chapter.title,
    content: chapter.content,
    char_count: chapter.charCount,
    char_offset: chapter.charOffset,
  }))

  for (let start = 0; start < rows.length; start += CHAPTER_INSERT_BATCH) {
    const batch = rows.slice(start, start + CHAPTER_INSERT_BATCH)
    const { error: chapterError } = await db.from('book_chapters').insert(batch)
    if (chapterError) {
      // Dọn tài liệu dở dang; cascade xoá luôn các chương đã ghi.
      await db.from('book_documents').delete().eq('id', document.id)
      throw new Error(chapterError.message)
    }
  }

  return document as BookDocument
}

export async function loadBookDocument(mediaItemId: string): Promise<BookDocument | null> {
  const { data } = await client().from('book_documents').select('*').eq('media_item_id', mediaItemId).maybeSingle()
  return (data as BookDocument | null) ?? null
}

export async function loadChapterList(documentId: string): Promise<BookChapterMeta[]> {
  const { data, error } = await client()
    .from('book_chapters')
    .select('id, idx, title, char_count, char_offset')
    .eq('document_id', documentId)
    .order('idx', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as BookChapterMeta[]
}

export async function loadChapterContent(chapterId: string): Promise<string> {
  const { data, error } = await client().from('book_chapters').select('content').eq('id', chapterId).single()
  if (error || !data) throw new Error(error?.message ?? 'Không tải được nội dung chương.')
  return (data as { content: string }).content
}

export type ProgressPatch = {
  last_chapter_idx: number
  last_scroll_ratio: number
  last_char_offset: number
  percent: number
}

export async function saveProgress(documentId: string, patch: ProgressPatch): Promise<void> {
  const now = new Date().toISOString()
  await client()
    .from('book_documents')
    .update({ ...patch, last_read_at: now, updated_at: now })
    .eq('id', documentId)
}

/** Danh sách media item đã có sách nhập, để Library biết thẻ nào hiện nút Đọc. */
export async function loadImportedMediaItemIds(): Promise<Set<string>> {
  if (!supabase) return new Set()
  const { data } = await supabase.from('book_documents').select('media_item_id')
  return new Set(((data ?? []) as { media_item_id: string }[]).map((row) => row.media_item_id))
}

export type ReadingLogInput = {
  media_item_id: string
  log_date: string
  page?: number | null
  listen_hours?: number
  listen_minutes?: number
  note?: string | null
}

/**
 * Ghi nhật ký đọc cho một ngày: có dòng thì update, chưa có thì insert.
 * Không dùng upsert vì bảng không có unique constraint trên (media_item_id, log_date),
 * và thêm constraint sẽ đụng với các dòng đã soft-delete.
 */
export async function saveReadingLogEntry(input: ReadingLogInput): Promise<BookReadingLog | null> {
  const db = client()
  const payload = {
    media_item_id: input.media_item_id,
    log_date: input.log_date,
    page: input.page ?? null,
    listen_hours: input.listen_hours ?? 0,
    listen_minutes: input.listen_minutes ?? 0,
    note: input.note ?? null,
  }

  const { data: existing } = await db
    .from('book_reading_logs')
    .select('id')
    .eq('media_item_id', input.media_item_id)
    .eq('log_date', input.log_date)
    .is('deleted_at', null)
    .maybeSingle()

  const query = existing
    ? db.from('book_reading_logs').update(payload).eq('id', (existing as { id: string }).id)
    : db.from('book_reading_logs').insert(payload)

  const { data, error } = await query.select().single()
  if (error || !data) return null
  return data as BookReadingLog
}

/** Ghi trang đã đọc của hôm nay. Chỉ tăng, không bao giờ ghi đè bằng số nhỏ hơn. */
export async function reportPagesRead(mediaItemId: string, page: number): Promise<void> {
  const db = client()
  const today = localDate()

  const { data: existing } = await db
    .from('book_reading_logs')
    .select('id, page')
    .eq('media_item_id', mediaItemId)
    .eq('log_date', today)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    const row = existing as { id: string; page: number | null }
    if ((row.page ?? 0) >= page) return
    await db.from('book_reading_logs').update({ page }).eq('id', row.id)
    return
  }

  await db.from('book_reading_logs').insert({ media_item_id: mediaItemId, log_date: today, page })
}
