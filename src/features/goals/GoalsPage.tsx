import { useMemo, useState } from 'react'
import {
  Calendar, CheckCircle2, ChevronDown, ChevronUp, Edit3,
  Flame,
  Mountain, Plus, Trash2, Trophy, X
} from 'lucide-react'
import { useGoals, calculateAscensionProgress } from '../../lib/goals'
import { GoalModal } from './GoalModal'
import { useHeaderActions } from '../HeaderAction'
import { useToast } from '../ToastContext'
import { useQuery } from '../shared'
import { supabase } from '../../lib/supabase'
import { localDate } from '../../lib/date'
import { notifyTasksChanged } from '../useUncompletedTasks'
import type { GoalItem, Todo } from '../../types'
import './goals.css'

// 3 tầng mây SVG vẽ vector mềm mại cho hiệu ứng bồng bềnh
function CloudSvgLayer({ opacity = 0.6, width = '100%' }: { opacity?: number; width?: string }) {
  return (
    <svg viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width, opacity }}>
      <path
        d="M0,160 C120,200 240,120 360,160 C480,200 600,280 720,240 C840,200 960,120 1080,140 C1200,160 1320,220 1440,180 L1440,320 L0,320 Z"
        fill="currentColor"
      />
      <circle cx="200" cy="140" r="80" fill="currentColor" />
      <circle cx="340" cy="120" r="100" fill="currentColor" />
      <circle cx="500" cy="150" r="70" fill="currentColor" />
      <circle cx="750" cy="110" r="110" fill="currentColor" />
      <circle cx="920" cy="130" r="90" fill="currentColor" />
      <circle cx="1150" cy="120" r="105" fill="currentColor" />
      <circle cx="1320" cy="150" r="80" fill="currentColor" />
    </svg>
  )
}

