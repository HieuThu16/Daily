import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Check, CheckSquare, Flame, NotebookPen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import type { Entry, Habit, HabitLog, Media as MediaItem, Todo } from '../types'

export function HomePage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [dailyEntries, setDailyEntries] = useState<Entry[]>([])
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      if (!supabase) return
      setLoading(true)
      const [h, l, t, d, m] = await Promise.all([
        supabase.from('habits').select('*').eq('is_active', true).is('deleted_at', null),
        supabase.from('habit_logs').select('*').eq('date', localDate()),
        supabase.from('todos').select('*').eq('completed', false).is('deleted_at', null).limit(4),
        supabase.from('daily_entries').select('*').eq('entry_date', localDate()).is('deleted_at', null).limit(3),
        supabase.from('media_items').select('*').eq('status', 'IN_PROGRESS').is('deleted_at', null).limit(3),
      ])

      setHabits((h.data ?? []) as Habit[])
      setLogs((l.data ?? []) as HabitLog[])
      setTodos((t.data ?? []) as Todo[])
      setDailyEntries((d.data ?? []) as Entry[])
      setMedia((m.data ?? []) as MediaItem[])
      setLoading(false)
    })()
  }, [])

  const completedHabitIds = new Set(logs.filter((l) => l.completed).map((l) => l.habit_id))

  const toggleHabit = async (h: Habit) => {
    const done = !completedHabitIds.has(h.id)
    setLogs((prev) => [...prev.filter((l) => l.habit_id !== h.id), { habit_id: h.id, date: localDate(), completed: done }])
    await supabase!.from('habit_logs').upsert({ habit_id: h.id, date: localDate(), completed: done }, { onConflict: 'habit_id,date' })
  }

  const toggleTodo = async (t: Todo) => {
    const next = !t.completed
    setTodos((prev) => prev.filter((i) => i.id !== t.id))
    await supabase!.from('todos').update({ completed: next }).eq('id', t.id)
  }

  return (
    <section style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 2x2 Max Information Dashboard Grid (Zero Greeting Text, Maximum Space Efficiency!) */}
      <div className="home-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {/* Card 1: Today's Habits */}
        <div className="card" style={{ padding: 12, margin: 0, height: 230, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem' }}>
              <div className="icon-box icon-box-sm icon-box-amber" style={{ width: 22, height: 22 }}>
                <Flame size={13} />
              </div>
              <span>Habits</span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 700 }}>
              {completedHabitIds.size}/{habits.length}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 4 }}>
            {loading ? (
              <p className="muted" style={{ fontSize: '0.78rem' }}>Đang tải…</p>
            ) : habits.length ? (
              habits.map((h) => {
                const isDone = completedHabitIds.has(h.id)
                return (
                  <div key={h.id} className={'check-row ' + (isDone ? 'checked' : '')} onClick={() => toggleHabit(h)} style={{ padding: '5px 8px', borderRadius: 8, margin: 0, cursor: 'pointer' }}>
                    <span className="checkbox" style={{ width: 18, height: 18, borderRadius: 5 }}>
                      {isDone && <Check size={12} />}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{h.name}</span>
                  </div>
                )
              })
            ) : (
              <p className="muted" style={{ fontSize: '0.78rem', textAlign: 'center', padding: '20px 0' }}>Chưa có thói quen nào.</p>
            )}
          </div>
        </div>

        {/* Card 2: To Do */}
        <div className="card" style={{ padding: 12, margin: 0, height: 230, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem' }}>
              <div className="icon-box icon-box-sm icon-box-purple" style={{ width: 22, height: 22 }}>
                <CheckSquare size={13} />
              </div>
              <span>To Do</span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--purple)', fontWeight: 700 }}>{todos.length}</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 4 }}>
            {loading ? (
              <p className="muted" style={{ fontSize: '0.78rem' }}>Đang tải…</p>
            ) : todos.length ? (
              todos.map((t) => (
                <div key={t.id} className="check-row" onClick={() => toggleTodo(t)} style={{ padding: '5px 8px', borderRadius: 8, margin: 0, cursor: 'pointer' }}>
                  <span className="checkbox" style={{ width: 18, height: 18, borderRadius: 5 }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{t.title}</span>
                </div>
              ))
            ) : (
              <p className="muted" style={{ fontSize: '0.78rem', textAlign: 'center', padding: '20px 0' }}>Hoàn thành hết rồi ✨</p>
            )}
          </div>
        </div>

        {/* Card 3: Today's Daily */}
        <div className="card daily-card" style={{ padding: 12, margin: 0, height: 210, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem', marginBottom: 6 }}>
              <div className="icon-box icon-box-sm icon-box-emerald" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', width: 22, height: 22 }}>
                <NotebookPen size={13} />
              </div>
              <span>Today's Daily ({dailyEntries.length})</span>
            </div>

            {dailyEntries.length > 0 ? (
              <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                {dailyEntries.slice(0, 2).map((e) => (
                  <div key={e.id} style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 8px', borderRadius: 6, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    • {e.content}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: '8px 0', fontSize: '0.82rem', color: '#dbeafe' }}>Hôm nay chưa có bài viết nào. Ghi lại khoảnh khắc nhé!</p>
            )}
          </div>

          <a href="/daily" style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: 8, marginTop: 6 }}>
            Viết nhật ký <ArrowRight size={14} />
          </a>
        </div>

        {/* Card 4: Currently in progress */}
        <div className="card" style={{ padding: 12, margin: 0, height: 210, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.88rem' }}>
              <div className="icon-box icon-box-sm icon-box-blue" style={{ width: 22, height: 22 }}>
                <BookOpen size={13} />
              </div>
              <span>Currently</span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 700 }}>{media.length}</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 4 }}>
            {loading ? (
              <p className="muted" style={{ fontSize: '0.78rem' }}>Đang tải…</p>
            ) : media.length ? (
              media.map((m) => (
                <div key={m.id} className="current" style={{ padding: '4px 0', fontSize: '0.8rem' }}>
                  <strong style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</strong>
                  <span style={{ fontSize: '0.65rem', padding: '1px 5px' }}>{m.type.toLowerCase()}</span>
                </div>
              ))
            ) : (
              <p className="muted" style={{ fontSize: '0.78rem', textAlign: 'center', padding: '20px 0' }}>Chưa có mục nào đang thưởng thức.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
