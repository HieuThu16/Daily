import { Heart } from 'lucide-react'
import type { Media } from '../../types'
import { BookCover } from './BookCover'

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

export function BookGrid({ items, onOpen, onToggleFavorite }: BookGridProps) {
  return (
    <ul className="book-grid">
      {items.map((item) => {
        const statusLabel = STATUS_LABEL[item.status][item.book_format === 'LISTEN' ? 1 : 0]
        const favoriteLabel = `${item.is_favorite ? 'Bỏ yêu thích' : 'Yêu thích'} ${item.name}`

        return (
          <li key={item.id} className="book-grid-cell">
            {/* Nút bìa và nút tim là anh em, không lồng nhau: nút trong nút là HTML không
                hợp lệ và làm screen reader không tới được nút bên trong. */}
            <button
              type="button"
              className="book-grid-cover"
              aria-label={`Xem chi tiết ${item.name}, ${statusLabel}`}
              onClick={() => onOpen(item)}
            >
              {/* alt rỗng vì tên sách đã nằm trong aria-label của nút, để alt nữa thì đọc hai lần. */}
              <BookCover url={item.cover_url} alt="" size="grid" />
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
              {/* Chấm màu là thông tin truyền bằng màu sắc, nên ẩn khỏi screen reader —
                  nhãn chữ tương ứng đã có trong aria-label của nút bìa. */}
              <span className="book-grid-dot" data-status={item.status} aria-hidden="true" />
              {item.name}
            </p>
            <p className="book-grid-author">{item.author || 'Chưa rõ tác giả'}</p>
          </li>
        )
      })}
    </ul>
  )
}
