import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import type { Media } from '../../types'
import { BookCover } from './BookCover'
import { getBookReadingSessionLogs, getLastReadBook } from '../../lib/bookReadingLog'

type BookGridProps = {
  items: Media[]
  onOpen: (item: Media) => void
  onToggleFavorite: (item: Media) => void
}

/** Nhãn chữ của trạng thái, cặp [đọc, nghe] theo `book_format`. */
const STATUS_LABEL: Record<Media['status'], [string, string]> = {
  PLANNED: ['sẽ đọc', 'sẽ nghe'],
  IN_PROGRESS: ['đang đọc', 'đang nghe'],
  COMPLETED: ['đã đọc', 'đã nghe'],
}

interface BookProgressInfo {
  percent: number
  page?: number
  totalPages?: number
}

function useBookProgressMap(): Map<string, BookProgressInfo> {
  const [progressMap, setProgressMap] = useState<Map<string, BookProgressInfo>>(new Map())

  useEffect(() => {
    const map = new Map<string, BookProgressInfo>()

    try {
      // 1. Nạp từ các phiên đọc gần đây
      const logs = getBookReadingSessionLogs()
      for (const log of logs) {
        if (log.mediaItemId) {
          const existing = map.get(log.mediaItemId)
          const highestPage = Math.max(existing?.page || 0, log.endPage || 0, log.startPage || 0)
          const totalEst = highestPage > 100 ? highestPage + 50 : 200
          const pct = Math.min(100, Math.max(5, Math.round((highestPage / totalEst) * 100)))
          map.set(log.mediaItemId, {
            percent: existing?.percent || pct,
            page: highestPage,
          })
        }
      }

      // 2. Nạp từ cuốn sách đang đọc gần nhất
      const last = getLastReadBook()
      if (last && last.mediaItemId) {
        map.set(last.mediaItemId, {
          percent: Math.min(100, Math.max(1, Math.round(last.percent || 0))),
          page: last.page ?? undefined,
          totalPages: last.pageCount ?? undefined,
        })
      }
    } catch {}

    setProgressMap(map)
  }, [])

  return progressMap
}

export function BookGrid({ items, onOpen, onToggleFavorite }: BookGridProps) {
  const progressMap = useBookProgressMap()

  return (
    <ul className="book-grid">
      {items.map((item) => {
        const statusLabel = STATUS_LABEL[item.status][item.book_format === 'LISTEN' ? 1 : 0]
        const favoriteLabel = `${item.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'} ${item.name}`

        // Tính toán tiến độ đọc
        const isInProgress = item.status === 'IN_PROGRESS'
        const isCompleted = item.status === 'COMPLETED'
        const prog = progressMap.get(item.id)

        let percent = isCompleted ? 100 : (prog?.percent ?? (item.current_chapter ? Math.min(100, item.current_chapter * 5) : (isInProgress ? 25 : 0)))
        percent = Math.min(100, Math.max(0, Math.round(percent)))

        const pageDisplay = prog?.page 
          ? (prog.totalPages ? `${prog.page}/${prog.totalPages}` : `${prog.page}`)
          : (item.current_chapter ? `${item.current_chapter}` : null)

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
          </li>
        )
      })}
    </ul>
  )
}
