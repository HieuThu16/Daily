import { useEffect, useState } from 'react'
import { CheckCircle2, Heart, Sparkles, Trash2 } from 'lucide-react'
import type { Media } from '../../types'
import { BookCover } from './BookCover'
import { getBookReadingSessionLogs, getLastReadBook } from '../../lib/bookReadingLog'

type BookGridProps = {
  items: Media[]
  onOpen: (item: Media) => void
  onToggleFavorite: (item: Media) => void
  onApproveDraft?: (id: string) => void
  onDeleteDraft?: (id: string) => void
}

/** Nhãn chữ của trạng thái, cặp [đọc, nghe] theo `book_format`. */
const STATUS_LABEL: Record<Media['status'], [string, string]> = {
  PLANNED: ['sẽ đọc', 'sẽ nghe'],
  IN_PROGRESS: ['đang đọc', 'đang nghe'],
  COMPLETED: ['đã đọc', 'đã nghe'],
  DRAFT: ['bản nháp', 'bản nháp'],
}

import { supabase } from '../../lib/supabase'
import { estimatePage } from '../../lib/book/repository'

interface BookProgressInfo {
  percent: number
  page?: number
  totalPages?: number
}

function useBookProgressMap(): Map<string, BookProgressInfo> {
  const [progressMap, setProgressMap] = useState<Map<string, BookProgressInfo>>(new Map())

  useEffect(() => {
    let cancelled = false

    const loadProgress = async () => {
      const map = new Map<string, BookProgressInfo>()

      try {
        // 1. Nạp từ database bảng book_documents (tiến độ đọc thực tế được lưu khi đọc sách)
        if (supabase) {
          const { data: docs } = await supabase
            .from('book_documents')
            .select('media_item_id, percent, page_count, est_pages, last_char_offset, total_chars, last_chapter_idx')

          if (docs && docs.length > 0) {
            for (const doc of docs) {
              if (!doc.media_item_id) continue
              const totalPages = doc.page_count || doc.est_pages || undefined
              let page: number | undefined
              if (doc.last_char_offset && doc.total_chars > 0) {
                page = estimatePage(doc.last_char_offset, doc.total_chars, doc.page_count)
              }
              const pct = typeof doc.percent === 'number' 
                ? Math.round(doc.percent) 
                : (totalPages && page ? Math.round((page / totalPages) * 100) : 0)

              map.set(doc.media_item_id, {
                percent: Math.min(100, Math.max(0, pct)),
                page,
                totalPages,
              })
            }
          }

          // Nạp thêm từ book_reading_logs mới nhất
          const { data: readingLogs } = await supabase
            .from('book_reading_logs')
            .select('media_item_id, page')
            .is('deleted_at', null)
            .order('log_date', { ascending: false })

          if (readingLogs) {
            for (const log of readingLogs) {
              if (!log.media_item_id || !log.page) continue
              const existing = map.get(log.media_item_id)
              if (!existing) {
                map.set(log.media_item_id, {
                  percent: 0,
                  page: log.page,
                })
              } else if (!existing.page || log.page > existing.page) {
                existing.page = log.page
                if (existing.totalPages && existing.totalPages > 0) {
                  existing.percent = Math.min(100, Math.max(existing.percent, Math.round((log.page / existing.totalPages) * 100)))
                }
              }
            }
          }
        }

        // 2. Nạp bổ sung từ các phiên đọc gần đây trong local storage (nếu có cập nhật mới chưa sync)
        const logs = getBookReadingSessionLogs()
        for (const log of logs) {
          if (log.mediaItemId) {
            const existing = map.get(log.mediaItemId)
            const highestPage = Math.max(existing?.page || 0, log.endPage || 0, log.startPage || 0)
            const totalEst = existing?.totalPages || (highestPage > 100 ? highestPage + 50 : undefined)
            const pct = totalEst ? Math.min(100, Math.round((highestPage / totalEst) * 100)) : (existing?.percent || 0)
            map.set(log.mediaItemId, {
              percent: existing?.percent !== undefined && existing.percent > 0 ? existing.percent : pct,
              page: highestPage,
              totalPages: existing?.totalPages || totalEst,
            })
          }
        }

        // 3. Nạp từ cuốn sách đang đọc gần nhất
        const last = getLastReadBook()
        if (last && last.mediaItemId) {
          const existing = map.get(last.mediaItemId)
          map.set(last.mediaItemId, {
            percent: Math.min(100, Math.max(0, Math.round(last.percent ?? existing?.percent ?? 0))),
            page: last.page ?? existing?.page,
            totalPages: last.pageCount ?? existing?.totalPages,
          })
        }
      } catch (err) {
        console.warn('Lỗi khi tải tiến độ đọc sách:', err)
      }

      if (!cancelled) {
        setProgressMap(map)
      }
    }

    void loadProgress()
    return () => {
      cancelled = true
    }
  }, [])

  return progressMap
}

