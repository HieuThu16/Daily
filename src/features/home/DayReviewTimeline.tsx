import { BookOpen, CheckCircle2, Clock, Film, Flame, Heart, ListPlus, Music, NotebookPen, Star, Sunrise, Tv, UtensilsCrossed } from 'lucide-react'
import type { DayEvent } from '../../lib/dayReview'
import { Empty } from '../shared'

type Props = {
  events: DayEvent[]
  dateKey: string
  isToday: boolean
  onOpen?: (route: string) => void
}

const eventStyles: Record<DayEvent['kind'], { icon: any; color: string; bg: string; route?: string }> = {
  WAKE:      { icon: Sunrise,         color: 'var(--amber)',   bg: 'var(--amber-bg)',      route: '/nutrition' },
  MEAL:      { icon: UtensilsCrossed, color: 'var(--emerald)', bg: 'var(--emerald-bg)',    route: '/nutrition' },
  DIARY:     { icon: NotebookPen,     color: 'var(--purple)',  bg: 'var(--purple-bg)',     route: '/daily' },
  TASK_ADD:  { icon: ListPlus,        color: 'var(--blue)',    bg: 'var(--blue-bg)',       route: '/tasks' },
  TASK_DONE: { icon: CheckCircle2,    color: 'var(--emerald)', bg: 'var(--emerald-bg)',    route: '/tasks' },
  MEDIA:     { icon: Music,           color: 'var(--primary)', bg: 'var(--primary-light)', route: '/music' },
  MANGA:     { icon: Heart,           color: '#ec4899',        bg: 'rgba(236, 72, 153, 0.12)', route: '/bl' },
}

function getMangaEventConfig(label: string) {
  if (label.includes('H (18+)')) return { icon: Flame, color: '#e11d48', bg: 'rgba(225, 29, 72, 0.12)', route: '/truyenh' }
  if (label.includes('BL')) return { icon: Heart, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', route: '/bl' }
  return { icon: Heart, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', route: '/ngontinh' }
}

function getMediaEventConfig(detail: string, label: string) {
  if (label.includes('sách') || detail.includes('Sách')) return { icon: BookOpen, color: 'var(--purple)', bg: 'var(--purple-bg)', route: '/books' }
  if (label.includes('Review')) return { icon: Film, color: 'var(--rose)', bg: 'var(--rose-bg)', route: '/youtube' }
  if (label.includes('YouTube') || label.includes('TV Show')) return { icon: Tv, color: 'var(--rose)', bg: 'rgba(244, 63, 94, 0.12)', route: '/youtube' }
  if (label.includes('phim') || detail.includes('Phim')) return { icon: Film, color: 'var(--rose)', bg: 'var(--rose-bg)', route: '/movies' }
  if (label.includes('BL') || label.includes('truyện')) return { icon: Heart, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', route: '/bl' }
  return { icon: Music, color: 'var(--cyan)', bg: 'var(--cyan-bg)', route: '/music' }
}

export function DayReviewTimeline({ events, dateKey: _dateKey, isToday, onOpen }: Props) {
  return (
    <div className="report-timeline-container card" style={{ padding: 14, margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="icon-box icon-box-sm" style={{ background: 'var(--amber-bg)', color: 'var(--amber)', width: 26, height: 26 }}>
            <Clock size={14} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Dòng thời gian cả ngày
            </h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {events.length > 0 ? `${events.length} mốc hoạt động ${isToday ? 'hôm nay' : ''}` : 'Chưa có dữ liệu'}
            </span>
          </div>
        </div>

        {events.length > 0 && (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--amber-bg)', color: 'var(--amber)' }}>
            {events.length} mốc
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <Empty icon={Clock} colorClass="icon-box-amber">
          Ngày này chưa có hoạt động nào được ghi giờ.
        </Empty>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingLeft: 10,
            borderLeft: '2px solid var(--card-border)',
            maxHeight: 'calc(100vh - 280px)',
            minHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {events.map((ev, i) => {
            let baseStyle = eventStyles[ev.kind] ?? { icon: Clock, color: 'var(--text-main)', bg: 'var(--bg-main)' }
            if (ev.kind === 'MEDIA') {
              const extra = getMediaEventConfig(ev.detail, ev.label)
              baseStyle = { ...baseStyle, ...extra }
            } else if (ev.kind === 'MANGA') {
              const extra = getMangaEventConfig(ev.label)
              baseStyle = { ...baseStyle, ...extra }
            }
            const Icon = baseStyle.icon

            return (
              <div
                key={i}
                onClick={() => baseStyle.route && onOpen?.(baseStyle.route)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: ev.is_favorite ? 'linear-gradient(135deg, var(--card-bg), rgba(245, 158, 11, 0.08))' : 'var(--card-bg)',
                  border: ev.is_favorite ? '1.5px solid rgba(245, 158, 11, 0.55)' : '1px solid var(--card-border)',
                  boxShadow: ev.is_favorite ? '0 2px 10px rgba(245, 158, 11, 0.12)' : 'none',
                  cursor: onOpen && baseStyle.route ? 'pointer' : 'default',
                  transition: 'transform 0.1s, border-color 0.15s',
                }}
              >
                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: ev.is_favorite ? 'var(--amber)' : baseStyle.color,
                    width: 42,
                    flexShrink: 0,
                    marginTop: 2,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {ev.time || '--:--'}
                </span>

                <div
                  className="icon-box icon-box-sm"
                  style={{
                    background: ev.is_favorite ? 'var(--amber-bg)' : baseStyle.bg,
                    color: ev.is_favorite ? 'var(--amber)' : baseStyle.color,
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <Icon size={12} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 1 }}>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: baseStyle.color, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                      {ev.label}
                    </span>
                    {ev.is_favorite && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', fontWeight: 800, color: 'var(--amber)', background: 'var(--amber-bg)', padding: '1px 6px', borderRadius: 10 }}>
                        <Star size={10} fill="currentColor" /> Yêu thích
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.4, wordBreak: 'break-word', marginTop: 1, fontWeight: ev.is_favorite ? 600 : 400 }}>
                    {ev.detail}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
