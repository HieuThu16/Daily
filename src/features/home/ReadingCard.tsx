import { useState } from 'react'
import { BookOpen, ChevronRight, Film, Music, Youtube } from 'lucide-react'
import type { Media } from '../../types'

const TYPE_ICON = { BOOK: BookOpen, MANGA: BookOpen, MOVIE: Film, MUSIC: Music, YOUTUBE: Youtube }

function Cover({ item }: { item: Media }) {
  const [broken, setBroken] = useState(false)
  const Icon = TYPE_ICON[item.type] ?? BookOpen

  if (item.cover_url && !broken) {
    return <img className="media-cover" src={item.cover_url} alt={item.name} onError={() => setBroken(true)} />
  }
  return (
    <div className="media-cover" aria-hidden="true">
      <Icon size={22} />
    </div>
  )
}

type Props = { media: Media[]; loading: boolean; onOpenLibrary: () => void }

export function ReadingCard({ media, loading, onOpenLibrary }: Props) {
  const [featured, ...rest] = media

  return (
    <div className="card home-card">
      <div className="home-card-head">
        <div className="home-card-title">
          <div className="icon-box icon-box-sm icon-box-blue" style={{ width: 24, height: 24 }}>
            <BookOpen size={14} />
          </div>
          <span>Đang đọc</span>
        </div>
        <span className="home-card-count">{media.length}</span>
      </div>

      <div className="home-card-body">
        {loading ? (
          <p className="home-card-empty">Đang tải…</p>
        ) : !featured ? (
          <p className="home-card-empty">Chưa có mục nào đang thưởng thức.</p>
        ) : (
          <>
            <div className="reading-row">
              <Cover item={featured} />
              <div style={{ minWidth: 0 }}>
                <strong>{featured.name}</strong>
                <span className="reading-badge">{featured.type}</span>
              </div>
            </div>
            {rest.slice(0, 2).map((item) => (
              <div key={item.id} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                • {item.name}
              </div>
            ))}
          </>
        )}
      </div>

      <button type="button" className="home-card-foot accent" onClick={onOpenLibrary}>
        Xem thư viện <ChevronRight size={14} />
      </button>
    </div>
  )
}
