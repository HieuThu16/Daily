import { useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Calendar, Check, CheckSquare, Eye, Filter, Lightbulb, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import type { Idea, TaskDifficulty, TaskPriority, Todo } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'
import { useToast } from './ToastContext'

type Tab = 'tasks' | 'ideas' | 'stats'
type EditState = { kind: 'todo'; item: Todo } | { kind: 'idea'; item: Idea }
type ViewState = { kind: 'todo'; item: Todo } | { kind: 'idea'; item: Idea }
type AddModalState = { kind: 'todo' } | { kind: 'idea' } | null

const DIFFICULTY_CONFIG: Record<TaskDifficulty, { label: string; color: string; bg: string; border: string }> = {
  EASY: { label: 'Dễ', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' },
  NORMAL: { label: 'Bình thường', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' },
  HARD: { label: 'Khó', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string }> = {
  NORMAL: { label: 'Bình thường', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.2)' },
  URGENT: { label: '🔥 Gấp', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' },
}

export function DifficultyBadge({ difficulty }: { difficulty?: TaskDifficulty }) {
  const diff = difficulty ?? 'EASY'
  const cfg = DIFFICULTY_CONFIG[diff]
  return (
    <span
      style={{
        fontSize: '0.68rem',
        padding: '1px 6px',
        borderRadius: 6,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}

export function PriorityBadge({ priority, showNormal = false }: { priority?: TaskPriority; showNormal?: boolean }) {
  const prio = priority ?? 'NORMAL'
  if (prio === 'NORMAL' && !showNormal) return null
  const cfg = PRIORITY_CONFIG[prio]
  return (
    <span
      style={{
        fontSize: '0.68rem',
        padding: '1px 6px',
        borderRadius: 6,
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
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

  // Form & Modal states
  const [addModal, setAddModal] = useState<AddModalState>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState(localDate())
  const [newDifficulty, setNewDifficulty] = useState<TaskDifficulty>('EASY')
  const [newPriority, setNewPriority] = useState<TaskPriority>('NORMAL')
  const [newIdeaContent, setNewIdeaContent] = useState('')

  const [edit, setEdit] = useState<EditState | null>(null)
  const [viewDetail, setViewDetail] = useState<ViewState | null>(null)

  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editDueDate, setEditDueDate] = useState(localDate())
  const [editDifficulty, setEditDifficulty] = useState<TaskDifficulty>('EASY')
  const [editPriority, setEditPriority] = useState<TaskPriority>('NORMAL')

  // Open Add Modal
  const openAddModal = (kind: 'todo' | 'idea') => {
    setNewTitle('')
    setNewDueDate(selectedDate)
    setNewDifficulty('EASY')
    setNewPriority('NORMAL')
    setNewIdeaContent('')
    setAddModal({ kind })
  }

  // Create Todo
  const saveNewTodo = async () => {
    if (!newTitle.trim()) return
    const title = newTitle.trim()
    const payload = {
      title,
      completed: false,
      due_date: newDueDate,
      difficulty: newDifficulty,
      priority: newPriority,
    }

    const tempTodo: Todo = {
      id: Date.now().toString(),
      title,
      completed: false,
      due_date: newDueDate,
      difficulty: newDifficulty,
      priority: newPriority,
      created_at: new Date().toISOString(),
    }

    todos.setItems((prev) => [tempTodo, ...prev])
    setAddModal(null)
    setNewTitle('')
    setNewDifficulty('EASY')
    setNewPriority('NORMAL')
    showToast('➕ Đã thêm công việc mới!')

    const { data, error } = await supabase!.from('todos').insert(payload).select().single()
    if (!error && data) {
      todos.setItems((prev) => prev.map((item) => (item.id === tempTodo.id ? (data as Todo) : item)))
    } else {
      const fallback = await supabase!.from('todos').insert({ title, completed: false, difficulty: newDifficulty, priority: newPriority }).select().single()
      if (fallback.data) todos.setItems((prev) => prev.map((item) => (item.id === tempTodo.id ? (fallback.data as Todo) : item)))
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
      await supabase!.from('todos').update({ completed: next }).eq('id', t.id)
    }
    showToast(next ? '✅ Đã tích hoàn thành công việc!' : '🔄 Đã bỏ tích công việc')
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
        difficulty: editDifficulty,
        priority: editPriority,
      }
      todos.setItems((prev) => prev.map((i) => (i.id === edit.item.id ? { ...i, ...updateData } : i)))
      const { error } = await supabase!.from('todos').update(updateData).eq('id', edit.item.id)
      if (error) {
        await supabase!.from('todos').update({ title: editTitle.trim() }).eq('id', edit.item.id)
      }
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
  const currentSelectedDateTodos = useMemo(() => {
    const filtered = todos.items.filter((t) => {
      const tDate = t.due_date ?? (t.created_at ? t.created_at.slice(0, 10) : localDate())
      return tDate === selectedDate && t.title.toLowerCase().includes(search.toLowerCase())
    })
    return processTodosList(filtered)
  }, [todos.items, selectedDate, search, filterDifficulty, filterPriority, sortBy])

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

  return (
    <section style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 100% Width Full Responsive Sub Tabs Bar */}
      <div className="habit-sub-tabs">
        <button className={activeTab === 'tasks' ? 'active' : ''} onClick={() => setActiveTab('tasks')}>
          <CheckSquare size={14} /> Tasks ({currentSelectedDateTodos.length + overduePreviousTodos.length})
        </button>
        <button className={activeTab === 'ideas' ? 'active' : ''} onClick={() => setActiveTab('ideas')}>
          <Lightbulb size={14} /> Ideas ({ideas.items.length})
        </button>
        <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>
          <BarChart3 size={14} /> Thống kê
        </button>
        <button
          onClick={() => openAddModal(activeTab === 'ideas' ? 'idea' : 'todo')}
          style={{ background: 'var(--primary)', color: 'white', fontWeight: 700, padding: '5px 8px', fontSize: '0.74rem', gap: 2 }}
        >
          <Plus size={13} /> Thêm
        </button>
      </div>

      {/* TAB 1: TASKS */}
      {activeTab === 'tasks' && (
        <div className="card" style={{ padding: 10, margin: 0 }}>
          {/* Header Row: Date Selector + Filter Input */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} style={{ color: 'var(--primary)' }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ border: '1px solid var(--card-border)', borderRadius: 8, padding: '2px 6px', fontSize: '0.76rem', background: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
            </div>
            <input className="mini-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm công việc…" style={{ padding: '3px 8px', fontSize: '0.76rem', width: 110 }} />
          </div>

          {/* FILTER & SORT TOOLBAR */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8, padding: '4px 8px', background: 'var(--bg-main)', borderRadius: 8, border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              <Filter size={12} /> Lọc & Sắp xếp:
            </div>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              style={{ fontSize: '0.74rem', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer' }}
            >
              <option value="ALL">🚩 Ưu tiên: Tất cả</option>
              <option value="URGENT">🔥 Gấp</option>
              <option value="NORMAL">Bình thường</option>
            </select>

            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value as any)}
              style={{ fontSize: '0.74rem', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer' }}
            >
              <option value="ALL">🎯 Độ khó: Tất cả</option>
              <option value="EASY">🟢 Dễ</option>
              <option value="NORMAL">🔵 Bình thường</option>
              <option value="HARD">🔴 Khó</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ fontSize: '0.74rem', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer', marginLeft: 'auto' }}
            >
              <option value="DEFAULT">⇅ Sắp xếp: Mặc định</option>
              <option value="PRIORITY">⇅ Theo ưu tiên (Gấp trước)</option>
              <option value="DIFFICULTY">⇅ Theo độ khó (Khó trước)</option>
            </select>
          </div>

          {/* Quick Add Row & Open Modal Button */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
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
              style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', padding: '6px 10px', borderRadius: 10, border: '1px solid var(--card-border)' }}
            />
            <button className="primary" onClick={() => (newTitle.trim() ? saveNewTodo() : openAddModal('todo'))} style={{ padding: '6px 12px', fontSize: '0.8rem', gap: 4, flexShrink: 0 }}>
              <Plus size={14} /> Thêm
            </button>
          </div>

          {/* SINGLE CONTAINED SCROLLABLE TASK LIST CONTAINER */}
          <div style={{ maxHeight: 'calc(100vh - 310px)', minHeight: '320px', overflowY: 'auto', display: 'grid', gap: 6 }}>
            {/* OVERDUE PENDING TASKS SECTION */}
            {overduePreviousTodos.length > 0 && (
              <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: 10, padding: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--amber)', fontWeight: 700, fontSize: '0.76rem' }}>
                  <AlertCircle size={13} />
                  <span>Tồn đọng ngày trước ({overduePreviousTodos.length})</span>
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {overduePreviousTodos.map((t) => (
                    <div key={t.id} className="check-row" style={{ justifyContent: 'space-between', background: 'var(--card-bg)', borderRadius: 8, padding: '4px 6px', marginBottom: 0 }}>
                      <button className="habit-check" onClick={() => flipTodo(t)}>
                        <span className="checkbox">{t.completed && <Check size={13} />}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{t.title}</span>
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <DifficultyBadge difficulty={t.difficulty} />
                        <PriorityBadge priority={t.priority} />
                        <button className="icon small" aria-label="View task details" onClick={() => setViewDetail({ kind: 'todo', item: t })} style={{ padding: 2 }}>
                          <Eye size={13} />
                        </button>
                        <button className="icon small" aria-label="Edit task" onClick={() => openEdit({ kind: 'todo', item: t })} style={{ padding: 2 }}>
                          <Pencil size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CURRENT SELECTED DATE TASKS SECTION */}
            {todos.loading ? (
              <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải công việc…</p>
            ) : currentSelectedDateTodos.length ? (
              currentSelectedDateTodos.map((t) => (
                <div key={t.id} className={'check-row ' + (t.completed ? 'checked' : '')} style={{ justifyContent: 'space-between', background: 'var(--bg-main)', borderRadius: 8, padding: '6px 8px', marginBottom: 0 }}>
                  <button className="habit-check" onClick={() => flipTodo(t)}>
                    <span className="checkbox">{t.completed && <Check size={13} />}</span>
                    <span style={{ fontSize: '0.84rem' }}>{t.title}</span>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <DifficultyBadge difficulty={t.difficulty} />
                    <PriorityBadge priority={t.priority} />
                    <button className="icon small" aria-label="View task details" onClick={() => setViewDetail({ kind: 'todo', item: t })} style={{ padding: 3 }}>
                      <Eye size={14} />
                    </button>
                    <button className="icon small" aria-label="Edit task" onClick={() => openEdit({ kind: 'todo', item: t })} style={{ padding: 3 }}>
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              ))
            ) : overduePreviousTodos.length === 0 ? (
              <Empty icon={CheckSquare} colorClass="icon-box-purple">
                Chưa có công việc nào khớp với điều kiện tìm kiếm/lọc.
              </Empty>
            ) : null}
          </div>
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
          </div>

          {/* BREAKDOWN BY DIFFICULTY & PRIORITY */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
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
                Hạn hoàn thành (Ngày)
                <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </label>

              <label>
                Độ khó
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {(['EASY', 'NORMAL', 'HARD'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewDifficulty(d)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '0.78rem',
                        fontWeight: newDifficulty === d ? 700 : 500,
                        borderRadius: 8,
                        border: `1px solid ${newDifficulty === d ? DIFFICULTY_CONFIG[d].color : 'var(--card-border)'}`,
                        background: newDifficulty === d ? DIFFICULTY_CONFIG[d].bg : 'transparent',
                        color: newDifficulty === d ? DIFFICULTY_CONFIG[d].color : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      {DIFFICULTY_CONFIG[d].label}
                    </button>
                  ))}
                </div>
              </label>

              <label>
                Mức độ ưu tiên
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {(['NORMAL', 'URGENT'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '0.78rem',
                        fontWeight: newPriority === p ? 700 : 500,
                        borderRadius: 8,
                        border: `1px solid ${newPriority === p ? PRIORITY_CONFIG[p].color : 'var(--card-border)'}`,
                        background: newPriority === p ? PRIORITY_CONFIG[p].bg : 'transparent',
                        color: newPriority === p ? PRIORITY_CONFIG[p].color : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
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

              {viewDetail.kind === 'todo' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>🎯 Độ khó:</span>
                    <DifficultyBadge difficulty={viewDetail.item.difficulty} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>🚩 Mức độ ưu tiên:</span>
                    <PriorityBadge priority={viewDetail.item.priority} showNormal={true} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>✅ Thời gian hoàn thành:</span>
                    <span style={{ fontWeight: 700, color: viewDetail.item.completed ? 'var(--emerald)' : 'var(--amber)' }}>
                      {viewDetail.item.completed ? formatDate(viewDetail.item.completed_at) : 'Chưa tích hoàn thành'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
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
                Hạn hoàn thành (Ngày)
                <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </label>

              <label>
                Độ khó
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {(['EASY', 'NORMAL', 'HARD'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setEditDifficulty(d)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '0.78rem',
                        fontWeight: editDifficulty === d ? 700 : 500,
                        borderRadius: 8,
                        border: `1px solid ${editDifficulty === d ? DIFFICULTY_CONFIG[d].color : 'var(--card-border)'}`,
                        background: editDifficulty === d ? DIFFICULTY_CONFIG[d].bg : 'transparent',
                        color: editDifficulty === d ? DIFFICULTY_CONFIG[d].color : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      {DIFFICULTY_CONFIG[d].label}
                    </button>
                  ))}
                </div>
              </label>

              <label>
                Mức độ ưu tiên
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {(['NORMAL', 'URGENT'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        fontSize: '0.78rem',
                        fontWeight: editPriority === p ? 700 : 500,
                        borderRadius: 8,
                        border: `1px solid ${editPriority === p ? PRIORITY_CONFIG[p].color : 'var(--card-border)'}`,
                        background: editPriority === p ? PRIORITY_CONFIG[p].bg : 'transparent',
                        color: editPriority === p ? PRIORITY_CONFIG[p].color : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
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
    </section>
  )
}
