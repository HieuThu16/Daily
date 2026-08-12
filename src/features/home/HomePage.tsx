import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { localDate } from '../../lib/date'
import { todayCompletion } from '../../lib/homeProgress'
import { parseLocalDate, upcomingOccasions } from '../../lib/occasions'
import { DatePager } from './DatePager'
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
