import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3, Clock } from 'lucide-react'
import { localDate } from '../../lib/date'
import { buildDayReview } from '../../lib/dayReview'
import { todayCompletion } from '../../lib/homeProgress'
import { useMangaReadingLogs } from '../../lib/mangaReadingLog'
import { summarizeMangaLogs } from '../../lib/mangaStats'
import { useBookReadingSessionLogs, summarizeBookSessions, useLastReadBook } from '../../lib/bookReadingLog'
import { parseLocalDate, upcomingOccasions } from '../../lib/occasions'
import { Aside, AsideCard } from '../AsideSlot'
import { DatePager } from './DatePager'
import { DayReviewTimeline } from './DayReviewTimeline'
import { ProgressRing } from './ProgressRing'
import { ReportDay } from './ReportDay'
import { ReportWeek } from './ReportWeek'
import { useHomeData } from './useHomeData'
import { QuickLog } from './QuickLog'
import { SkeletonList } from '../Skeleton'

type ReportTab = 'day' | 'week'
type DaySubTab = 'review' | 'stats'

export function HomePage() {
  const nav = useNavigate()
  const [tab, setTab] = useState<ReportTab>('day')
  // Mở Home là thấy thống kê ngày; dòng thời gian nằm ở tab bên cạnh.
  const [daySubTab, setDaySubTab] = useState<DaySubTab>('stats')
  /*
   * Nhận ngày từ URL (?date=YYYY-MM-DD) để thông báo "Nhìn lại" bấm vào là mở
   * thẳng ngày đó, thay vì bắt tự bấm lùi từng ngày.
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const urlDate = searchParams.get('date') ?? ''
  const [dateKey, setDateKey] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : localDate(),
  )

  // Đổi ngày thì bỏ tham số đi, khỏi dính lại lúc bấm sang ngày khác.
  useEffect(() => {
    if (urlDate && urlDate !== dateKey) setSearchParams({}, { replace: true })
  }, [urlDate, dateKey, setSearchParams])
  const data = useHomeData(dateKey)
  const mangaLogs = useMangaReadingLogs()
  const bookSessionLogs = useBookReadingSessionLogs()
  const lastReadBook = useLastReadBook()
  const isToday = dateKey === localDate()

  const completion = useMemo(
    () =>
      todayCompletion({
        habits: data.habits,
        habitLogs: data.todayLogs,
        todos: [...data.todos, ...data.todosDoneToday],
      }, parseLocalDate(dateKey)),
    [data.habits, data.todayLogs, data.todos, data.todosDoneToday, dateKey],
  )


  /** Thống kê đọc truyện: dữ liệu vốn đã ghi sẵn, giờ mới có chỗ xem. */
  const mangaStats = useMemo(() => summarizeMangaLogs(mangaLogs, dateKey), [mangaLogs, dateKey])

  /** Thống kê đọc sách chi tiết & chuỗi đọc liên tục */
  const bookStats = useMemo(() => summarizeBookSessions(bookSessionLogs, dateKey), [bookSessionLogs, dateKey])

  const nextOccasion = useMemo(
    () => upcomingOccasions(data.occasions, data.people, new Date(), { withinDays: 60, limit: 1 })[0] ?? null,
    [data.occasions, data.people],
  )

  const dayEvents = useMemo(
    () =>
      buildDayReview({
        date: dateKey,
        entries: data.entries,
        meals: data.meals,
        sleeps: data.sleep,
        todos: [...data.todos, ...data.todosDoneToday],
        media: data.todayMedia,
        mangaLogs,
        bookReadingLogs: bookSessionLogs,
      }),
    [dateKey, data.entries, data.meals, data.sleep, data.todos, data.todosDoneToday, data.todayMedia, mangaLogs, bookSessionLogs],
  )

  return (
    <section className="home-page">
      {/* Cột phụ desktop: nhìn một cái là biết hôm nay còn bao nhiêu việc. */}
      <Aside>
        <AsideCard title="Hoàn thành">
          <div className="aside-ring">
            <ProgressRing percent={completion.percent} size={104} stroke={9}>
              <strong>{completion.percent}%</strong>
              <span>hôm nay</span>
            </ProgressRing>
          </div>
          <div className="aside-row">
            <span>Đã xong</span>
            <strong>{completion.done}</strong>
          </div>
          <div className="aside-row">
            <span>Còn lại</span>
            <strong>{completion.remaining}</strong>
          </div>
        </AsideCard>

        <AsideCard title="Trong ngày">
          <div className="aside-row">
            <span>Thói quen</span>
            <strong>{data.habits.length}</strong>
          </div>
          <div className="aside-row">
            <span>Việc chưa xong</span>
            <strong>{data.todos.filter((t) => !t.completed).length}</strong>
          </div>
          <div className="aside-row">
            <span>Ghi chép</span>
            <strong>{data.entries.length}</strong>
          </div>
          <div className="aside-row">
            <span>Bữa ăn</span>
            <strong>{data.meals.length}</strong>
          </div>
        </AsideCard>

        {(bookStats.totalPages > 0 || lastReadBook) && (
          <AsideCard title="Đọc sách">
            {lastReadBook && (
              <div
                onClick={() => nav(`/read/${lastReadBook.mediaItemId}`)}
                style={{
                  padding: '8px 10px',
                  marginBottom: 8,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.15))',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.borderColor = 'var(--purple)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.25)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--purple)', textTransform: 'uppercase' }}>
                    📖 Tiếp tục đọc
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--purple)' }}>
                    {lastReadBook.percent}%
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lastReadBook.title}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lastReadBook.chapterTitle ? `Ch. ${lastReadBook.chapterIdx + 1}: ${lastReadBook.chapterTitle}` : `Đang đọc chương ${lastReadBook.chapterIdx + 1}`}
                </div>
              </div>
            )}
            {bookStats.totalPages > 0 && (
              <>
                <div className="aside-row">
                  <span>Tuần này</span>
                  <strong>{bookStats.thisWeekPages} trang</strong>
                </div>
                <div className="aside-row">
                  <span>Chuỗi ngày đọc</span>
                  <strong>🔥 {bookStats.streak}</strong>
                </div>
                {bookStats.topBooks[0] && (
                  <div className="aside-row">
                    <span>Đọc nhiều nhất</span>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                      {bookStats.topBooks[0].title}
                    </strong>
                  </div>
                )}
                <div
                  className="aside-row"
                  style={{ cursor: 'pointer', color: 'var(--primary)', marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--card-border)' }}
                  onClick={() => nav('/books/stats')}
                >
                  <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.74rem' }}>📊 Xem chi tiết</span>
                  <strong style={{ color: 'var(--primary)', fontSize: '0.74rem' }}>→</strong>
                </div>
              </>
            )}
          </AsideCard>
        )}

        {mangaStats.totalChapters > 0 && (
          <AsideCard title="Đọc truyện">
            <div className="aside-row">
              <span>Tuần này</span>
              <strong>{mangaStats.thisWeek} chương</strong>
            </div>
            <div className="aside-row">
              <span>Chuỗi ngày đọc</span>
              <strong>🔥 {mangaStats.streak}</strong>
            </div>
            {mangaStats.topManga[0] && (
              <div className="aside-row">
                <span>Đọc nhiều nhất</span>
                <strong>{mangaStats.topManga[0].title}</strong>
              </div>
            )}
          </AsideCard>
        )}

        <AsideCard title="Sắp tới">
          {nextOccasion ? (
            <div className="aside-row">
              <span>{nextOccasion.label}</span>
              <strong>{nextOccasion.days === 0 ? 'Hôm nay' : `${nextOccasion.days}n`}</strong>
            </div>
          ) : (
            <p className="aside-empty">Không có dịp nào trong 60 ngày tới.</p>
          )}
        </AsideCard>
      </Aside>

      <div className="segmented" role="tablist" aria-label="Kỳ báo cáo">
        <button role="tab" aria-selected={tab === 'day'} className={tab === 'day' ? 'active' : ''} onClick={() => setTab('day')}>
          Ngày
        </button>
        <button role="tab" aria-selected={tab === 'week'} className={tab === 'week' ? 'active' : ''} onClick={() => setTab('week')}>
          Tuần
        </button>
      </div>

      <DatePager dateKey={dateKey} week={data.week} mode={tab} onChange={setDateKey} />

      {tab === 'day' && (
        <div
          className="home-day-subtabs"
          role="tablist"
          aria-label="Chế độ xem ngày"
          style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: '1fr',
            gap: 6,
            marginBottom: 12,
            padding: 3,
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 12,
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={daySubTab === 'review'}
            className={daySubTab === 'review' ? 'active' : ''}
            onClick={() => setDaySubTab('review')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 9,
              border: 0,
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: daySubTab === 'review' ? 'var(--amber)' : 'transparent',
              color: daySubTab === 'review' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <Clock size={14} /> Review ngày {dayEvents.length > 0 ? `(${dayEvents.length})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={daySubTab === 'stats'}
            className={daySubTab === 'stats' ? 'active' : ''}
            onClick={() => setDaySubTab('stats')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 10px',
              borderRadius: 9,
              border: 0,
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: daySubTab === 'stats' ? 'var(--primary)' : 'transparent',
              color: daySubTab === 'stats' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <BarChart3 size={14} /> Thống kê ngày
          </button>
        </div>
      )}



      {data.error && (
        <div className="card" role="alert" style={{ padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderColor: 'var(--rose)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--rose)', fontWeight: 700 }}>{data.error}</span>
          <button type="button" className="primary" onClick={data.reload} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Thử lại
          </button>
        </div>
      )}

      {data.loading ? (
        <SkeletonList rows={5} height={72} />
      ) : tab === 'day' ? (
        daySubTab === 'review' ? (
          <DayReviewTimeline
            events={dayEvents}
            dateKey={dateKey}
            isToday={isToday}
            onOpen={nav}
          />
        ) : (
          <>
          <QuickLog dateKey={dateKey} onSaved={data.reload} />
          <ReportDay
            completion={completion}
            habits={data.habits}
            todayLogs={data.todayLogs}
            todos={data.todos}
            todosDoneToday={data.todosDoneToday}
            entries={data.entries}
            meals={data.meals}
            sleep={data.sleep}
            todayMedia={data.todayMedia}
            todayReadingLogs={data.todayReadingLogs}
            isToday={isToday}
            nextOccasion={nextOccasion}
            onOpen={nav}
          />
          </>
        )
      ) : (
        <ReportWeek
          week={data.week}
          habits={data.habits}
          weekLogs={data.weekLogs}
          weekEntries={data.weekEntries}
          weekMeals={data.weekMeals}
          weekTodosDone={data.weekTodosDone}
          weekSleep={data.weekSleep}
          onOpen={nav}
        />
      )}
    </section>
  )
}
