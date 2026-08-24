import { useMemo, useRef, useState } from 'react'
import { BookMarked, BookOpen, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Film, Gift, Music, NotebookPen, Plus, Wallet, X, Youtube } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { localDate } from '../lib/date'
import { formatMoney } from '../lib/money'
import { nextOccurrence, parseLocalDate } from '../lib/occasions'
import type { Entry, Media, MoneyTransaction, PersonOccasion, Todo } from '../types'
import { useQuery } from './shared'
import { dedupeMusic } from '../lib/musicDedupe'
import { supabase } from '../lib/supabase'
import { useToast } from './ToastContext'
import { notifyTasksChanged } from './useUncompletedTasks'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** Năm loại dữ liệu hiện trên lịch; chú thích màu cũng là nút bật/tắt từng loại. */
type Layer = 'todos' | 'occasions' | 'entries' | 'spend' | 'media'
const LAYERS: { id: Layer; label: string; color: string }[] = [
  { id: 'todos', label: 'việc', color: '#8b5cf6' },
  { id: 'occasions', label: 'dịp', color: '#f59e0b' },
  { id: 'entries', label: 'nhật ký', color: '#10b981' },
  { id: 'spend', label: 'chi tiêu', color: '#ef4444' },
  { id: 'media', label: 'giải trí', color: '#06b6d4' },
]

const dayKey = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')

/** Các ô của lưới tháng: đệm đầu tuần bằng null cho thẳng cột. */
function monthGrid(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (new Date(year, month, 1).getDay() + 6) % 7 // đưa Chủ nhật về cuối tuần
  return [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(year, month, i + 1))),
  ]
}

/** Bảy ngày của tuần chứa `day`, bắt đầu từ thứ Hai. */
function weekDays(day: string): string[] {
  const base = parseLocalDate(day)
  const monday = new Date(base)
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return dayKey(d)
  })
}

const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']

type DayBucket = { todos: Todo[]; entries: Entry[]; occasions: PersonOccasion[]; spend: number; media: Media[] }