// Bầu trời mây và sao nền động 2D/3D
function SkyAtmosphereScene() {
  const stars = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      left: `${(i * 17) % 96 + 2}%`,
      size: (i % 3) + 2,
      duration: 12 + (i % 8) * 3,
      delay: (i % 6) * 2,
    }))
  }, [])

  return (
    <div className="sky-backdrop-wrapper" aria-hidden="true">
      <div className="sky-gradient-layer" />
      <div className="sky-aurora-glow" />

      {/* Các hạt sao bay ngược lên trời */}
      {stars.map((s) => (
        <div
          key={s.id}
          className="star-particle"
          style={{
            left: s.left,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* Tầng mây sâu phía xa */}
      <div className="cloud-layer cloud-layer-deep" style={{ color: 'rgba(255, 255, 255, 0.12)' }}>
        <CloudSvgLayer opacity={0.4} width="200%" />
      </div>

      {/* Tầng mây giữa */}
      <div className="cloud-layer cloud-layer-mid" style={{ color: 'rgba(255, 255, 255, 0.22)' }}>
        <CloudSvgLayer opacity={0.6} width="200%" />
      </div>

      {/* Tầng mây cận cảnh */}
      <div className="cloud-layer cloud-layer-front" style={{ color: 'rgba(255, 255, 255, 0.35)' }}>
        <CloudSvgLayer opacity={0.8} width="200%" />
      </div>
    </div>
  )
}

export function GoalsPage() {
  const { showToast } = useToast()
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals()
  const todos = useQuery<Todo>('todos')

  const [activeTab, setActiveTab] = useState<'stairway' | 'hall'>('stairway')
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

  // Thống kê độ cao hành trình leo trời
  const ascension = useMemo(() => calculateAscensionProgress(goals), [goals])

  // Sắp xếp mục tiêu theo độ cao tăng dần để leo lên
  const sortedStairwayGoals = useMemo(() => {
    return [...goals].sort((a, b) => (a.altitude_meters || 0) - (b.altitude_meters || 0))
  }, [goals])

  // Danh sách mục tiêu đã hoàn thành (Đền vinh quang)
  const completedGoals = useMemo(() => {
    return goals.filter((g) => {
      const linked = todos.items.filter((t) => t.goal_id === g.id && !t.deleted_at)
      const allTasksDone = linked.length > 0 && linked.every((t) => t.completed)
      return g.status === 'COMPLETED' || g.current_value >= g.target_value || allTasksDone
    })
  }, [goals, todos.items])

  const handleSaveGoal = async (goalData: Omit<GoalItem, 'id' | 'created_at'>) => {
    if (editingGoal) {
      await updateGoal(editingGoal.id, goalData)
      showToast('Đã cập nhật mục tiêu thành công', 'success')
    } else {
      await addGoal(goalData)
      showToast('🎉 Đã khởi tạo hành trình mục tiêu mới!', 'success')
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Bạn có chắc muốn xoá mục tiêu "${title}"?`)) {
      await deleteGoal(id)
      showToast('Đã xoá mục tiêu', 'info')
    }
  }

  const handleQuickIncrement = async (goal: GoalItem, amount = 1) => {
    const nextVal = Math.min(goal.target_value, goal.current_value + amount)
    await updateGoal(goal.id, { current_value: nextVal })
    if (nextVal >= goal.target_value && goal.status !== 'COMPLETED') {
      showToast(`🎉 Xuất sắc! Đã hoàn thành mục tiêu "${goal.title}"!`, 'success')
    }
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
      await updateGoal(goal.id, { status: 'COMPLETED', current_value: goal.target_value })
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

  return (
    <div className="goals-page-container">
      {/* 1. NỀN TRỜI & MÂY 3D / 2D PARALLAX */}
      <SkyAtmosphereScene />

      {/* 2. HERO DASHBOARD — ĐỘ CAO LEO TRỜI & TẦNG MÂY HIỆN TẠI */}
      <section className="sky-altitude-hero">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="hero-stats-badge">
              <span>{ascension.tierIcon}</span>
              <span>{ascension.tierName}</span>
            </div>

            <div className="hero-altitude-number">
              <span>{ascension.currentAltitude.toLocaleString()}m</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                / {ascension.targetAltitude.toLocaleString()}m độ cao
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 500, lineHeight: 1.35 }}>
              {ascension.tierDescription}
            </p>
          </div>

          <button
            type="button"
            className="tv-btn primary"
            onClick={() => {
              setEditingGoal(null)
              setIsModalOpen(true)
            }}
            style={{ padding: '9px 16px', fontSize: '0.84rem', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Thêm Mục Tiêu Lên Trời
          </button>
        </div>

        {/* Thanh tiến độ leo mây */}
        <div className="hero-progress-track">
          <div className="hero-progress-fill" style={{ width: `${Math.max(5, ascension.percent)}%` }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          <span>🌱 0m Mặt Đất</span>
          <span style={{ color: 'var(--primary)', fontWeight: 800 }}>Chinh phục: {ascension.percent}% • {ascension.completedGoalsCount}/{ascension.totalGoalsCount} Mục tiêu đỉnh</span>
          <span>👑 10,000m+ Bầu Trời Sao</span>
        </div>
      </section>

      {/* 3. THANH ĐIỀU HƯỚNG CHẾ ĐỘ XEM (BẬC THANG LÊN TRỜI / ĐỀN VINH QUANG) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, position: 'relative', zIndex: 10 }}>
        <div className="goals-view-selector">
          <button
            type="button"
            className={`goals-view-btn ${activeTab === 'stairway' ? 'active' : ''}`}
            onClick={() => setActiveTab('stairway')}
          >
            <Mountain size={14} /> Bậc Thang Lên Trời ({goals.length})
          </button>
          <button
            type="button"
            className={`goals-view-btn ${activeTab === 'hall' ? 'active' : ''}`}
            onClick={() => setActiveTab('hall')}
          >
            <Trophy size={14} /> Đền Vinh Quang ({completedGoals.length})
          </button>
        </div>
      </div>

      {/* 4. TRƯỜNG HỢP CHƯA CÓ MỤC TIÊU NÀO (EMPTY STATE 3D) */}
      {goals.length === 0 && (
        <div className="sky-apex-heaven" style={{ margin: '20px 0', border: '1px dashed rgba(56, 189, 248, 0.35)' }}>
          <div className="apex-portal-icon">
            ✨
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px', color: '#ffffff' }}>
            Bầu trời xanh đang chờ ước mơ của bạn
          </h3>
          <p style={{ margin: '0 auto 16px', fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: 460 }}>
            Chưa có mục tiêu nào được tạo. Hãy khởi tạo nấc thang đầu tiên để bắt đầu hành trình vươn tới trời cao!
          </p>
          <button
            type="button"
            className="tv-btn primary"
            onClick={() => {
              setEditingGoal(null)
              setIsModalOpen(true)
            }}
            style={{ padding: '10px 20px', fontSize: '0.88rem', borderRadius: 12 }}
          >
            <Plus size={16} /> Tạo Mục Tiêu Đầu Tiên
          </button>
        </div>
      )}

      {/* 5. CHẾ ĐỘ 1: BẬC THANG LÊN TRỜI (SKY STAIRWAY JOURNEY) */}
      {activeTab === 'stairway' && goals.length > 0 && (
        <div className="sky-stairway-journey">
          {/* Cột sáng chiếu dọc nối các nấc mây */}
          <div className="stairway-beam-line" />

          {/* Đỉnh trời vinh quang trên cùng */}
          <div className="sky-apex-heaven">
            <div className="apex-portal-icon">
              👑
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 4px', color: '#ffffff' }}>
              Cổng Thiên Giới & Bầu Trời Bất Tận
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 440, marginInline: 'auto' }}>
              Nơi mọi mục tiêu và công việc hoàn thành hội tụ thành những vì sao rực rỡ nhất.
            </p>
          </div>

          {/* Danh sách các nấc thang mục tiêu leo từ dưới lên */}
          {sortedStairwayGoals.map((goal, idx) => {
            const isEven = idx % 2 === 0
            const linkedTasks = todos.items.filter((t) => t.goal_id === goal.id && !t.deleted_at)
            const completedTasksCount = linkedTasks.filter((t) => t.completed).length
            const hasLinkedTasks = linkedTasks.length > 0

            // Tính toán % tiến độ
            let percent = 0
            if (hasLinkedTasks) {
              percent = Math.round((completedTasksCount / linkedTasks.length) * 100)
            } else if (goal.target_value > 0) {
              percent = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
            }

            const isCompleted = goal.status === 'COMPLETED' || percent >= 100
            const isTasksExpanded = expandedTasks[goal.id] !== false // Mặc định mở rộng checklist

            return (
              <div
                key={goal.id}
                className={`stairway-step-container ${isEven ? 'stairway-step-left' : 'stairway-step-right'}`}
              >
                {/* Trạm mây trung tâm */}
                <div
                  className={`stairway-cloud-station ${isCompleted ? 'completed' : ''}`}
                  onClick={() => handleQuickIncrement(goal, 1)}
                  title={`Bậc thang ${goal.altitude_meters.toLocaleString()}m: Bấm để tăng +1`}
                >
                  {isCompleted ? '⭐' : goal.icon || '☁️'}
                </div>

                {/* Thẻ mục tiêu bồng bềnh 3D */}
                <div className={`goal-cloud-card ${isCompleted ? 'completed' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: `${goal.color || '#38bdf8'}22`, color: goal.color || '#38bdf8', border: `1px solid ${goal.color || '#38bdf8'}44` }}>
                          🏔️ {goal.altitude_meters?.toLocaleString()}m
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          • {goal.category_label || 'Mục tiêu'}
                        </span>
                        {goal.target_date && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            • <Calendar size={11} /> {goal.target_date}
                          </span>
                        )}
                      </div>

                      <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {goal.title}
                      </h4>

                      {goal.description && (
                        <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                          {goal.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGoal(goal)
                          setIsModalOpen(true)
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                        title="Sửa mục tiêu"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(goal.id, goal.title)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                        title="Xoá mục tiêu"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Tiến độ và thanh đo */}
                  <div style={{ margin: '6px 0 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ color: isCompleted ? '#10b981' : 'var(--text-main)' }}>
                        {hasLinkedTasks
                          ? `⚡ Đã xong ${completedTasksCount}/${linkedTasks.length} việc thực thi`
                          : `${goal.current_value} / ${goal.target_value} ${goal.unit}`}
                      </span>
                      <span style={{ color: isCompleted ? '#10b981' : 'var(--primary)' }}>
                        {percent}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${percent}%`,
                          background: isCompleted ? 'linear-gradient(90deg, #10b981, #059669)' : `linear-gradient(90deg, ${goal.color || '#38bdf8'}, #818cf8)`,
                          borderRadius: 99,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* DANH SÁCH CÔNG VIỆC THỰC THI (LINKED TASKS TRONG TODOS TABLE) */}
                  <div className="goal-task-section">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        padding: '2px 0',
                      }}
                      onClick={() => setExpandedTasks((prev) => ({ ...prev, [goal.id]: !isTasksExpanded }))}
                    >
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Flame size={12} color="#f59e0b" /> Công việc thực thi ({linkedTasks.length}):
                      </span>
                      <button
                        type="button"
                        style={{ border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                      >
                        {isTasksExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {isTasksExpanded && (
                      <div style={{ marginTop: 4 }}>
                        {/* Danh sách các task liên kết */}
                        {linkedTasks.map((t) => (
                          <div key={t.id} className={`goal-task-item ${t.completed ? 'done' : ''}`}>
                            <div
                              className={`cloud-checkbox ${t.completed ? 'checked' : ''}`}
                              onClick={() => handleToggleTask(t, goal)}
                              title={t.completed ? 'Đánh dấu chưa xong' : 'Đánh dấu đã hoàn thành'}
                            >
                              {t.completed && <CheckCircle2 size={11} color="#ffffff" />}
                            </div>
                            <span
                              className="goal-task-title"
                              onClick={() => handleToggleTask(t, goal)}
                              style={{ flex: 1, fontSize: '0.78rem', cursor: 'pointer', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {t.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(t.id)}
                              style={{ border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                              title="Xoá việc này"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}

                        {/* Form thêm task nhanh cho mục tiêu */}
                        <form
                          className="goal-task-quick-input-form"
                          onSubmit={(e) => handleCreateTaskForGoal(goal, e)}
                        >
                          <input
                            type="text"
                            className="goal-task-quick-input"
                            value={quickTaskInputs[goal.id] || ''}
                            onChange={(e) => setQuickTaskInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                            placeholder="+ Thêm công việc thực thi cho mục tiêu..."
                          />
                          <button
                            type="submit"
                            style={{
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: 0,
                              background: 'var(--primary)',
                              color: '#fff',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Plus size={12} /> Thêm
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 6. CHẾ ĐỘ 2: ĐỀN VINH QUANG (COMPLETED CELESTIAL GOALS) */}
      {activeTab === 'hall' && (
        <div style={{ position: 'relative', zIndex: 10, padding: '20px 0' }}>
          {completedGoals.length === 0 ? (
            <div className="sky-apex-heaven">
              <div className="apex-portal-icon">
                🏛️
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px', color: '#ffffff' }}>
                Đền Vinh Quang Đang Chờ Đón
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 440, marginInline: 'auto' }}>
                Khi bạn hoàn thành 100% mục tiêu, ngôi đền này sẽ lưu danh những chiến tích vĩ đại của bạn.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {completedGoals.map((goal) => {
                const linkedTasks = todos.items.filter((t) => t.goal_id === goal.id && !t.deleted_at)
                return (
                  <div key={goal.id} className="goal-cloud-card completed">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '1.6rem' }}>👑</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800, color: '#10b981' }}>
                          {goal.title}
                        </h4>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          🏔️ {goal.altitude_meters?.toLocaleString()}m • Chinh phục thành công
                        </span>
                      </div>
                    </div>
                    {goal.description && (
                      <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {goal.description}
                      </p>
                    )}
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Hoàn thành {linkedTasks.length > 0 ? `${linkedTasks.length}/${linkedTasks.length} việc` : `${goal.target_value} ${goal.unit}`}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 7. MODAL THÊM / SỬA MỤC TIÊU */}
      <GoalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveGoal}
        initialGoal={editingGoal}
      />
    </div>
  )
}
