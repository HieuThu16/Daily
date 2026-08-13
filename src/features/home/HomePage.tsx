import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { localDate } from '../../lib/date'
import { todayCompletion } from '../../lib/homeProgress'
import { parseLocalDate, upcomingOccasions } from '../../lib/occasions'
import { Aside, AsideCard } from '../AsideSlot'
import { DatePager } from './DatePager'
import { ProgressRing } from './ProgressRing'
import { ReportDay } from './ReportDay'
import { ReportWeek } from './ReportWeek'
import { useHomeData } from './useHomeData'

type ReportTab = 'day' | 'week'

export function HomePage() {
  const nav = useNavigate()
  const [tab, setTab] = useState<ReportTab>('day')
  const [dateKey, setDateKey] = useState(localDate())
  const data = useHomeData(dateKey)
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

  const nextOccasion = useMemo(
    () => upcomingOccasions(data.occasions, data.people, new Date(), { withinDays: 60, limit: 1 })[0] ?? null,
    [data.occasions, data.people],
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

      {tab === 'day' ? (
        <ReportDay
          completion={completion}
          habits={data.habits}
          todayLogs={data.todayLogs}
          todos={data.todos}
          todosDoneToday={data.todosDoneToday}
          entries={data.entries}
          meals={data.meals}
          sleep={data.sleep}
          isToday={isToday}
          nextOccasion={nextOccasion}
          onOpen={nav}
        />
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
