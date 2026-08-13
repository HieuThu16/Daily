import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Check, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Clock, Eye, Filter, History, Lightbulb, Pencil, Plus, Timer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import { POSTPONE_PRESETS, formatDeadline, formatMinutes, isOverdue, postponeTo, timeLabel } from '../lib/deadline'
import type { Idea, TaskDifficulty, TaskPostpone, TaskPriority, Todo } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'
import { useHeaderAction } from './HeaderAction'
import { Aside, AsideCard } from './AsideSlot'
import { saveLocal } from '../lib/persistence'

type Tab = 'tasks' | 'ideas' | 'stats'
type EditState = { kind: 'todo'; item: Todo } | { kind: 'idea'; item: Idea }
type ViewState = { kind: 'todo'; item: Todo } | { kind: 'idea'; item: Idea }
type AddModalState = { kind: 'todo' } | { kind: 'idea' } | null

// Màu lấy từ token của app (var(--emerald) / --blue / --rose / --amber) qua class .task-chip-*,
// nhờ vậy chip đổi màu theo dark mode thay vì giữ nguyên mã hex sáng như trước.
const DIFFICULTY_CONFIG: Record<TaskDifficulty, { label: string; tone: string }> = {
  EASY: { label: '🟢 Dễ', tone: 'emerald' },
  NORMAL: { label: '🔵 Bình thường', tone: 'blue' },
  HARD: { label: '🔴 Khó', tone: 'rose' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; tone: string }> = {
  NORMAL: { label: 'Bình thường', tone: '' },
  URGENT: { label: '🔥 Gấp', tone: 'amber' },
}

const DIFFICULTY_OPTIONS = ['EASY', 'NORMAL', 'HARD'] as const
const PRIORITY_OPTIONS = ['NORMAL', 'URGENT'] as const

/** Dời ngày 'YYYY-MM-DD' đi n ngày, giữ nguyên múi giờ địa phương. */
const shiftDate = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + days))
}

export function Chip({ tone, title, children }: { tone?: string; title?: string; children: React.ReactNode }) {
  return (
    <span className={'task-chip' + (tone ? ` task-chip-${tone}` : '')} title={title}>
      {children}
    </span>
  )
}

/**
 * Hàng nút chọn một giá trị (độ khó / ưu tiên) — dùng chung cho cả modal Thêm và Sửa.
 * Config truyền vào chứ không gộp, vì độ khó và ưu tiên dùng chung khóa 'NORMAL'.
 */
