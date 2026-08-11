import { useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Calendar, Check, CheckSquare, Eye, Lightbulb, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/date'
import type { Idea, Todo } from '../types'
import { DeleteButton, Empty, Modal, useQuery } from './shared'

type Tab = 'tasks' | 'ideas' | 'stats'
type EditState = { kind: 'todo'; item: Todo } | { kind: 'idea'; item: Idea }
import { useToast } from './ToastContext'

type ViewState = { kind: 'todo'; item: Todo } | { kind: 'idea'; item: Idea }

export function TasksPage() {
  const { showToast } = useToast()
  const todos = useQuery<Todo>('todos')
  const ideas = useQuery<Idea>('ideas')

  const [activeTab, setActiveTab] = useState<Tab>('tasks')
  const [selectedDate, setSelectedDate] = useState<string>(localDate())
  const [search, setSearch] = useState('')

  // Form states
  const [newTitle, setNewTitle] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [viewDetail, setViewDetail] = useState<ViewState | null>(null)

  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editDueDate, setEditDueDate] = useState(localDate())

  // Create Todo
  const addTodo = async () => {
    if (!newTitle.trim()) return
    const payload = {
      title: newTitle.trim(),
      completed: false,
      due_date: selectedDate,
    }

    const { data, error } = await supabase!.from('todos').insert(payload).select().single()
    if (!error && data) {
      todos.setItems((prev) => [data as Todo, ...prev])
    } else {
      const fallback = await supabase!.from('todos').insert({ title: newTitle.trim(), completed: false }).select().single()
      if (fallback.data) todos.setItems((prev) => [fallback.data as Todo, ...prev])
    }
    setNewTitle('')
    showToast('➕ Đã thêm công việc mới!')
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

  // Create Idea
  const addIdea = async () => {
    if (!newTitle.trim()) return
    const { data } = await supabase!.from('ideas').insert({ title: newTitle.trim(), content: '' }).select().single()
    if (data) ideas.setItems((prev) => [data as Idea, ...prev])
    setNewTitle('')
    showToast('💡 Đã thêm ý tưởng mới!')
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
    }
  }

  // Save Edit
  const saveEdit = async () => {
    if (!edit || !editTitle.trim()) return
    if (edit.kind === 'todo') {
      const updateData = { title: editTitle.trim(), due_date: editDueDate }
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

  // Filter Tasks by Selected Date
  const currentSelectedDateTodos = useMemo(() => {
    return todos.items.filter((t) => {
      const tDate = t.due_date ?? (t.created_at ? t.created_at.slice(0, 10) : localDate())
      return tDate === selectedDate && t.title.toLowerCase().includes(search.toLowerCase())
    })
  }, [todos.items, selectedDate, search])

  // Filter Overdue / Pending Tasks from Previous Days
  const overduePreviousTodos = useMemo(() => {
    return todos.items.filter((t) => {
      const tDate = t.due_date ?? (t.created_at ? t.created_at.slice(0, 10) : localDate())
      return !t.completed && tDate < selectedDate && t.title.toLowerCase().includes(search.toLowerCase())
    })
  }, [todos.items, selectedDate, search])

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
    const percent = totalTodos ? Math.round((completedTodos / totalTodos) * 100) : 0
    return { totalTodos, completedTodos, overdueCount, totalIdeas, percent }
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
      </div>

      {/* TAB 1: TASKS */}
      {activeTab === 'tasks' && (
        <div className="card" style={{ padding: 10, margin: 0 }}>
          {/* Header Row: Date Selector + Filter Input */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 8 }}>
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

          {/* Quick Add Row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTodo()
                }
              }}
              placeholder="Thêm việc cần làm mới…"
              style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', padding: '6px 10px', borderRadius: 10, border: '1px solid var(--card-border)' }}
            />
            <button className="primary" onClick={addTodo} style={{ padding: '6px 14px', fontSize: '0.8rem', gap: 4, flexShrink: 0 }}>
              <Plus size={14} /> Thêm
            </button>
          </div>

          {/* SINGLE CONTAINED SCROLLABLE TASK LIST CONTAINER */}
          <div style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '340px', overflowY: 'auto', display: 'grid', gap: 6 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {/* Eye (Xem) Button next to Pencil (Sửa) */}
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

            {/* CURRENT SELECTED DATE TASKS */}
            {todos.loading ? (
              <p className="muted" style={{ fontSize: '0.8rem' }}>Đang tải công việc…</p>
            ) : currentSelectedDateTodos.length ? (
              currentSelectedDateTodos.map((t) => (
                <div key={t.id} className={'check-row ' + (t.completed ? 'checked' : '')} style={{ justifyContent: 'space-between', background: 'var(--bg-main)', borderRadius: 8, padding: '6px 8px', marginBottom: 0 }}>
                  <button className="habit-check" onClick={() => flipTodo(t)}>
                    <span className="checkbox">{t.completed && <Check size={13} />}</span>
                    <span style={{ fontSize: '0.84rem' }}>{t.title}</span>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Eye (Xem) Button next to Pencil (Sửa) */}
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
                Chưa có công việc nào cho ngày này. Thêm ở trên nhé!
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
                  addIdea()
                }
              }}
              placeholder="Bắt trọn một ý tưởng mới…"
              style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', padding: '6px 10px', borderRadius: 10, border: '1px solid var(--card-border)' }}
            />
            <button className="primary" onClick={addIdea} style={{ padding: '6px 12px', fontSize: '0.8rem', gap: 4, flexShrink: 0 }}>
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
                    {/* Eye (Xem) Button next to Pencil (Sửa) */}
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
              Chưa có ý tưởng nào. Tạo ý tưởng đầu tiên của bạn nhé!
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

      {/* VIEW DETAIL MODAL (Displays creation time and completion time) */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>✅ Thời gian hoàn thành:</span>
                  <span style={{ fontWeight: 700, color: viewDetail.item.completed ? 'var(--emerald)' : 'var(--amber)' }}>
                    {viewDetail.item.completed ? formatDate(viewDetail.item.completed_at) : 'Chưa tích hoàn thành'}
                  </span>
                </div>
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
            <label>
              Hạn hoàn thành (Ngày)
              <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
            </label>
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