/** Agenda tuần: bảy ngày xếp dọc, đọc được nội dung từng ngày trên màn hình hẹp. */
function AgendaWeek({
  days,
  dayData,
  today,
  selected,
  onPick,
  shows,
}: {
  days: string[]
  dayData: Map<string, DayBucket>
  today: string
  selected: string
  onPick: (day: string) => void
  shows: (id: Layer) => boolean
}) {
  return (
    <div className="cal-agenda">
      {days.map((day, index) => {
        const data = dayData.get(day)
        const items: { key: string; text: string; color: string }[] = [
          ...(shows('occasions') ? (data?.occasions ?? []).map((o) => ({ key: `o-${o.id}`, text: o.title || 'Dịp đặc biệt', color: '#f59e0b' })) : []),
          ...(shows('todos') ? (data?.todos ?? []).map((t) => ({ key: `t-${t.id}`, text: `${t.due_time ? t.due_time + ' - ' : ''}${t.title}`, color: t.completed ? '#10b981' : '#8b5cf6' })) : []),
          ...(shows('entries') ? (data?.entries ?? []).map((e) => ({ key: `e-${e.id}`, text: e.content, color: '#10b981' })) : []),
          ...(shows('media') ? (data?.media ?? []).map((m) => ({ key: `m-${m.id}`, text: m.name, color: '#06b6d4' })) : []),
          ...(shows('spend') && data?.spend ? [{ key: `s-${day}`, text: `Đã chi ${formatMoney(data.spend)}`, color: '#ef4444' }] : []),
        ]
        return (
          <button
            key={day}
            type="button"
            className={`cal-agenda-day ${day === today ? 'is-today' : ''} ${day === selected ? 'is-selected' : ''}`}
            onClick={() => onPick(day)}
          >
            <span className="cal-agenda-head">
              <b>{DAY_LABELS[index]}</b>
              <small>{day.slice(8)}/{day.slice(5, 7)}</small>
            </span>
            {items.length === 0 ? (
              <span className="cal-agenda-empty">Trống</span>
            ) : (
              <span className="cal-agenda-items">
                {items.map((item) => (
                  <span key={item.key} className="cal-agenda-item">
                    <i style={{ background: item.color }} />
                    {item.text}
                  </span>
                ))}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function CalendarPage() {
  const navigate = useNavigate()
  const todos = useQuery<Todo>('todos')
  const entries = useQuery<Entry>('daily_entries')
  const occasions = useQuery<PersonOccasion>('person_occasions')
  const transactions = useQuery<MoneyTransaction>('transactions')
  const mediaQuery = useQuery<Media>('media_items')
  // Bản nhạc trùng (do chia sẻ nhiều lần) lọt vào lịch thành nhiều dòng y hệt.
  const media = { ...mediaQuery, items: useMemo(() => dedupeMusic(mediaQuery.items, 'day'), [mediaQuery.items]) }

  const today = localDate()
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }))
  const [selected, setSelected] = useState(today)
  // Một tag đang xem tại một thời điểm; 'all' là mặc định, xem hết mọi loại.
  const [layer, setLayer] = useState<Layer | 'all'>('all')
  // Lưới tháng để nhìn tổng thể; agenda tuần để đọc nội dung trên màn hình hẹp.
  const [view, setView] = useState<'month' | 'week'>('month')
  const [quickTitle, setQuickTitle] = useState('')
  const [quickTime, setQuickTime] = useState('')
  const [quickOpen, setQuickOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const shows = (id: Layer) => layer === 'all' || layer === id

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const agendaDays = useMemo(() => weekDays(selected), [selected])
  // Tuần đang xem có thể tràn sang tháng khác, nên dịp phải tính cho cả hai tập ngày.
  const occasionDays = useMemo(
    () => [...new Set([...(cells.filter(Boolean) as string[]), ...agendaDays])],
    [cells, agendaDays],
  )

  const dayData = useMemo(() => {
    const map = new Map<string, { todos: Todo[]; entries: Entry[]; occasions: PersonOccasion[]; spend: number; media: Media[] }>()
    const ensure = (day: string) => {
      if (!map.has(day)) map.set(day, { todos: [], entries: [], occasions: [], spend: 0, media: [] })
      return map.get(day)!
    }
    todos.items.forEach((todo) => todo.due_date && ensure(todo.due_date).todos.push(todo))
    entries.items.forEach((entry) => ensure(entry.entry_date).entries.push(entry))
    transactions.items.forEach((tx) => {
      if (tx.direction === 'OUT') ensure(tx.log_date).spend += tx.amount
    })
    media.items.forEach((m) => {
      const d = m.log_date || (m.created_at ? m.created_at.slice(0, 10) : null)
      if (d) ensure(d).media.push(m)
    })
    // Dịp lặp hằng năm: rơi vào ngày nào thì lần xảy ra kế tiếp tính từ ngày đó chính là ngày đó.
    occasionDays.forEach((day) => {
      occasions.items.forEach((occasion) => {
        const next = nextOccurrence(occasion, parseLocalDate(day))
        if (next && dayKey(next) === day) ensure(day).occasions.push(occasion)
      })
    })
    return map
  }, [todos.items, entries.items, occasions.items, transactions.items, media.items, occasionDays])

  const shift = (direction: -1 | 1) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + direction, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })

  // Vuốt ngang trên lưới để lật tháng, giống thao tác lọc ở trang Tasks.
  const swipeStartX = useRef<number | null>(null)
  const onSwipeStart = (event: React.TouchEvent) => {
    swipeStartX.current = event.touches[0]?.clientX ?? null
  }
  const onSwipeEnd = (event: React.TouchEvent) => {
    const start = swipeStartX.current
    swipeStartX.current = null
    const end = event.changedTouches[0]?.clientX
    if (start == null || end == null || Math.abs(end - start) < 60) return
    shift(end < start ? 1 : -1)
  }

  const found = dayData.get(selected)
  // Danh sách bên dưới nghe theo cùng bộ lọc với chấm màu trên lưới.
  const detail = found && {
    todos: shows('todos') ? found.todos : [],
    entries: shows('entries') ? found.entries : [],
    occasions: shows('occasions') ? found.occasions : [],
    spend: shows('spend') ? found.spend : 0,
    media: shows('media') ? found.media : [],
  }
  /** Thêm việc thẳng vào ngày đang chọn, không phải nhảy sang trang Tasks. */
  const addQuickTask = async () => {
    const title = quickTitle.trim()
    if (!title || !supabase) return
    setSaving(true)
    const payload = { title, completed: false, due_date: selected, due_time: quickTime || null }
    const { data, error } = await supabase.from('todos').insert(payload).select().single()
    setSaving(false)
    if (error) {
      showToast('❌ Chưa thêm được việc — kiểm tra kết nối.', 'delete')
      return
    }
    todos.setItems((prev) => [data as Todo, ...prev])
    notifyTasksChanged()
    setQuickTitle('')
    setQuickTime('')
    setQuickOpen(false)
    showToast(`✅ Đã thêm "${title}" vào ngày ${selected.slice(8)}/${selected.slice(5, 7)}`)
  }

  const nothingOnDay = !detail?.occasions.length && !detail?.todos.length && !detail?.entries.length && !detail?.spend && !detail?.media.length

  return (
    <section className="page-shell is-narrow" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="icon small" aria-label="Tháng trước" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
        <strong><CalendarDays size={14} /> Tháng {cursor.month + 1}/{cursor.year}</strong>
        <button className="icon small" aria-label="Tháng sau" onClick={() => shift(1)}><ChevronRight size={16} /></button>
      </div>

      <div className="cal-view-switch" role="tablist" aria-label="Chế độ xem lịch">
        <button type="button" role="tab" aria-selected={view === 'month'} className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>
          Lưới tháng
        </button>
        <button type="button" role="tab" aria-selected={view === 'week'} className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>
          Agenda tuần
        </button>
      </div>

      {view === 'month' && (
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }} onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
        {WEEKDAYS.map((label) => (
          <small key={label} style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>{label}</small>
        ))}

        {cells.map((day, index) => {
          if (!day) return <span key={`pad-${index}`} />
          const data = dayData.get(day)
          const pending = data?.todos.filter((todo) => !todo.completed).length ?? 0
          return (
            <button
              key={day}
              type="button"
              aria-label={`Ngày ${day}`}
              aria-pressed={selected === day}
              onClick={() => setSelected(day)}
              style={{
                display: 'grid', gap: 2, justifyItems: 'center', padding: '4px 0', borderRadius: 8, cursor: 'pointer',
                border: day === today ? '1px solid var(--primary)' : '1px solid transparent',
                background: selected === day ? 'var(--primary-light)' : 'transparent',
                color: selected === day ? 'var(--primary)' : 'var(--text-main)', fontWeight: selected === day ? 800 : 500,
              }}
            >
              <span style={{ fontSize: '0.78rem' }}>{Number(day.slice(8))}</span>
              <span style={{ display: 'flex', gap: 2, height: 5 }}>
                {pending > 0 && shows('todos') && <i style={{ width: 5, height: 5, borderRadius: 5, background: '#8b5cf6' }} />}
                {data?.occasions.length && shows('occasions') ? <i style={{ width: 5, height: 5, borderRadius: 5, background: '#f59e0b' }} /> : null}
                {data?.entries.length && shows('entries') ? <i style={{ width: 5, height: 5, borderRadius: 5, background: '#10b981' }} /> : null}
                {data?.spend && shows('spend') ? <i style={{ width: 5, height: 5, borderRadius: 5, background: '#ef4444' }} /> : null}
                {data?.media.length && shows('media') ? <i style={{ width: 5, height: 5, borderRadius: 5, background: '#06b6d4' }} /> : null}
              </span>
            </button>
          )
        })}
      </div>
      )}

      {view === 'week' && <AgendaWeek days={agendaDays} dayData={dayData} today={today} selected={selected} onPick={setSelected} shows={shows} />}

      {/* Chú thích màu kiêm bộ lọc: chọn một tag để xem riêng loại đó, "Tất cả" để xem hết. */}
      <div className="calendar-legend" role="tablist" aria-label="Lọc theo loại">
        <button
          type="button"
          role="tab"
          aria-selected={layer === 'all'}
          className={'calendar-legend-chip' + (layer === 'all' ? ' on' : '')}
          onClick={() => setLayer('all')}
        >
          Tất cả
        </button>
        {LAYERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={layer === item.id}
            className={'calendar-legend-chip' + (layer === item.id ? ' on' : '')}
            onClick={() => setLayer(item.id)}
          >
            <i style={{ background: item.color }} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="nutrition-period-card">
        <div className="cal-day-head">
          <h3>{selected === today ? 'Hôm nay' : `Ngày ${selected.slice(8)}/${selected.slice(5, 7)}`}</h3>
          <button type="button" className="cal-add-btn" onClick={() => setQuickOpen((open) => !open)} aria-expanded={quickOpen}>
            {quickOpen ? <X size={14} /> : <Plus size={14} />}
            {quickOpen ? 'Đóng' : 'Thêm việc'}
          </button>
        </div>

        {quickOpen && (
          <form className="cal-quick-add" onSubmit={(e) => { e.preventDefault(); void addQuickTask() }}>
            <input
              autoFocus
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Việc cần làm trong ngày này…"
              aria-label="Tên việc"
            />
            <input type="time" value={quickTime} onChange={(e) => setQuickTime(e.target.value)} aria-label="Giờ hạn (không bắt buộc)" />
            <button type="submit" className="primary" disabled={!quickTitle.trim() || saving}>
              {saving ? 'Đang lưu…' : 'Thêm'}
            </button>
          </form>
        )}

        {detail?.occasions.map((occasion) => (
          <div key={occasion.id} className="nutrition-history-row">
            <span className="nutrition-history-icon"><Gift size={15} color="#f59e0b" /></span>
            <div><strong>{occasion.title || (occasion.kind === 'BIRTHDAY' ? 'Sinh nhật' : 'Kỷ niệm')}</strong></div>
          </div>
        ))}

        {detail?.todos.map((todo) => (
          <button key={todo.id} type="button" onClick={() => navigate(`/tasks?todo=${todo.id}`)} className="nutrition-history-row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }}>
            <span className="nutrition-history-icon"><CheckSquare size={15} color={todo.completed ? '#10b981' : '#8b5cf6'} /></span>
            <div>
              <strong style={{ textDecoration: todo.completed ? 'line-through' : undefined }}>{todo.title}</strong>
              {todo.due_time && <small>{todo.due_time}</small>}
            </div>
          </button>
        ))}

        {detail?.entries.map((entry) => (
          <button key={entry.id} type="button" onClick={() => navigate('/daily')} className="nutrition-history-row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }}>
            <span className="nutrition-history-icon"><NotebookPen size={15} color="#10b981" /></span>
            <div><strong>{entry.content}</strong></div>
          </button>
        ))}

        {/* Danh sách mục giải trí / nghệ thuật / đọc sách ghi vào ngày này */}
        {detail?.media.map((item) => {
          const mediaMeta: Record<Media['type'], { icon: typeof Music; color: string; path: string; label: string }> = {
            MUSIC: { icon: Music, color: '#06b6d4', path: '/music', label: 'Nhạc' },
            BOOK: { icon: BookOpen, color: '#a855f7', path: '/books', label: 'Sách' },
            YOUTUBE: { icon: Youtube, color: '#f43f5e', path: '/youtube', label: 'YouTube' },
            MOVIE: { icon: Film, color: '#f43f5e', path: '/movies', label: 'Phim' },
            MANGA: { icon: BookMarked, color: '#10b981', path: '/manga', label: 'Truyện' },
          }
          const conf = mediaMeta[item.type] || mediaMeta.BOOK
          const Icon = conf.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(conf.path)}
              className="nutrition-history-row"
              style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="nutrition-history-icon">
                <Icon size={15} color={conf.color} />
              </span>
              <div>
                <strong>{item.name}</strong>
                <small>{conf.label} • {item.status === 'COMPLETED' ? 'Đã xong' : item.status === 'IN_PROGRESS' ? 'Đang theo dõi' : 'Sẽ xem'}</small>
              </div>
            </button>
          )
        })}

        {detail?.spend ? (
          <button type="button" onClick={() => navigate('/money')} className="nutrition-history-row" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer' }}>
            <span className="nutrition-history-icon"><Wallet size={15} color="#ef4444" /></span>
            <div><strong>Đã chi</strong></div>
            <b style={{ color: '#ef4444' }}>{formatMoney(detail.spend)}</b>
          </button>
        ) : null}

        {nothingOnDay && <div className="nutrition-period-empty">Ngày này chưa có gì được ghi.</div>}
      </div>
    </section>
  )
}
