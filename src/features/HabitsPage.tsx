import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, FolderCog, GripVertical, LayoutGrid, List, Minus, MoreVertical, Pencil, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import type { Habit, HabitCategory, HabitLog } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'
import { useHeaderAction } from './HeaderAction'
import { Aside, AsideCard } from './AsideSlot'
import { HabitHistoryTable } from './habits/HabitHistoryTable'
import { HabitMonthCalendar } from './habits/HabitMonthCalendar'
import { isCurrentPeriod, monthDates, monthLabel, shiftAnchor, weekDates, weekLabel, yearDates, yearLabel, type HistoryRange } from './habits/historyRange'
import { HabitYearHeatmap } from './habits/HabitYearHeatmap'
import { ProgressRing } from './home/ProgressRing'

type Tab = 'today' | 'categories' | 'history'
/** Bộ lọc dạng chip của tab "Hôm nay". */
type Filter = 'ALL' | 'CHECK' | 'COUNT' | 'GOOD' | 'BAD'

const FILTER_CHIPS: Array<{ key: Filter; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CHECK', label: 'Tích' },
  { key: 'COUNT', label: 'Số liệu' },
  { key: 'GOOD', label: 'Tốt' },
  { key: 'BAD', label: 'Cần hạn chế' },
]

const HABIT_ORDER_STORAGE_KEY = 'daily_habit_priority_order'

import { saveAppSetting } from '../lib/userAppSettings'
import { Z } from '../lib/zLayers'

