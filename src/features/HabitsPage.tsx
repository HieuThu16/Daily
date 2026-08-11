import { useEffect, useMemo, useState } from 'react'
import { Calendar, Check, Flame, FolderCog, LayoutGrid, List, MoreHorizontal, Pencil, Plus, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import type { Habit, HabitCategory, HabitLog } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'

type Tab = 'today' | 'categories' | 'history'
const colors = ['#3b82f6', '#d97706', '#059669', '#7c3aed', '#e11d48']
const now = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`

export function HabitsPage() {
  const habits = useQuery<Habit>('habits', 'name')
  const categories = useQuery<HabitCategory>('habit_categories', 'name')

  const [logs, setLogs] = useState<HabitLog[]>([])
  const [countDrafts, setCountDrafts] = useState<Record<string, string>>({})
  const [savingCountId, setSavingCountId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [editing, setEditing] = useState<Habit | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [manage, setManage] = useState(false)

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [trackingType, setTrackingType] = useState<'CHECK' | 'COUNT'>('CHECK')
  const [newCategory, setNewCategory] = useState('')

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

  const groups = useMemo(() => {
    const result: Array<[HabitCategory | null, Habit[]]> = categories.items.map((c) => [c, habits.items.filter((h) => h.category_id === c.id)])
    result.push([null, habits.items.filter((h) => !h.category_id)])
    return result.filter(([, hs]) => hs.length)
  }, [habits.items, categories.items])

  const toggle = async (h: Habit) => {
    const done = !completed.has(h.id)
    setLogs((ls) => [...ls.filter((l) => !(l.habit_id === h.id && l.date === localDate())), { habit_id: h.id, date: localDate(), completed: done }])
    await supabase!.from('habit_logs').upsert({ habit_id: h.id, date: localDate(), completed: done }, { onConflict: 'habit_id,date' })
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
    if (error || !data) return alert('Không thể lưu số liệu. Hãy kiểm tra migration habit_tracking_types đã được chạy trên Supabase.')
    setLogs((ls) => [...ls.filter((l) => !(l.habit_id === h.id && l.date === localDate())), data as HabitLog])
    setCountDrafts((drafts) => ({ ...drafts, [h.id]: value ? String(value) : '' }))
  }

  const create = async () => {
    if (!name.trim()) return
    const { data } = await supabase!
      .from('habits')
      .insert({ name: name.trim(), category_id: categoryId || null, tracking_type: trackingType })
      .select()
      .single()
    if (data) habits.setItems((x) => [data as Habit, ...x])
    setName('')
    setCategoryId('')
    setTrackingType('CHECK')
    setAddModal(false)
  }

  const save = async () => {
    if (!editing || !name.trim()) return
    const value = { name: name.trim(), category_id: categoryId || null, tracking_type: trackingType }
    await supabase!.from('habits').update(value).eq('id', editing.id)
    habits.setItems((xs) => xs.map((h) => (h.id === editing.id ? { ...h, ...value } : h)))
    setEditing(null)
  }

  const deleteHabit = async () => {
    if (!editing) return
    await supabase!.from('habits').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', editing.id)
    habits.setItems((xs) => xs.filter((h) => h.id !== editing.id))
    setEditing(null)
  }

  const addCategory = async () => {
    if (!newCategory.trim()) return
    const { data } = await supabase!
      .from('habit_categories')
      .insert({ name: newCategory.trim(), color: colors[categories.items.length % colors.length] })
      .select()
      .single()
    if (data) categories.setItems((xs) => [...xs, data as HabitCategory])
    setNewCategory('')
  }

  const addCategoryFromHabitForm = async () => {
    const value = prompt('Tên thể loại thói quen mới')?.trim()
    if (!value) return
    const { data, error } = await supabase!
      .from('habit_categories')
      .insert({ name: value, color: colors[categories.items.length % colors.length] })
      .select()
      .single()
    if (error || !data) return alert('Không thể thêm thể loại. Tên có thể đã tồn tại.')
    const category = data as HabitCategory
    categories.setItems((prev) => [...prev, category])
    setCategoryId(category.id)
  }

  const renameCategory = async (c: HabitCategory) => {
    const value = prompt('Category name', c.name)?.trim()
    if (!value || value === c.name) return
    await supabase!.from('habit_categories').update({ name: value }).eq('id', c.id)
    categories.setItems((xs) => xs.map((x) => (x.id === c.id ? { ...x, name: value } : x)))
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

  return (
    <section style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Top Bar Header */}
      <div className="habit-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="icon-box icon-box-amber">
            <Flame size={22} />
          </div>
          <h1>Habits</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary" onClick={() => { setName(''); setCategoryId(''); setTrackingType('CHECK'); setAddModal(true) }} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            <Plus size={16} /> Add
          </button>
          <button className="icon" aria-label="Manage categories" onClick={() => setManage(true)}>
            <FolderCog size={18} />
          </button>
        </div>
      </div>

      {/* Compact Sub Navigation Tabs */}
      <div className="habit-sub-tabs">
        <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')}>
          <List size={15} /> Today ({completed.size}/{habits.items.length})
        </button>
        <button className={activeTab === 'categories' ? 'active' : ''} onClick={() => setActiveTab('categories')}>
          <LayoutGrid size={15} /> Categories
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
          <Calendar size={15} /> History
        </button>
      </div>

      {/* Main View Area (Fits on screen cleanly!) */}
      {activeTab === 'today' && (
        <div>
          {habits.items.length > 0 && (
            <div className="habit-progress-pill">
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{progressPercent}% completed</div>
              <div className="habit-progress-bar-bg">
                <div className="habit-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}

          {!habits.items.length ? (
            <Empty icon={Flame} colorClass="icon-box-amber">
              No habits set up yet. Click "+ Add" to create one.
            </Empty>
          ) : (
            <div className="habit-quick-grid">
              {habits.items.map((h) => {
                const isDone = completed.has(h.id)
                const cat = category(h)
                return (
                  <div key={h.id} className={'habit-quick-card ' + (isDone ? 'done' : '')} onClick={h.tracking_type === 'CHECK' ? () => toggle(h) : undefined}>
                    <div className="habit-quick-top">
                      <div className="habit-quick-title">{h.name}</div>
                      {h.tracking_type === 'CHECK' ? <div className="habit-quick-check"><Check size={16} /></div> : <span className="category-chip">{todayValue(h.id)}</span>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {cat ? (
                        <span className="category-chip" style={{ color: cat.color }}>
                          {cat.name}
                        </span>
                      ) : (
                        <span />
                      )}
                      {h.tracking_type === 'COUNT' && <div style={{ display: 'flex', gap: 4 }}><input aria-label={`Giá trị hôm nay cho ${h.name}`} type="text" inputMode="numeric" pattern="[0-9]*" value={countValue(h.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => updateCountDraft(h.id, e.target.value)} placeholder="0" style={{ width: 50, padding: '3px 5px', border: '1px solid var(--line)', borderRadius: 6, textAlign: 'center' }} /><button className="icon small" aria-label={`Lưu số liệu cho ${h.name}`} title="Lưu số liệu" disabled={savingCountId === h.id} onClick={(e) => { e.stopPropagation(); saveCount(h) }}><Save size={14} /></button></div>}
                      <button
                        className="icon small"
                        aria-label="Edit habit"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(h)
                          setName(h.name)
                          setCategoryId(h.category_id ?? '')
                          setTrackingType(h.tracking_type ?? 'CHECK')
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="card">
          {!groups.length ? (
            <Empty icon={LayoutGrid} colorClass="icon-box-purple">
              No habits found.
            </Empty>
          ) : (
            groups.map(([c, hs]) => (
              <div className="habit-group" key={c?.id ?? 'none'}>
                <h3>
                  {c ? (
                    <>
                      <i style={{ background: c.color }} />
                      {c.name}
                    </>
                  ) : (
                    'Uncategorized'
                  )}
                </h3>
                {hs.map((h) => (
                  <div className={'check-row ' + (completed.has(h.id) ? 'checked' : '')} key={h.id}>
                    {h.tracking_type === 'CHECK' ? (
                      <button className="habit-check" onClick={() => toggle(h)}>
                        <span className="checkbox">{completed.has(h.id) && <Check size={14} />}</span>
                        <span>{h.name}</span>
                      </button>
                    ) : (
                      <div className="habit-check">
                        <span className="category-chip">{todayValue(h.id)}</span>
                        <span>{h.name}</span>
                      </div>
                    )}
                    {h.tracking_type === 'COUNT' && <div style={{ display: 'flex', gap: 4 }}><input aria-label={`Giá trị hôm nay cho ${h.name}`} type="text" inputMode="numeric" pattern="[0-9]*" value={countValue(h.id)} onChange={(e) => updateCountDraft(h.id, e.target.value)} placeholder="0" style={{ width: 50, padding: '3px 5px', border: '1px solid var(--line)', borderRadius: 6, textAlign: 'center' }} /><button className="icon small" aria-label={`Lưu số liệu cho ${h.name}`} title="Lưu số liệu" disabled={savingCountId === h.id} onClick={() => saveCount(h)}><Save size={14} /></button></div>}
                    <button
                      className="icon small"
                      aria-label="Edit habit"
                      onClick={() => {
                        setEditing(h)
                        setName(h.name)
                        setCategoryId(h.category_id ?? '')
                        setTrackingType(h.tracking_type ?? 'CHECK')
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card history">
          <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>Weekly Streak</h2>
          <div className="week-grid">
            <span>Habit</span>
            {week.map((d) => (
              <span key={d}>{new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
            ))}
            {habits.items.flatMap((h) => [
              <strong key={h.id}>{h.name}</strong>,
              ...week.map((d) => {
                const log = logs.find((l) => l.habit_id === h.id && l.date === d)
                if (h.tracking_type === 'COUNT') {
                  const value = log?.value ?? 0
                  return <span key={h.id + d} className={value > 0 ? 'history-value' : 'history-empty'}>{value > 0 ? value : '–'}</span>
                }
                return <span key={h.id + d} className={log?.completed ? 'history-done' : 'history-empty'}>{log?.completed ? '✓' : '·'}</span>
              }),
            ])}
          </div>
        </div>
      )}

      {/* Modals for Add, Edit & Category Management */}
      {addModal && (
        <Modal title="Add new habit" onClose={() => setAddModal(false)}>
          <label>
            Habit name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read 15 minutes, Meditate..." autoFocus />
          </label>
          <label>
            Loại theo dõi
            <select value={trackingType} onChange={(e) => setTrackingType(e.target.value as 'CHECK' | 'COUNT')}>
              <option value="CHECK">Tích hoàn thành</option>
              <option value="COUNT">Nhập số</option>
            </select>
          </label>
          <label>
            Category
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">No category</option>
                {categories.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" className="icon" aria-label="Thêm thể loại" title="Thêm thể loại" onClick={addCategoryFromHabitForm}><Plus size={16} /></button>
            </div>
          </label>
          <div className="modal-actions">
            <button className="primary" onClick={create} style={{ marginLeft: 'auto' }}>
              Create habit
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title="Edit habit" onClose={() => setEditing(null)}>
          <label>
            Habit name
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label>
            Loại theo dõi
            <select value={trackingType} onChange={(e) => setTrackingType(e.target.value as 'CHECK' | 'COUNT')}>
              <option value="CHECK">Tích hoàn thành</option>
              <option value="COUNT">Nhập số</option>
            </select>
          </label>
          <label>
            Category
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">No category</option>
                {categories.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" className="icon" aria-label="Thêm thể loại" title="Thêm thể loại" onClick={addCategoryFromHabitForm}><Plus size={16} /></button>
            </div>
          </label>
          <div className="modal-actions">
            <DeleteButton onDelete={deleteHabit} />
            <button className="primary" onClick={save}>
              Save changes
            </button>
          </div>
        </Modal>
      )}

      {manage && (
        <Modal title="Habit categories" onClose={() => setManage(false)}>
          <div className="add-habit" style={{ marginBottom: 16 }}>
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name" />
            <button className="primary" onClick={addCategory}>
              Add
            </button>
          </div>
          <div className="category-manager">
            {categories.items.map((c) => (
              <div key={c.id}>
                <i className="color-dot" style={{ background: c.color }} />
                <span>{c.name}</span>
                <button className="icon small" aria-label="Rename category" onClick={() => renameCategory(c)}>
                  <Pencil size={14} />
                </button>
                <DeleteButton onDelete={() => removeCategory(c)} />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </section>
  )
}
