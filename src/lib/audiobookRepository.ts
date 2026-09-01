import { supabase } from './supabase'
import type { Audiobook, AudiobookTrack } from '../types/audiobook'

const LOCAL_AUDIOBOOKS_KEY = 'daily_audiobooks_cache'

export function getLocalAudiobooks(): Audiobook[] {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIOBOOKS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalAudiobooks(list: Audiobook[]): void {
  try {
    localStorage.setItem(LOCAL_AUDIOBOOKS_KEY, JSON.stringify(list))
  } catch (err) {
    console.warn('[audiobookRepository] Lỗi lưu cache local:', err)
  }
}

/** Tải toàn bộ danh sách sách nói từ Supabase & Local Cache */
export async function loadAudiobooks(): Promise<Audiobook[]> {
  const localList = getLocalAudiobooks()

  if (!supabase) return localList

  try {
    const { data, error } = await supabase
      .from('media_items')
      .select('*')
      .eq('type', 'BOOK')
      .eq('book_format', 'LISTEN')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error || !data) return localList

    const remoteList: Audiobook[] = data.map((row: any) => {
      let tracks: AudiobookTrack[] = []
      let dilibUrl: string | undefined
      let readbookUrl: string | undefined
      let pdfUrl: string | undefined
      let totalDuration: number | undefined
      let durationFormatted: string | undefined
      let isDraft = row.status === 'DRAFT'

      if (row.notes) {
        try {
          const parsed = JSON.parse(row.notes)
          if (Array.isArray(parsed.tracks)) tracks = parsed.tracks
          if (parsed.dilibUrl) dilibUrl = parsed.dilibUrl
          if (parsed.readbookUrl) readbookUrl = parsed.readbookUrl
          if (parsed.pdfUrl) pdfUrl = parsed.pdfUrl
          if (parsed.totalDuration) totalDuration = parsed.totalDuration
          if (parsed.durationFormatted) durationFormatted = parsed.durationFormatted
          if (parsed.isDraft !== undefined) isDraft = Boolean(parsed.isDraft)
        } catch {
          // Ghi chú dạng text thông thường
        }
      }

      return {
        id: row.id,
        title: row.title || 'Sách nói không tên',
        author: row.author || 'Chưa rõ tác giả',
        genre: row.genre || 'Sách nói',
        cover: row.cover_url || '',
        description: row.description || '',
        tracks,
        totalDuration,
        durationFormatted,
        dilibUrl,
        hasPdf: Boolean(readbookUrl || pdfUrl),
        readbookUrl,
        pdfUrl,
        isDraft,
        status: isDraft ? 'DRAFT' : row.status || 'PLANNED',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    })

    // Gộp remote và local
    const mergedMap = new Map<string, Audiobook>()
    localList.forEach((b) => mergedMap.set(b.id, b))
    remoteList.forEach((b) => mergedMap.set(b.id, b))
    const merged = Array.from(mergedMap.values())

    saveLocalAudiobooks(merged)
    return merged
  } catch (err) {
    console.warn('[audiobookRepository] Lỗi tải từ Supabase, dùng local:', err)
    return localList
  }
}

/** Lưu một cuốn sách nói mới hoặc cập nhật sách nói hiện có */
export async function saveAudiobook(book: Audiobook): Promise<Audiobook> {
  const localList = getLocalAudiobooks()
  const existingIdx = localList.findIndex((b) => b.id === book.id || (b.title === book.title && b.author === book.author))

  let savedBook = { ...book }
  if (existingIdx >= 0) {
    localList[existingIdx] = { ...localList[existingIdx], ...savedBook, updated_at: new Date().toISOString() }
    savedBook = localList[existingIdx]
  } else {
    localList.unshift(savedBook)
  }
  saveLocalAudiobooks(localList)

  // Lưu vào Supabase media_items
  if (supabase) {
    try {
      const notesPayload = JSON.stringify({
        tracks: savedBook.tracks,
        totalDuration: savedBook.totalDuration,
        durationFormatted: savedBook.durationFormatted,
        dilibUrl: savedBook.dilibUrl,
        readbookUrl: savedBook.readbookUrl,
        pdfUrl: savedBook.pdfUrl,
        isDraft: savedBook.isDraft ?? false,
      })

      const payload = {
        title: savedBook.title,
        author: savedBook.author,
        genre: savedBook.genre,
        type: 'BOOK',
        book_format: 'LISTEN',
        cover_url: savedBook.cover,
        description: savedBook.description,
        notes: notesPayload,
        url: savedBook.tracks[0]?.url || savedBook.dilibUrl || null,
        status: savedBook.isDraft ? 'DRAFT' : savedBook.status || 'PLANNED',
        updated_at: new Date().toISOString(),
      }

      if (savedBook.id && !savedBook.id.startsWith('ab-local-')) {
        await supabase.from('media_items').upsert({ id: savedBook.id, ...payload })
      } else {
        const { data } = await supabase.from('media_items').insert(payload).select('id').single()
        if (data?.id) {
          savedBook.id = data.id
          saveLocalAudiobooks(localList.map((b) => (b.id === book.id ? savedBook : b)))
        }
      }
    } catch (err) {
      console.warn('[audiobookRepository] Lỗi ghi Supabase:', err)
    }
  }

  return savedBook
}

/** Duyệt một cuốn sách bản nháp vào danh sách sách chính thức */
export async function approveDraftAudiobook(bookId: string): Promise<void> {
  const localList = getLocalAudiobooks().map((b) => {
    if (b.id === bookId) {
      return { ...b, isDraft: false, status: 'PLANNED' as const, updated_at: new Date().toISOString() }
    }
    return b
  })
  saveLocalAudiobooks(localList)

  if (supabase) {
    try {
      const target = localList.find((b) => b.id === bookId)
      const notesPayload = target
        ? JSON.stringify({
            tracks: target.tracks,
            totalDuration: target.totalDuration,
            durationFormatted: target.durationFormatted,
            dilibUrl: target.dilibUrl,
            readbookUrl: target.readbookUrl,
            pdfUrl: target.pdfUrl,
            isDraft: false,
          })
        : undefined

      const updateData: any = {
        status: 'PLANNED',
        updated_at: new Date().toISOString(),
      }
      if (notesPayload) updateData.notes = notesPayload

      await supabase.from('media_items').update(updateData).eq('id', bookId)
    } catch (err) {
      console.warn('[audiobookRepository] Lỗi duyệt bản nháp:', err)
    }
  }
}

/** Duyệt tất cả bản nháp vào danh sách sách chính thức */
export async function approveAllDraftAudiobooks(): Promise<number> {
  const localList = getLocalAudiobooks()
  const draftIds = localList.filter((b) => b.isDraft || b.status === 'DRAFT').map((b) => b.id)
  if (draftIds.length === 0) return 0

  const updatedList = localList.map((b) => {
    if (b.isDraft || b.status === 'DRAFT') {
      return { ...b, isDraft: false, status: 'PLANNED' as const, updated_at: new Date().toISOString() }
    }
    return b
  })
  saveLocalAudiobooks(updatedList)

  if (supabase) {
    try {
      await supabase
        .from('media_items')
        .update({ status: 'PLANNED', updated_at: new Date().toISOString() })
        .in('id', draftIds)
    } catch (err) {
      console.warn('[audiobookRepository] Lỗi duyệt tất cả bản nháp:', err)
    }
  }

  return draftIds.length
}

/** Xóa sách nói */
export async function deleteAudiobook(bookId: string): Promise<void> {
  const localList = getLocalAudiobooks().filter((b) => b.id !== bookId)
  saveLocalAudiobooks(localList)

  if (supabase) {
    try {
      await supabase.from('media_items').update({ deleted_at: new Date().toISOString() }).eq('id', bookId)
    } catch (err) {
      console.warn('[audiobookRepository] Lỗi xóa Supabase:', err)
    }
  }
}

/**
 * Quét toàn bộ thư viện sách nói và tự động xóa các cuốn sách không có âm thanh / link rác (dẫn tới trang HTML)
 */
export async function cleanUnplayableAudiobooks(): Promise<{ removedCount: number; remaining: Audiobook[] }> {
  const currentList = await loadAudiobooks()
  const toKeep: Audiobook[] = []
  const toRemoveIds: string[] = []

  for (const book of currentList) {
    const tracks = book.tracks || []
    // Kiểm tra xem có track nào là audio thật không (không phải HTML page URL, không rỗng)
    const validTracks = tracks.filter((t) => {
      const u = (t.url || '').trim().toLowerCase()
      if (!u.startsWith('http')) return false
      // Nếu URL dẫn tới trang web HTML (vd: dilib.vn/cong-vien-trung-tam/ hoặc .html) và không có đuôi/param audio
      if (
        (u.includes('dilib.vn') || u.includes('thuviensach.vn') || u.includes('dtv-ebook.com.vn')) &&
        !u.includes('.mp3') &&
        !u.includes('.m4a') &&
        !u.includes('.aac') &&
        !u.includes('.wav') &&
        !u.includes('.ogg') &&
        !u.includes('audio') &&
        !u.includes('stream')
      ) {
        return false
      }
      return true
    })

    if (validTracks.length === 0) {
      toRemoveIds.push(book.id)
    } else {
      toKeep.push({ ...book, tracks: validTracks })
    }
  }

  if (toRemoveIds.length > 0) {
    saveLocalAudiobooks(toKeep)
    if (supabase) {
      try {
        await supabase
          .from('media_items')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toRemoveIds)
      } catch (err) {
        console.warn('[audiobookRepository] Lỗi xóa sách lỗi trên Supabase:', err)
      }
    }
  }

  return { removedCount: toRemoveIds.length, remaining: toKeep }
}

