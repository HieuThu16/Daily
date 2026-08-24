import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Bell, BookMarked, Brain, Cake, CalendarHeart, Check, ChevronRight, Clock, Flame, Clapperboard, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useBackdropClose } from './shared'
import { localDate } from '../lib/date'
import { isOverdue, timeLabel } from '../lib/deadline'
import { countdownLabel, upcomingOccasions } from '../lib/occasions'
import { anniversariesOn, yearsAgoLabel, type Anniversary } from '../lib/anniversary'
import { useUncompletedTasks } from './useUncompletedTasks'
import { useMangaUpdates, mangaPath } from './manga/mangaUpdates'
import { useNewVideos } from './newVideos'
import { useDeck } from './study/useDeck'
import { useToast } from './ToastContext'
import type { Habit, HabitLog, Person, PersonOccasion, SharedEvent, Todo } from '../types'

/** Số ngày tới được coi là "dịp sắp đến" và đưa vào hộp thư. */
const OCCASION_WINDOW_DAYS = 7

/** Sinh nhật & dịp lễ sắp tới của mọi người trong danh bạ. */
function useUpcomingOccasions() {
  const [occasions, setOccasions] = useState<PersonOccasion[]>([])
  const [people, setPeople] = useState<Person[]>([])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    void (async () => {
      const [o, p] = await Promise.all([
        client.from('person_occasions').select('*').is('deleted_at', null),
        client.from('people').select('*').is('deleted_at', null),
      ])
      if (o.data) setOccasions(o.data as PersonOccasion[])
      if (p.data) setPeople(p.data as Person[])
    })()
  }, [])

  return useMemo(
    () => upcomingOccasions(occasions, people, new Date(), { withinDays: OCCASION_WINDOW_DAYS, limit: 5 }),
    [occasions, people],
  )
}

/** Thói quen tốt còn bật mà hôm nay chưa ghi nhận. */
function useUnloggedHabits() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const today = localDate()

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    const load = async () => {
      const [h, l] = await Promise.all([
        client.from('habits').select('*').eq('is_active', true),
        client.from('habit_logs').select('habit_id,date,completed,value').eq('date', today),
      ])
      if (h.data) setHabits(h.data as Habit[])
      if (l.data) setLogs(l.data as HabitLog[])
    }
    void load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [today])

  return useMemo(() => {
    const done = new Set(logs.filter((l) => l.completed).map((l) => l.habit_id))
    return habits.filter((h) => h.habit_type !== 'BAD' && !done.has(h.id))
  }, [habits, logs])
}

/** Kỷ niệm chung rơi đúng ngày này của các năm trước. */
function useMemoryAnniversaries(): Array<Anniversary<SharedEvent>> {
  const [events, setEvents] = useState<SharedEvent[]>([])
  const today = localDate()

  useEffect(() => {
    if (!supabase) return
    void supabase
      .from('shared_events')
      .select('*')
      .is('deleted_at', null)
      .then(({ data }) => setEvents((data ?? []) as SharedEvent[]))
  }, [])

  return useMemo(() => anniversariesOn(events, today), [events, today])
}

type Section = 'tasks' | 'study' | 'manga' | 'videos' | 'people' | 'memories' | 'habits'

const SECTION_ORDER: Section[] = ['memories', 'study', 'tasks', 'videos', 'manga', 'people', 'habits']

const SECTION_PATH: Record<Section, string> = {
  tasks: '/tasks',
  study: '/english',
  manga: '/bl',
  videos: '/youtube',
  people: '/people',
  memories: '/daily',
  habits: '/habit',
}

/**
 * Một chuông duy nhất gộp mọi thứ cần chú ý: việc chưa xong, truyện có chương mới,
 * dịp sắp tới và thói quen hôm nay chưa ghi. Thay cho hai chuông rời trước đây.
 */