export function BookGrid({ items, onOpen, onToggleFavorite, onApproveDraft, onDeleteDraft }: BookGridProps) {
  const progressMap = useBookProgressMap()

  return (
    <ul className="book-grid">
      {items.map((item) => {
        const statusLabel = STATUS_LABEL[item.status][item.book_format === 'LISTEN' ? 1 : 0]
        const favoriteLabel = `${item.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'} ${item.name}`

        // Tính toán tiến độ đọc từ database
        const isInProgress = item.status === 'IN_PROGRESS'
        const isCompleted = item.status === 'COMPLETED'
        const prog = progressMap.get(item.id)

        // Tính % từ dữ liệu của item nếu có
        const itemPct = item.total_pages && item.total_pages > 0 && item.current_page
          ? Math.min(100, Math.round((item.current_page / item.total_pages) * 100))
          : (item.total_chapters && item.total_chapters > 0 && item.current_chapter
              ? Math.min(100, Math.round((item.current_chapter / item.total_chapters) * 100))
              : 0)

        let percent = isCompleted 
          ? 100 
          : (prog?.percent !== undefined && prog.percent > 0 ? prog.percent : itemPct)
        percent = Math.min(100, Math.max(0, Math.round(percent)))

        const pageDisplay = prog?.page 
          ? (prog.totalPages ? `${prog.page}/${prog.totalPages}` : `${prog.page}`)
          : (item.current_page 
              ? (item.total_pages ? `${item.current_page}/${item.total_pages}` : `${item.current_page}`)
              : (item.current_chapter ? `${item.current_chapter}` : null))

        return (
          <li key={item.id} className="book-grid-cell">
            {/* Nút bìa và nút tim là anh em, không lồng nhau */}
            <button
              type="button"
              className="book-grid-cover"
              aria-label={`Xem chi tiết ${item.name}, ${statusLabel}`}
              onClick={() => onOpen(item)}
              style={{ position: 'relative' }}
            >
              {/* alt rỗng vì tên sách đã nằm trong aria-label của nút */}
              <BookCover url={item.cover_url} alt="" size="grid" />

              {/* Thanh tiến độ mini phủ mép dưới ảnh bìa */}
              {isInProgress && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'rgba(0, 0, 0, 0.45)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(8, percent)}%`,
                      background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                      boxShadow: '0 0 6px rgba(236, 72, 153, 0.8)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </button>

            <button
              type="button"
              className={'book-grid-fav' + (item.is_favorite ? ' on' : '')}
              aria-label={favoriteLabel}
              aria-pressed={item.is_favorite}
              onClick={() => onToggleFavorite(item)}
            >
              <Heart size={14} fill={item.is_favorite ? 'currentColor' : 'none'} />
            </button>

            <p className="book-grid-title">
              <span className="book-grid-dot" data-status={item.status} aria-hidden="true" />
              {item.name}
            </p>
            <p className="book-grid-author">{item.author || 'Chưa rõ tác giả'}</p>
            {item.genre && (
              <span className="book-grid-genre-tag" title={`Thể loại: ${item.genre}`}>
                {item.genre}
              </span>
            )}
            {item.shared_by && <p className="book-grid-shared">Do {item.shared_by} chia sẻ</p>}

            {/* Thanh tiến độ đọc rõ ràng phía dưới thẻ sách */}
            {isInProgress && (
              <div
                className="book-grid-progress-bar"
                style={{
                  marginTop: '5px',
                  padding: '3px 0 0',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '4px',
                    borderRadius: '2px',
                    background: 'var(--border)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(6, percent)}%`,
                      borderRadius: '2px',
                      background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                      boxShadow: '0 0 4px rgba(139, 92, 246, 0.5)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '3px',
                    fontSize: '0.66rem',
                    lineHeight: 1,
                  }}
                >
                  <span style={{ fontWeight: 800, color: 'var(--purple)' }}>
                    {pageDisplay ? `Trang ${pageDisplay}` : `${percent}%`}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    {percent > 0 ? `${percent}%` : 'Đang đọc'}
                  </span>
                </div>
              </div>
            )}

            {/* Thao tác cho Sách Bản Nháp */}
            {((item.status as string) === 'DRAFT' || item.notes?.includes('"isDraft":true')) && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="audiobook-draft-chip" style={{ alignSelf: 'flex-start', fontSize: '0.68rem', padding: '2px 8px' }}>
                  <Sparkles size={11} /> Bản nháp
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {onApproveDraft && (
                    <button
                      type="button"
                      className="audiobook-btn-approve"
                      style={{ padding: '4px 8px', fontSize: '0.74rem', flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onApproveDraft(item.id)
                      }}
                    >
                      <CheckCircle2 size={13} /> Duyệt
                    </button>
                  )}
                  {onDeleteDraft && (
                    <button
                      type="button"
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        padding: '4px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteDraft(item.id)
                      }}
                      title="Xóa bản nháp"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
