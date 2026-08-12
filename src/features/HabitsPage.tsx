import { useMemo, useState, useEffect } from 'react'
import { Calendar, Check, ChevronLeft, ChevronRight, Flame, FolderCog, LayoutGrid, List, Minus, MoreVertical, Pencil, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import type { Habit, HabitCategory, HabitLog } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'
import { HabitHistoryTable } from './habits/HabitHistoryTable'
import { HabitMonthCalendar } from './habits/HabitMonthCalendar'
import { isCurrentPeriod, monthDates, monthLabel, shiftAnchor, weekDates, weekLabel, type HistoryRange } from './habits/historyRange'
import { ProgressRing } from './home/ProgressRing'

type Tab = 'today' | 'categories' | 'history'
/** Bộ lọc dạng chip của tab "Hôm nay". */
type Filter = 'ALL' | 'CHECK' | 'COUNT' | 'GOOD' | 'BAD' | 'MORNING' | 'AFTERNOON' | 'EVENING'

const FILTER_CHIPS: Array<{ key: Filter; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CHECK', label: 'Tích' },
  { key: 'COUNT', label: 'Số liệu' },
  { key: 'GOOD', label: 'Tốt' },
  { key: 'BAD', label: 'Cần hạn chế' },
  { key: 'MORNING', label: '🌅 Sáng' },
  { key: 'AFTERNOON', label: '☀️ Trưa' },
  { key: 'EVENING', label: '🌙 Tối' },
]

const colors = ['var(--purple)', 'var(--rose)', 'var(--amber)', 'var(--emerald)', 'var(--cyan)', 'var(--blue)']
const now = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`

export function HabitsPage() {
  const { showToast, showSaveToast } = useToast()
  const habits = useQuery<Habit>('habits', 'name')
  const categories = useQuery<HabitCategory>('habit_categories', 'name')

  const [logs, setLogs] = useState<HabitLog[]>([])
  const [savingCountId, setSavingCountId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [historyRange, setHistoryRange] = useState<HistoryRange>('week')
  /** Ngày mốc của kỳ đang xem ở tab Lịch sử (đổi khi bấm ‹ ›). */
  const [anchor, setAnchor] = useState(() => new Date())
  const [filter, setFilter] = useState<Filter>('ALL')
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

  /** Ngày hiển thị ở tab Lịch sử: cả tuần (T2→CN) hoặc cả tháng đang chọn. */
  const historyDates = useMemo(
    () => (historyRange === 'week' ? weekDates(anchor) : monthDates(anchor)),
    [historyRange, anchor],
  )
  const rangeTitle = historyRange === 'week' ? weekLabel(anchor) : monthLabel(anchor)
  const atCurrentPeriod = isCurrentPeriod(anchor, historyRange)

  /** Tải log phủ cả kỳ đang xem lẫn tháng hiện tại (tab "Hôm nay" cần ngày hôm nay). */
  const fetchFrom = historyDates[0] < `${month}-01` ? historyDates[0] : `${month}-01`
  const fetchTo = historyDates[historyDates.length - 1] > `${month}-31` ? historyDates[historyDates.length - 1] : `${month}-31`

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('habit_logs')
      .select('habit_id,date,completed,value')
      .gte('date', fetchFrom)
      .lte('date', fetchTo)
      .then(({ data }) => setLogs((data ?? []) as HabitLog[]))
  }, [habits.items.length, fetchFrom, fetchTo])

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

  /** Nhóm hiển thị của tab "Hôm nay", suy ra từ chip lọc đang chọn. */
  const sections = useMemo(() => {
    const check = { key: 'CHECK', title: 'Thói quen tích cực', color: 'var(--emerald)', habits: checkHabits }
    const count = { key: 'COUNT', title: 'Theo dõi số liệu', color: 'var(--primary)', habits: countHabits }
    const bySlot = (slotKey: string) => {
      const slot = routineGroups.find((s) => s.key === slotKey)
      return slot ? [{ key: slot.key, title: slot.label, color: slot.color, habits: slot.habits }] : []
    }
    const picked =
      filter === 'CHECK' ? [check]
      : filter === 'COUNT' ? [count]
      : filter === 'GOOD' ? [{ key: 'GOOD', title: 'Thói quen tốt', color: 'var(--emerald)', habits: goodHabits }]
      : filter === 'BAD' ? [{ key: 'BAD', title: 'Cần hạn chế', color: 'var(--rose)', habits: badHabits }]
      : filter === 'ALL' ? [check, count]
      : bySlot(filter)
    return picked.filter((s) => s.habits.length > 0)
  }, [filter, checkHabits, countHabits, goodHabits, badHabits, routineGroups])

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

  /** Tăng/giảm số liệu của hôm nay rồi lưu ngay (không còn ô nhập + nút lưu rời). */
  const stepCount = async (h: Habit, delta: number) => {
    const value = Math.max(0, todayValue(h.id) + delta)
    const isDone = value > 0
    // Cập nhật lạc quan để nút bấm phản hồi tức thì.
    setLogs((ls) => [
      ...ls.filter((l) => !(l.habit_id === h.id && l.date === localDate())),
      { habit_id: h.id, date: localDate(), completed: isDone, value },
    ])
    setSavingCountId(h.id)
    const { data, error } = await supabase!
      .from('habit_logs')
      .upsert({ habit_id: h.id, date: localDate(), completed: isDone, value }, { onConflict: 'habit_id,date' })
      .select('habit_id,date,completed,value')
      .single()
    setSavingCountId(null)

    if (!error && data) {
      setLogs((ls) => [...ls.filter((l) => !(l.habit_id === h.id && l.date === localDate())), data as HabitLog])
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

  const progressPercent = habits.items.length ? Math.round((completed.size / habits.items.length) * 100) : 0

  // Hai vòng tròn: xanh cho thói quen tốt (càng đầy càng ngon),
  // đỏ cho thói quen xấu (càng TRỐNG càng ngon — trống = hôm nay không lỡ cái nào).
  const goodDone = goodHabits.filter((h) => completed.has(h.id)).length
  const badDone = badHabits.filter((h) => completed.has(h.id)).length
  const goodPercent = goodHabits.length ? Math.round((goodDone / goodHabits.length) * 100) : 0
  const badPercent = badHabits.length ? Math.round((badDone / badHabits.length) * 100) : 0

  const progressMessage =
    badHabits.length > 0 && badDone === 0 && goodDone === goodHabits.length && goodHabits.length > 0
      ? 'Hoàn hảo! Đủ thói quen tốt, không lỡ cái xấu nào 🎉'
      : badHabits.length > 0 && badDone === 0
        ? 'Chưa lỡ thói quen xấu nào, giữ vậy nhé 👏'
        : badHabits.length > 0 && badDone === badHabits.length
          ? 'Hôm nay lỡ hết thói quen xấu rồi, mai làm lại nhé'
          : goodHabits.length > 0 && goodDone === goodHabits.length
            ? 'Xong hết thói quen tốt, tuyệt vời!'
            : 'Tiếp tục duy trì nhé'
  const todayValue = (habitId: string) => logs.find((l) => l.habit_id === habitId && l.date === localDate())?.value ?? 0

  const openEditHabit = (h: Habit) => {
    setEditing(h)
    setName(h.name)
    setCategoryId(h.category_id ?? '')
    setHabitType(h.habit_type ?? 'GOOD')
    setTrackingType(h.tracking_type ?? 'CHECK')
    setRoutineSlot(h.routine ?? 'MORNING')
  }

  const renderHabitItem = (h: Habit) => {
    const isDone = completed.has(h.id)
    const isBad = h.habit_type === 'BAD'
    const isCount = h.tracking_type === 'COUNT'
    const cat = category(h)

    const routine = h.routine || 'MORNING'
    const routineIcon = routine === 'MORNING' ? '🌅' : routine === 'AFTERNOON' ? '☀️' : '🌙'
    const routineColor = routine === 'MORNING' ? 'var(--amber)' : routine === 'AFTERNOON' ? '#f97316' : 'var(--purple)' // using hex for orange since it might not be in css
    const routineBg = routine === 'MORNING' ? 'var(--amber-bg)' : routine === 'AFTERNOON' ? 'rgba(249, 115, 22, 0.1)' : 'var(--purple-bg)'

    return (
      <div
        key={h.id}
        className={'habit-item' + (isDone ? ' is-done' : '') + (isBad ? ' is-bad' : '') + (isCount ? '' : ' is-tappable')}
        onClick={isCount ? undefined : () => toggle(h)}
      >
        <button
          className={'habit-tick' + (isDone ? ' is-on' : '')}
          aria-label={`Đánh dấu ${h.name}`}
          aria-pressed={isDone}
          onClick={(e) => {
            e.stopPropagation()
            toggle(h)
          }}
        >
          {isDone && <Check size={15} strokeWidth={3} />}
        </button>

        <div className="habit-item-body">
          <div className="habit-item-title">{h.name}</div>
          <div className="habit-item-tags">
            {cat && (
              <span className="habit-tag" style={{ color: cat.color, borderColor: 'var(--card-border)' }}>
                {cat.name}
              </span>
            )}
            <span
              className="habit-tag"
              style={{
                color: isBad ? 'var(--red)' : 'var(--emerald)',
                background: isBad ? 'var(--rose-bg)' : 'transparent',
                borderColor: isBad ? 'transparent' : 'var(--card-border)',
              }}
            >
              {isBad ? '⚠ Cần hạn chế' : '☀ Thói quen tốt'}
            </span>
            <span className="habit-tag" style={{ color: routineColor, background: routineBg, borderColor: 'transparent' }}>
              {routineIcon} {routine === 'MORNING' ? 'Sáng' : routine === 'AFTERNOON' ? 'Trưa' : 'Tối'}
            </span>
          </div>
        </div>

        {isCount && (
          <div className="habit-stepper">
            <button
              aria-label={`Giảm số liệu cho ${h.name}`}
              disabled={savingCountId === h.id || todayValue(h.id) === 0}
              onClick={() => stepCount(h, -1)}
            >
              <Minus size={14} />
            </button>
            <span aria-label={`Giá trị hôm nay cho ${h.name}`}>{todayValue(h.id)}</span>
            <button aria-label={`Tăng số liệu cho ${h.name}`} disabled={savingCountId === h.id} onClick={() => stepCount(h, 1)}>
              <Plus size={14} />
            </button>
          </div>
        )}

        <button
          className="habit-item-menu"
          aria-label={`Sửa ${h.name}`}
          onClick={(e) => {
            e.stopPropagation()
            openEditHabit(h)
          }}
        >
          <MoreVertical size={16} />
        </button>
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="habit-add-btn"
            aria-label="Thêm thói quen"
            title="Thêm thói quen"
            onClick={() => { setName(''); setCategoryId(''); setHabitType('GOOD'); setTrackingType('CHECK'); setRoutineSlot('MORNING'); setAddModal(true) }}
          >
            <Plus size={20} />
          </button>
          <button className="icon" aria-label="Manage categories" title="Quản lý thể loại" onClick={() => setManage(true)} style={{ padding: 5 }}>
            <FolderCog size={16} />
          </button>
        </div>
      </div>

      {/* Compact Sub Navigation Tabs */}
      <div className="habit-sub-tabs" style={{ marginBottom: 10 }}>
        <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')}>
          <List size={14} /> Hôm nay {completed.size}/{habits.items.length}
        </button>
        <button className={activeTab === 'categories' ? 'active' : ''} onClick={() => setActiveTab('categories')}>
          <LayoutGrid size={14} /> Thể loại
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
          <Calendar size={14} /> Lịch sử
        </button>
      </div>

      {/* Main View Area: TODAY TAB */}
      {activeTab === 'today' && (
        <>
          {habits.items.length > 0 && (
            <div className="habit-progress-card">
              <div className="habit-progress-rings">
                {goodHabits.length > 0 && (
                  <div className="habit-progress-ring">
                    <ProgressRing percent={goodPercent} size={78} stroke={8} color="var(--emerald)">
                      <strong style={{ color: 'var(--emerald)' }}>{goodDone}/{goodHabits.length}</strong>
                    </ProgressRing>
                    <span style={{ color: 'var(--emerald)' }}>Tốt · làm được</span>
                  </div>
                )}
                {badHabits.length > 0 && (
                  <div className="habit-progress-ring">
                    <ProgressRing percent={badPercent} size={78} stroke={8} color="var(--red)">
                      <strong style={{ color: badDone ? 'var(--red)' : 'var(--emerald)' }}>
                        {badDone}/{badHabits.length}
                      </strong>
                    </ProgressRing>
                    <span style={{ color: 'var(--red)' }}>Xấu · đã lỡ</span>
                  </div>
                )}
              </div>
              <div className="habit-progress-note">
                <div className="habit-progress-headline">
                  <strong>{completed.size}/{habits.items.length}</strong> hoàn thành
                </div>
                <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
                  {progressMessage}
                </p>
              </div>
            </div>
          )}

          {!habits.items.length ? (
            <div className="card" style={{ padding: 14, margin: 0 }}>
              <Empty icon={Flame} colorClass="icon-box-amber">
                Chưa có thói quen nào. Bấm "+" để tạo mới nhé!
              </Empty>
            </div>
          ) : (
            <>
              {/* Hàng chip lọc: cuộn ngang trong khung, không đẩy cả trang */}
              <div className="habit-filter-row">
                {FILTER_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    className={'habit-filter-chip' + (filter === chip.key ? ' is-on' : '')}
                    aria-pressed={filter === chip.key}
                    onClick={() => setFilter(chip.key)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {sections.length === 0 ? (
                  <div className="card" style={{ padding: 14, margin: 0 }}>
                    <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>
                      Không có thói quen nào khớp bộ lọc này.
                    </p>
                  </div>
                ) : (
                  sections.map((section) => (
                    <div key={section.key} className="card habit-section">
                      <div className="habit-section-head">
                        <span className="habit-section-dot" style={{ background: section.color }}>
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <h3>{section.title}</h3>
                        <span className="habit-section-count" style={{ color: section.color }}>
                          {section.habits.filter((h) => completed.has(h.id)).length}/{section.habits.length}
                        </span>
                      </div>
                      <div className="habit-section-list">{section.habits.map(renderHabitItem)}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
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
          {/* Chọn kiểu xem + điều hướng tuần/tháng */}
          <div className="habit-range-bar">
            <div className="habit-range-toggle">
              <button className={historyRange === 'week' ? 'active' : ''} onClick={() => setHistoryRange('week')}>Tuần</button>
              <button className={historyRange === 'month' ? 'active' : ''} onClick={() => setHistoryRange('month')}>Tháng</button>
            </div>
            <div className="habit-range-nav">
              <button className="icon" aria-label="Kỳ trước" onClick={() => setAnchor((a) => shiftAnchor(a, historyRange, -1))}>
                <ChevronLeft size={16} />
              </button>
              <span className="habit-range-title">{rangeTitle}</span>
              <button className="icon" aria-label="Kỳ sau" disabled={atCurrentPeriod} onClick={() => setAnchor((a) => shiftAnchor(a, historyRange, 1))}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* TABLE 1: THÓI QUEN TÍCH */}
          <div className="card" style={{ padding: 10, margin: 0 }}>
            <h3 style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 8, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              ☑️ Thói quen Tích ({checkHabits.length})
            </h3>
            {checkHabits.length ? (
              historyRange === 'month'
                ? <HabitMonthCalendar habits={checkHabits} logs={logs} dates={historyDates} mode="CHECK" />
                : <HabitHistoryTable habits={checkHabits} logs={logs} dates={historyDates} mode="CHECK" />
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
              historyRange === 'month'
                ? <HabitMonthCalendar habits={countHabits} logs={logs} dates={historyDates} mode="COUNT" />
                : <HabitHistoryTable habits={countHabits} logs={logs} dates={historyDates} mode="COUNT" />
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
