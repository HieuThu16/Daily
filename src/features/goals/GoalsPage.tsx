import { useMemo, useState } from 'react'
import {
  Check, CheckCircle2, ChevronDown, ChevronUp, Edit3,
  Plus, Target, Trash2, X
} from 'lucide-react'
import { useGoals } from '../../lib/goals'
import { GoalModal } from './GoalModal'
import { useSharedCategories } from '../../lib/sharedCategories'
import { useHeaderActions } from '../HeaderAction'
import { useToast } from '../ToastContext'
import { useQuery } from '../shared'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { notifyTasksChanged } from '../useUncompletedTasks'
import type { GoalItem, Todo } from '../../types'
import './goals.css'

export function GoalsPage() {
  const { showToast } = useToast()
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals()
  const { categories } = useSharedCategories()
  const todos = useQuery<Todo>('todos')

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null)

  // State nhập task nhanh cho từng goal: { [goalId]: string }
  const [quickTaskInputs, setQuickTaskInputs] = useState<Record<string, string>>({})
  // State thu gọn/mở rộng checklist công việc của từng goal: { [goalId]: boolean }
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({})

  // Nút Header action thêm mục tiêu
  useHeaderActions([
    {
      label: 'Thêm mục tiêu',
      icon: 'plus',
      onClick: () => {
        setEditingGoal(null)
        setIsModalOpen(true)
      },
    },
  ])

  // Tính toán số liệu thống kê tổng thể
  const stats = useMemo(() => {
    const total = goals.length
    const completedList = goals.filter((g) => {
      const linked = todos.items.filter((t) => t.goal_id === g.id && !t.deleted_at)
      const allTasksDone = linked.length > 0 && linked.every((t) => t.completed)
      return g.status === 'COMPLETED' || allTasksDone
    })
    const activeList = goals.filter((g) => !completedList.some((c) => c.id === g.id))
    const allLinkedTasks = todos.items.filter((t) => t.goal_id && !t.deleted_at)
    const completedTasksCount = allLinkedTasks.filter((t) => t.completed).length

    return {
      total,
      activeCount: activeList.length,
      completedCount: completedList.length,
      totalTasks: allLinkedTasks.length,
      completedTasksCount,
      overallProgress: allLinkedTasks.length > 0 ? Math.round((completedTasksCount / allLinkedTasks.length) * 100) : total > 0 ? Math.round((completedList.length / total) * 100) : 0,
    }
  }, [goals, todos.items])

  // Lọc theo trạng thái và danh mục dùng chung
  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      const linked = todos.items.filter((t) => t.goal_id === g.id && !t.deleted_at)
      const isComplete = g.status === 'COMPLETED' || (linked.length > 0 && linked.every((t) => t.completed))

      if (activeTab === 'active' && isComplete) return false
      if (activeTab === 'completed' && !isComplete) return false

      if (categoryFilter !== 'ALL') {
        const goalCat = (g.category_label || g.category || '').toLowerCase()
        if (goalCat !== categoryFilter.toLowerCase()) return false
      }
      return true
    })
  }, [goals, todos.items, activeTab, categoryFilter])

  const handleSaveGoal = async (goalData: Omit<GoalItem, 'id' | 'created_at'>) => {
    if (editingGoal) {
      await updateGoal(editingGoal.id, goalData)
      showToast('Đã cập nhật mục tiêu thành công', 'success')
    } else {
      await addGoal(goalData)
      showToast('🎉 Đã khởi tạo mục tiêu mới thành công!', 'success')
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Bạn có chắc muốn xoá mục tiêu "${title}"?`)) {
      await deleteGoal(id)
      showToast('Đã xoá mục tiêu', 'info')
    }
  }

  const handleToggleGoalStatus = async (goal: GoalItem) => {
    const isCompleted = goal.status === 'COMPLETED'
    const nextStatus = isCompleted ? 'IN_PROGRESS' : 'COMPLETED'
    await updateGoal(goal.id, {
      status: nextStatus,
      completed_at: nextStatus === 'COMPLETED' ? new Date().toISOString() : null,
    })
    showToast(nextStatus === 'COMPLETED' ? `🏆 Đã hoàn thành mục tiêu "${goal.title}"!` : 'Đã mở lại mục tiêu')
  }

  /** Tạo task thực thi trực tiếp trong mục tiêu = tạo task trong bảng todos */
  const handleCreateTaskForGoal = async (goal: GoalItem, e?: React.FormEvent) => {
    e?.preventDefault()
    const taskTitle = (quickTaskInputs[goal.id] || '').trim()
    if (!taskTitle) return

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      title: taskTitle,
      completed: false,
      goal_id: goal.id,
      category: goal.category_label || goal.category || null,
      due_date: goal.target_date || localDate(),
      priority: 'NORMAL',
      difficulty: 'NORMAL',
      created_at: new Date().toISOString(),
    }

    todos.setItems((prev) => [newTodo, ...prev])
    setQuickTaskInputs((prev) => ({ ...prev, [goal.id]: '' }))

    if (supabase) {
      try {
        await supabase.from('todos').insert(newTodo)
      } catch (err) {
        console.warn('Lỗi lưu task vào Supabase:', err)
      }
    }

    notifyTasksChanged()
    showToast(`✅ Đã thêm việc "${taskTitle}" vào mục tiêu!`, 'success')
  }

  /** Bật/tắt trạng thái hoàn thành của task trong mục tiêu */
  const handleToggleTask = async (todo: Todo, goal: GoalItem) => {
    const nextCompleted = !todo.completed
    const now = nextCompleted ? new Date().toISOString() : null

    todos.setItems((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, completed: nextCompleted, completed_at: now } : t)),
    )

    if (supabase) {
      try {
        await supabase.from('todos').update({ completed: nextCompleted, completed_at: now }).eq('id', todo.id)
      } catch (err) {
        console.warn('Lỗi cập nhật task trên Supabase:', err)
      }
    }

    notifyTasksChanged()

    // Kiểm tra xem tất cả các việc trong mục tiêu đã xong chưa
    const otherTasks = todos.items.filter((t) => t.goal_id === goal.id && t.id !== todo.id && !t.deleted_at)
    const allOthersDone = otherTasks.every((t) => t.completed)
    if (nextCompleted && allOthersDone) {
      await updateGoal(goal.id, { status: 'COMPLETED' })
      showToast(`🏆 Chúc mừng! Bạn đã hoàn thành toàn bộ công việc của "${goal.title}"!`, 'success')
    } else {
      showToast(nextCompleted ? '✨ Đã hoàn thành công việc!' : 'Đã mở lại công việc')
    }
  }

  /** Xoá một task khỏi mục tiêu */
  const handleDeleteTask = async (todoId: string) => {
    todos.setItems((prev) => prev.filter((t) => t.id !== todoId))
    if (supabase) {
      try {
        await supabase.from('todos').update({ deleted_at: new Date().toISOString() }).eq('id', todoId)
      } catch (err) {
        console.warn('Lỗi xoá task trên Supabase:', err)
      }
    }
    notifyTasksChanged()
    showToast('🗑️ Đã xoá công việc khỏi mục tiêu')
  }

  const formatDeadline = (targetDate?: string | null) => {
    if (!targetDate) return null
    try {
      const todayStr = localDate()
      const t1 = new Date(todayStr + 'T00:00:00').getTime()
      const t2 = new Date(targetDate + 'T00:00:00').getTime()
      const days = Math.round((t2 - t1) / (1000 * 60 * 60 * 24))
      if (days < 0) return { label: `Quá hạn ${Math.abs(days)} ngày`, color: '#f43f5e' }
      if (days === 0) return { label: 'Hạn là hôm nay', color: '#f59e0b' }
      if (days === 1) return { label: 'Hạn vào ngày mai', color: '#f59e0b' }
      return { label: `Còn ${days} ngày · ${targetDate}`, color: '#38bdf8' }
    } catch {
      return { label: targetDate, color: '#38bdf8' }
    }
  }

  return (
    <div className="goals-page-container">
      {/* 1. HERO DASHBOARD TỔNG QUAN */}
      <section className="goals-hero-dashboard">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="goals-stat-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
                <Target size={14} /> Bảng Tầm Nhìn & Mục Tiêu
              </span>
              <span className="goals-stat-pill">
                🏆 {stats.completedCount}/{stats.total} Đạt được
              </span>
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 4px', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Kiến Tạo Tương Lai • Từng Bước Chinh Phục
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Đặt mục tiêu rõ ràng, lưu giữ động lực và chia nhỏ thành các hành động thực thi mỗi ngày.
            </p>
          </div>

          <button
            type="button"
            className="tv-btn primary"
            onClick={() => {
              setEditingGoal(null)
              setIsModalOpen(true)
            }}
            style={{ padding: '10px 18px', fontSize: '0.86rem', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Thêm Mục Tiêu Mới
          </button>
        </div>

        {/* Thanh tiến độ tổng quát */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>⚡ Tiến độ thực thi: {stats.completedTasksCount}/{stats.totalTasks} công việc đã xong</span>
            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{stats.overallProgress}%</span>
          </div>
          <div className="goal-progress-bar" style={{ height: 8 }}>
            <div className="goal-progress-fill" style={{ width: `${Math.max(stats.overallProgress > 0 ? 4 : 0, stats.overallProgress)}%`, background: 'var(--primary)' }} />
          </div>
        </div>
      </section>

      {/* 2. CHUYỂN TAB (ĐANG THEO ĐUỔI / ĐÃ HOÀN THÀNH) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div className="goals-view-selector" style={{ display: 'inline-flex', background: 'rgba(15, 23, 42, 0.65)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            type="button"
            className={`goals-view-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
            style={{ padding: '7px 14px', borderRadius: 9, border: 0, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: activeTab === 'active' ? 'var(--primary)' : 'transparent', color: activeTab === 'active' ? '#fff' : 'var(--text-muted)' }}
          >
            🎯 Đang Theo Đuổi ({stats.activeCount})
          </button>
          <button
            type="button"
            className={`goals-view-btn ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
            style={{ padding: '7px 14px', borderRadius: 9, border: 0, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', background: activeTab === 'completed' ? 'var(--primary)' : 'transparent', color: activeTab === 'completed' ? '#fff' : 'var(--text-muted)' }}
          >
            🏆 Đã Hoàn Thành ({stats.completedCount})
          </button>
        </div>
      </div>

      {/* 3. BỘ LỌC THỂ LOẠI DÙNG CHUNG (Đồng bộ 100% với bên Tasks) */}
      <div className="goals-category-filter">
        <button
          type="button"
          className={`goals-cat-btn ${categoryFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('ALL')}
        >
          ✨ Tất cả thể loại
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`goals-cat-btn ${categoryFilter === cat.name ? 'active' : ''}`}
            onClick={() => setCategoryFilter(cat.name)}
          >
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* 4. TRƯỜNG HỢP TRỐNG (EMPTY STATE) */}
      {filteredGoals.length === 0 && (
        <div className="day-highlight-box" style={{ textAlign: 'center', padding: '50px 20px', borderRadius: 20 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>✨</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-main)' }}>
            {activeTab === 'active' ? 'Chưa có mục tiêu nào đang theo đuổi' : 'Chưa có mục tiêu nào hoàn thành'}
          </h3>
          <p style={{ margin: '0 auto 16px', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 440 }}>
            {activeTab === 'active'
              ? 'Hãy khởi tạo ước mơ và mục tiêu của bạn để bắt đầu hành trình từng bước chinh phục!'
              : 'Hãy kiên trì hoàn thành các công việc bên trong mục tiêu để đưa mục tiêu vào danh sách hoàn thành!'}
          </p>
          {activeTab === 'active' && (
            <button
              type="button"
              className="tv-btn primary"
              onClick={() => {
                setEditingGoal(null)
                setIsModalOpen(true)
              }}
              style={{ padding: '9px 18px', fontSize: '0.84rem', borderRadius: 12 }}
            >
              <Plus size={15} /> Tạo Mục Tiêu Mới
            </button>
          )}
        </div>
      )}

      {/* 5. LƯỚI THẺ MỤC TIÊU VISION BOARD (GRID) */}
      {filteredGoals.length > 0 && (
        <div className="goals-vision-grid">
          {filteredGoals.map((goal) => {
            const linkedTasks = todos.items.filter((t) => t.goal_id === goal.id && !t.deleted_at)
            const completedTasksCount = linkedTasks.filter((t) => t.completed).length
            const totalTasksCount = linkedTasks.length
            const isCompleted = goal.status === 'COMPLETED' || (totalTasksCount > 0 && completedTasksCount === totalTasksCount)
            const progress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : isCompleted ? 100 : 0
            const isTasksOpen = expandedTasks[goal.id] ?? true
            const deadline = formatDeadline(goal.target_date)
            const categoryLabel = goal.category_label || goal.category || 'Mục tiêu'

            return (
              <div key={goal.id} className={`goal-vision-card ${isCompleted ? 'completed' : ''}`}>
                {/* 1. Ảnh Vision Board của thẻ */}
                <div className="goal-vision-banner">
                  {goal.image_url ? (
                    <img src={goal.image_url} alt={goal.title} className="goal-vision-banner-img" />
                  ) : (
                    <div className="goal-vision-banner-fallback">
                      <span>{goal.icon || '🌟'}</span>
                    </div>
                  )}

                  {/* Badges đè trên banner */}
                  <div className="goal-banner-badges">
                    <span className="goal-cat-pill" style={{ background: `${goal.color || '#8b5cf6'}cc` }}>
                      {goal.icon || '🎯'} {categoryLabel}
                    </span>
                    {deadline && (
                      <span className="goal-deadline-pill" style={{ borderColor: deadline.color, color: deadline.color }}>
                        {deadline.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Thân thẻ */}
                <div className="goal-vision-body">
                  <h3 className="goal-vision-title">{goal.title}</h3>

                  {/* Lí do & Động lực */}
                  {(goal.reason || goal.description) && (
                    <div className="goal-reason-quote">
                      💡 <strong>Động lực:</strong> "{goal.reason || goal.description}"
                    </div>
                  )}

                  {/* Thanh tiến độ */}
                  <div className="goal-progress-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      <span>
                        {totalTasksCount > 0
                          ? `⚡ Đã xong ${completedTasksCount}/${totalTasksCount} việc`
                          : isCompleted ? '🏆 Đã đạt được' : '🌱 Đang thực hiện'}
                      </span>
                      <span style={{ color: isCompleted ? '#10b981' : 'var(--primary)', fontWeight: 800 }}>{progress}%</span>
                    </div>
                    <div className="goal-progress-bar">
                      <div
                        className="goal-progress-fill"
                        style={{
                          width: `${Math.max(progress > 0 ? 5 : 0, progress)}%`,
                          background: isCompleted ? '#10b981' : goal.color || 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>

                  {/* 3. Danh sách công việc thực thi (Linked Tasks) */}
                  <div className="goal-action-tasks">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        padding: '4px 0',
                      }}
                      onClick={() => setExpandedTasks((prev) => ({ ...prev, [goal.id]: !isTasksOpen }))}
                    >
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        📋 Việc cần làm ({completedTasksCount}/{totalTasksCount})
                      </span>
                      <button type="button" style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                        {isTasksOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    {isTasksOpen && (
                      <div style={{ marginTop: 6 }}>
                        {/* Render từng task */}
                        {linkedTasks.map((todo) => (
                          <div key={todo.id} className={`goal-task-row ${todo.completed ? 'done' : ''}`}>
                            <div
                              className={`goal-checkbox ${todo.completed ? 'checked' : ''}`}
                              onClick={() => handleToggleTask(todo, goal)}
                              role="checkbox"
                              aria-checked={todo.completed}
                            >
                              {todo.completed && <Check size={11} color="#fff" strokeWidth={3} />}
                            </div>
                            <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.3 }}>
                              {todo.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(todo.id)}
                              style={{ background: 'none', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                              title="Xoá việc"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}

                        {/* Form thêm nhanh task */}
                        <form onSubmit={(e) => handleCreateTaskForGoal(goal, e)} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <input
                            type="text"
                            value={quickTaskInputs[goal.id] || ''}
                            onChange={(e) => setQuickTaskInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                            placeholder="+ Thêm việc cụ thể để đạt mục tiêu…"
                            style={{
                              flex: 1,
                              fontSize: '0.76rem',
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: '1px solid var(--card-border)',
                              background: 'var(--card-bg)',
                              color: 'var(--text-main)',
                              outline: 'none',
                            }}
                          />
                          <button
                            type="submit"
                            disabled={!(quickTaskInputs[goal.id] || '').trim()}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: 0,
                              background: 'var(--primary)',
                              color: '#fff',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              opacity: (quickTaskInputs[goal.id] || '').trim() ? 1 : 0.5,
                            }}
                          >
                            Thêm
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                  {/* 4. Hàng nút công cụ của thẻ */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleGoalStatus(goal)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                        color: isCompleted ? '#10b981' : 'var(--text-muted)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CheckCircle2 size={13} />
                      <span>{isCompleted ? 'Đã hoàn thành' : 'Đánh dấu xong'}</span>
                    </button>

                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGoal(goal)
                          setIsModalOpen(true)
                        }}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          fontSize: '0.74rem',
                          cursor: 'pointer',
                        }}
                        title="Chỉnh sửa mục tiêu"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(goal.id, goal.title)}
                        style={{
                          padding: '5px 8px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'transparent',
                          color: '#f43f5e',
                          fontSize: '0.74rem',
                          cursor: 'pointer',
                        }}
                        title="Xoá mục tiêu"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 6. MODAL THÊM / SỬA MỤC TIÊU */}
      <GoalModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingGoal(null)
        }}
        onSave={handleSaveGoal}
        initialGoal={editingGoal}
      />
    </div>
  )
}
