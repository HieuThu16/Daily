import { CalendarDays, Cake, Heart } from 'lucide-react'
import { countdownLabel, type UpcomingOccasion } from '../../lib/occasions'
import { shortDate } from '../../lib/date'

type Props = { items: UpcomingOccasion[]; onOpenAll: () => void }

export function UpcomingCard({ items, onOpenAll }: Props) {
  return (
    <div className="card home-section-card">
      <div className="home-section-head">
        <h3>
          <CalendarDays size={17} color="var(--emerald)" /> Sắp tới
        </h3>
        <button
          type="button"
          className="icon"
          onClick={onOpenAll}
          style={{ color: 'var(--emerald)', fontSize: '0.8rem', fontWeight: 700, padding: '2px 6px' }}
        >
          Xem tất cả
        </button>
      </div>

      {items.length === 0 ? (
        <p className="home-card-empty">Chưa có dịp nào sắp tới — thêm ở tab Người.</p>
      ) : (
        items.map(({ occasion, days, date, label }) => {
          const Icon = occasion.kind === 'BIRTHDAY' ? Cake : Heart
          const tone = occasion.kind === 'BIRTHDAY' ? 'rose' : 'purple'
          return (
            <div key={occasion.id} className="upcoming-row">
              <div
                className="icon-box icon-box-sm"
                style={{ width: 26, height: 26, background: `var(--${tone}-bg)`, color: `var(--${tone})` }}
              >
                <Icon size={14} />
              </div>
              <span className="upcoming-name">{label}</span>
              <span className={'countdown-badge' + (days <= 7 ? ' soon' : '')}>{countdownLabel(days)}</span>
              <time>{shortDate(date)}</time>
            </div>
          )
        })
      )}
    </div>
  )
}
