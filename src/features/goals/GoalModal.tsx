import { useEffect, useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { Modal } from '../shared'
import type { GoalItem, GoalMilestone } from '../../types'

type GoalModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (goal: Omit<GoalItem, 'id' | 'created_at'>) => Promise<void>
  initialGoal?: GoalItem | null
}

const CATEGORY_OPTIONS = [
  { id: 'GROWTH', label: 'Phát triển bản thân', icon: '🌱', color: '#38bdf8', defaultAlt: 2500 },
  { id: 'HEALTH', label: 'Sức khỏe & Thể chất', icon: '🏃', color: '#34d399', defaultAlt: 3000 },
  { id: 'WEALTH', label: 'Tài chính & Thịnh vượng', icon: '💎', color: '#fbbf24', defaultAlt: 5000 },
  { id: 'CAREER', label: 'Sự nghiệp & Công việc', icon: '🚀', color: '#818cf8', defaultAlt: 4000 },
  { id: 'SHORT_TERM', label: 'Mục tiêu ngắn hạn', icon: '⚡', color: '#f472b6', defaultAlt: 1500 },
  { id: 'LONG_TERM', label: 'Ước mơ cuộc đời', icon: '👑', color: '#c084fc', defaultAlt: 8848 },
] as const

const ALTITUDE_PRESETS = [
  { value: 1000, label: '1,000m (Khởi hành mây thấp)' },
  { value: 2500, label: '2,500m (Sườn núi sương mù)' },
  { value: 4000, label: '4,000m (Tầng mây trắng)' },
  { value: 6000, label: '6,000m (Bồng bềnh giữa trời)' },
  { value: 8848, label: '8,848m (Đỉnh Everest mây phủ)' },
  { value: 10000, label: '10,000m+ (Chạm Bầu Trời Sao)' },
]

