import { useMemo, useState } from 'react'
import {
  Calendar, CheckCircle2, Edit3,
  Layers, Mountain, Plus, Trash2, Trophy
} from 'lucide-react'
import { useGoals, calculateAscensionProgress } from '../../lib/goals'
import { GoalModal } from './GoalModal'
import { useHeaderActions } from '../HeaderAction'
import { useToast } from '../ToastContext'
import type { GoalItem } from '../../types'
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
  const { goals, addGoal, updateGoal, toggleMilestone, deleteGoal } = useGoals()

  const [activeTab, setActiveTab] = useState<'stairway' | 'matrix' | 'hall'>('stairway')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null)

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

  // Danh sách mục tiêu cho chế độ lưới lọc
  const filteredMatrixGoals = useMemo(() => {
    let result = [...goals]
    if (filterCategory !== 'ALL') {
      result = result.filter((g) => g.category === filterCategory)
    }
    if (filterStatus !== 'ALL') {
      result = result.filter((g) => g.status === filterStatus)
    }
    return result
  }, [goals, filterCategory, filterStatus])

  // Danh sách mục tiêu đã hoàn thành (Đền vinh quang)
  const completedGoals = useMemo(() => {
    return goals.filter((g) => g.status === 'COMPLETED' || g.current_value >= g.target_value)
  }, [goals])

  const handleSaveGoal = async (goalData: Omit<GoalItem, 'id' | 'created_at'>) => {
    if (editingGoal) {
      await updateGoal(editingGoal.id, goalData)
      showToast('Đã cập nhật mục tiêu thành công', 'success')
    } else {
      await addGoal(goalData)
      showToast('🎉 Đã khởi tạo hành trình mục tiêu mới!', 'success')
    }
  }

  const handleToggleMilestone = async (goalId: string, milestoneId: string) => {
    const updated = await toggleMilestone(goalId, milestoneId)
    if (updated?.status === 'COMPLETED') {
      showToast(`🏆 Chúc mừng! Bạn đã chinh phục xong "${updated.title}"!`, 'success')
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

  return (
    <div className="goals-page-container">
      {/* 1. NỀN TRỜI & MÂY 3D / 2D PARALLAX */}
      <SkyAtmosphereScene />

      {/* 2. HERO DASHBOARD — ĐỘ CAO LEO TRỜI & TẦNG MÂY HIỆN TẠI */}
      <section className="sky-altitude-hero">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="hero-stats-badge">
              <span>{ascension.tierIcon}</span>
              <span>{ascension.tierName}</span>
            </div>

            <div className="hero-altitude-number">
              <span>{ascension.currentAltitude.toLocaleString()}m</span>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                / {ascension.targetAltitude.toLocaleString()}m độ cao
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: 'var(--text-muted)', maxWidth: 520, lineHeight: 1.4 }}>
              {ascension.tierDescription}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="tv-btn primary"
              onClick={() => {
                setEditingGoal(null)
                setIsModalOpen(true)
              }}
              style={{ padding: '10px 18px', fontSize: '0.86rem', borderRadius: 14 }}
            >
              <Plus size={16} /> Thêm Mục Tiêu Lên Trời
            </button>
          </div>
        </div>

        {/* Thanh tiến độ leo mây */}
        <div className="hero-progress-track">
          <div className="hero-progress-fill" style={{ width: `${Math.max(5, ascension.percent)}%` }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          <span>🌱 0m Mặt Đất</span>
          <span style={{ color: 'var(--primary)', fontWeight: 800 }}>Chinh phục: {ascension.percent}% • {ascension.completedGoalsCount}/{ascension.totalGoalsCount} Mục tiêu đỉnh</span>
          <span>👑 10,000m+ Bầu Trời Sao</span>
        </div>
      </section>

      {/* 3. THANH ĐIỀU HƯỚNG CHẾ ĐỘ XEM */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, position: 'relative', zIndex: 10 }}>
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
            className={`goals-view-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            <Layers size={14} /> Lưới Mục Tiêu
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

      {/* 4.1. CHẾ ĐỘ 1: BẬC THANG LÊN TRỜI (SKY STAIRWAY JOURNEY) */}
      {activeTab === 'stairway' && (
        <div className="sky-stairway-journey">
          {/* Cột sáng chiếu dọc nối các nấc mây */}
          <div className="stairway-beam-line" />

          {/* Đỉnh trời vinh quang trên cùng */}
          <div className="sky-apex-heaven">
            <div className="apex-portal-icon">
              ✨
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, margin: '0 0 6px', color: '#ffffff' }}>
              Cổng Thiên Giới & Bầu Trời Bất Tận
            </h3>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: 460, marginInline: 'auto' }}>
              Nơi mọi ước mơ và nỗ lực đều hội tụ thành những vì sao rực rỡ nhất.
            </p>
          </div>

          {/* Danh sách các nấc thang mục tiêu leo từ dưới lên */}
          {sortedStairwayGoals.map((goal, idx) => {
            const isEven = idx % 2 === 0
            const percent = goal.target_value > 0 ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0
            const isCompleted = goal.status === 'COMPLETED' || percent >= 100

            return (
              <div
                key={goal.id}
                className={`stairway-step-container ${isEven ? 'stairway-step-left' : 'stairway-step-right'}`}
              >
                {/* Trạm mây trung tâm */}
                <div
                  className={`stairway-cloud-station ${isCompleted ? 'completed' : ''}`}
                  onClick={() => handleQuickIncrement(goal, 1)}
                  title={`Bậc thang ${goal.altitude_meters.toLocaleString()}m: Bấm để tăng tiến độ +1`}
                >
                  {isCompleted ? '⭐' : goal.icon || '☁️'}
                </div>

                {/* Thẻ mục tiêu bồng bềnh */}
                <div className={`goal-cloud-card ${isCompleted ? 'completed' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: `${goal.color || '#38bdf8'}22`, color: goal.color || '#38bdf8' }}>
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

                      <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {goal.title}
                      </h4>

                      {goal.description && (
                        <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                          {goal.description}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 4 }}>
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
                  <div style={{ margin: '8px 0 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
                      <span style={{ color: isCompleted ? '#10b981' : 'var(--text-main)' }}>
                        {goal.current_value} / {goal.target_value} {goal.unit}
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

                  {/* Nút cộng nhanh & Danh sách bậc thang con */}
                  {goal.milestones && goal.milestones.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 8 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        Nấc thang từng bước:
                      </span>
                      {goal.milestones.map((m) => (
                        <div
                          key={m.id}
                          className={`goal-milestone-item ${m.completed ? 'done' : ''}`}
                          onClick={() => handleToggleMilestone(goal.id, m.id)}
                        >
                          <div className={`cloud-checkbox ${m.completed ? 'checked' : ''}`}>
                            {m.completed && <CheckCircle2 size={12} color="#ffffff" />}
                          </div>
                          <span style={{ fontSize: '0.78rem', color: m.completed ? 'var(--text-muted)' : 'var(--text-main)', flex: 1 }}>
                            {m.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 4.2. CHẾ ĐỘ 2: LƯỚI MA TRẬN MỤC TIÊU (CARDS MATRIX) */}
      {activeTab === 'matrix' && (
        <div>
          {/* Bộ lọc thể loại & trạng thái */}
          <div className="chip-scroll-row" style={{ margin: '12px 0 20px', position: 'relative', zIndex: 10 }}>
            {([
              { id: 'ALL', label: 'Tất cả danh mục' },
              { id: 'GROWTH', label: '🌱 Phát triển' },
              { id: 'HEALTH', label: '🏃 Sức khỏe' },
              { id: 'WEALTH', label: '💎 Tài chính' },
              { id: 'CAREER', label: '🚀 Sự nghiệp' },
              { id: 'SHORT_TERM', label: '⚡ Ngắn hạn' },
              { id: 'LONG_TERM', label: '👑 Ước mơ lớn' },
            ] as const).map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`tv-filter-pill ${filterCategory === cat.id ? 'active' : ''}`}
                onClick={() => setFilterCategory(cat.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: `1px solid ${filterCategory === cat.id ? 'var(--primary)' : 'var(--card-border)'}`,
                  background: filterCategory === cat.id ? 'var(--primary)' : 'var(--card-bg)',
                  color: filterCategory === cat.id ? '#ffffff' : 'var(--text-main)',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Bộ lọc trạng thái */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {([
              { id: 'ALL', label: 'Tất cả trạng thái' },
              { id: 'IN_PROGRESS', label: '⚡ Đang leo' },
              { id: 'COMPLETED', label: '✓ Đã chạm đỉnh' },
            ] as const).map((st) => (
              <button
                key={st.id}
                type="button"
                className={`goals-view-btn ${filterStatus === st.id ? 'active' : ''}`}
                onClick={() => setFilterStatus(st.id)}
                style={{ fontSize: '0.74rem', padding: '4px 10px' }}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="goals-matrix-grid">
            {filteredMatrixGoals.map((goal) => {
              const percent = goal.target_value > 0 ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : 0
              const isCompleted = goal.status === 'COMPLETED' || percent >= 100

              return (
                <div key={goal.id} className={`goal-cloud-card ${isCompleted ? 'completed' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: '1.5rem' }}>{goal.icon || '🌟'}</span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: `${goal.color || '#38bdf8'}22`, color: goal.color || '#38bdf8' }}>
                      {goal.altitude_meters?.toLocaleString()}m
                    </span>
                  </div>

                  <h4 style={{ margin: '0 0 6px', fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {goal.title}
                  </h4>

                  {goal.description && (
                    <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {goal.description}
                    </p>
                  )}

                  {/* Tiến độ */}
                  <div style={{ margin: '10px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>
                      <span>{goal.current_value} / {goal.target_value} {goal.unit}</span>
                      <span style={{ color: isCompleted ? '#10b981' : 'var(--primary)' }}>{percent}%</span>
                    </div>
                    <div style={{ width: '100%', height: 7, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${percent}%`,
                          background: isCompleted ? 'linear-gradient(90deg, #10b981, #059669)' : `linear-gradient(90deg, ${goal.color || '#38bdf8'}, #818cf8)`,
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>

                  {/* Milestones checklist */}
                  {goal.milestones && goal.milestones.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      {goal.milestones.map((m) => (
                        <div
                          key={m.id}
                          className={`goal-milestone-item ${m.completed ? 'done' : ''}`}
                          onClick={() => handleToggleMilestone(goal.id, m.id)}
                        >
                          <div className={`cloud-checkbox ${m.completed ? 'checked' : ''}`}>
                            {m.completed && <CheckCircle2 size={12} color="#ffffff" />}
                          </div>
                          <span style={{ fontSize: '0.78rem', color: m.completed ? 'var(--text-muted)' : 'var(--text-main)', flex: 1 }}>
                            {m.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick increment buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleQuickIncrement(goal, 1)}
                        className="tv-btn"
                        style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                      >
                        +1 {goal.unit}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickIncrement(goal, 5)}
                        className="tv-btn"
                        style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                      >
                        +5
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 2 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGoal(goal)
                          setIsModalOpen(true)
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(goal.id, goal.title)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4.3. CHẾ ĐỘ 3: ĐỀN VINH QUANG (HALL OF FAME) */}
      {activeTab === 'hall' && (
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>👑</div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 900, margin: '0 0 6px', color: '#ffffff' }}>
            Đền Vinh Quang & Những Mục Tiêu Đã Chạm Đỉnh
          </h3>
          <p style={{ margin: '0 0 24px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Nơi ghi nhận những cột mốc rạng rỡ bạn đã kiên trì bước từng bậc để chạm tới bầu trời.
          </p>

          {completedGoals.length === 0 ? (
            <div style={{ padding: '40px 20px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 20, maxWidth: 480, margin: '0 auto' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Chưa có mục tiêu nào chạm đỉnh. Hãy kiên trì leo từng nấc thang mỗi ngày nhé!
              </p>
            </div>
          ) : (
            <div className="goals-matrix-grid">
              {completedGoals.map((goal) => (
                <div key={goal.id} className="goal-cloud-card completed" style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '1.6rem' }}>{goal.icon || '🏆'}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: 99 }}>
                      ✓ ĐÃ CHẠM ĐỈNH
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1.02rem', fontWeight: 800, color: '#10b981' }}>
                    {goal.title}
                  </h4>
                  <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {goal.description || `Đã hoàn thành trọn vẹn ${goal.target_value} ${goal.unit}.`}
                  </p>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    🏔️ Độ cao: {goal.altitude_meters?.toLocaleString()}m • Danh mục: {goal.category_label || 'Mục tiêu'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. MODAL TẠO / SỬA MỤC TIÊU */}
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
