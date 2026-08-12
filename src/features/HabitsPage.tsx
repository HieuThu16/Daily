import { useMemo, useState, useEffect } from 'react'
import { BarChart3, Calendar, Check, Flame, FolderCog, LayoutGrid, List, Pencil, Plus, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import type { Habit, HabitCategory, HabitLog } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'

type Tab = 'today' | 'categories' | 'history'
type GroupView = 'tracking' | 'type' | 'routine'

const colors = ['var(--purple)', 'var(--rose)', 'var(--amber)', 'var(--emerald)', 'var(--cyan)', 'var(--blue)']
const now = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`

export function HabitsPage() {
  const { showToast, showSaveToast } = useToast()
  const habits = useQuery<Habit>('habits', 'name')
  const categories = useQuery<HabitCategory>('habit_categories', 'name')

  const [logs, setLogs] = useState<HabitLog[]>([])
  const [countDrafts, setCountDrafts] = useState<Record<string, string>>({})
  const [savingCountId, setSavingCountId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [groupView, setGroupView] = useState<GroupView>('tracking')
  const [editing, setEditing] = useState<Habit | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [manage, setManage] = useState(false)
  const [editingCategory, setEditingCategory] = useState<HabitCategory | null>(null)

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [habitType, setHabitType] = useState<'GOOD' | 'BAD'>('GOOD')
  const [trackingType, setTrackingType] = useState<'CHECK' | 'COUNT'>('CHECK')
  const [routineSlot, setRoutineSlot] = useState<'MORNING' | 'AFTERNOON' | 'EVENING'>('MORNING')
  const [newCategory, setNewCategory] = useState('')
  const [categoryName, setCategoryName] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('habit_logs')
      .select('habit_id,date,completed,value')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)
      .then(({ data }) => setLogs((data ?? []) as HabitLog[]))
  }, [habits.items.length])

  const completed = new Set(logs.filter((l) => l.date === localDate() && l.completed).map((l) => l.habit_id))
  const category = (h: Habit) => categories.items.find((c) => c.id === h.category_id)

  const checkHabits = useMemo(() => habits.items.filter((h) => (h.tracking_type ?? 'CHECK') === 'CHECK'), [habits.items])
  const countHabits = useMemo(() => habits.items.filter((h) => h.tracking_type === 'COUNT'), [habits.items])

  const goodHabits = useMemo(() => habits.items.filter((h) => h.habit_type !== 'BAD'), [habits.items])
  const badHabits  = useMemo(() => habits.items.filter((h) => h.habit_type === 'BAD'),  [habits.items])

  const SLOTS = [
    { key: 'MORNING',   label: '🌅 Sáng',  color: 'var(--amber)',   bg: 'var(--amber-bg)'   },
    { key: 'AFTERNOON', label: '☀️ Trưa',  color: '#f97316',       bg: 'rgba(249,115,22,0.1)' },
    { key: 'EVENING',   label: '🌙 Tối',   color: 'var(--purple)', bg: 'var(--purple-bg)' },
  ] as const

  const routineGroups = useMemo(() =>
    SLOTS.map((s) => ({ ...s, habits: habits.items.filter((h) => (h.routine ?? 'MORNING') === s.key) }))
  , [habits.items])

  const groups = useMemo(() => {
    const result: Array<[HabitCategory | null, Habit[]]> = categories.items.map((c) => [c, habits.items.filter((h) => h.category_id === c.id)])
    result.push([null, habits.items.filter((h) => !h.category_id)])
    return result.filter(([, hs]) => hs.length)
  }, [habits.items, categories.items])

  const toggle = async (h: Habit) => {
    const done = !completed.has(h.id)
    setLogs((ls) => [...ls.filter((l) => !(l.habit_id === h.id && l.date === localDate())), { habit_id: h.id, date: localDate(), completed: done }])
    const { error } = await supabase!.from('habit_logs').upsert({ habit_id: h.id, date: localDate(), completed: done }, { onConflict: 'habit_id,date' })
    if (!error) {
      showSaveToast(true, 'trạng thái thói quen')
    } else {
      showSaveToast(false, 'trạng thái thói quen')
    }
  }

  const countValue = (habitId: string) => countDrafts[habitId] ?? (todayValue(habitId) ? String(todayValue(habitId)) : '')

  const updateCountDraft = (habitId: string, rawValue: string) => {
    const normalized = rawValue.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
    setCountDrafts((drafts) => ({ ...drafts, [habitId]: normalized }))
  }

  const saveCount = async (h: Habit) => {
    const value = Math.max(0, Number.parseInt(countValue(h.id), 10) || 0)
    const completed = value > 0
    setSavingCountId(h.id)
    const { data, error } = await supabase!
      .from('habit_logs')
      .upsert({ habit_id: h.id, date: localDate(), completed, value }, { onConflict: 'habit_id,date' })
      .select('habit_id,date,completed,value')
      .single()
    setSavingCountId(null)

    if (!error && data) {
      setLogs((ls) => [...ls.filter((l) => !(l.habit_id === h.id && l.date === localDate())), data as HabitLog])
      setCountDrafts((drafts) => ({ ...drafts, [h.id]: value ? String(value) : '' }))
      showSaveToast(true, 'số liệu thói quen')
    } else {
      showSaveToast(false, 'số liệu thói quen')
    }
  }

  const create = async () => {
    if (!name.trim()) return
    const payload = { name: name.trim(), category_id: categoryId || null, tracking_type: trackingType, habit_type: habitType, routine: routineSlot }

    let { data, error } = await supabase!.from('habits').insert(payload).select().single()

    if (!error && data) {
      habits.setItems((x) => [{ ...(data as Habit), habit_type: habitType, routine: routineSlot }, ...x])
      showSaveToast(true, `thói quen "${payload.name}"`)
    } else {
      const fallback = await supabase!
        .from('habits')
        .insert({ name: payload.name, category_id: payload.category_id, tracking_type: payload.tracking_type, routine: payload.routine })
        .select()
        .single()

      const finalHabit: Habit = {
        id: fallback.data?.id ?? Date.now().toString(),
        ...payload,
        is_active: true,
      }
      habits.setItems((x) => [finalHabit, ...x])
      showSaveToast(false, `thói quen "${payload.name}"`)
    }

    setName('')
    setCategoryId('')
    setHabitType('GOOD')
    setTrackingType('CHECK')
    setRoutineSlot('MORNING')
    setAddModal(false)
  }

  const save = async () => {
    if (!editing || !name.trim()) return
    const payload = { name: name.trim(), category_id: categoryId || null, tracking_type: trackingType, habit_type: habitType, routine: routineSlot }

    // Update local state immediately (Optimistic Persistence)
    habits.setItems((xs) => xs.map((h) => (h.id === editing.id ? { ...h, ...payload } : h)))
    setEditing(null)

    let { error } = await supabase!.from('habits').update(payload).eq('id', editing.id)
    if (!error) {
      showSaveToast(true, `cập nhật thói quen "${payload.name}"`)
    } else {
      await supabase!.from('habits').update({ name: payload.name, category_id: payload.category_id, tracking_type: payload.tracking_type, routine: payload.routine }).eq('id', editing.id)
      showSaveToast(false, `cập nhật thói quen "${payload.name}"`)
    }
  }

  const deleteHabit = async () => {
    if (!editing) return
    await supabase!.from('habits').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', editing.id)
    habits.setItems((xs) => xs.filter((h) => h.id !== editing.id))
    setEditing(null)
    showToast('🗑️ Đã xóa thói quen', 'delete')
  }

  const addCategory = async () => {
    if (!newCategory.trim()) return
    const { data } = await supabase!
      .from('habit_categories')
      .insert({ name: newCategory.trim(), color: colors[categories.items.length % colors.length] })
      .select()
      .single()
    if (data) {
      categories.setItems((xs) => [...xs, data as HabitCategory])
      setCategoryId((data as HabitCategory).id)
    }
    setNewCategory('')
  }

  const openRenameCategory = (category: HabitCategory) => {
    setEditingCategory(category)
    setCategoryName(category.name)
  }

  const renameCategory = async () => {
    if (!editingCategory || !categoryName.trim()) return
    const name = categoryName.trim()
    if (name === editingCategory.name) return setEditingCategory(null)
    const { error } = await supabase!.from('habit_categories').update({ name }).eq('id', editingCategory.id)
    if (error) return showToast(error.message, 'delete')
    categories.setItems((xs) => xs.map((category) => (category.id === editingCategory.id ? { ...category, name } : category)))
    setEditingCategory(null)
  }

  const removeCategory = async (c: HabitCategory) => {
    await supabase!.from('habits').update({ category_id: null }).eq('category_id', c.id)
    await supabase!.from('habit_categories').update({ deleted_at: new Date().toISOString() }).eq('id', c.id)
    categories.setItems((xs) => xs.filter((x) => x.id !== c.id))
    habits.setItems((xs) => xs.map((h) => (h.category_id === c.id ? { ...h, category_id: null } : h)))
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(now.getDate() - 6 + i)
    return localDate(d)
  })

  const progressPercent = habits.items.length ? Math.round((completed.size / habits.items.length) * 100) : 0
  const todayValue = (habitId: string) => logs.find((l) => l.habit_id === habitId && l.date === localDate())?.value ?? 0

  const renderHabitItem = (h: Habit) => {
    const isDone = completed.has(h.id)
    const isBad = h.habit_type === 'BAD'
    const cat = category(h)
    
    const routine = h.routine || 'MORNING'
    const routineIcon = routine === 'MORNING' ? '🌅' : routine === 'AFTERNOON' ? '☀️' : '🌙'
    const routineColor = routine === 'MORNING' ? 'var(--amber)' : routine === 'AFTERNOON' ? '#f97316' : 'var(--purple)' // using hex for orange since it might not be in css
    const routineBg = routine === 'MORNING' ? 'var(--amber-bg)' : routine === 'AFTERNOON' ? 'rgba(249, 115, 22, 0.1)' : 'var(--purple-bg)'

    return (
      <div
        key={h.id}
        className={'check-row ' + (isDone ? 'done' : '')}
        onClick={h.tracking_type === 'CHECK' ? () => toggle(h) : undefined}
        style={{
          justifyContent: 'space-between',
          background: isDone ? (isBad ? 'var(--rose-bg)' : 'var(--emerald-bg)') : 'var(--bg-main)',
          borderRadius: 8,
          padding: '6px 10px',
          marginBottom: 0,
          cursor: h.tracking_type === 'CHECK' ? 'pointer' : 'default',
          border: isDone ? (isBad ? '1.5px solid var(--rose)' : '1px solid var(--emerald)') : '1px solid var(--card-border)',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {/* Checkbox Icon */}
          <button
            className={'check-box ' + (isDone ? 'checked' : '')}
            onClick={(e) => {
              e.stopPropagation()
              toggle(h)
            }}
            style={{
              width: 22,
              height: 22,
              minWidth: 22,
              borderRadius: 6,
              padding: 0,
              background: isDone ? (isBad ? 'var(--rose)' : 'var(--primary)') : 'transparent',
              borderColor: isDone ? (isBad ? 'var(--rose)' : 'var(--primary)') : undefined,
            }}
          >
            {isDone && <Check size={14} style={{ color: 'white' }} />}
          </button>

          {/* Title & Category Tag */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: isDone ? (isBad ? 'var(--rose)' : 'var(--text-muted)') : 'var(--text-main)',
                textDecoration: isDone ? 'line-through' : 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {h.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              {cat && (
                <span style={{ fontSize: '0.64rem', fontWeight: 700, color: cat.color, background: 'var(--card-bg)', padding: '1px 5px', borderRadius: 4 }}>
                  {cat.name}
                </span>
              )}
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: isBad ? 'var(--rose)' : 'var(--emerald)',
                  background: isBad ? 'var(--rose-bg)' : 'var(--emerald-bg)',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                {isBad ? '⚠️ Thói quen xấu' : '🌟 Thói quen tốt'}
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: routineColor,
                  background: routineBg,
                  padding: '1px 5px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                {routineIcon} {routine === 'MORNING' ? 'Sáng' : routine === 'AFTERNOON' ? 'Trưa' : 'Tối'}
              </span>
            </div>
          </div>
        </div>

        {/* COUNT Value Input & Edit Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {h.tracking_type === 'COUNT' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <input
                aria-label={`Giá trị hôm nay cho ${h.name}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={countValue(h.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateCountDraft(h.id, e.target.value)}
                placeholder="0"
                style={{ width: 44, padding: '2px 4px', border: '1px solid var(--card-border)', borderRadius: 6, textAlign: 'center', fontSize: '0.76rem', background: 'var(--card-bg)' }}
              />
              <button
                className="icon small"
                aria-label={`Lưu số liệu cho ${h.name}`}
                title="Lưu số liệu"
                disabled={savingCountId === h.id}
                onClick={(e) => {
                  e.stopPropagation()
                  saveCount(h)
                }}
                style={{ padding: 3 }}
              >
                <Save size={13} />
              </button>
            </div>
          )}

          <button
            className="icon small"
            aria-label="Edit habit"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(h)
              setName(h.name)
              setCategoryId(h.category_id ?? '')
              setHabitType(h.habit_type ?? 'GOOD')
              setTrackingType(h.tracking_type ?? 'CHECK')
              setRoutineSlot(h.routine ?? 'MORNING')
            }}
            style={{ padding: 3 }}
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <section style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Top Bar Header */}
      <div className="habit-header-row" style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="icon-box icon-box-amber" style={{ width: 28, height: 28 }}>
            <Flame size={16} />
          </div>
          <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Habits</h1>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="primary" onClick={() => { setName(''); setCategoryId(''); setHabitType('GOOD'); setTrackingType('CHECK'); setRoutineSlot('MORNING'); setAddModal(true) }} style={{ padding: '6px 12px', fontSize: '0.8rem', gap: 4 }}>
            <Plus size={14} /> Thêm
          </button>
          <button className="icon" aria-label="Manage categories" onClick={() => setManage(true)} style={{ padding: 5 }}>
            <FolderCog size={16} />
          </button>
        </div>
      </div>

      {/* Compact Sub Navigation Tabs */}
      <div className="habit-sub-tabs" style={{ marginBottom: 8 }}>
        <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')} style={{ padding: '5px 4px', fontSize: '0.74rem' }}>
          <List size={13} /> Hôm nay ({completed.size}/{habits.items.length})
        </button>
        <button className={activeTab === 'categories' ? 'active' : ''} onClick={() => setActiveTab('categories')} style={{ padding: '5px 4px', fontSize: '0.74rem' }}>
          <LayoutGrid size={13} /> Thể loại
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')} style={{ padding: '5px 4px', fontSize: '0.74rem' }}>
          <Calendar size={13} /> Lịch sử
        </button>
      </div>

      {/* Main View Area: TODAY TAB */}
      {activeTab === 'today' && (
        <div className="card" style={{ padding: 10, margin: 0 }}>
          {habits.items.length > 0 && (
            <div className="habit-progress-pill" style={{ padding: '4px 10px', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{progressPercent}% hoàn thành</div>
              <div className="habit-progress-bar-bg" style={{ height: 5 }}>
                <div className="habit-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}

          {!habits.items.length ? (
            <Empty icon={Flame} colorClass="icon-box-amber">
              Chưa có thói quen nào. Bấm "+ Thêm" để tạo mới nhé!
            </Empty>
          ) : (
            <>
              {/* View toggle */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                <button
                  onClick={() => setGroupView('tracking')}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700,
                    border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                    borderColor: groupView === 'tracking' ? 'var(--cyan)' : 'var(--card-border)',
                    background: groupView === 'tracking' ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-main)',
                    color: groupView === 'tracking' ? 'var(--cyan)' : 'var(--text-muted)',
                  }}
                >
                  ☑️ Tích / 🔢 Số liệu
                </button>
                <button
                  onClick={() => setGroupView('type')}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700,
                    border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                    borderColor: groupView === 'type' ? 'var(--emerald)' : 'var(--card-border)',
                    background: groupView === 'type' ? 'var(--emerald-bg)' : 'var(--bg-main)',
                    color: groupView === 'type' ? 'var(--emerald)' : 'var(--text-muted)',
                  }}
                >
                  🌟 Tốt / ⚠️ Xấu
                </button>
                <button
                  onClick={() => setGroupView('routine')}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700,
                    border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                    borderColor: groupView === 'routine' ? 'var(--primary)' : 'var(--card-border)',
                    background: groupView === 'routine' ? 'var(--primary-light)' : 'var(--bg-main)',
                    color: groupView === 'routine' ? 'var(--primary)' : 'var(--text-muted)',
                  }}
                >
                  🌅 Sáng / ☀️ Trưa / 🌙 Tối
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10, maxHeight: 'calc(100vh - 265px)', minHeight: 180, overflowY: 'auto' }}>
                {/* ── BY TRACKING TYPE (Tích / Số liệu) ── */}
                {groupView === 'tracking' && (
                  <>
                    {checkHabits.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--cyan)', marginBottom: 4 }}>
                          ☑️ Thói quen Tích ({checkHabits.filter((h) => completed.has(h.id)).length}/{checkHabits.length})
                        </div>
                        <div style={{ display: 'grid', gap: 5 }}>{checkHabits.map(renderHabitItem)}</div>
                      </div>
                    )}
                    {countHabits.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#f97316', marginBottom: 4 }}>
                          🔢 Thói quen Số liệu ({countHabits.filter((h) => completed.has(h.id)).length}/{countHabits.length})
                        </div>
                        <div style={{ display: 'grid', gap: 5 }}>{countHabits.map(renderHabitItem)}</div>
                      </div>
                    )}
                  </>
                )}

                {/* ── BY TYPE (Tốt / Xấu) ── */}
                {groupView === 'type' && (
                  <>
                    {goodHabits.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--emerald)', marginBottom: 4 }}>
                          🌟 Thói quen tốt ({goodHabits.filter((h) => completed.has(h.id)).length}/{goodHabits.length})
                        </div>
                        <div style={{ display: 'grid', gap: 5 }}>{goodHabits.map(renderHabitItem)}</div>
                      </div>
                    )}
                    {badHabits.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--rose)', marginBottom: 4 }}>
                          ⚠️ Thói quen cần bỏ ({badHabits.filter((h) => completed.has(h.id)).length}/{badHabits.length})
                        </div>
                        <div style={{ display: 'grid', gap: 5 }}>{badHabits.map(renderHabitItem)}</div>
                      </div>
                    )}
                  </>
                )}

                {/* ── BY ROUTINE (Sáng / Trưa / Tối) ── */}
                {groupView === 'routine' && (
                  <>
                    {routineGroups.map((slot) => slot.habits.length > 0 && (
                      <div key={slot.key}>
                        <div style={{
                          fontSize: '0.76rem', fontWeight: 800, marginBottom: 4,
                          color: slot.color,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <span>{slot.label}</span>
                          <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                            ({slot.habits.filter((h) => completed.has(h.id)).length}/{slot.habits.length})
                          </span>
                        </div>
                        <div style={{ display: 'grid', gap: 5 }}>{slot.habits.map(renderHabitItem)}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {groups.map(([cat, list]) => (
            <div key={cat?.id ?? 'uncategorized'} className="card" style={{ padding: 10, margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: cat?.color ?? 'var(--text-muted)' }}>
                  {cat?.name ?? 'Không phân loại'} ({list.length})
                </span>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {list.map((h) => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '5px 8px', borderRadius: 6, fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 600 }}>{h.name} <small style={{ color: h.habit_type === 'BAD' ? 'var(--rose)' : 'var(--emerald)' }}>({h.habit_type === 'BAD' ? 'Bad' : 'Good'})</small></span>
                    <button
                      className="icon small"
                      onClick={() => {
                        setEditing(h)
                        setName(h.name)
                        setCategoryId(h.category_id ?? '')
                        setHabitType(h.habit_type ?? 'GOOD')
                        setTrackingType(h.tracking_type ?? 'CHECK')
                        setRoutineSlot(h.routine ?? 'MORNING')
                      }}
                      style={{ padding: 2 }}
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HISTORY TAB: DIVIDED INTO 2 TABLES (Tích & Số liệu) */}
      {activeTab === 'history' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {/* TABLE 1: THÓI QUEN TÍCH */}
          <div className="card" style={{ padding: 10, margin: 0 }}>
            <h3 style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 8, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              ☑️ Thói quen Tích ({checkHabits.length})
            </h3>
            {checkHabits.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--card-border)' }}>Thói quen</th>
                      {week.map((d) => (
                        <th key={d} style={{ textAlign: 'center', padding: '4px 2px', borderBottom: '1px solid var(--card-border)' }}>
                          {d.slice(8)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {checkHabits.map((h) => (
                      <tr key={h.id}>
                        <td style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid var(--card-border)' }}>{h.name}</td>
                        {week.map((d) => {
                          const log = logs.find((l) => l.habit_id === h.id && l.date === d)
                          const isDone = log?.completed
                          return (
                            <td key={d} style={{ textAlign: 'center', padding: '4px 2px', borderBottom: '1px solid var(--card-border)' }}>
                              {isDone ? <span style={{ color: h.habit_type === 'BAD' ? 'var(--rose)' : 'var(--emerald)', fontWeight: 800 }}>✓</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>Chưa có thói quen dạng Tích.</p>
            )}
          </div>

          {/* TABLE 2: THÓI QUEN SỐ LIỆU */}
          <div className="card" style={{ padding: 10, margin: 0 }}>
            <h3 style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 8, color: '#f97316', display: 'flex', alignItems: 'center', gap: 6 }}>
              🔢 Thói quen Số liệu ({countHabits.length})
            </h3>
            {countHabits.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--card-border)' }}>Thói quen</th>
                      {week.map((d) => (
                        <th key={d} style={{ textAlign: 'center', padding: '4px 2px', borderBottom: '1px solid var(--card-border)' }}>
                          {d.slice(8)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {countHabits.map((h) => (
                      <tr key={h.id}>
                        <td style={{ padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid var(--card-border)' }}>{h.name}</td>
                        {week.map((d) => {
                          const log = logs.find((l) => l.habit_id === h.id && l.date === d)
                          const val = log?.value ?? (log?.completed ? '✓' : null)
                          return (
                            <td key={d} style={{ textAlign: 'center', padding: '4px 2px', borderBottom: '1px solid var(--card-border)' }}>
                              {val !== null ? <span style={{ color: '#f97316', fontWeight: 800 }}>{val}</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>Chưa có thói quen dạng Số liệu.</p>
            )}
          </div>
        </div>
      )}

      {/* Add Habit Modal */}
      {addModal && (
        <Modal title="Thêm thói quen mới" onClose={() => setAddModal(false)}>
          <label>
            Tên thói quen
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên thói quen..." autoFocus />
          </label>
          <label>
            Loại thói quen
            <select value={habitType} onChange={(e) => setHabitType(e.target.value as 'GOOD' | 'BAD')}>
              <option value="GOOD">🌟 Thói quen tốt (Good habit)</option>
              <option value="BAD">⚠️ Thói quen xấu (Bad habit)</option>
            </select>
          </label>
          <label>
            Thể loại
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Không phân loại</option>
              {categories.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" className="icon small" onClick={() => setManage(true)} title="Quản lý thể loại" aria-label="Quản lý thể loại" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)' }}>
              <FolderCog size={14} /> Quản lý thể loại
            </button>
          </label>
          <label>
            Buổi thực hiện
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                style={{ flex: 1, padding: '6px 0', fontSize: '0.8rem', background: routineSlot === 'MORNING' ? 'var(--primary)' : 'var(--bg-main)', color: routineSlot === 'MORNING' ? 'white' : 'var(--text-main)', border: '1px solid', borderColor: routineSlot === 'MORNING' ? 'var(--primary)' : 'var(--card-border)', borderRadius: 6 }}
                onClick={() => setRoutineSlot('MORNING')}
              >
                🌅 Sáng
              </button>
              <button
                type="button"
                style={{ flex: 1, padding: '6px 0', fontSize: '0.8rem', background: routineSlot === 'AFTERNOON' ? 'var(--primary)' : 'var(--bg-main)', color: routineSlot === 'AFTERNOON' ? 'white' : 'var(--text-main)', border: '1px solid', borderColor: routineSlot === 'AFTERNOON' ? 'var(--primary)' : 'var(--card-border)', borderRadius: 6 }}
                onClick={() => setRoutineSlot('AFTERNOON')}
              >
                ☀️ Trưa
              </button>
              <button
                type="button"
                style={{ flex: 1, padding: '6px 0', fontSize: '0.8rem', background: routineSlot === 'EVENING' ? 'var(--primary)' : 'var(--bg-main)', color: routineSlot === 'EVENING' ? 'white' : 'var(--text-main)', border: '1px solid', borderColor: routineSlot === 'EVENING' ? 'var(--primary)' : 'var(--card-border)', borderRadius: 6 }}
                onClick={() => setRoutineSlot('EVENING')}
              >
                🌙 Tối
              </button>
            </div>
          </label>
          <label>
            Kiểu theo dõi
            <select value={trackingType} onChange={(e) => setTrackingType(e.target.value as 'CHECK' | 'COUNT')}>
              <option value="CHECK">Tích hoàn thành (Checkmark)</option>
              <option value="COUNT">Nhập số phút / số lần</option>
            </select>
          </label>
          <div className="modal-actions">
            <button className="primary" onClick={create}>
              Tạo thói quen
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Habit Modal */}
      {editing && (
        <Modal title="Sửa thói quen" onClose={() => setEditing(null)}>
          <label>
            Tên thói quen
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên thói quen..." />
          </label>
          <label>
            Loại thói quen
            <select value={habitType} onChange={(e) => setHabitType(e.target.value as 'GOOD' | 'BAD')}>
              <option value="GOOD">🌟 Thói quen tốt (Good habit)</option>
              <option value="BAD">⚠️ Thói quen xấu (Bad habit)</option>
            </select>
          </label>
          <label>
            Thể loại
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Không phân loại</option>
              {categories.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" className="icon small" onClick={() => setManage(true)} title="Quản lý thể loại" aria-label="Quản lý thể loại" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)' }}>
              <FolderCog size={14} /> Quản lý thể loại
            </button>
          </label>
          <label>
            Buổi thực hiện
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                type="button"
                style={{ flex: 1, padding: '6px 0', fontSize: '0.8rem', background: routineSlot === 'MORNING' ? 'var(--primary)' : 'var(--bg-main)', color: routineSlot === 'MORNING' ? 'white' : 'var(--text-main)', border: '1px solid', borderColor: routineSlot === 'MORNING' ? 'var(--primary)' : 'var(--card-border)', borderRadius: 6 }}
                onClick={() => setRoutineSlot('MORNING')}
              >
                🌅 Sáng
              </button>
              <button
                type="button"
                style={{ flex: 1, padding: '6px 0', fontSize: '0.8rem', background: routineSlot === 'AFTERNOON' ? 'var(--primary)' : 'var(--bg-main)', color: routineSlot === 'AFTERNOON' ? 'white' : 'var(--text-main)', border: '1px solid', borderColor: routineSlot === 'AFTERNOON' ? 'var(--primary)' : 'var(--card-border)', borderRadius: 6 }}
                onClick={() => setRoutineSlot('AFTERNOON')}
              >
                ☀️ Trưa
              </button>
              <button
                type="button"
                style={{ flex: 1, padding: '6px 0', fontSize: '0.8rem', background: routineSlot === 'EVENING' ? 'var(--primary)' : 'var(--bg-main)', color: routineSlot === 'EVENING' ? 'white' : 'var(--text-main)', border: '1px solid', borderColor: routineSlot === 'EVENING' ? 'var(--primary)' : 'var(--card-border)', borderRadius: 6 }}
                onClick={() => setRoutineSlot('EVENING')}
              >
                🌙 Tối
              </button>
            </div>
          </label>
          <label>
            Kiểu theo dõi
            <select value={trackingType} onChange={(e) => setTrackingType(e.target.value as 'CHECK' | 'COUNT')}>
              <option value="CHECK">Tích hoàn thành (Checkmark)</option>
              <option value="COUNT">Nhập số phút / số lần</option>
            </select>
          </label>
          <div className="modal-actions">
            <DeleteButton onDelete={deleteHabit} />
            <button className="primary" onClick={save}>
              Lưu thay đổi
            </button>
          </div>
        </Modal>
      )}

      {/* Manage Categories Modal */}
      {manage && (
        <Modal title="Quản lý thể loại thói quen" onClose={() => setManage(false)}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Tên thể loại mới..." style={{ flex: 1 }} />
            <button className="primary" onClick={addCategory}>
              Thêm
            </button>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {categories.items.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '6px 10px', borderRadius: 8 }}>
                <span style={{ color: c.color, fontWeight: 700 }}>{c.name}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon small" aria-label="Rename category" onClick={() => openRenameCategory(c)} style={{ padding: 3 }}>
                    <Pencil size={13} />
                  </button>
                  <DeleteButton onDelete={() => removeCategory(c)} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {editingCategory && (
        <Modal title="Đổi tên thể loại" onClose={() => setEditingCategory(null)}>
          <label>
            Tên thể loại
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && renameCategory()} />
          </label>
          <div className="modal-actions">
            <button className="primary" onClick={renameCategory}>Lưu</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