export function GoalModal({ isOpen, onClose, onSave, initialGoal }: GoalModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<GoalItem['category']>('GROWTH')
  const [targetDate, setTargetDate] = useState('')
  const [currentValue, setCurrentValue] = useState(0)
  const [targetValue, setTargetValue] = useState(10)
  const [unit, setUnit] = useState('bước')
  const [altitudeMeters, setAltitudeMeters] = useState(2500)
  const [icon, setIcon] = useState('🌟')
  const [color, setColor] = useState('#38bdf8')

  const [milestones, setMilestones] = useState<GoalMilestone[]>([])
  const [newMilestoneInput, setNewMilestoneInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialGoal) {
      setTitle(initialGoal.title)
      setDescription(initialGoal.description || '')
      setCategory(initialGoal.category)
      setTargetDate(initialGoal.target_date || '')
      setCurrentValue(initialGoal.current_value || 0)
      setTargetValue(initialGoal.target_value || 10)
      setUnit(initialGoal.unit || 'bước')
      setAltitudeMeters(initialGoal.altitude_meters || 2500)
      setIcon(initialGoal.icon || '🌟')
      setColor(initialGoal.color || '#38bdf8')
      setMilestones(initialGoal.milestones || [])
    } else {
      setTitle('')
      setDescription('')
      setCategory('GROWTH')
      setTargetDate('')
      setCurrentValue(0)
      setTargetValue(10)
      setUnit('bước')
      setAltitudeMeters(2500)
      setIcon('🌟')
      setColor('#38bdf8')
      setMilestones([
        { id: `m_${Date.now()}_1`, title: 'Bước 1: Lập kế hoạch hành động & chuẩn bị', completed: false },
        { id: `m_${Date.now()}_2`, title: 'Bước 2: Chinh phục 50% chặng đường', completed: false },
        { id: `m_${Date.now()}_3`, title: 'Bước 3: Về đích & tổng kết thành quả', completed: false },
      ])
    }
    setNewMilestoneInput('')
  }, [initialGoal, isOpen])

  if (!isOpen) return null

  const handleSelectCategory = (cat: typeof CATEGORY_OPTIONS[number]) => {
    setCategory(cat.id as GoalItem['category'])
    setIcon(cat.icon)
    setColor(cat.color)
    if (!initialGoal) {
      setAltitudeMeters(cat.defaultAlt)
    }
  }

  const handleAddMilestone = (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = newMilestoneInput.trim()
    if (!trimmed) return
    const newM: GoalMilestone = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: trimmed,
      completed: false,
    }
    setMilestones((prev) => [...prev, newM])
    setNewMilestoneInput('')
  }

  const handleRemoveMilestone = (mId: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== mId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      const selectedCatObj = CATEGORY_OPTIONS.find((c) => c.id === category)
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        category,
        category_label: selectedCatObj?.label || 'Mục tiêu',
        target_date: targetDate || null,
        current_value: Number(currentValue) || 0,
        target_value: Math.max(1, Number(targetValue) || 1),
        unit: unit.trim() || 'bước',
        milestones,
        status: (Number(currentValue) >= Number(targetValue)) ? 'COMPLETED' : (Number(currentValue) > 0 ? 'IN_PROGRESS' : 'NOT_STARTED'),
        altitude_meters: Number(altitudeMeters) || 1000,
        color,
        icon,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title={initialGoal ? '✏️ Chỉnh sửa Mục tiêu' : '☁️ Tạo Mục tiêu Lên Trời Mới'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Phân loại mục tiêu */}
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
            Phân loại & Tầng mây
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = category === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 12,
                    border: `1.5px solid ${isSelected ? cat.color : 'var(--card-border)'}`,
                    background: isSelected ? `${cat.color}22` : 'var(--card-bg)',
                    color: isSelected ? cat.color : 'var(--text-main)',
                    fontSize: '0.78rem',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                  <span style={{ textAlign: 'left', lineHeight: 1.2 }}>{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tên mục tiêu */}
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Tên mục tiêu *
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              style={{
                width: 48,
                textAlign: 'center',
                fontSize: '1.2rem',
                borderRadius: 12,
                border: '1px solid var(--card-border)',
                background: 'var(--bg-main)',
              }}
              title="Biểu tượng"
            />
            <input
              type="text"
              className="search-input"
              style={{ flex: 1 }}
              placeholder="VD: Đọc 20 cuốn sách, Tiết kiệm 100 triệu, Chạy bộ 21km..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Mô tả / Lý do */}
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Ý nghĩa & Lý do muốn chinh phục
          </label>
          <textarea
            className="search-input"
            rows={2}
            placeholder="Tại sao mục tiêu này quan trọng với bạn? Nó sẽ thay đổi cuộc sống bạn thế nào?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {/* Chỉ tiêu số lượng & Hạn chót */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Đã đạt
            </label>
            <input
              type="number"
              className="search-input"
              style={{ width: '100%' }}
              value={currentValue}
              onChange={(e) => setCurrentValue(Math.max(0, Number(e.target.value)))}
              min={0}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Mục tiêu đích
            </label>
            <input
              type="number"
              className="search-input"
              style={{ width: '100%' }}
              value={targetValue}
              onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value)))}
              min={1}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Đơn vị
            </label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              placeholder="VD: cuốn, km, triệu..."
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Hạn chót (Deadline)
            </label>
            <input
              type="date"
              className="search-input"
              style={{ width: '100%' }}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>

        {/* Độ cao leo trời (Altitude) */}
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span>🏔️ Độ cao bậc mây: <strong style={{ color: 'var(--primary)' }}>{altitudeMeters.toLocaleString()}m</strong></span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALTITUDE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setAltitudeMeters(p.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: '0.74rem',
                  fontWeight: altitudeMeters === p.value ? 800 : 500,
                  border: `1px solid ${altitudeMeters === p.value ? 'var(--primary)' : 'var(--card-border)'}`,
                  background: altitudeMeters === p.value ? 'var(--primary)' : 'var(--card-bg)',
                  color: altitudeMeters === p.value ? '#ffffff' : 'var(--text-main)',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bậc thang con (Milestones) */}
        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 14 }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Layers size={14} /> Các bậc thang con (Milestones từng bước leo lên trời)
          </label>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              className="search-input"
              style={{ flex: 1 }}
              placeholder="Thêm nấc thang con... (Enter)"
              value={newMilestoneInput}
              onChange={(e) => setNewMilestoneInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddMilestone()
                }
              }}
            />
            <button
              type="button"
              className="tv-btn primary"
              onClick={() => handleAddMilestone()}
              disabled={!newMilestoneInput.trim()}
              style={{ borderRadius: 10, padding: '0 14px' }}
            >
              <Plus size={16} /> Thêm nấc
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {milestones.map((m, idx) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  fontSize: '0.8rem',
                }}
              >
                <span>
                  <strong style={{ color: 'var(--text-muted)', marginRight: 6 }}>Bậc {idx + 1}:</strong>
                  {m.title}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveMilestone(m.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Nút lưu */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <button type="button" className="tv-btn" onClick={onClose} disabled={saving}>
            Đóng
          </button>
          <button type="submit" className="tv-btn primary" disabled={saving || !title.trim()}>
            {saving ? 'Đang lưu…' : initialGoal ? 'Cập nhật mục tiêu' : '🚀 Khởi tạo Hành Trình Lên Trời'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