function ChoiceRow<T extends string>({
  options,
  config,
  value,
  onChange,
}: {
  options: readonly T[]
  config: Record<T, { label: string; tone: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="task-choice-row">
      {options.map((o) => {
        const cfg = config[o]
        return (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            className={'task-choice' + (value === o ? ` is-on task-chip-${cfg.tone || 'blue'}` : '')}
            onClick={() => onChange(o)}
          >
            {cfg.label}
          </button>
        )
      })}
    </div>
  )
}

export function DifficultyBadge({ difficulty }: { difficulty?: TaskDifficulty }) {
  const cfg = DIFFICULTY_CONFIG[difficulty ?? 'EASY']
  return <Chip tone={cfg.tone}>{cfg.label}</Chip>
}

export function PriorityBadge({ priority, showNormal = false }: { priority?: TaskPriority; showNormal?: boolean }) {
  const prio = priority ?? 'NORMAL'
  if (prio === 'NORMAL' && !showNormal) return null
  const cfg = PRIORITY_CONFIG[prio]
  return <Chip tone={cfg.tone}>{cfg.label}</Chip>
}

/**
 * Thẻ công việc 2 tầng: tầng 1 là checkbox + tiêu đề + nút thao tác,
 * tầng 2 là các chip (giờ hạn, độ khó, ưu tiên, trì hoãn) và tự ẩn khi không có chip nào.
 */
function TaskCard({
  todo,
  now,
  onToggle,
  onPostpone,
  onView,
  onEdit,
}: {
  todo: Todo
  now: Date
  onToggle: (t: Todo) => void
  onPostpone: (t: Todo) => void
  onView: (t: Todo) => void
  onEdit: (t: Todo) => void
}) {
  const overdue = isOverdue(todo, now)
  const time = timeLabel(todo.due_time)
  const postponeCount = todo.postpone_count ?? 0
  const difficulty = todo.difficulty ?? 'EASY'
  const urgent = todo.priority === 'URGENT'

  // Task dễ + không gấp + không hạn giờ + chưa hoãn thì tầng 2 rỗng, thẻ gọn lại một dòng
  const hasMeta = Boolean(time) || postponeCount > 0 || urgent || difficulty !== 'EASY'

  const classes = ['task-card']
  if (todo.completed) classes.push('is-done')
  else if (overdue) classes.push('is-overdue')
  else if (urgent) classes.push('is-urgent')

  return (
    <div className={classes.join(' ')}>
      <div className="task-card-main">
        <button className="task-toggle" onClick={() => onToggle(todo)}>
          <span className="task-check" aria-hidden="true" />
          <span className="task-title">{todo.title}</span>
        </button>
        <div className="task-actions">
          <button className="icon small" aria-label="Postpone task" title="Trì hoãn" onClick={() => onPostpone(todo)}>
            <Timer size={15} />
          </button>
          <button className="icon small" aria-label="View task details" title="Chi tiết" onClick={() => onView(todo)}>
            <Eye size={15} />
          </button>
          <button className="icon small" aria-label="Edit task" title="Sửa" onClick={() => onEdit(todo)}>
            <Pencil size={14} />
          </button>
        </div>
      </div>

      {hasMeta && (
        <div className="task-meta">
          {time && (
            <Chip tone={overdue ? 'rose' : undefined} title={overdue ? 'Đã quá giờ hạn chót' : 'Giờ hạn chót'}>
              <Clock size={11} /> {time}
            </Chip>
          )}
          {difficulty !== 'EASY' && <DifficultyBadge difficulty={difficulty} />}
          <PriorityBadge priority={todo.priority} />
          {postponeCount > 0 && (
            <Chip tone="amber" title={`Đã trì hoãn ${postponeCount} lần · tổng ${formatMinutes(todo.postpone_minutes ?? 0)}`}>
              ⏳×{postponeCount}
            </Chip>
          )}
        </div>
      )}
    </div>
  )
}

export function TasksPage() {
  const { showToast } = useToast()
  const todos = useQuery<Todo>('todos')
  const ideas = useQuery<Idea>('ideas')

  const [activeTab, setActiveTab] = useState<Tab>('tasks')
  const [selectedDate, setSelectedDate] = useState<string>(localDate())
  const [search, setSearch] = useState('')

  // Filter & Sort states
  const [filterDifficulty, setFilterDifficulty] = useState<'ALL' | TaskDifficulty>('ALL')
  const [filterPriority, setFilterPriority] = useState<'ALL' | TaskPriority>('ALL')
  const [sortBy, setSortBy] = useState<'DEFAULT' | 'PRIORITY' | 'DIFFICULTY'>('DEFAULT')
  const [showFilters, setShowFilters] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const filtersActive = filterDifficulty !== 'ALL' || filterPriority !== 'ALL' || sortBy !== 'DEFAULT'

  // Form & Modal states
  const [addModal, setAddModal] = useState<AddModalState>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState(localDate())
  const [newDueTime, setNewDueTime] = useState('')
  const [newDifficulty, setNewDifficulty] = useState<TaskDifficulty>('EASY')
  const [newPriority, setNewPriority] = useState<TaskPriority>('NORMAL')
  const [newIdeaContent, setNewIdeaContent] = useState('')

  const [edit, setEdit] = useState<EditState | null>(null)
  const [viewDetail, setViewDetail] = useState<ViewState | null>(null)

  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editDueDate, setEditDueDate] = useState(localDate())
  const [editDueTime, setEditDueTime] = useState('')
  const [editDifficulty, setEditDifficulty] = useState<TaskDifficulty>('EASY')
  const [editPriority, setEditPriority] = useState<TaskPriority>('NORMAL')

  // Postpone states
  const [postponeTarget, setPostponeTarget] = useState<Todo | null>(null)
  const [postponePreset, setPostponePreset] = useState(POSTPONE_PRESETS[1].minutes)
  const [postponeCustom, setPostponeCustom] = useState('')
  const [postponeReason, setPostponeReason] = useState('')
  const [postponeBusy, setPostponeBusy] = useState(false)

  // Postpone history of the task shown in the detail modal
  const [history, setHistory] = useState<TaskPostpone[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Ticking clock so overdue highlighting stays accurate without a reload
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Open Add Modal
  const openAddModal = (kind: 'todo' | 'idea') => {
    setNewTitle('')
    setNewDueDate(selectedDate)
    setNewDueTime('')
    setNewDifficulty('EASY')
    setNewPriority('NORMAL')
    setNewIdeaContent('')
    setAddModal({ kind })
  }

  // Nút "+" của trang dùng ô hành động trên header chung, giống Habits và Người.
  // Bấm ở tab Ideas thì thêm ý tưởng, các tab còn lại thì thêm công việc.
  const addKind = activeTab === 'ideas' ? 'idea' : 'todo'
  const openAddFromHeader = useCallback(() => openAddModal(addKind), [addKind, selectedDate])
  useHeaderAction(addKind === 'idea' ? 'Thêm ý tưởng' : 'Thêm công việc', openAddFromHeader)

  /**
   * Supabase từ chối ghi (thiếu cột do chưa chạy migration, RLS, mất mạng…).
   * Phải nói rõ lý do: báo chung chung "Đã lưu Local" từng che mất lỗi thiếu cột suốt thời gian dài.
   */
  const reportWriteError = (error: { message?: string } | null, key: string, value: unknown) => {
    console.error('[tasks] Supabase write failed:', error)
    const savedLocally = saveLocal(key, value)
    const reason = error?.message?.trim() || 'không rõ nguyên nhân'
    showToast(savedLocally ? `⚠️ Supabase từ chối: ${reason} — đã lưu tạm Local` : `⚠️ Lưu thất bại: ${reason}`, 'local')
  }

  // Create Todo
  const saveNewTodo = async () => {
    if (!newTitle.trim()) return
    const title = newTitle.trim()
    const payload = {
      title,
      completed: false,
      due_date: newDueDate,
      due_time: newDueTime || null,
      difficulty: newDifficulty,
      priority: newPriority,
    }

    const tempTodo: Todo = {
      id: Date.now().toString(),
      title,
      completed: false,
      due_date: newDueDate,
      due_time: newDueTime || null,
      difficulty: newDifficulty,
      priority: newPriority,
      postpone_count: 0,
      postpone_minutes: 0,
      created_at: new Date().toISOString(),
    }

    todos.setItems((prev) => [tempTodo, ...prev])
    setAddModal(null)
    setNewTitle('')
    setNewDueTime('')
    setNewDifficulty('EASY')
    setNewPriority('NORMAL')
    showToast('➕ Đã thêm công việc mới!')

    const { data, error } = await supabase!.from('todos').insert(payload).select().single()
    if (!error && data) {
      todos.setItems((prev) => prev.map((item) => (item.id === tempTodo.id ? (data as Todo) : item)))
      showToast('Đã lưu Supabase')
    } else {
      reportWriteError(error, `todo:${tempTodo.id}`, tempTodo)
    }
  }

  // Create Idea
  const saveNewIdea = async () => {
    if (!newTitle.trim()) return
    const title = newTitle.trim()
    const content = newIdeaContent.trim()

    const tempIdea: Idea = {
      id: Date.now().toString(),
      title,
      content: content || '',
      created_at: new Date().toISOString(),
    }

    ideas.setItems((prev) => [tempIdea, ...prev])
    setAddModal(null)
    setNewTitle('')
    setNewIdeaContent('')
    showToast('💡 Đã thêm ý tưởng mới!')

    const { data } = await supabase!.from('ideas').insert({ title, content }).select().single()
    if (data) {
      ideas.setItems((prev) => prev.map((item) => (item.id === tempIdea.id ? (data as Idea) : item)))
    }
  }

  // Toggle Todo completion with completion timestamp logging
  const flipTodo = async (t: Todo) => {
    const next = !t.completed
    const completedAt = next ? new Date().toISOString() : null
    const updateData = { completed: next, completed_at: completedAt }

    todos.setItems((prev) => prev.map((i) => (i.id === t.id ? { ...i, ...updateData } : i)))
    const { error } = await supabase!.from('todos').update(updateData).eq('id', t.id)
    if (error) {
      reportWriteError(error, `todo:${t.id}`, { ...t, ...updateData })
    } else {
      showToast(next ? '✅ Đã tích hoàn thành công việc!' : '🔄 Đã bỏ tích công việc')
    }
  }

  // Open Edit Modal
  const openEdit = (e: EditState) => {
    setEdit(e)
    setEditTitle(e.item.title)
    if (e.kind === 'idea') {
      setEditContent(e.item.content ?? '')
    } else {
      const itemDate = e.item.due_date ?? (e.item.created_at ? e.item.created_at.slice(0, 10) : localDate())
      setEditDueDate(itemDate)
      setEditDueTime(timeLabel(e.item.due_time))
      setEditDifficulty(e.item.difficulty ?? 'EASY')
      setEditPriority(e.item.priority ?? 'NORMAL')
    }
  }

  // Save Edit
  const saveEdit = async () => {
    if (!edit || !editTitle.trim()) return
    if (edit.kind === 'todo') {
      const updateData = {
        title: editTitle.trim(),
        due_date: editDueDate,
        due_time: editDueTime || null,
        difficulty: editDifficulty,
        priority: editPriority,
      }
      todos.setItems((prev) => prev.map((i) => (i.id === edit.item.id ? { ...i, ...updateData } : i)))
      const { error } = await supabase!.from('todos').update(updateData).eq('id', edit.item.id)
      if (error) {
        reportWriteError(error, `todo:${edit.item.id}`, { ...edit.item, ...updateData })
        setEdit(null)
        return
      }
      showToast('Đã lưu Supabase')
    } else {
      const updateData = { title: editTitle.trim(), content: editContent }
      ideas.setItems((prev) => prev.map((i) => (i.id === edit.item.id ? { ...i, ...updateData } : i)))
      await supabase!.from('ideas').update(updateData).eq('id', edit.item.id)
    }
    setEdit(null)
    showToast('✏️ Đã lưu thay đổi!')
  }

  // Delete item
  const remove = async () => {
    if (!edit) return
    const table = edit.kind === 'todo' ? 'todos' : 'ideas'
    await supabase!.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', edit.item.id)
    if (edit.kind === 'todo') {
      todos.setItems((prev) => prev.filter((i) => i.id !== edit.item.id))
    } else {
      ideas.setItems((prev) => prev.filter((i) => i.id !== edit.item.id))
    }
    setEdit(null)
    showToast('🗑️ Đã xóa mục thành công', 'delete')
  }

  const openView = (item: Todo) => setViewDetail({ kind: 'todo', item })
  const openEditTodo = (item: Todo) => openEdit({ kind: 'todo', item })

  // Open Postpone Modal
  const openPostpone = (t: Todo) => {
    setNow(new Date()) // refresh the clock so the "hạn mới" preview matches what will be saved
    setPostponePreset(POSTPONE_PRESETS[1].minutes)
    setPostponeCustom('')
    setPostponeReason('')
    setPostponeTarget(t)
  }

  // Minutes currently chosen in the postpone modal (custom input wins when filled)
  const postponeMinutes = useMemo(() => {
    const custom = Number(postponeCustom.trim())
    if (postponeCustom.trim() && Number.isFinite(custom) && custom > 0) return Math.round(custom)
    return postponeCustom.trim() ? 0 : postponePreset
  }, [postponeCustom, postponePreset])

  // Apply postpone: push the deadline, bump the counters, log one history row
  const applyPostpone = async () => {
    if (!postponeTarget || postponeMinutes <= 0) return
    const t = postponeTarget
    const next = postponeTo(t, postponeMinutes, new Date())
    const reason = postponeReason.trim()
    const updateData = {
      due_date: next.due_date,
      due_time: next.due_time,
      postpone_count: (t.postpone_count ?? 0) + 1,
      postpone_minutes: (t.postpone_minutes ?? 0) + postponeMinutes,
    }

    setPostponeBusy(true)
    todos.setItems((prev) => prev.map((i) => (i.id === t.id ? { ...i, ...updateData } : i)))
    setPostponeTarget(null)
    showToast(`⏳ Đã trì hoãn ${formatMinutes(postponeMinutes)} → hạn mới ${formatDeadline({ ...t, ...next })}`)

    const { error } = await supabase!.from('todos').update(updateData).eq('id', t.id)
    if (error) {
      reportWriteError(error, `todo:${t.id}`, { ...t, ...updateData })
    } else {
      const log = {
        todo_id: t.id,
        minutes: postponeMinutes,
        reason: reason || null,
        prev_due_date: t.due_date ?? null,
        prev_due_time: t.due_time ?? null,
        new_due_date: next.due_date,
        new_due_time: next.due_time,
      }
      const { data, error: logError } = await supabase!.from('task_postpones').insert(log).select().single()
      if (logError) {
        reportWriteError(logError, `task_postpone:${t.id}:${new Date().toISOString()}`, log)
      } else {
        if (data) setHistory((prev) => (viewDetail?.item.id === t.id ? [data as TaskPostpone, ...prev] : prev))
        showToast('Đã lưu Supabase')
      }
    }
    setPostponeBusy(false)
  }

  // Load postpone history whenever a task detail modal opens
  useEffect(() => {
    if (!viewDetail || viewDetail.kind !== 'todo' || !supabase) {
      setHistory([])
      return
    }
    let cancelled = false
    setHistoryLoading(true)
    supabase
      .from('task_postpones')
      .select('*')
      .eq('todo_id', viewDetail.item.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setHistory((data ?? []) as TaskPostpone[])
        setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewDetail])

  // Helper for filtering & sorting todos list
  const processTodosList = (items: Todo[]) => {
    let result = items.filter((t) => {
      const diffMatch = filterDifficulty === 'ALL' || (t.difficulty ?? 'EASY') === filterDifficulty
      const prioMatch = filterPriority === 'ALL' || (t.priority ?? 'NORMAL') === filterPriority
      return diffMatch && prioMatch
    })

    if (sortBy === 'PRIORITY') {
      const prioOrder: Record<string, number> = { URGENT: 2, NORMAL: 1 }
      result = [...result].sort((a, b) => (prioOrder[b.priority ?? 'NORMAL'] || 1) - (prioOrder[a.priority ?? 'NORMAL'] || 1))
    } else if (sortBy === 'DIFFICULTY') {
      const diffOrder: Record<string, number> = { HARD: 3, NORMAL: 2, EASY: 1 }
      result = [...result].sort((a, b) => (diffOrder[b.difficulty ?? 'EASY'] || 1) - (diffOrder[a.difficulty ?? 'EASY'] || 1))
    }

    return result
  }

  // Filter Tasks by Selected Date
  const dayTodos = useMemo(() => {
    const filtered = todos.items.filter((t) => {
      const tDate = t.due_date ?? (t.created_at ? t.created_at.slice(0, 10) : localDate())
      return tDate === selectedDate && t.title.toLowerCase().includes(search.toLowerCase())
    })
    return processTodosList(filtered)
  }, [todos.items, selectedDate, search, filterDifficulty, filterPriority, sortBy])

  // Việc đã xong tách khỏi việc còn phải làm để không lấn chỗ trong danh sách
  const pendingTodos = useMemo(() => dayTodos.filter((t) => !t.completed), [dayTodos])
  const doneTodos = useMemo(() => dayTodos.filter((t) => t.completed), [dayTodos])

  // Filter Overdue / Pending Tasks from Previous Days
  const overduePreviousTodos = useMemo(() => {
    const filtered = todos.items.filter((t) => {
      const tDate = t.due_date ?? (t.created_at ? t.created_at.slice(0, 10) : localDate())
      return !t.completed && tDate < selectedDate && t.title.toLowerCase().includes(search.toLowerCase())
    })
    return processTodosList(filtered)
  }, [todos.items, selectedDate, search, filterDifficulty, filterPriority, sortBy])

  // Filter Ideas
  const filteredIdeas = useMemo(() => {
    return ideas.items.filter((i) => (i.title + (i.content ?? '')).toLowerCase().includes(search.toLowerCase()))
  }, [ideas.items, search])

  // Stats calculation
  const stats = useMemo(() => {
    const totalTodos = todos.items.length
    const completedTodos = todos.items.filter((t) => t.completed).length
    const overdueCount = overduePreviousTodos.length
    const totalIdeas = ideas.items.length
    const easyCount = todos.items.filter((t) => (t.difficulty ?? 'EASY') === 'EASY').length
    const normalDiffCount = todos.items.filter((t) => t.difficulty === 'NORMAL').length
    const hardCount = todos.items.filter((t) => t.difficulty === 'HARD').length
    const urgentCount = todos.items.filter((t) => t.priority === 'URGENT').length
    const normalPrioCount = todos.items.filter((t) => (t.priority ?? 'NORMAL') === 'NORMAL').length
    const percent = totalTodos ? Math.round((completedTodos / totalTodos) * 100) : 0

    const postponedTodos = todos.items.filter((t) => (t.postpone_count ?? 0) > 0)
    const postponeCount = todos.items.reduce((sum, t) => sum + (t.postpone_count ?? 0), 0)
    const postponeMinutesTotal = todos.items.reduce((sum, t) => sum + (t.postpone_minutes ?? 0), 0)
    const topPostponed = [...postponedTodos]
      .sort((a, b) => (b.postpone_minutes ?? 0) - (a.postpone_minutes ?? 0) || (b.postpone_count ?? 0) - (a.postpone_count ?? 0))
      .slice(0, 5)

    return {
      totalTodos,
      completedTodos,
      overdueCount,
      totalIdeas,
      easyCount,
      normalDiffCount,
      hardCount,
      urgentCount,
      normalPrioCount,
      percent,
      postponeCount,
      postponeMinutesTotal,
      postponedTaskCount: postponedTodos.length,
      topPostponed,
    }
  }, [todos.items, overduePreviousTodos.length, ideas.items.length])


  // Helper date formatter
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Chưa có thông tin'
    try {
      const d = new Date(isoString)
      return d.toLocaleString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return isoString
    }
  }

  // Always read the freshest copy so the detail modal reflects a postpone made from inside it
  const detailTodo =
    viewDetail?.kind === 'todo' ? todos.items.find((i) => i.id === viewDetail.item.id) ?? (viewDetail.item as Todo) : null

  return (
    <section className="page-shell">
      {/* Cột phụ desktop: tình hình việc trong ngày, khỏi cần mở tab Thống kê. */}
      <Aside>
        <AsideCard title="Ngày đang xem">
          <div className="aside-row">
            <span>Còn phải làm</span>
            <strong>{pendingTodos.length}</strong>
          </div>
          <div className="aside-row">
            <span>Đã xong</span>
            <strong>{doneTodos.length}</strong>
          </div>
          <div className="aside-row">
            <span>Quá hạn từ trước</span>
            <strong>{overduePreviousTodos.length}</strong>
          </div>
        </AsideCard>

        <AsideCard title="Toàn bộ">
          <div className="aside-row">
            <span>Hoàn thành</span>
            <strong>{stats.percent}%</strong>
          </div>
          <div className="aside-row">
            <span>Gấp</span>
            <strong>{stats.urgentCount}</strong>
          </div>
          <div className="aside-row">
            <span>Khó</span>
            <strong>{stats.hardCount}</strong>
          </div>
          <div className="aside-row">
            <span>Ý tưởng</span>
            <strong>{stats.totalIdeas}</strong>
          </div>
        </AsideCard>

        <AsideCard title="Trì hoãn nhiều nhất">
          {stats.topPostponed.length === 0 ? (
            <p className="aside-empty">Chưa hoãn việc nào. Giữ vậy nhé.</p>
          ) : (
            stats.topPostponed.slice(0, 4).map((t) => (
              <div className="aside-row" key={t.id}>
                <span title={t.title}>{t.title}</span>
                <strong>{formatMinutes(t.postpone_minutes ?? 0)}</strong>
              </div>
            ))
          )}
        </AsideCard>
      </Aside>

      {/* 100% Width Full Responsive Sub Tabs Bar */}
      <div className="habit-sub-tabs">
        <button className={activeTab === 'tasks' ? 'active' : ''} onClick={() => setActiveTab('tasks')}>
          <CheckSquare size={14} /> Tasks ({dayTodos.length + overduePreviousTodos.length})
        </button>
        <button className={activeTab === 'ideas' ? 'active' : ''} onClick={() => setActiveTab('ideas')}>
          <Lightbulb size={14} /> Ideas ({ideas.items.length})
        </button>
        <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>
          <BarChart3 size={14} /> Thống kê
        </button>
      </div>

      {/* TAB 1: TASKS */}
      {activeTab === 'tasks' && (
        <div className="card" style={{ padding: 12, margin: 0 }}>
          {/* Ngày · tiến độ · tìm kiếm · lọc */}
          <div className="task-toolbar">
            <div className="task-date-nav">
              <button aria-label="Ngày trước" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}>
                <ChevronLeft size={16} />
              </button>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} aria-label="Ngày đang xem" />
              <button aria-label="Ngày sau" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}>
                <ChevronRight size={16} />
              </button>
            </div>

            {dayTodos.length > 0 && (
              <span className="task-progress-pill" title="Đã hoàn thành trong ngày">
                <Check size={12} strokeWidth={3} />
                {doneTodos.length}/{dayTodos.length}
              </span>
            )}

            <input className="mini-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm công việc…" />

            <button
              className={'task-tool-btn' + (showFilters ? ' on' : '')}
              aria-label="Lọc và sắp xếp"
              aria-expanded={showFilters}
              title="Lọc & sắp xếp"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter size={16} />
              {filtersActive && <span className="task-tool-dot" />}
            </button>
          </div>

          {showFilters && (
            <div className="task-filter-panel">
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as any)} aria-label="Lọc theo ưu tiên">
                <option value="ALL">🚩 Ưu tiên: Tất cả</option>
                <option value="URGENT">🔥 Gấp</option>
                <option value="NORMAL">Bình thường</option>
              </select>

              <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value as any)} aria-label="Lọc theo độ khó">
                <option value="ALL">🎯 Độ khó: Tất cả</option>
                <option value="EASY">🟢 Dễ</option>
                <option value="NORMAL">🔵 Bình thường</option>
                <option value="HARD">🔴 Khó</option>
              </select>

              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} aria-label="Sắp xếp">
                <option value="DEFAULT">⇅ Sắp xếp: Mặc định</option>
                <option value="PRIORITY">⇅ Theo ưu tiên (Gấp trước)</option>
                <option value="DIFFICULTY">⇅ Theo độ khó (Khó trước)</option>
              </select>
            </div>
          )}

          {/* Thêm nhanh */}
          <div className="task-quick-add">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (newTitle.trim()) saveNewTodo()
                  else openAddModal('todo')
                }
              }}
              placeholder="Nhập công việc..."
              aria-label="Nhập công việc"
            />
            <button aria-label="Thêm công việc" onClick={() => (newTitle.trim() ? saveNewTodo() : openAddModal('todo'))}>
              <Plus size={22} />
            </button>
          </div>

          {todos.loading ? (
            <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải công việc…</p>
          ) : (
            <div className="task-groups">
              {/* Tồn đọng ngày trước */}
              {overduePreviousTodos.length > 0 && (
                <section className="task-group-overdue">
                  <div className="task-group-head">
                    <h3>
                      <AlertCircle size={14} /> Tồn đọng ngày trước
                    </h3>
                    <span className="task-group-count">{overduePreviousTodos.length}</span>
                  </div>
                  <div className="task-list">
                    {overduePreviousTodos.map((t) => (
                      <TaskCard key={t.id} todo={t} now={now} onToggle={flipTodo} onPostpone={openPostpone} onView={openView} onEdit={openEditTodo} />
                    ))}
                  </div>
                </section>
              )}

              {/* Việc của ngày đang chọn, chưa xong */}
              {pendingTodos.length > 0 && (
                <section>
                  <div className="task-group-head">
                    <h3>{selectedDate === localDate() ? 'Hôm nay' : 'Cần làm'}</h3>
                    <span className="task-group-count">{pendingTodos.length}</span>
                    {doneTodos.length > 0 && <span className="task-group-note">{doneTodos.length} việc đã xong</span>}
                  </div>
                  <div className="task-list">
                    {pendingTodos.map((t) => (
                      <TaskCard key={t.id} todo={t} now={now} onToggle={flipTodo} onPostpone={openPostpone} onView={openView} onEdit={openEditTodo} />
                    ))}
                  </div>
                </section>
              )}

              {/* Đã xong — gập sẵn để không đẩy việc còn lại xuống dưới */}
              {doneTodos.length > 0 && (
                <section>
                  <button className="task-group-head" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
                    <h3>
                      {showDone ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Đã xong
                    </h3>
                    <span className="task-group-count">{doneTodos.length}</span>
                  </button>
                  {showDone && (
                    <div className="task-list">
                      {doneTodos.map((t) => (
                        <TaskCard key={t.id} todo={t} now={now} onToggle={flipTodo} onPostpone={openPostpone} onView={openView} onEdit={openEditTodo} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {overduePreviousTodos.length === 0 && dayTodos.length === 0 && (
                <Empty icon={CheckSquare} colorClass="icon-box-purple">
                  Chưa có công việc nào khớp với điều kiện tìm kiếm/lọc.
                </Empty>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: IDEAS */}
      {activeTab === 'ideas' && (
        <div className="card" style={{ padding: 10, margin: 0 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (newTitle.trim()) saveNewIdea()
                  else openAddModal('idea')
                }
              }}
              placeholder="Bắt trọn một ý tưởng mới…"
              style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', padding: '6px 10px', borderRadius: 10, border: '1px solid var(--card-border)' }}
            />
            <button className="primary" onClick={() => (newTitle.trim() ? saveNewIdea() : openAddModal('idea'))} style={{ padding: '6px 12px', fontSize: '0.8rem', gap: 4, flexShrink: 0 }}>
              <Plus size={14} /> Thêm
            </button>
            <input className="mini-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm…" style={{ padding: '4px 8px', fontSize: '0.76rem', width: 90 }} />
          </div>

          {ideas.loading ? (
            <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải ý tưởng…</p>
          ) : filteredIdeas.length ? (
            <div style={{ display: 'grid', gap: 6, maxHeight: 'calc(100vh - 280px)', minHeight: '340px', overflowY: 'auto' }}>
              {filteredIdeas.map((i) => (
                <div key={i.id} className="check-row" style={{ justifyContent: 'space-between', background: 'var(--bg-main)', borderRadius: 8, padding: '6px 8px', marginBottom: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: '0.84rem' }}>{i.title}</strong>
                    {i.content && <p style={{ fontSize: '0.76rem', margin: '2px 0 0', color: 'var(--text-muted)' }}>{i.content}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button className="icon small" aria-label="View idea details" onClick={() => setViewDetail({ kind: 'idea', item: i })} style={{ padding: 3 }}>
                      <Eye size={14} />
                    </button>
                    <button className="icon small" aria-label="Edit idea" onClick={() => openEdit({ kind: 'idea', item: i })} style={{ padding: 3 }}>
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={Lightbulb} colorClass="icon-box-amber">
              Chưa có ý tưởng nào. Bấm "+ Thêm" ở trên để tạo mới nhé!
            </Empty>
          )}
        </div>
      )}

      {/* TAB 3: STATS */}
      {activeTab === 'stats' && (
        <div>
          <div className="stats-grid" style={{ gap: 8, marginBottom: 10 }}>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ fontSize: '1.4rem' }}>{stats.totalTodos}</div>
              <div className="stat-lbl">Tổng công việc</div>
            </div>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ color: 'var(--emerald)', fontSize: '1.4rem' }}>{stats.completedTodos}</div>
              <div className="stat-lbl">Đã xong ({stats.percent}%)</div>
            </div>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ color: 'var(--amber)', fontSize: '1.4rem' }}>{stats.overdueCount}</div>
              <div className="stat-lbl">Tồn đọng ngày trước</div>
            </div>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ color: 'var(--purple)', fontSize: '1.4rem' }}>{stats.totalIdeas}</div>
              <div className="stat-lbl">Tổng ý tưởng</div>
            </div>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ color: '#f59e0b', fontSize: '1.4rem' }}>{stats.postponeCount}</div>
              <div className="stat-lbl">Số lần trì hoãn</div>
            </div>
            <div className="stat-card" style={{ padding: 8 }}>
              <div className="stat-val" style={{ color: '#f59e0b', fontSize: '1.4rem' }}>{formatMinutes(stats.postponeMinutesTotal)}</div>
              <div className="stat-lbl">Tổng thời gian trì hoãn</div>
            </div>
          </div>

          {/* POSTPONE BREAKDOWN */}
          <div className="card" style={{ padding: 10, margin: '0 0 10px' }}>
            <h2 style={{ fontSize: '0.84rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Timer size={14} style={{ color: '#f59e0b' }} /> Thống kê trì hoãn
            </h2>
            <div style={{ display: 'grid', gap: 6, fontSize: '0.8rem', marginBottom: stats.topPostponed.length ? 10 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Công việc từng bị trì hoãn</span>
                <strong>{stats.postponedTaskCount} / {stats.totalTodos}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Trung bình mỗi lần trì hoãn</span>
                <strong>{formatMinutes(stats.postponeCount ? Math.round(stats.postponeMinutesTotal / stats.postponeCount) : 0)}</strong>
              </div>
            </div>

            {stats.topPostponed.length > 0 && (
              <>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Bị trì hoãn nhiều nhất</div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {stats.topPostponed.map((t) => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', background: 'var(--bg-main)', borderRadius: 8, padding: '5px 8px', fontSize: '0.8rem' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <strong style={{ color: '#f59e0b', whiteSpace: 'nowrap' }}>
                        {t.postpone_count} lần · {formatMinutes(t.postpone_minutes ?? 0)}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* BREAKDOWN BY DIFFICULTY & PRIORITY */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 10, marginBottom: 10 }}>
            <div className="card" style={{ padding: 10, margin: 0 }}>
              <h2 style={{ fontSize: '0.84rem', marginBottom: 8 }}>🎯 Phân loại theo Độ khó</h2>
              <div style={{ display: 'grid', gap: 6, fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🟢 Dễ</span>
                  <strong>{stats.easyCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🔵 Bình thường</span>
                  <strong>{stats.normalDiffCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🔴 Khó</span>
                  <strong>{stats.hardCount}</strong>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 10, margin: 0 }}>
              <h2 style={{ fontSize: '0.84rem', marginBottom: 8 }}>🚩 Phân loại theo Ưu tiên</h2>
              <div style={{ display: 'grid', gap: 6, fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🔥 Ưu tiên Gấp</span>
                  <strong style={{ color: '#f59e0b' }}>{stats.urgentCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Bình thường</span>
                  <strong>{stats.normalPrioCount}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 12, margin: 0 }}>
            <h2 style={{ fontSize: '0.88rem', marginBottom: 8 }}>Tiến độ hoàn thành công việc</h2>
            <div className="habit-progress-bar-bg" style={{ height: 8, marginBottom: 10 }}>
              <div className="habit-progress-bar-fill" style={{ width: `${stats.percent}%` }} />
            </div>
            <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
              Bạn đã hoàn thành {stats.completedTodos} / {stats.totalTodos} công việc.
            </p>
          </div>
        </div>
      )}

      {/* ADD MODAL FOR TASK OR IDEA */}
      {addModal && (
        <Modal title={addModal.kind === 'todo' ? 'Thêm công việc mới' : 'Thêm ý tưởng mới'} onClose={() => setAddModal(null)}>
          <label>
            {addModal.kind === 'todo' ? 'Tên công việc' : 'Tiêu đề ý tưởng'}
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nhập tên..." autoFocus />
          </label>

          {addModal.kind === 'todo' && (
            <>
              <label>
                Hạn hoàn thành
                <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                  <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                  <input type="time" value={newDueTime} onChange={(e) => setNewDueTime(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                  {newDueTime && (
                    <button type="button" onClick={() => setNewDueTime('')} title="Bỏ giờ, để cả ngày" style={{ padding: '6px 8px', fontSize: '0.74rem', borderRadius: 8, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                      Cả ngày
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bỏ trống giờ = hạn tính đến cuối ngày.</span>
              </label>

              <label>
                Độ khó
                <ChoiceRow options={DIFFICULTY_OPTIONS} config={DIFFICULTY_CONFIG} value={newDifficulty} onChange={setNewDifficulty} />
              </label>

              <label>
                Mức độ ưu tiên
                <ChoiceRow options={PRIORITY_OPTIONS} config={PRIORITY_CONFIG} value={newPriority} onChange={setNewPriority} />
              </label>
            </>
          )}

          {addModal.kind === 'idea' && (
            <label>
              Ghi chú ý tưởng
              <textarea value={newIdeaContent} onChange={(e) => setNewIdeaContent(e.target.value)} rows={3} placeholder="Chi tiết ý tưởng…" />
            </label>
          )}

          <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="primary" onClick={addModal.kind === 'todo' ? saveNewTodo : saveNewIdea}>
              {addModal.kind === 'todo' ? 'Lưu công việc' : 'Lưu ý tưởng'}
            </button>
          </div>
        </Modal>
      )}

      {/* VIEW DETAIL MODAL */}
      {viewDetail && (
        <Modal title={viewDetail.kind === 'todo' ? 'Chi tiết công việc' : 'Chi tiết ý tưởng'} onClose={() => setViewDetail(null)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tên mục</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>{viewDetail.item.title}</div>
            </div>

            {viewDetail.kind === 'idea' && viewDetail.item.content && (
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ghi chú</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: 2, background: 'var(--bg-main)', padding: 8, borderRadius: 8 }}>{viewDetail.item.content}</div>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 10, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>🕒 Thời gian tạo:</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatDate(viewDetail.item.created_at)}</span>
              </div>

              {detailTodo && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>⏰ Hạn hoàn thành:</span>
                    <span style={{ fontWeight: 700, color: isOverdue(detailTodo, now) ? '#ef4444' : 'var(--text-main)' }}>
                      {formatDeadline(detailTodo)}
                      {isOverdue(detailTodo, now) && ' (quá hạn)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>🎯 Độ khó:</span>
                    <DifficultyBadge difficulty={detailTodo.difficulty} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>🚩 Mức độ ưu tiên:</span>
                    <PriorityBadge priority={detailTodo.priority} showNormal={true} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>✅ Thời gian hoàn thành:</span>
                    <span style={{ fontWeight: 700, color: detailTodo.completed ? 'var(--emerald)' : 'var(--amber)' }}>
                      {detailTodo.completed ? formatDate(detailTodo.completed_at) : 'Chưa tích hoàn thành'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>⏳ Đã trì hoãn:</span>
                    <span style={{ fontWeight: 700, color: (detailTodo.postpone_count ?? 0) > 0 ? '#f59e0b' : 'var(--text-main)' }}>
                      {detailTodo.postpone_count ?? 0} lần · {formatMinutes(detailTodo.postpone_minutes ?? 0)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* POSTPONE HISTORY OF THIS TASK */}
            {detailTodo && (
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                  <History size={13} /> Lịch sử trì hoãn
                </div>
                {historyLoading ? (
                  <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>Đang tải lịch sử…</p>
                ) : history.length ? (
                  <div style={{ display: 'grid', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                    {history.map((h) => (
                      <div key={h.id} style={{ background: 'var(--bg-main)', borderRadius: 8, padding: '5px 8px', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{formatDate(h.created_at)}</span>
                          <strong style={{ color: '#f59e0b', whiteSpace: 'nowrap' }}>+{formatMinutes(h.minutes)}</strong>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2 }}>
                          {formatDeadline({ due_date: h.prev_due_date, due_time: h.prev_due_time })} → {formatDeadline({ due_date: h.new_due_date, due_time: h.new_due_time })}
                        </div>
                        {h.reason && <div style={{ marginTop: 2 }}>💬 {h.reason}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>Chưa trì hoãn lần nào. Giữ vững phong độ nhé!</p>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ justifyContent: detailTodo ? 'space-between' : 'flex-end' }}>
            {detailTodo && (
              <button onClick={() => openPostpone(detailTodo)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', fontSize: '0.82rem', fontWeight: 600, borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', cursor: 'pointer' }}>
                <Timer size={14} /> Trì hoãn
              </button>
            )}
            <button className="primary" onClick={() => setViewDetail(null)}>
              Đóng
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Modal for Task or Idea */}
      {edit && (
        <Modal title={edit.kind === 'todo' ? 'Sửa công việc' : 'Sửa ý tưởng'} onClose={() => setEdit(null)}>
          <label>
            Tiêu đề
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
          </label>

          {edit.kind === 'todo' && (
            <>
              <label>
                Hạn hoàn thành
                <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                  <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                  <input type="time" value={editDueTime} onChange={(e) => setEditDueTime(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                  {editDueTime && (
                    <button type="button" onClick={() => setEditDueTime('')} title="Bỏ giờ, để cả ngày" style={{ padding: '6px 8px', fontSize: '0.74rem', borderRadius: 8, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                      Cả ngày
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bỏ trống giờ = hạn tính đến cuối ngày.</span>
              </label>

              <label>
                Độ khó
                <ChoiceRow options={DIFFICULTY_OPTIONS} config={DIFFICULTY_CONFIG} value={editDifficulty} onChange={setEditDifficulty} />
              </label>

              <label>
                Mức độ ưu tiên
                <ChoiceRow options={PRIORITY_OPTIONS} config={PRIORITY_CONFIG} value={editPriority} onChange={setEditPriority} />
              </label>
            </>
          )}

          {edit.kind === 'idea' && (
            <label>
              Ghi chú ý tưởng
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} placeholder="Mô tả ý tưởng…" />
            </label>
          )}

          <div className="modal-actions">
            <DeleteButton onDelete={remove} />
            <button className="primary" onClick={saveEdit}>
              Lưu thay đổi
            </button>
          </div>
        </Modal>
      )}

      {/* POSTPONE MODAL */}
      {postponeTarget && (
        <Modal title="Trì hoãn công việc" onClose={() => setPostponeTarget(null)}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Công việc</div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, marginTop: 2 }}>{postponeTarget.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Hạn hiện tại: <strong style={{ color: isOverdue(postponeTarget, now) ? '#ef4444' : 'var(--text-main)' }}>{formatDeadline(postponeTarget)}</strong>
                {isOverdue(postponeTarget, now) && ' — đã quá hạn, sẽ tính thêm từ bây giờ'}
              </div>
            </div>

            <label>
              Trì hoãn thêm
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {POSTPONE_PRESETS.map((p) => {
                  const active = !postponeCustom.trim() && postponePreset === p.minutes
                  return (
                    <button
                      key={p.minutes}
                      type="button"
                      onClick={() => {
                        setPostponeCustom('')
                        setPostponePreset(p.minutes)
                      }}
                      style={{
                        flex: '1 1 30%',
                        padding: '7px 8px',
                        fontSize: '0.78rem',
                        fontWeight: active ? 700 : 500,
                        borderRadius: 8,
                        border: `1px solid ${active ? '#f59e0b' : 'var(--card-border)'}`,
                        background: active ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        color: active ? '#f59e0b' : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </label>

            <label>
              Hoặc nhập số phút tùy chỉnh
              <input
                type="number"
                min={1}
                value={postponeCustom}
                onChange={(e) => setPostponeCustom(e.target.value)}
                placeholder="VD: 90"
              />
            </label>

            <label>
              Lý do trì hoãn (tùy chọn)
              <input value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} placeholder="VD: Bận họp đột xuất…" />
            </label>

            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 8, padding: '8px 10px', fontSize: '0.82rem' }}>
              {postponeMinutes > 0 ? (
                <>
                  Cộng thêm <strong style={{ color: '#f59e0b' }}>{formatMinutes(postponeMinutes)}</strong> → hạn mới:{' '}
                  <strong>{formatDeadline({ ...postponeTarget, ...postponeTo(postponeTarget, postponeMinutes, now) })}</strong>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Nhập số phút lớn hơn 0 để xem hạn mới.</span>
              )}
            </div>

            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Sau lần này: {(postponeTarget.postpone_count ?? 0) + 1} lần trì hoãn · tổng{' '}
              {formatMinutes((postponeTarget.postpone_minutes ?? 0) + Math.max(postponeMinutes, 0))}
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="primary" onClick={applyPostpone} disabled={postponeMinutes <= 0 || postponeBusy}>
              {postponeBusy ? 'Đang lưu…' : 'Xác nhận trì hoãn'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}