const colors = ['var(--purple)', 'var(--rose)', 'var(--amber)', 'var(--emerald)', 'var(--cyan)', 'var(--blue)']
const now = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`

function getStoredOrder(): string[] {
  try {
    const raw = localStorage.getItem(HABIT_ORDER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveStoredOrder(ids: string[]) {
  try {
    localStorage.setItem(HABIT_ORDER_STORAGE_KEY, JSON.stringify(ids))
    void saveAppSetting('habit_custom_order', ids)
  } catch {}
}

export function HabitsPage() {
  const { showToast, showSaveToast } = useToast()
  const habits = useQuery<Habit>('habits', 'created_at')
  const categories = useQuery<HabitCategory>('habit_categories', 'name')

  const [logs, setLogs] = useState<HabitLog[]>([])
  const [savingCountId, setSavingCountId] = useState<string | null>(null)
  /** Modal nhập giá trị khi tick COUNT habit thành công */
  const [countPromptHabit, setCountPromptHabit] = useState<Habit | null>(null)
  const [countPromptValue, setCountPromptValue] = useState<string>('')
  const countPromptRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const [historyRange, setHistoryRange] = useState<HistoryRange>('week')
  /** Ngày mốc của kỳ đang xem ở tab Lịch sử (đổi khi bấm ‹ ›). */
  const [anchor, setAnchor] = useState(() => new Date())
  /** Ngày đang ghi nhận ở tab "Hôm nay"; đổi được để bù log ngày trước. */
  const [logDate, setLogDate] = useState(localDate())
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Habit | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [manage, setManage] = useState(false)
  const [editingCategory, setEditingCategory] = useState<HabitCategory | null>(null)

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [habitType, setHabitType] = useState<'GOOD' | 'BAD'>('GOOD')
  const [trackingType, setTrackingType] = useState<'CHECK' | 'COUNT'>('CHECK')
  const [newCategory, setNewCategory] = useState('')
  const [categoryName, setCategoryName] = useState('')

  // Drag and drop & Touch reorder states
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null)
  const [dragOverHabitId, setDragOverHabitId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null)
  const touchStartY = useRef<number>(0)
  const touchCurrentTargetId = useRef<string | null>(null)

  /** Sắp xếp danh sách thói quen theo thứ tự ưu tiên (position hoặc localStorage order). */
  const sortedHabits = useMemo(() => {
    const storedOrder = getStoredOrder()
    const orderMap = new Map<string, number>()
    storedOrder.forEach((id, idx) => orderMap.set(id, idx))

    return [...habits.items].sort((a, b) => {
      // 1. Ưu tiên theo position số lưu trong DB nếu có
      if (typeof a.position === 'number' && typeof b.position === 'number') {
        if (a.position !== b.position) return a.position - b.position
      } else if (typeof a.position === 'number') {
        return -1
      } else if (typeof b.position === 'number') {
        return 1
      }

      // 2. Theo thứ tự đã lưu trong localStorage
      const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999
      const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999
      if (orderA !== orderB) return orderA - orderB

      return (a.name || '').localeCompare(b.name || '')
    })
  }, [habits.items])

  /** Ngày hiển thị ở tab Lịch sử: cả tuần (T2→CN) hoặc cả tháng đang chọn. */
  const historyDates = useMemo(
    () => (historyRange === 'week' ? weekDates(anchor) : historyRange === 'year' ? yearDates(anchor) : monthDates(anchor)),
    [historyRange, anchor],
  )
  const rangeTitle = historyRange === 'week' ? weekLabel(anchor) : historyRange === 'year' ? yearLabel(anchor) : monthLabel(anchor)
  const atCurrentPeriod = isCurrentPeriod(anchor, historyRange)

  /** Tải log phủ cả kỳ đang xem lẫn tháng hiện tại (tab "Hôm nay" cần ngày hôm nay). */
  const fetchFrom = [historyDates[0], `${month}-01`, logDate].sort()[0]
  const fetchTo = [historyDates[historyDates.length - 1], `${month}-31`, logDate].sort().pop()!

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('habit_logs')
      .select('habit_id,date,completed,value')
      .gte('date', fetchFrom)
      .lte('date', fetchTo)
      .then(({ data }) => setLogs((data ?? []) as HabitLog[]))
  }, [habits.items.length, fetchFrom, fetchTo])

  const completed = new Set(logs.filter((l) => l.date === logDate && l.completed).map((l) => l.habit_id))
  const category = (h: Habit) => categories.items.find((c) => c.id === h.category_id)

  const checkHabits = useMemo(() => sortedHabits.filter((h) => (h.tracking_type ?? 'CHECK') === 'CHECK'), [sortedHabits])
  const countHabits = useMemo(() => sortedHabits.filter((h) => h.tracking_type === 'COUNT'), [sortedHabits])

  const goodHabits = useMemo(() => sortedHabits.filter((h) => h.habit_type !== 'BAD'), [sortedHabits])
  const badHabits  = useMemo(() => sortedHabits.filter((h) => h.habit_type === 'BAD'),  [sortedHabits])

  /** Nhóm hiển thị của tab "Hôm nay", suy ra từ chip lọc đang chọn. */
  const filteredHabits = useMemo(() => {
    if (filter === 'CHECK') return checkHabits
    if (filter === 'COUNT') return countHabits
    if (filter === 'GOOD') return goodHabits
    if (filter === 'BAD') return badHabits
    return sortedHabits
  }, [filter, sortedHabits, checkHabits, countHabits, goodHabits, badHabits])

  /** Ô tìm nhanh của tab "Hôm nay": lọc theo tên thói quen, bỏ dấu hoa thường. */
  const matchesSearch = (h: Habit) => !search.trim() || (h.name ?? '').toLowerCase().includes(search.trim().toLowerCase())

  const sections = useMemo(() => {
    if (filter === 'ALL') {
      const check = { key: 'CHECK', title: 'Thói quen tích cực', color: 'var(--emerald)', habits: checkHabits.filter(matchesSearch) }
      const count = { key: 'COUNT', title: 'Theo dõi số liệu', color: 'var(--primary)', habits: countHabits.filter(matchesSearch) }
      return [check, count].filter((s) => s.habits.length > 0)
    }
    const title =
      filter === 'CHECK' ? 'Thói quen Tích'
      : filter === 'COUNT' ? 'Theo dõi số liệu'
      : filter === 'GOOD' ? 'Thói quen tốt'
      : 'Cần hạn chế'
    const color =
      filter === 'BAD' ? 'var(--rose)'
      : filter === 'COUNT' ? 'var(--primary)'
      : 'var(--emerald)'
    return [{ key: filter, title, color, habits: filteredHabits.filter(matchesSearch) }]
  }, [filter, checkHabits, countHabits, filteredHabits, search])

  const groups = useMemo(() => {
    const result: Array<[HabitCategory | null, Habit[]]> = categories.items.map((c) => [c, sortedHabits.filter((h) => h.category_id === c.id)])
    result.push([null, sortedHabits.filter((h) => !h.category_id)])
    return result.filter(([, hs]) => hs.length)
  }, [sortedHabits, categories.items])

  /** Xử lý cập nhật thứ tự ưu tiên mới sau khi kéo thả / di chuyển */
  const persistReorderedHabits = async (newOrderedList: Habit[]) => {
    // 1. Cập nhật vị trí cục bộ và position index
    const withPosition = newOrderedList.map((h, idx) => ({ ...h, position: idx }))
    habits.setItems(withPosition)

    // 2. Lưu vào localStorage để không bao giờ mất thứ tự
    const newIds = withPosition.map((h) => h.id)
    saveStoredOrder(newIds)

    // 3. Cập nhật lên Supabase (nếu có kết nối)
    if (supabase) {
      try {
        const promises = withPosition.map((h) =>
          supabase!.from('habits').update({ position: h.position }).eq('id', h.id),
        )
        await Promise.all(promises)
      } catch {
        // Fallback: nếu database chưa có cột position thì localStorage đã lưu
      }
    }
    showSaveToast(true, 'thứ tự ưu tiên thói quen')
  }

  /** Di chuyển habit từ vị trí nguồn đến trước/sau vị trí đích */
  const moveHabit = (sourceId: string, targetId: string, place: 'top' | 'bottom' = 'top') => {
    if (sourceId === targetId) return
    const currentList = [...sortedHabits]
    const sourceIndex = currentList.findIndex((h) => h.id === sourceId)
    if (sourceIndex === -1) return

    const [moved] = currentList.splice(sourceIndex, 1)
    const targetIndex = currentList.findIndex((h) => h.id === targetId)
    if (targetIndex === -1) {
      currentList.push(moved)
    } else {
      const insertAt = place === 'top' ? targetIndex : targetIndex + 1
      currentList.splice(insertAt, 0, moved)
    }

    void persistReorderedHabits(currentList)
  }

  /** Di chuyển habit lên trên 1 bậc */
  const moveHabitUp = (habitId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const index = sortedHabits.findIndex((h) => h.id === habitId)
    if (index <= 0) return
    const target = sortedHabits[index - 1]
    moveHabit(habitId, target.id, 'top')
  }

  /** Di chuyển habit xuống dưới 1 bậc */
  const moveHabitDown = (habitId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const index = sortedHabits.findIndex((h) => h.id === habitId)
    if (index === -1 || index >= sortedHabits.length - 1) return
    const target = sortedHabits[index + 1]
    moveHabit(habitId, target.id, 'bottom')
  }

  const toggle = async (h: Habit) => {
    const done = !completed.has(h.id)
    setLogs((ls) => [...ls.filter((l) => !(l.habit_id === h.id && l.date === logDate)), { habit_id: h.id, date: logDate, completed: done }])
    const { error } = await supabase!.from('habit_logs').upsert({ habit_id: h.id, date: logDate, completed: done }, { onConflict: 'habit_id,date' })
    if (!error) {
      showSaveToast(true, 'trạng thái thói quen')
    } else {
      showSaveToast(false, 'trạng thái thói quen')
    }
  }

  /** Đặt thẳng số liệu của ngày đang chọn rồi lưu ngay. Số âm bị kẹp về 0. */
  const setCount = async (h: Habit, next: number) => {
    const value = Math.max(0, Math.round(next) || 0)
    const isDone = value > 0
    // Cập nhật lạc quan để nút bấm phản hồi tức thì.
    setLogs((ls) => [
      ...ls.filter((l) => !(l.habit_id === h.id && l.date === logDate)),
      { habit_id: h.id, date: logDate, completed: isDone, value },
    ])
    setSavingCountId(h.id)
    const { data, error } = await supabase!
      .from('habit_logs')
      .upsert({ habit_id: h.id, date: logDate, completed: isDone, value }, { onConflict: 'habit_id,date' })
      .select('habit_id,date,completed,value')
      .single()
    setSavingCountId(null)

    if (!error && data) {
      setLogs((ls) => [...ls.filter((l) => !(l.habit_id === h.id && l.date === logDate)), data as HabitLog])
    } else {
      showSaveToast(false, 'số liệu thói quen')
    }
  }

  const stepCount = (h: Habit, delta: number) => setCount(h, todayValue(h.id) + delta)

  const create = async () => {
    if (!name.trim()) return
    const nextPosition = sortedHabits.length
    const payload = {
      name: name.trim(),
      category_id: categoryId || null,
      tracking_type: trackingType,
      habit_type: habitType,
      position: nextPosition,
    }

    const { data, error } = await supabase!.from('habits').insert(payload).select().single()

    if (!error && data) {
      const created = { ...(data as Habit), habit_type: habitType, position: nextPosition }
      habits.setItems((x) => [...x, created])
      const newOrder = [...getStoredOrder(), created.id]
      saveStoredOrder(newOrder)
      showSaveToast(true, `thói quen "${payload.name}"`)
    } else {
      const fallback = await supabase!
        .from('habits')
        .insert({ name: payload.name, category_id: payload.category_id, tracking_type: payload.tracking_type })
        .select()
        .single()

      const finalHabit: Habit = {
        id: fallback.data?.id ?? Date.now().toString(),
        ...payload,
        is_active: true,
      }
      habits.setItems((x) => [...x, finalHabit])
      const newOrder = [...getStoredOrder(), finalHabit.id]
      saveStoredOrder(newOrder)
      showSaveToast(false, `thói quen "${payload.name}"`)
    }

    setName('')
    setCategoryId('')
    setHabitType('GOOD')
    setTrackingType('CHECK')
    setAddModal(false)
  }

  const save = async () => {
    if (!editing || !name.trim()) return
    const payload = { name: name.trim(), category_id: categoryId || null, tracking_type: trackingType, habit_type: habitType }

    // Update local state immediately (Optimistic Persistence)
    habits.setItems((xs) => xs.map((h) => (h.id === editing.id ? { ...h, ...payload } : h)))
    setEditing(null)

    const { error } = await supabase!.from('habits').update(payload).eq('id', editing.id)
    if (!error) {
      showSaveToast(true, `cập nhật thói quen "${payload.name}"`)
    } else {
      await supabase!.from('habits').update({ name: payload.name, category_id: payload.category_id, tracking_type: payload.tracking_type }).eq('id', editing.id)
      showSaveToast(false, `cập nhật thói quen "${payload.name}"`)
    }
  }

  const deleteHabit = async () => {
    if (!editing) return
    await supabase!.from('habits').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', editing.id)
    habits.setItems((xs) => xs.filter((h) => h.id !== editing.id))
    saveStoredOrder(getStoredOrder().filter((id) => id !== editing.id))
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

  // Hai vòng tròn: xanh cho thói quen tốt (càng đầy càng ngon),
  // đỏ cho thói quen xấu (càng TRỐNG càng ngon — trống = hôm nay không lỡ cái nào).
  const goodDone = goodHabits.filter((h) => completed.has(h.id)).length
  const badDone = badHabits.filter((h) => completed.has(h.id)).length
  const goodPercent = goodHabits.length ? Math.round((goodDone / goodHabits.length) * 100) : 0
  const badPercent = badHabits.length ? Math.round((badDone / badHabits.length) * 100) : 0

  const todayValue = (habitId: string) => logs.find((l) => l.habit_id === habitId && l.date === logDate)?.value ?? 0

  // Nút "+" dùng chung ô hành động trên header của app, giống PeoplePage.
  const openAddHabit = useCallback(() => {
    setName('')
    setCategoryId('')
    setHabitType('GOOD')
    setTrackingType('CHECK')
    setAddModal(true)
  }, [])
  useHeaderAction('Thêm thói quen', openAddHabit)

  const openEditHabit = (h: Habit) => {
    setEditing(h)
    setName(h.name)
    setCategoryId(h.category_id ?? '')
    setHabitType(h.habit_type ?? 'GOOD')
    setTrackingType(h.tracking_type ?? 'CHECK')
  }

  // --- Handlers cho Drag and Drop (Mouse / Desktop) ---
  const handleDragStart = (e: React.DragEvent, habitId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', habitId)
    setDraggedHabitId(habitId)
  }

  const handleDragOver = (e: React.DragEvent, habitId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedHabitId && draggedHabitId !== habitId) {
      const rect = e.currentTarget.getBoundingClientRect()
      const relY = e.clientY - rect.top
      const pos = relY < rect.height / 2 ? 'top' : 'bottom'
      setDragOverHabitId(habitId)
      setDragOverPosition(pos)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Chỉ reset nếu chuột thật sự rời khỏi card
    const current = e.currentTarget
    if (!current.contains(e.relatedTarget as Node)) {
      setDragOverHabitId(null)
      setDragOverPosition(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = draggedHabitId || e.dataTransfer.getData('text/plain')
    if (sourceId && sourceId !== targetId) {
      moveHabit(sourceId, targetId, dragOverPosition || 'top')
    }
    setDraggedHabitId(null)
    setDragOverHabitId(null)
    setDragOverPosition(null)
  }

  const handleDragEnd = () => {
    setDraggedHabitId(null)
    setDragOverHabitId(null)
    setDragOverPosition(null)
  }

  // --- Handlers cho Touch / Long Press Drag (Mobile) ---
  const handleTouchStart = (e: React.TouchEvent, habitId: string) => {
    const touch = e.touches[0]
    touchStartY.current = touch.clientY
    touchCurrentTargetId.current = habitId
    setDraggedHabitId(habitId)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedHabitId) return
    const touch = e.touches[0]
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    const habitItem = element?.closest('[data-habit-id]') as HTMLElement | null
    if (habitItem && habitItem.dataset.habitId) {
      const targetId = habitItem.dataset.habitId
      if (targetId !== draggedHabitId) {
        const rect = habitItem.getBoundingClientRect()
        const relY = touch.clientY - rect.top
        const pos = relY < rect.height / 2 ? 'top' : 'bottom'
        setDragOverHabitId(targetId)
        setDragOverPosition(pos)
        touchCurrentTargetId.current = targetId
      }
    }
  }

  const handleTouchEnd = () => {
    if (draggedHabitId && touchCurrentTargetId.current && draggedHabitId !== touchCurrentTargetId.current) {
      moveHabit(draggedHabitId, touchCurrentTargetId.current, dragOverPosition || 'top')
    }
    setDraggedHabitId(null)
    setDragOverHabitId(null)
    setDragOverPosition(null)
    touchCurrentTargetId.current = null
  }

  const renderHabitItem = (h: Habit, index: number) => {
    const isDone = completed.has(h.id)
    const isBad = h.habit_type === 'BAD'
    const isCount = h.tracking_type === 'COUNT'
    const cat = category(h)
    const isDragging = draggedHabitId === h.id
    const isDragOver = dragOverHabitId === h.id

    const canMoveUp = index > 0
    const canMoveDown = index < sortedHabits.length - 1

    return (
      <div
        key={h.id}
        data-habit-id={h.id}
        draggable
        onDragStart={(e) => handleDragStart(e, h.id)}
        onDragOver={(e) => handleDragOver(e, h.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, h.id)}
        onDragEnd={handleDragEnd}
        className={
          'habit-item' +
          (isDone ? ' is-done' : '') +
          (isBad ? ' is-bad' : '') +
          (isCount ? '' : ' is-tappable') +
          (isDragging ? ' is-dragging' : '') +
          (isDragOver && dragOverPosition === 'top' ? ' drag-over-top' : '') +
          (isDragOver && dragOverPosition === 'bottom' ? ' drag-over-bottom' : '')
        }
        onClick={isCount ? undefined : () => toggle(h)}
      >
        {/* Nút tay cầm kéo thả (Drag Handle) - Đè vào để di chuyển lên/xuống */}
        <div
          className="habit-drag-handle"
          title="Đè hoặc kéo để đổi thứ tự ưu tiên"
          aria-label={`Đổi thứ tự cho ${h.name}`}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => handleTouchStart(e, h.id)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <GripVertical size={16} />
        </div>

        <button
          className={'habit-tick' + (isDone ? ' is-on' : '')}
          aria-label={`Đánh dấu ${h.name}`}
          aria-pressed={isDone}
          onClick={(e) => {
            e.stopPropagation()
            if (isCount && !isDone) {
              // Mở modal nhập giá trị thay vì toggle ngay
              setCountPromptValue(String(todayValue(h.id) || ''))
              setCountPromptHabit(h)
              setTimeout(() => countPromptRef.current?.select(), 80)
            } else {
              toggle(h)
            }
          }}
        />

        <div className="habit-item-body">
          <div className="habit-item-title">{h.name}</div>
          <div className="habit-item-tags">
            {cat && (
              <span className="habit-tag" style={{ color: cat.color, borderColor: 'var(--card-border)' }}>
                {cat.name}
              </span>
            )}
            <span
              className="habit-tag habit-type-tag"
              title={isBad ? 'Cần hạn chế' : 'Thói quen tốt'}
              aria-label={isBad ? 'Cần hạn chế' : 'Thói quen tốt'}
              style={{
                color: isBad ? 'var(--red)' : 'var(--emerald)',
                background: isBad ? 'var(--rose-bg)' : 'var(--emerald-bg)',
                borderColor: isBad ? 'transparent' : 'transparent',
                padding: '2px 6px',
                fontSize: '0.78rem',
              }}
            >
              {isBad ? '⚠️' : '🌟'}
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
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label={`Giá trị hôm nay cho ${h.name}`}
              value={todayValue(h.id)}
              disabled={savingCountId === h.id}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setCount(h, Number(e.target.value))}
            />
            <button aria-label={`Tăng số liệu cho ${h.name}`} disabled={savingCountId === h.id} onClick={() => stepCount(h, 1)}>
              <Plus size={14} />
            </button>
          </div>
        )}

        {/* Nút điều hướng nhanh lên/xuống (tiện lợi cho người dùng) */}
        <div className="habit-item-reorder-btns" onClick={(e) => e.stopPropagation()}>
          <button
            className="habit-reorder-btn"
            disabled={!canMoveUp}
            title="Di chuyển lên trên"
            aria-label={`Di chuyển ${h.name} lên trên`}
            onClick={(e) => moveHabitUp(h.id, e)}
          >
            <ChevronUp size={14} />
          </button>
          <button
            className="habit-reorder-btn"
            disabled={!canMoveDown}
            title="Di chuyển xuống dưới"
            aria-label={`Di chuyển ${h.name} xuống dưới`}
            onClick={(e) => moveHabitDown(h.id, e)}
          >
            <ChevronDown size={14} />
          </button>
        </div>

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
    <section className="page-shell">
      {/* ── Modal nhập số liệu khi tick COUNT habit ── */}
      {countPromptHabit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: Z.fullscreen,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setCountPromptHabit(null)}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '1.25rem',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              padding: '1.75rem 1.5rem 1.5rem',
              maxWidth: 360,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              color: 'var(--text-main)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.25rem', marginBottom: '0.25rem' }}>✅</div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {countPromptHabit.name}
              </h3>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Nhập số liệu hôm nay để đánh dấu hoàn thành
              </p>
            </div>

            {/* Input */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <label
                style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >
                Số lượng / Số phút
              </label>
              <input
                ref={countPromptRef}
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="0"
                autoFocus
                value={countPromptValue}
                onChange={(e) => setCountPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = Number(countPromptValue)
                    if (val > 0) {
                      void setCount(countPromptHabit, val)
                      setCountPromptHabit(null)
                    }
                  } else if (e.key === 'Escape') {
                    setCountPromptHabit(null)
                  }
                }}
                style={{
                  background: 'var(--bg-subtle, var(--card-bg))',
                  border: '2px solid var(--primary)',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1rem',
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  textAlign: 'center',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />

              {/* Quick pick buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.25rem' }}>
                {[5, 10, 15, 20, 25, 30, 45, 60].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCountPromptValue(String(v))}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.85rem',
                      fontWeight: countPromptValue === String(v) ? 700 : 600,
                      borderRadius: '8px',
                      border: countPromptValue === String(v)
                        ? '2px solid var(--primary)'
                        : '1px solid var(--card-border)',
                      background: countPromptValue === String(v)
                        ? 'var(--primary)'
                        : 'var(--bg-subtle)',
                      color: countPromptValue === String(v) ? '#ffffff' : 'var(--text-main)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setCountPromptHabit(null)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--card-border)',
                  background: 'var(--bg-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!countPromptValue || Number(countPromptValue) <= 0}
                onClick={() => {
                  const val = Number(countPromptValue)
                  if (val > 0) {
                    void setCount(countPromptHabit, val)
                    setCountPromptHabit(null)
                  }
                }}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  background: !countPromptValue || Number(countPromptValue) <= 0
                    ? 'var(--card-border)'
                    : 'linear-gradient(135deg, var(--primary), #7c3aed)',
                  color: !countPromptValue || Number(countPromptValue) <= 0
                    ? 'var(--text-muted)'
                    : '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: !countPromptValue || Number(countPromptValue) <= 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <Check size={16} /> Hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cột phụ desktop: hai vòng tròn tiến độ */}
      <Aside>
        <AsideCard title="Hôm nay">
          <div className="aside-ring">
            <ProgressRing percent={goodPercent} size={104} stroke={9} color="var(--emerald)">
              <strong style={{ color: 'var(--emerald)' }}>
                {goodDone}/{goodHabits.length}
              </strong>
              <span>thói quen tốt</span>
            </ProgressRing>
          </div>
          <div className="aside-row">
            <span>Cần hạn chế đã lỡ</span>
            <strong style={{ color: badDone ? 'var(--red)' : 'var(--emerald)' }}>
              {badDone}/{badHabits.length}
            </strong>
          </div>
        </AsideCard>

        <AsideCard title="Tổng quan">
          <div className="aside-row">
            <span>Tổng thói quen</span>
            <strong>{sortedHabits.length}</strong>
          </div>
          <div className="aside-row">
            <span>Dạng tích hoàn thành</span>
            <strong>{checkHabits.length}</strong>
          </div>
          <div className="aside-row">
            <span>Dạng nhập số liệu</span>
            <strong>{countHabits.length}</strong>
          </div>
          <div className="aside-row">
            <span>Đã hoàn thành hôm nay</span>
            <strong style={{ color: 'var(--emerald)' }}>{completed.size}/{sortedHabits.length}</strong>
          </div>
        </AsideCard>
      </Aside>

      {/* Tiêu đề "Habits" + nút thêm đã nằm ở header chung của app */}
      <div className="habit-top-bar">
        <div className="habit-sub-tabs">
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
        <button className="icon habit-manage-btn" aria-label="Quản lý thể loại" title="Quản lý thể loại" onClick={() => setManage(true)}>
          <FolderCog size={16} />
        </button>
      </div>

      {/* Main View Area: TODAY TAB */}
      {activeTab === 'today' && (
        <>
          {/* Ngày đang ghi nhận: đổi để bù thói quen của hôm trước. */}
          <div className="habit-log-date">
            <label htmlFor="habit-log-date">Ngày ghi nhận</label>
            <input id="habit-log-date" type="date" value={logDate} max={localDate()} onChange={(e) => setLogDate(e.target.value || localDate())} />
            {logDate !== localDate() && (
              <button type="button" onClick={() => setLogDate(localDate())}>Về hôm nay</button>
            )}
          </div>

          {sortedHabits.length > 0 && (
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
            </div>
          )}

          {!sortedHabits.length ? (
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

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm thói quen theo tên…"
                aria-label="Tìm thói quen"
                style={{ width: '100%', marginBottom: 8, fontSize: '0.84rem' }}
              />
              {search.trim() && sections.every((s) => !s.habits.length) && (
                <p className="muted" style={{ fontSize: '0.8rem' }}>Không có thói quen nào khớp "{search.trim()}".</p>
              )}

              {/* Hướng dẫn kéo thả nhẹ nhàng */}
              <div className="habit-reorder-hint">
                <GripVertical size={13} />
                <span>Đè giữ hoặc kéo thẻ để sắp xếp thứ tự ưu tiên</span>
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
                      <div className="habit-section-list">
                        {section.habits.map((h, idx) => renderHabitItem(h, idx))}
                      </div>
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
                {cat && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="icon small" aria-label="Rename category" title="Sửa tên thể loại" onClick={() => openRenameCategory(cat)} style={{ padding: 3 }}>
                      <Pencil size={13} />
                    </button>
                    <DeleteButton onDelete={() => removeCategory(cat)} />
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {list.map((h) => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '5px 8px', borderRadius: 6, fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 600 }}>{h.name} <small style={{ color: h.habit_type === 'BAD' ? 'var(--rose)' : 'var(--emerald)' }}>({h.habit_type === 'BAD' ? '⚠️' : '🌟'})</small></span>
                    <button
                      className="icon small"
                      onClick={() => {
                        setEditing(h)
                        setName(h.name)
                        setCategoryId(h.category_id ?? '')
                        setHabitType(h.habit_type ?? 'GOOD')
                        setTrackingType(h.tracking_type ?? 'CHECK')
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
              <button className={historyRange === 'year' ? 'active' : ''} onClick={() => setHistoryRange('year')}>Năm</button>
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

          {historyRange === 'year' ? (
            <div className="card" style={{ padding: 10, margin: 0 }}>
              <h3 style={{ fontSize: '0.84rem', fontWeight: 700, marginBottom: 8, color: 'var(--emerald)' }}>
                🔥 Heatmap cả năm ({checkHabits.length} thói quen tích)
              </h3>
              <HabitYearHeatmap habits={checkHabits} logs={logs} dates={historyDates} />
            </div>
          ) : (
          <>
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
          </>
          )}
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
