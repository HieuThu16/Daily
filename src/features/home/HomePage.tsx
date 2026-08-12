import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { todayCompletion } from '../../lib/homeProgress'
import { upcomingOccasions } from '../../lib/occasions'
import { DailyCard } from './DailyCard'
import { GreetingBanner } from './GreetingBanner'
import { HabitsCard } from './HabitsCard'
import { ReadingCard } from './ReadingCard'
import { TodosCard } from './TodosCard'
import { UpcomingCard } from './UpcomingCard'
import { useHomeData } from './useHomeData'
import { WeekProgressCard } from './WeekProgressCard'

export function HomePage() {
  const data = useHomeData()
  const nav = useNavigate()

  const completion = useMemo(
    () =>
      todayCompletion({
        habits: data.habits,
        habitLogs: data.todayLogs,
        todos: [...data.todos, ...data.todosDoneToday],
      }),
    [data.habits, data.todayLogs, data.todos, data.todosDoneToday],
  )

  const upcoming = useMemo(
    () => upcomingOccasions(data.occasions, data.people, new Date(), { withinDays: 60, limit: 3 }),
    [data.occasions, data.people],
  )

  return (
    <section className="home-page">
      <GreetingBanner completion={completion} onOpen={() => nav('/tasks')} />

      <div className="home-grid home-grid-2">
        <HabitsCard
          habits={data.habits}
          completedIds={data.completedHabitIds}
          loading={data.loading}
          onToggle={data.toggleHabit}
          onOpenAll={() => nav('/habit')}
        />
        <TodosCard todos={data.todos} loading={data.loading} onToggle={data.toggleTodo} onOpenAll={() => nav('/tasks')} />
        <DailyCard entries={data.entries} loading={data.loading} onWrite={() => nav('/daily')} />
        <ReadingCard media={data.media} loading={data.loading} onOpenLibrary={() => nav('/library')} />
      </div>

      <WeekProgressCard week={data.week} habits={data.habits} logs={data.weekLogs} todayPercent={completion.percent} />
      <UpcomingCard items={upcoming} onOpenAll={() => nav('/people')} />
    </section>
  )
}