export function NotificationCenter() {
  const { tasks, overdueCount, completeTask } = useUncompletedTasks()
  const backdrop = useBackdropClose(() => setOpen(false))
  const { updates, dismiss, dismissAll } = useMangaUpdates()
  const newVideos = useNewVideos()
  const occasions = useUpcomingOccasions()
  const unloggedHabits = useUnloggedHabits()
  const anniversaries = useMemoryAnniversaries()
  const english = useDeck('english')
  const knowledge = useDeck('knowledge')
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<Section>('tasks')
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null)
  const nav = useNavigate()
  const { showToast } = useToast()
  const today = localDate()

  const dueDecks = [
    { path: '/english', label: 'Tiếng Anh', due: english.stats.due, total: english.stats.total },
    { path: '/knowledge', label: 'Kiến thức', due: knowledge.stats.due, total: knowledge.stats.total },
  ].filter((d) => d.due > 0)

  const counts: Record<Section, number> = {
    tasks: tasks.length,
    study: dueDecks.reduce((sum, d) => sum + d.due, 0),
    manga: updates.length,
    videos: newVideos.updates.reduce((sum, u) => sum + u.count, 0),
    people: occasions.length,
    memories: anniversaries.length,
    habits: unloggedHabits.length,
  }
  const total = counts.tasks + counts.study + counts.manga + counts.videos + counts.people + counts.memories + counts.habits

  // Số cần chú ý hiện luôn trên icon app khi đã cài PWA (Android/desktop; iOS chưa hỗ trợ).
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (!nav.setAppBadge) return
    if (total > 0) void nav.setAppBadge(total).catch(() => {})
    else void nav.clearAppBadge?.().catch(() => {})
  }, [total])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = original
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Mở bảng thì nhảy thẳng vào mục đầu tiên còn việc, đỡ phải bấm tìm.
  const firstNonEmpty = SECTION_ORDER.find((s) => counts[s] > 0)
  useEffect(() => {
    if (open && firstNonEmpty) setSection(firstNonEmpty)
  }, [open])

  const quickComplete = (e: React.MouseEvent, task: Todo) => {
    e.stopPropagation()
    setJustCompletedId(task.id)
    showToast(`✅ Đã hoàn thành: ${task.title}`)
    setTimeout(() => {
      completeTask(task)
      setJustCompletedId(null)
    }, 250)
  }

  const goTo = (path: string) => {
    setOpen(false)
    nav(path)
  }

  const tabs: { id: Section; label: string; icon: typeof Bell }[] = [
    { id: 'study', label: 'Ôn tập', icon: Brain },
    { id: 'tasks', label: 'Việc', icon: Clock },
    { id: 'manga', label: 'Truyện', icon: BookMarked },
    { id: 'videos', label: 'Video mới', icon: Clapperboard },
    { id: 'people', label: 'Dịp', icon: Cake },
    { id: 'memories', label: 'Kỷ niệm', icon: CalendarHeart },
    { id: 'habits', label: 'Thói quen', icon: Flame },
  ]

  return (
    <div className="task-bell-container">
      <button
        type="button"
        className={`task-bell-btn ${total > 0 ? 'has-tasks' : ''} ${overdueCount > 0 ? 'has-overdue' : ''} ${open ? 'is-active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Thông báo: ${total} mục cần chú ý`}
        title={total > 0 ? `${total} mục cần chú ý` : 'Không có gì cần chú ý'}
      >
        <Bell size={18} className="task-bell-icon" />
        {total > 0 && (
          <span className={`task-bell-badge ${overdueCount > 0 ? 'is-overdue' : ''}`}>{total > 99 ? '99+' : total}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div className="task-bell-portal-backdrop" role="presentation" {...backdrop}>
            <div
              className="task-bell-dropdown-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Hộp thư thông báo"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="task-bell-sheet-handle" aria-hidden="true" />

              <div className="task-bell-header">
                <div className="task-bell-title-wrap">
                  <div className="task-bell-title-icon"><Bell size={16} /></div>
                  <strong className="task-bell-title">Cần chú ý</strong>
                  <span className="task-bell-count-pill">{total} mục</span>
                  {overdueCount > 0 && (
                    <span className="task-bell-overdue-pill"><AlertCircle size={12} />{overdueCount} quá hạn</span>
                  )}
                </div>
                <button type="button" className="task-bell-close-btn" onClick={() => setOpen(false)} aria-label="Đóng hộp thư">
                  <X size={18} />
                </button>
              </div>

              <div className="inbox-tabs" role="tablist">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={section === id}
                    className={`inbox-tab ${section === id ? 'is-active' : ''}`}
                    onClick={() => setSection(id)}
                  >
                    <Icon size={14} />
                    <span>{label}</span>
                    {counts[id] > 0 && <span className="inbox-tab-count">{counts[id]}</span>}
                  </button>
                ))}
              </div>

              <div className="task-bell-body">
                {counts[section] === 0 ? (
                  <div className="task-bell-empty">
                    <div className="task-bell-empty-icon"><Sparkles size={28} /></div>
                    <p className="task-bell-empty-title">Mục này đang trống 🎉</p>
                  </div>
                ) : section === 'tasks' ? (
                  <ul className="task-bell-list">
                    {tasks.map((task) => {
                      const overdue = isOverdue(task)
                      const isCompleting = justCompletedId === task.id
                      return (
                        <li
                          key={task.id}
                          className={`task-bell-item ${overdue ? 'is-overdue' : ''} ${isCompleting ? 'is-completing' : ''}`}
                          onClick={() => goTo(`/tasks?id=${task.id}`)}
                        >
                          <button
                            type="button"
                            className={`task-bell-check-btn ${isCompleting ? 'checked' : ''}`}
                            onClick={(e) => quickComplete(e, task)}
                            aria-label={`Hoàn thành: ${task.title}`}
                          >
                            {isCompleting ? <Check size={14} /> : <span className="check-ring" />}
                          </button>
                          <div className="task-bell-item-content">
                            <span className={`task-bell-item-title ${isCompleting ? 'done' : ''}`}>{task.title}</span>
                            <div className="task-bell-item-tags">
                              {overdue ? (
                                <span className="task-tag-badge tag-overdue"><AlertCircle size={11} />Quá hạn</span>
                              ) : task.due_date === today ? (
                                <span className="task-tag-badge tag-today"><Clock size={11} />Hôm nay {timeLabel(task.due_time)}</span>
                              ) : task.due_date ? (
                                <span className="task-tag-badge tag-due"><Clock size={11} />{task.due_date.slice(5).replace('-', '/')} {timeLabel(task.due_time)}</span>
                              ) : null}
                              {task.priority === 'URGENT' && <span className="task-tag-badge tag-urgent"><Flame size={11} />Gấp</span>}
                              {task.category && <span className="task-tag-badge tag-category">{task.category}</span>}
                            </div>
                          </div>
                          <ChevronRight size={15} className="task-bell-item-arrow" />
                        </li>
                      )
                    })}
                  </ul>
                ) : section === 'memories' ? (
                  <ul className="task-bell-list">
                    {anniversaries.map(({ event, monthsAgo }) => (
                      <li key={event.id} className="task-bell-item" onClick={() => goTo('/daily')}>
                        <div className="task-bell-item-content">
                          <span className="task-bell-item-title">{event.title}</span>
                          <div className="task-bell-item-tags">
                            <span className="task-tag-badge tag-today"><CalendarHeart size={11} />{yearsAgoLabel(monthsAgo)}</span>
                            <span className="task-tag-badge tag-category">{event.event_date}</span>
                          </div>
                        </div>
                        <ChevronRight size={15} className="task-bell-item-arrow" />
                      </li>
                    ))}
                  </ul>
                ) : section === 'study' ? (
                  <ul className="task-bell-list">
                    {dueDecks.map((d) => (
                      <li key={d.path} className="task-bell-item" onClick={() => goTo(d.path)}>
                        <div className="task-bell-item-content">
                          <span className="task-bell-item-title">{d.label}</span>
                          <div className="task-bell-item-tags">
                            <span className="task-tag-badge tag-today"><Brain size={11} />{d.due} thẻ tới hạn ôn</span>
                            <span className="task-tag-badge tag-category">{d.total} thẻ tất cả</span>
                          </div>
                        </div>
                        <ChevronRight size={15} className="task-bell-item-arrow" />
                      </li>
                    ))}
                  </ul>
                ) : section === 'manga' ? (
                  <ul className="task-bell-list">
                    {updates.map((u) => (
                      <li
                        key={u.key}
                        className="task-bell-item"
                        onClick={() => {
                          dismiss(u)
                          goTo(mangaPath(u))
                        }}
                      >
                        {u.cover && <img className="mn-cover" src={u.cover} alt="" loading="lazy" />}
                        <div className="task-bell-item-content">
                          <span className="task-bell-item-title">{u.title}</span>
                          <div className="task-bell-item-tags">
                            <span className="task-tag-badge tag-today">+{u.newChapters} chương mới</span>
                            <span className="task-tag-badge tag-category">{u.kind === 'BL' ? 'Truyện BL' : 'Ngôn Tình'}</span>
                          </div>
                        </div>
                        <ChevronRight size={15} className="task-bell-item-arrow" />
                      </li>
                    ))}
                  </ul>
                ) : section === 'videos' ? (
                  <ul className="task-bell-list">
                    {newVideos.updates.map((u) => (
                      <li
                        key={u.key}
                        className="task-bell-item"
                        onClick={() => {
                          newVideos.dismissAll()
                          goTo('/youtube')
                        }}
                      >
                        {u.thumbnail && <img className="mn-cover" src={u.thumbnail} alt="" loading="lazy" />}
                        <div className="task-bell-item-content">
                          <span className="task-bell-item-title">{u.creatorName}</span>
                          <div className="task-bell-item-tags">
                            <span className="task-tag-badge tag-today"><Clapperboard size={11} />+{u.count} video mới</span>
                            <span className="task-tag-badge tag-category">{u.latestTitle}</span>
                          </div>
                        </div>
                        <ChevronRight size={15} className="task-bell-item-arrow" />
                      </li>
                    ))}
                  </ul>
                ) : section === 'people' ? (
                  <ul className="task-bell-list">
                    {occasions.map((o) => (
                      <li key={o.occasion.id} className="task-bell-item" onClick={() => goTo('/people')}>
                        <div className="task-bell-item-content">
                          <span className="task-bell-item-title">{o.label}</span>
                          <div className="task-bell-item-tags">
                            <span className="task-tag-badge tag-today"><Cake size={11} />{countdownLabel(o.days)}</span>
                          </div>
                        </div>
                        <ChevronRight size={15} className="task-bell-item-arrow" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="task-bell-list">
                    {unloggedHabits.map((h) => (
                      <li key={h.id} className="task-bell-item" onClick={() => goTo('/habit')}>
                        <div className="task-bell-item-content">
                          <span className="task-bell-item-title">{h.name}</span>
                          <div className="task-bell-item-tags">
                            <span className="task-tag-badge tag-due"><Flame size={11} />Hôm nay chưa ghi</span>
                          </div>
                        </div>
                        <ChevronRight size={15} className="task-bell-item-arrow" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="task-bell-footer">
                {section === 'videos' && counts.videos > 0 ? (
                  <button type="button" className="task-bell-view-all-btn" onClick={newVideos.dismissAll}>
                    <span>Đánh dấu đã xem hết</span>
                    <ChevronRight size={16} />
                  </button>
                ) : section === 'manga' && counts.manga > 0 ? (
                  <button type="button" className="task-bell-view-all-btn" onClick={dismissAll}>
                    <span>Đánh dấu đã xem hết</span>
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button type="button" className="task-bell-view-all-btn" onClick={() => goTo(SECTION_PATH[section])}>
                    <span>Mở trang tương ứng</span>
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
